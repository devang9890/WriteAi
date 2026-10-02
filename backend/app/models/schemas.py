from pydantic import BaseModel, Field
from typing import Optional, List


class GenerateRequest(BaseModel):
    prompt: str = Field(..., description="User prompt or draft text to improve/generate")
    task_type: Optional[str] = Field("generate", description="Task type: generate, summarize, paraphrase, tone_change, grammar")
    tone: Optional[str] = Field("professional", description="Desired tone: professional, casual, academic, creative, concise")
    max_length: Optional[int] = Field(500, description="Max token / length constraint")


class GenerateResponse(BaseModel):
    result: str
    task_type: str
    tone: str
    suggestions: Optional[List[str]] = []
