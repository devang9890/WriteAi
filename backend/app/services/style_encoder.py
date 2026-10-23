"""
Step 6: CNN-Based Handwriting Style Encoder Service
===================================================

This module implements a deep learning feature extractor for handwriting samples
using a Convolutional Neural Network (ResNet-18) backbone.

Key Computer Vision Concepts:
-----------------------------
1. Convolution (Conv2D Layers):
   Sliding spatial filters scan the handwriting image to detect primitive visual
   elements (edges, stroke curvature, ink junctions, pen slant, and stroke loops).
   Early layers capture fine line details, while deeper layers detect complex
   topological handwriting patterns.

2. Feature Maps (Activation Volumes):
   Intermediate 3D tensors (Channels x Height x Width) representing where and how
   strongly specific handwriting stroke features activate across the page.

3. Global Average Pooling (GAP):
   Collapses spatial dimensions (e.g., 7x7 spatial grid) into a single 512-dimensional
   vector by calculating the spatial average of each feature map. This makes the
   resulting style representation invariant to the exact position of words on the page.

4. Style Embedding:
   A fixed-length 512-dimensional numerical vector summarizing the visual texture,
   stroke distribution, and line characteristics of the handwriting sample.

Machine Learning Distinction & Honest Limitations:
--------------------------------------------------
- What this IS: A generic deep visual feature extractor using a pretrained ResNet-18
  backbone. It maps visual stroke textures into a compact, continuous 512-D space.
- What this is NOT: It is NOT yet a fine-tuned writer-identification model. The ImageNet
  weights were trained on natural objects, not specifically for distinguishing human
  handwriting identities.
- What future Step 7+ requires: Writer-specific metric learning (triplet/contrastive loss)
  trained on diverse multi-writer handwriting datasets (such as IAM or CVL) and conditioning
  a generative diffusion/autoregressive engine.
"""

import time
import math
from typing import List, Tuple, Dict, Any, Optional
import cv2
import numpy as np
import torch
import torch.nn as nn
from torchvision import transforms
from torchvision.models import resnet18, ResNet18_Weights

from app.models.schemas import (
    StyleEncoderResponse,
    SampleEncoderItem,
    EmbeddingStatistics,
)


