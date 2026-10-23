import io
from typing import List, Optional
import cv2
import numpy as np
from PIL import Image, ImageOps
from fastapi import APIRouter, HTTPException, UploadFile, File
from app.models.schemas import (
    GenerateRequest,
    GenerateResponse,
    ProcessSamplesResponse,
    ProcessedSampleItem,
    SegmentResponse,
    SegmentedLineItem,
    OriginalSize,
    OCRResponse,
    OCRLineItem,
    StyleProfileResponse,
)
from app.services.ai_service import ai_service
from app.services.preprocessing import preprocess_image, validate_image_file, ImageValidationError
from app.services.segmentation import segment_handwriting_lines
from app.services.ocr_service import get_ocr_service
from app.services.style_analysis_service import style_service

router = APIRouter()


@router.get("/health")
async def health_check():
    return {"status": "ok", "service": "WriteAI Backend"}


@router.post("/generate", response_model=GenerateResponse)
async def generate_text(payload: GenerateRequest):
    try:
        output = await ai_service.generate_content(
            prompt=payload.prompt,
            task_type=payload.task_type,
            tone=payload.tone,
        )
        return GenerateResponse(**output)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/samples/process", response_model=ProcessSamplesResponse)
async def process_samples(files: List[UploadFile] = File(...)):
    """
    Step 2 CV Pipeline:
    Validates and preprocesses uploaded handwriting sample images.
    Returns processed image previews (base64 data URLs) and dimensions.
    """
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files uploaded. Please select at least one handwriting image.")

    processed_samples: List[ProcessedSampleItem] = []

    for file in files:
        filename = file.filename or "unknown_sample"
        try:
            image_bytes = await file.read()
            processed_data = preprocess_image(image_bytes=image_bytes, filename=filename)
            processed_samples.append(ProcessedSampleItem(**processed_data))
        except ImageValidationError as ive:
            raise HTTPException(status_code=ive.status_code, detail=ive.message)
        except Exception as ex:
            raise HTTPException(
                status_code=500,
                detail=f"An error occurred while preprocessing '{filename}': {str(ex)}"
            )

    return ProcessSamplesResponse(success=True, samples=processed_samples)


