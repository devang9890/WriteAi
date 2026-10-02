from typing import List
from fastapi import APIRouter, HTTPException, UploadFile, File
from app.models.schemas import (
    GenerateRequest,
    GenerateResponse,
    ProcessSamplesResponse,
    ProcessedSampleItem,
)
from app.services.ai_service import ai_service
from app.services.preprocessing import preprocess_image, ImageValidationError

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
