from fastapi import APIRouter, HTTPException
from app.models.schemas import GenerateRequest, GenerateResponse
from app.services.ai_service import ai_service

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
