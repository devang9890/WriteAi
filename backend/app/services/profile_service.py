"""
Step 7: Personalized Handwriting Style Profile Service
=======================================================

This module builds, aggregates, persists, and retrieves a unified handwriting
style profile from one or multiple uploaded handwriting samples.

Core Architecture:
------------------
1. Aggregates Physical Metrics (from Step 5 Style Analysis):
   - Stroke width (px)
   - Median line height (px)
   - Median line spacing (px)
   - Baseline slant angle (deg)
   - Ink density (ratio)
   - Page ink coverage (%)
   - Estimated word/character gap (px)
   - Dominant ink color & hex swatch

2. Aggregates Deep Visual Representation (from Step 6 CNN Feature Extractor):
   - Individual 512-D L2-normalized feature vectors from ResNet-18
   - Mean feature pooling across valid pages followed by L2-renormalization
   - Per-sample cosine similarity against the unified style profile

3. File-Based Atomic JSON Persistence:
   - Stores profiles under backend/data/profiles/{profile_id}.json
   - Zero external database dependencies (lightweight, portable, transparent)
   - Full history of timestamps (created_at, updated_at)

Scientific Correctness:
-----------------------
- Represents an empirical visual style profile.
- Explicitly documents that ImageNet-pretrained ResNet-18 features are not a fine-tuned
  writer-biometric model and do not constitute handwriting synthesis (Step 8+).
"""

import os
import json
import time
import datetime
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import torch

from app.services.style_analysis_service import style_service
from app.services.style_encoder import get_style_encoder_service
from app.models.schemas import (
    MetricValue,
    DominantInkColor,
    AggregatedMetrics,
    SampleComparisonItem,
    PersonalizedProfileResponse,
)

# Persistent storage directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROFILES_DIR = os.path.join(BASE_DIR, "data", "profiles")