@router.post("/samples/segment", response_model=SegmentResponse)
async def segment_sample(file: UploadFile = File(...)):
    """
    Step 3 CV Pipeline:
    Detects and extracts handwritten text lines from a full handwritten page image.
    Returns line count, bounding boxes, cropped line images, and an annotated preview.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded. Please upload a handwriting page image.")

    filename = file.filename or "handwritten_page"

    try:
        image_bytes = await file.read()
        orig_w, orig_h = validate_image_file(filename, image_bytes)

        # Decode image using Pillow with orientation normalization
        with Image.open(io.BytesIO(image_bytes)) as pil_img:
            pil_img = ImageOps.exif_transpose(pil_img)
            if pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
            cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        # Run line segmentation
        result = segment_handwriting_lines(cv_img)

        return SegmentResponse(
            success=result["success"],
            filename=filename,
            line_count=result["line_count"],
            original_size=OriginalSize(width=orig_w, height=orig_h),
            annotated_image=result.get("annotated_image"),
            lines=[SegmentedLineItem(**line) for line in result.get("lines", [])],
            message=result.get("message"),
            diagnostics=result.get("diagnostics"),
        )
    except ImageValidationError as ive:
        raise HTTPException(status_code=ive.status_code, detail=ive.message)
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while segmenting '{filename}': {str(ex)}"
        )


@router.get("/samples/ocr/status")
async def ocr_status():
    """
    Returns OCR service diagnostic information including model name,
    device (CPU/CUDA), and loading status.
    """
    try:
        from app.services.ocr_service import get_ocr_service
        service = get_ocr_service()
        return service.get_status()
    except Exception as e:
        return {"status": "error", "detail": str(e)}


def _sync_ocr_pipeline(cv_img: np.ndarray, filename: str, mode: str = "original") -> tuple:
    """
    Synchronous worker executed in FastAPI / Starlette threadpool:
    1. Keeps original uploaded image.
    2. Runs line segmentation algorithm to detect bounding boxes.
    3. Crops bounding boxes strictly from the ORIGINAL high-resolution image.
    4. Applies mild OCR-specific preprocessing (prepare_line_for_ocr).
    5. Feeds clean RGB crops to TrOCR with deterministic generation.
    """
    import time
    from app.services.segmentation import segment_handwriting_lines
    from app.services.ocr_service import get_ocr_service
    from app.models.schemas import OCRLineItem, BoundingBox

    # Step 3: Run existing line segmentation, ensuring crops are taken from the ORIGINAL image
    t_seg_start = time.time()
    seg_result = segment_handwriting_lines(cv_img, source_image_for_crops=cv_img)
    seg_elapsed = round(time.time() - t_seg_start, 2)
    line_count = seg_result.get("line_count", 0)
    print(f"[OCR] Segmentation complete in {seg_elapsed}s. Lines detected: {line_count}")

    if not seg_result.get("success") or not seg_result.get("lines"):
        return seg_result, [], ""

    # Step 4: Run TrOCR inference using singleton instance
    ocr_service = get_ocr_service()
    ocr_service.load_model()
    lines_data = seg_result.get("lines", [])
    total_lines = len(lines_data)
    active_mode = (mode or ocr_service.default_preprocessing_mode).lower().strip()

    # Diagnostic logging
    print(f"[OCR] OCR model: {ocr_service.model_name}")
    print(f"[OCR] Device: {ocr_service.device.upper()}")
    print(f"[OCR] Lines: {total_lines}")
    print(f"[OCR] Preprocessing mode: {active_mode}")

    ocr_lines: List[OCRLineItem] = []
    t_ocr_start = time.time()

    for idx_num, line in enumerate(lines_data, start=1):
        idx = line.get("index", idx_num)
        raw_bbox = line.get("bbox")
        bbox = BoundingBox(**raw_bbox) if raw_bbox and isinstance(raw_bbox, dict) else None
        line_img_url = line.get("image", "")

        line_text = ""
        if line_img_url:
            t0 = time.time()
            try:
                # Save first 5 lines to debug/ocr_inputs/ for inspection
                save_idx = idx_num if idx_num <= 5 else None
                line_text = ocr_service.recognize_line(
                    line_img_url,
                    mode=active_mode,
                    save_debug_idx=save_idx,
                )
                line_elapsed = round(time.time() - t0, 2)
                preview = (line_text[:35] + "...") if len(line_text) > 35 else line_text
                print(f"[OCR] Line {idx_num}/{total_lines} recognized ({line_elapsed}s): \"{preview}\"")
            except Exception as line_err:
                print(f"[OCR] Error recognizing line {idx_num}/{total_lines}: {line_err}")
                line_text = ""

        ocr_lines.append(OCRLineItem(
            index=idx,
            bbox=bbox,
            image=line_img_url,
            text=line_text,
        ))

    full_text = "\n".join(l.text for l in ocr_lines if l.text)
    total_elapsed = round(time.time() - t_ocr_start, 2)
    print(f"[OCR] Request completed in {total_elapsed}s. {len(ocr_lines)} lines transcribed.")
    return seg_result, ocr_lines, full_text


@router.post("/samples/ocr", response_model=OCRResponse)
async def recognize_sample_handwriting(
    file: UploadFile = File(...),
    mode: Optional[str] = "original",
):
    """
    Step 4 HTR/OCR Pipeline (Non-blocking):
    Executes line segmentation on original image and TrOCR inference with
    pluggable preprocessing modes ('original', 'enhanced', 'denoised').
    """
    import time
    from fastapi.concurrency import run_in_threadpool
    from app.services.ocr_service import get_ocr_service
    from app.models.schemas import OCRResponse, OriginalSize

    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded. Please upload a handwriting page image.")

    filename = file.filename or "handwritten_page"
    chosen_mode = mode if mode in ["original", "enhanced", "denoised"] else "original"

    try:
        req_start = time.time()
        image_bytes = await file.read()
        orig_w, orig_h = validate_image_file(filename, image_bytes)

        # Decode image using Pillow with orientation normalization
        with Image.open(io.BytesIO(image_bytes)) as pil_img:
            pil_img = ImageOps.exif_transpose(pil_img)
            if pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
            cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        # Run synchronous segmentation + TrOCR inside Starlette threadpool
        seg_result, ocr_lines, full_text = await run_in_threadpool(
            _sync_ocr_pipeline, cv_img, filename, chosen_mode
        )

        ocr_service = get_ocr_service()
        total_time = round(time.time() - req_start, 2)

        if not seg_result.get("success") or not ocr_lines:
            return OCRResponse(
                success=False,
                filename=filename,
                line_count=0,
                model=ocr_service.model_name,
                device=ocr_service.device.upper(),
                preprocessing_mode=chosen_mode,
                lines=[],
                full_text="",
                original_size=OriginalSize(width=orig_w, height=orig_h),
                annotated_image=seg_result.get("annotated_image"),
                message=seg_result.get("message", "No handwriting lines could be detected on the page."),
                inference_time_sec=total_time,
            )

        return OCRResponse(
            success=True,
            filename=filename,
            line_count=len(ocr_lines),
            model=ocr_service.model_name,
            device=ocr_service.device.upper(),
            preprocessing_mode=chosen_mode,
            lines=ocr_lines,
            full_text=full_text,
            original_size=OriginalSize(width=orig_w, height=orig_h),
            annotated_image=seg_result.get("annotated_image"),
            inference_time_sec=total_time,
        )

    except ImageValidationError as ive:
        raise HTTPException(status_code=ive.status_code, detail=ive.message)
    except Exception as ex:
        print(f"[OCR] Unexpected error processing '{filename}': {ex}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while recognizing handwriting in '{filename}': {str(ex)}"
        )


@router.post("/samples/style", response_model=StyleProfileResponse)
async def analyze_sample_style(file: UploadFile = File(...)):
    """
    Step 5 Handwriting Style Analysis (Non-blocking):
    Extracts measurable stylistic metrics from the original handwriting image:
    stroke thickness, line height, line spacing, horizontal spacing, slant angle,
    ink density, ink coverage, and dominant ink color.
    """
    from fastapi.concurrency import run_in_threadpool

    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded. Please upload a handwriting page image.")

    filename = file.filename or "handwritten_page"

    try:
        image_bytes = await file.read()
        orig_w, orig_h = validate_image_file(filename, image_bytes)

        # Decode image using Pillow with orientation normalization (preserving original color)
        with Image.open(io.BytesIO(image_bytes)) as pil_img:
            pil_img = ImageOps.exif_transpose(pil_img)
            if pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
            cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        # Run non-blocking computer vision analysis inside Starlette threadpool
        profile = await run_in_threadpool(style_service.analyze_style, cv_img, filename)
        return profile

    except ImageValidationError as ive:
        raise HTTPException(status_code=ive.status_code, detail=ive.message)
    except Exception as ex:
        print(f"[StyleAnalysis] Unexpected error processing '{filename}': {ex}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while analyzing handwriting style in '{filename}': {str(ex)}"
        )