class StyleEncoderService:
    """
    Singleton service that wraps a frozen ResNet-18 feature extractor
    for encoding handwriting samples into 512-dimensional visual embeddings.
    """

    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model: Optional[nn.Module] = None
        self.is_pretrained = False
        self.model_name = "ResNet-18 (ImageNet Pretrained)"
        self.model_source = "torchvision.models.resnet18"
        self._is_loaded = False

        # Standard ImageNet normalization pipeline expected by torchvision ResNet
        self.transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize(256, interpolation=transforms.InterpolationMode.BILINEAR),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])

    def load_model(self) -> None:
        """Loads ResNet-18 once into memory and replaces fc with Identity."""
        if self._is_loaded and self.model is not None:
            return

        try:
            # Attempt to load pretrained ImageNet weights
            weights = ResNet18_Weights.DEFAULT
            base_model = resnet18(weights=weights)
            self.is_pretrained = True
            print(f"[StyleEncoder] Loaded pretrained ResNet-18 weights successfully on {self.device}.")
        except Exception as e:
            print(f"[StyleEncoder] Pretrained weights could not be loaded ({e}). Falling back to untrained architecture.")
            base_model = resnet18(weights=None)
            self.is_pretrained = False
            self.model_name = "ResNet-18 (Untrained Random Fallback)"

        # Strip classification head (fc layer) -> output is 512-D GAP vector
        base_model.fc = nn.Identity()
        base_model.to(self.device)
        base_model.eval()

        self.model = base_model
        self._is_loaded = True

    def extract_single_embedding(
        self, cv_bgr: np.ndarray, filename: str = "sample"
    ) -> Tuple[Optional[torch.Tensor], SampleEncoderItem]:
        """
        Extracts a normalized 512-D embedding from a single validated handwriting image.
        Uses original un-thresholded color image to preserve stroke gradations.
        """
        self.load_model()
        H, W = cv_bgr.shape[:2]

        # 1. Validation checks on individual sample
        if H < 30 or W < 30:
            return None, SampleEncoderItem(
                filename=filename,
                success=False,
                embedding_dim=512,
                message=f"Sample resolution ({W}x{H}) is too small for feature extraction.",
            )

        # 2. Check for blank or empty content
        gray = cv2.cvtColor(cv_bgr, cv2.COLOR_BGR2GRAY)
        bg = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25)))
        diff = cv2.subtract(bg, gray)
        ink_pixels = int(np.count_nonzero(diff > 15))

        if ink_pixels < 60:
            return None, SampleEncoderItem(
                filename=filename,
                success=False,
                embedding_dim=512,
                message="Sample appears blank or contains insufficient handwriting ink strokes.",
            )

        # 3. Preprocess image preserving visual stroke dynamics
        # Convert BGR to RGB
        rgb_img = cv2.cvtColor(cv_bgr, cv2.COLOR_BGR2RGB)
        tensor_input = self.transform(rgb_img).unsqueeze(0).to(self.device)

        # 4. Forward inference under inference_mode (no gradients)
        with torch.inference_mode():
            raw_features = self.model(tensor_input)  # Shape: (1, 512)

        # Validate finiteness
        if not torch.isfinite(raw_features).all():
            return None, SampleEncoderItem(
                filename=filename,
                success=False,
                embedding_dim=512,
                message="Encoder produced non-finite (NaN or Inf) feature activations.",
            )

        # Flatten to 1D vector (512)
        vec = raw_features.squeeze(0).cpu()

        # Compute L2 norm and normalize
        norm_val = float(torch.linalg.norm(vec).item())
        if norm_val > 1e-7:
            normalized_vec = vec / norm_val
        else:
            normalized_vec = vec

        # Preview values (first 16 components)
        preview = [round(float(v), 5) for v in normalized_vec[:16].tolist()]

        item = SampleEncoderItem(
            filename=filename,
            success=True,
            embedding_dim=512,
            l2_norm=round(norm_val, 4),
            preview_values=preview,
            message="Feature extraction successful.",
        )

        return normalized_vec, item

    def extract_style_profile(
        self, samples: List[Tuple[str, np.ndarray]]
    ) -> StyleEncoderResponse:
        """
        Extracts CNN feature representations across one or multiple handwriting samples,
        and aggregates them via normalized mean feature pooling.
        """
        t_start = time.time()
        self.load_model()

        if not samples:
            return StyleEncoderResponse(
                success=False,
                model_name=self.model_name,
                model_source=self.model_source,
                is_pretrained=self.is_pretrained,
                embedding_dim=512,
                embedding=[],
                preview_values=[],
                total_samples_received=0,
                successful_samples=0,
                sample_details=[],
                message="No handwriting image samples were provided for style encoding.",
            )

        valid_vectors: List[torch.Tensor] = []
        sample_details: List[SampleEncoderItem] = []
        warnings: List[str] = []

        if not self.is_pretrained:
            warnings.append(
                "Notice: Pretrained ImageNet weights could not be loaded. Features were generated "
                "by an untrained random ResNet-18 baseline and should not be used as learned features."
            )

        # Extract features for each uploaded sample
        for filename, cv_bgr in samples:
            try:
                vec, detail = self.extract_single_embedding(cv_bgr, filename=filename)
                sample_details.append(detail)
                if vec is not None and detail.success:
                    valid_vectors.append(vec)
            except Exception as e:
                sample_details.append(
                    SampleEncoderItem(
                        filename=filename,
                        success=False,
                        embedding_dim=512,
                        message=f"Extraction failed: {str(e)}",
                    )
                )

        if not valid_vectors:
            elapsed = round(time.time() - t_start, 2)
            return StyleEncoderResponse(
                success=False,
                model_name=self.model_name,
                model_source=self.model_source,
                is_pretrained=self.is_pretrained,
                embedding_dim=512,
                embedding=[],
                preview_values=[],
                total_samples_received=len(samples),
                successful_samples=0,
                sample_details=sample_details,
                processing_time_sec=elapsed,
                warnings=warnings,
                message="None of the uploaded samples contained sufficient valid handwriting to extract features.",
            )

        # Aggregate multiple sample vectors using Normalized Mean Feature Pooling
        if len(valid_vectors) == 1:
            aggregate_tensor = valid_vectors[0]
            agg_method = "Single Sample Extraction (No aggregation)"
        else:
            stacked = torch.stack(valid_vectors, dim=0)  # (N, 512)
            mean_vec = torch.mean(stacked, dim=0)
            norm = torch.linalg.norm(mean_vec)
            aggregate_tensor = mean_vec / max(norm.item(), 1e-7)
            agg_method = f"L2-Normalized Mean Feature Pooling ({len(valid_vectors)} samples combined)"

        embedding_list = [round(float(v), 6) for v in aggregate_tensor.tolist()]
        preview_list = [round(float(v), 5) for v in aggregate_tensor[:16].tolist()]

        # Compute summary statistics on the embedding vector
        stats_arr = np.array(embedding_list)
        active_count = int(np.count_nonzero(np.abs(stats_arr) > 0.001))

        stats = EmbeddingStatistics(
            min=round(float(np.min(stats_arr)), 5),
            max=round(float(np.max(stats_arr)), 5),
            mean=round(float(np.mean(stats_arr)), 5),
            std=round(float(np.std(stats_arr)), 5),
            l2_norm=round(float(np.linalg.norm(stats_arr)), 4),
            active_features_count=active_count,
        )

        elapsed = round(time.time() - t_start, 2)

        return StyleEncoderResponse(
            success=True,
            model_name=self.model_name,
            model_source=self.model_source,
            is_pretrained=self.is_pretrained,
            embedding_dim=512,
            embedding=embedding_list,
            preview_values=preview_list,
            statistics=stats,
            total_samples_received=len(samples),
            successful_samples=len(valid_vectors),
            sample_details=sample_details,
            aggregation_method=agg_method,
            processing_time_sec=elapsed,
            warnings=warnings,
            message="Handwriting CNN style embedding generated successfully.",
        )


# Singleton instance
style_encoder_service = StyleEncoderService()


def get_style_encoder_service() -> StyleEncoderService:
    """Returns the singleton instance of StyleEncoderService."""
    return style_encoder_service