class ProfileService:
    """
    Manages building, updating, persisting, and retrieving personalized
    handwriting style profiles.
    """

    def __init__(self, storage_dir: str = PROFILES_DIR):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)
        self.style_service = style_service
        self.encoder_service = get_style_encoder_service()

    def _get_profile_path(self, profile_id: str) -> str:
        safe_id = "".join(c for c in profile_id if c.isalnum() or c in ("-", "_")).strip()
        if not safe_id:
            safe_id = "default_profile"
        return os.path.join(self.storage_dir, f"{safe_id}.json")

    def get_saved_profile(self, profile_id: str = "default_profile") -> Optional[PersonalizedProfileResponse]:
        """Loads a previously saved profile from JSON storage if it exists."""
        path = self._get_profile_path(profile_id)
        if not os.path.exists(path):
            return None

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return PersonalizedProfileResponse(**data)
        except Exception as ex:
            print(f"[ProfileService] Error reading saved profile '{profile_id}': {ex}")
            return None

    def save_profile_to_disk(self, profile: PersonalizedProfileResponse) -> bool:
        """Atomically saves a profile response to persistent JSON storage."""
        path = self._get_profile_path(profile.profile_id)
        tmp_path = f"{path}.tmp"
        try:
            payload = profile.model_dump()
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
            os.replace(tmp_path, path)
            print(f"[ProfileService] Profile '{profile.profile_id}' saved successfully to {path}")
            return True
        except Exception as ex:
            print(f"[ProfileService] Failed to save profile to disk: {ex}")
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            return False

    def delete_saved_profile(self, profile_id: str = "default_profile") -> bool:
        """Deletes a saved profile from storage."""
        path = self._get_profile_path(profile_id)
        if os.path.exists(path):
            try:
                os.remove(path)
                return True
            except OSError as ex:
                print(f"[ProfileService] Error deleting profile '{profile_id}': {ex}")
                return False
        return False

    def build_personalized_profile(
        self,
        samples: List[Tuple[str, np.ndarray]],
        profile_id: str = "default_profile",
        profile_name: str = "Personal Handwriting Profile",
    ) -> PersonalizedProfileResponse:
        """
        Extracts metrics and CNN embeddings from all provided samples,
        calculates multi-sample median statistics and pooled embeddings,
        computes sample-to-profile similarities, and persists the result.
        """
        t_start = time.time()
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Check existing profile for created_at preservation
        existing = self.get_saved_profile(profile_id)
        created_at = existing.created_at if existing and existing.created_at else now_iso

        if not samples:
            return PersonalizedProfileResponse(
                success=False,
                profile_id=profile_id,
                profile_name=profile_name,
                status="empty",
                created_at=created_at,
                updated_at=now_iso,
                total_samples_analyzed=0,
                valid_sample_count=0,
                message="No handwriting samples provided to build a profile.",
            )

        valid_sample_vectors: List[torch.Tensor] = []
        valid_sample_filenames: List[str] = []
        sample_comparisons: List[SampleComparisonItem] = []

        # Containers for aggregating physical metrics across valid samples
        stroke_thicknesses: List[float] = []
        line_heights: List[float] = []
        line_spacings: List[float] = []
        slant_angles: List[float] = []
        ink_densities: List[float] = []
        coverages: List[float] = []
        horizontal_spacings: List[float] = []
        dominant_colors: List[DominantInkColor] = []

        # 1. Process each sample through style analysis and CNN encoder
        for filename, cv_bgr in samples:
            try:
                H, W = cv_bgr.shape[:2]
                if H < 30 or W < 30:
                    sample_comparisons.append(
                        SampleComparisonItem(
                            filename=filename,
                            success=False,
                            message=f"Image resolution too small ({W}x{H}).",
                        )
                    )
                    continue

                # Run Step 5 Style Analysis
                style_res = self.style_service.analyze_style(cv_bgr, filename=filename)
                if not style_res.success or not style_res.metrics:
                    sample_comparisons.append(
                        SampleComparisonItem(
                            filename=filename,
                            success=False,
                            message=style_res.message or "No detectable handwriting ink on page.",
                        )
                    )
                    continue

                # Run Step 6 CNN Feature Extractor
                vec, enc_item = self.encoder_service.extract_single_embedding(cv_bgr, filename=filename)
                if vec is None or not enc_item.success:
                    sample_comparisons.append(
                        SampleComparisonItem(
                            filename=filename,
                            success=False,
                            message=enc_item.message or "CNN feature extraction failed.",
                        )
                    )
                    continue

                # Collect valid measurements
                m = style_res.metrics
                s_thick = m.stroke_thickness.value
                l_h = m.line_height.value
                l_sp = m.line_spacing.value
                s_slant = m.slant_angle.value
                i_dens = m.ink_density.value
                i_cov = m.ink_coverage_pct.value
                h_gap = m.horizontal_spacing.value

                if s_thick is not None:
                    stroke_thicknesses.append(s_thick)
                if l_h is not None:
                    line_heights.append(l_h)
                if l_sp is not None:
                    line_spacings.append(l_sp)
                if s_slant is not None:
                    slant_angles.append(s_slant)
                if i_dens is not None:
                    ink_densities.append(i_dens)
                if i_cov is not None:
                    coverages.append(i_cov)
                if h_gap is not None:
                    horizontal_spacings.append(h_gap)
                if style_res.dominant_color:
                    dominant_colors.append(style_res.dominant_color)

                valid_sample_vectors.append(vec)
                valid_sample_filenames.append(filename)

                # Interim item (similarity populated after pooled embedding is calculated)
                sample_comparisons.append(
                    SampleComparisonItem(
                        filename=filename,
                        success=True,
                        stroke_thickness_px=s_thick,
                        line_height_px=l_h,
                        line_spacing_px=l_sp,
                        slant_angle_deg=s_slant,
                        ink_density_ratio=i_dens,
                        coverage_pct=i_cov,
                        horizontal_spacing_px=h_gap,
                        dominant_color_hex=style_res.dominant_color.hex if style_res.dominant_color else None,
                        dominant_color_name=style_res.dominant_color.color_name if style_res.dominant_color else None,
                        message="Analyzed successfully.",
                    )
                )

            except Exception as e:
                sample_comparisons.append(
                    SampleComparisonItem(
                        filename=filename,
                        success=False,
                        message=f"Error analyzing sample: {str(e)}",
                    )
                )

        valid_count = len(valid_sample_vectors)
        if valid_count == 0:
            elapsed = round(time.time() - t_start, 2)
            res = PersonalizedProfileResponse(
                success=False,
                profile_id=profile_id,
                profile_name=profile_name,
                status="error",
                created_at=created_at,
                updated_at=now_iso,
                total_samples_analyzed=len(samples),
                valid_sample_count=0,
                valid_samples_count=0,
                sample_comparisons=sample_comparisons,
                processing_time_sec=elapsed,
                message="None of the uploaded handwriting samples could be validated or analyzed.",
            )
            return res

        # 2. Compute Aggregated 512-D Embedding
        if valid_count == 1:
            agg_vec = valid_sample_vectors[0]
            agg_method = "Single Sample Profiling (No Multi-Page Aggregation)"
        else:
            stacked = torch.stack(valid_sample_vectors, dim=0)  # Shape: (N, 512)
            mean_vec = torch.mean(stacked, dim=0)
            norm = torch.linalg.norm(mean_vec)
            agg_vec = mean_vec / max(norm.item(), 1e-7)
            agg_method = f"Median Metric Aggregation + L2-Normalized Mean Embedding ({valid_count} samples)"

        agg_embedding_list = [round(float(v), 6) for v in agg_vec.tolist()]
        preview_list = [round(float(v), 5) for v in agg_vec[:16].tolist()]

        # 3. Calculate Cosine Similarities (Individual sample vs. Aggregated profile)
        for comp_item in sample_comparisons:
            if comp_item.success and comp_item.filename in valid_sample_filenames:
                idx = valid_sample_filenames.index(comp_item.filename)
                sample_vec = valid_sample_vectors[idx]
                cos_sim = float(torch.dot(sample_vec, agg_vec).item())
                # Bound to [0.0, 1.0]
                cos_sim = max(0.0, min(1.0, cos_sim))
                comp_item.similarity_to_profile = round(cos_sim, 4)
                comp_item.cosine_similarity = round(cos_sim, 4)

        # 4. Aggregate Numerical Metrics (Medians across valid samples)
        med_stroke = float(np.median(stroke_thicknesses)) if stroke_thicknesses else None
        med_height = float(np.median(line_heights)) if line_heights else None
        med_spacing = float(np.median(line_spacings)) if line_spacings else None
        med_slant = float(np.median(slant_angles)) if slant_angles else 0.0
        med_density = float(np.median(ink_densities)) if ink_densities else None
        med_cov = float(np.median(coverages)) if coverages else None
        med_h_gap = float(np.median(horizontal_spacings)) if horizontal_spacings else None

        aggregated_metrics = AggregatedMetrics(
            stroke_thickness=MetricValue(
                value=round(med_stroke, 2) if med_stroke is not None else None,
                unit="px",
                is_heuristic=False,
                status="measured" if med_stroke is not None else "unavailable",
                confidence="high",
                description="Aggregated median stroke thickness across analyzed samples",
            ),
            line_height=MetricValue(
                value=round(med_height, 1) if med_height is not None else None,
                unit="px",
                is_heuristic=False,
                status="measured" if med_height is not None else "unavailable",
                confidence="high",
                description="Aggregated median text line height across analyzed samples",
            ),
            line_spacing=MetricValue(
                value=round(med_spacing, 1) if med_spacing is not None else None,
                unit="px",
                is_heuristic=False,
                status="measured" if med_spacing is not None else "unavailable",
                confidence="high",
                description="Aggregated median vertical distance between successive baselines",
            ),
            horizontal_spacing=MetricValue(
                value=round(med_h_gap, 1) if med_h_gap is not None else None,
                unit="px",
                is_heuristic=True,
                status="heuristic" if med_h_gap is not None else "unavailable",
                confidence="medium",
                description="Aggregated median word/character separation gap estimate",
            ),
            slant_angle=MetricValue(
                value=round(med_slant, 2),
                unit="deg",
                is_heuristic=False,
                status="measured",
                confidence="high",
                description="Aggregated median baseline slant angle relative to horizontal",
            ),
            ink_density=MetricValue(
                value=round(med_density, 3) if med_density is not None else None,
                unit="ratio",
                is_heuristic=False,
                status="measured" if med_density is not None else "unavailable",
                confidence="high",
                description="Aggregated median foreground ink density within text lines",
            ),
            ink_coverage_pct=MetricValue(
                value=round(med_cov, 2) if med_cov is not None else None,
                unit="%",
                is_heuristic=False,
                status="measured" if med_cov is not None else "unavailable",
                confidence="high",
                description="Aggregated median page coverage percentage of ink strokes",
            ),
        )

        # 5. Determine Primary Dominant Ink Color
        if dominant_colors:
            # Pick color from dominant_colors with highest reliability
            reliable = [c for c in dominant_colors if c.is_reliable]
            primary_color = reliable[0] if reliable else dominant_colors[0]
        else:
            primary_color = DominantInkColor(
                rgb=None,
                hex=None,
                color_name="Unknown",
                is_reliable=False,
                confidence="unavailable",
            )

        # 6. Natural Language Summary
        summary = self._generate_profile_summary(
            thickness_px=med_stroke,
            slant_deg=med_slant,
            line_spacing_px=med_spacing,
            line_height_px=med_height,
            density_ratio=med_density,
            color_name=primary_color.color_name,
            valid_samples_count=valid_count,
        )

        elapsed = round(time.time() - t_start, 2)

        profile_response = PersonalizedProfileResponse(
            success=True,
            profile_id=profile_id,
            profile_name=profile_name,
            status="ready",
            created_at=created_at,
            updated_at=now_iso,
            total_samples_analyzed=len(samples),
            valid_sample_count=valid_count,
            valid_samples_count=valid_count,
            embedding_dim=512,
            embedding=agg_embedding_list,
            preview_values=preview_list,
            aggregated_metrics=aggregated_metrics,
            dominant_color=primary_color,
            summary=summary,
            sample_comparisons=sample_comparisons,
            aggregation_method=agg_method,
            processing_time_sec=elapsed,
            message="Personalized handwriting style profile constructed and persisted successfully.",
        )

        # Save to disk
        self.save_profile_to_disk(profile_response)

        return profile_response

    def _generate_profile_summary(
        self,
        thickness_px: Optional[float],
        slant_deg: float,
        line_spacing_px: Optional[float],
        line_height_px: Optional[float],
        density_ratio: Optional[float],
        color_name: Optional[str],
        valid_samples_count: int,
    ) -> Dict[str, Any]:
        """Generates clear, readable overview tags for the aggregated profile."""
        # Weight
        if thickness_px is None:
            weight = "Medium Stroke"
        elif thickness_px < 2.5:
            weight = "Fine / Light Nib"
        elif thickness_px <= 4.2:
            weight = "Medium Ballpoint"
        else:
            weight = "Bold / Gel Pen"

        # Slant
        if abs(slant_deg) < 1.0:
            slant = "Level / Upright Baseline"
        elif slant_deg > 1.0:
            slant = f"Ascending Slant (+{slant_deg:.1f}°)"
        else:
            slant = f"Descending Slant ({slant_deg:.1f}°)"

        # Spacing
        if line_spacing_px is not None and line_height_px is not None and line_height_px > 0:
            ratio = line_spacing_px / line_height_px
            if ratio < 0.95:
                spacing = "Compact Spacing"
            elif ratio <= 1.4:
                spacing = "Balanced Line Spacing"
            else:
                spacing = "Relaxed / Spacious"
        else:
            spacing = "Standard Spacing"

        # Density
        if density_ratio is not None:
            if density_ratio < 0.12:
                density = "Airy / Light"
            elif density_ratio <= 0.25:
                density = "Consistent Density"
            else:
                density = "Dense & Compact"
        else:
            density = "Balanced Density"

        headline = (
            f"{weight} with {slant} and {spacing}, "
            f"measured across {valid_samples_count} sample page{'s' if valid_samples_count > 1 else ''}."
        )

        return {
            "headline": headline,
            "weight_label": weight,
            "slant_label": slant,
            "spacing_label": spacing,
            "density_label": density,
            "ink_label": color_name or "Dark Ink",
        }


# Singleton instance
profile_service = ProfileService()


def get_profile_service() -> ProfileService:
    """Returns the singleton instance of ProfileService."""
    return profile_service
