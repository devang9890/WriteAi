from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


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


class OriginalSize(BaseModel):
    width: int
    height: int


class ProcessedSampleItem(BaseModel):
    filename: str
    original_size: OriginalSize
    processed_image: str


class ProcessSamplesResponse(BaseModel):
    success: bool
    samples: List[ProcessedSampleItem]


class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int


class SegmentedLineItem(BaseModel):
    index: int
    bbox: BoundingBox
    image: str
    quality: Optional[Dict[str, Any]] = None


class SegmentResponse(BaseModel):
    success: bool
    filename: str
    line_count: int
    lines: List[SegmentedLineItem] = []
    original_size: Optional[OriginalSize] = None
    annotated_image: Optional[str] = None
    message: Optional[str] = None
    diagnostics: Optional[Dict[str, Any]] = None


class OCRLineItem(BaseModel):
    index: int
    bbox: Optional[BoundingBox] = None
    image: Optional[str] = None
    text: str


class OCRResponse(BaseModel):
    success: bool
    filename: str
    line_count: int
    model: str
    device: str
    preprocessing_mode: Optional[str] = "original"
    lines: List[OCRLineItem] = []
    full_text: str
    original_size: Optional[OriginalSize] = None
    annotated_image: Optional[str] = None
    message: Optional[str] = None
    inference_time_sec: Optional[float] = None

