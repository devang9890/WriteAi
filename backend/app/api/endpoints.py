import io
from typing import List
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
)
from app.services.ai_service import ai_service
from app.services.preprocessing import preprocess_image, validate_image_file, ImageValidationError
from app.services.segmentation import segment_handwriting_lines

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
