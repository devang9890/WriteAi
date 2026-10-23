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


# =============================================================================
# Step 5: Handwriting Style Analysis Schemas
# =============================================================================

class MetricValue(BaseModel):
    value: Optional[float] = None
    unit: str
    is_heuristic: bool = False
    status: str = "measured"  # "measured" | "heuristic" | "unavailable"
    confidence: str = "high"  # "high" | "medium" | "low" | "unavailable"
    description: str


class DominantInkColor(BaseModel):
    rgb: Optional[List[int]] = None  # [R, G, B]
    hex: Optional[str] = None        # e.g., "#1c2b4d"
    color_name: Optional[str] = None # e.g., "Dark Blue / Navy", "Black / Charcoal"
    is_reliable: bool = True
    confidence: str = "high"


class StyleMetrics(BaseModel):
    stroke_thickness: MetricValue
    line_height: MetricValue
    line_spacing: MetricValue
    horizontal_spacing: MetricValue
    slant_angle: MetricValue
    ink_density: MetricValue
    ink_coverage_pct: MetricValue


class StyleProfileResponse(BaseModel):
    success: bool
    filename: str
    original_size: Optional[OriginalSize] = None
    line_count_detected: int = 0
    metrics: Optional[StyleMetrics] = None
    dominant_color: Optional[DominantInkColor] = None
    summary: Optional[Dict[str, Any]] = None
    annotated_sample: Optional[str] = None
    message: Optional[str] = None
    analysis_time_sec: Optional[float] = None


# =============================================================================
# Step 6: CNN-Based Handwriting Style Encoder Schemas
# =============================================================================

class SampleEncoderItem(BaseModel):
    filename: str
    success: bool
    embedding_dim: int = 512
    l2_norm: Optional[float] = None
    preview_values: Optional[List[float]] = []
    message: Optional[str] = None


class EmbeddingStatistics(BaseModel):
    min: float
    max: float
    mean: float
    std: float
    l2_norm: float
    active_features_count: int


class StyleEncoderResponse(BaseModel):
    success: bool
    model_name: str
    model_source: str
    is_pretrained: bool
    embedding_dim: int = 512
    embedding: List[float] = []
    preview_values: List[float] = []
    statistics: Optional[EmbeddingStatistics] = None
    total_samples_received: int = 0
    successful_samples: int = 0
    sample_details: List[SampleEncoderItem] = []
    aggregation_method: str = "L2-Normalized Mean Feature Pooling"
    processing_time_sec: Optional[float] = None
    warnings: List[str] = []
    ml_limitations_notice: str = (
        "Baseline representation uses generic visual features extracted by a pretrained "
        "ResNet-18 backbone (ImageNet). This is frozen visual feature extraction and has not "
        "been fine-tuned for writer-identification or personal handwriting generation."
    )
    message: Optional[str] = None


# =============================================================================
# Step 7: Personalized Handwriting Style Profile Schemas
# =============================================================================

class AggregatedMetrics(BaseModel):
    stroke_thickness: MetricValue
    line_height: MetricValue
    line_spacing: MetricValue
    horizontal_spacing: MetricValue
    slant_angle: MetricValue
    ink_density: MetricValue
    ink_coverage_pct: MetricValue


class SampleComparisonItem(BaseModel):
    filename: str
    success: bool
    stroke_thickness_px: Optional[float] = None
    line_height_px: Optional[float] = None
    line_spacing_px: Optional[float] = None
    slant_angle_deg: Optional[float] = None
    ink_density_ratio: Optional[float] = None
    coverage_pct: Optional[float] = None
    horizontal_spacing_px: Optional[float] = None
    dominant_color_hex: Optional[str] = None
    dominant_color_name: Optional[str] = None
    similarity_to_profile: Optional[float] = None  # Cosine similarity to aggregated 512-D embedding (0.0 - 1.0)
    cosine_similarity: Optional[float] = None
    message: Optional[str] = None


class PersonalizedProfileResponse(BaseModel):
    success: bool
    profile_id: str = "default_profile"
    profile_name: str = "Personal Handwriting Profile"
    status: str = "ready"  # "ready" | "empty" | "processing" | "error"
    created_at: str
    updated_at: str
    total_samples_analyzed: int = 0
    valid_sample_count: int = 0
    valid_samples_count: Optional[int] = 0
    embedding_dim: int = 512
    embedding: List[float] = []
    preview_values: List[float] = []
    aggregated_metrics: Optional[AggregatedMetrics] = None
    dominant_color: Optional[DominantInkColor] = None
    summary: Optional[Dict[str, Any]] = None
    sample_comparisons: List[SampleComparisonItem] = []
    aggregation_method: str = "Median Metric Aggregation + L2-Normalized Mean Embedding"
    processing_time_sec: Optional[float] = None
    ml_limitations_notice: str = (
        "This profile mathematically combines measured image statistics (OpenCV/NumPy) and "
        "generic visual features from a pretrained ResNet-18 backbone. It represents an empirical "
        "handwriting style descriptor, but does not constitute a fine-tuned biometric writer identity "
        "or a handwriting generation model."
    )
    message: Optional[str] = None
