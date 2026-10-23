import io
import time
import base64
from typing import Dict, Any, List, Optional, Tuple
import cv2
import numpy as np
from PIL import Image

from app.services.segmentation import segment_handwriting_lines
from app.models.schemas import (
    MetricValue,
    DominantInkColor,
    StyleMetrics,
    StyleProfileResponse,
    OriginalSize,
)


class StyleAnalysisService:
    """
    Step 5 Computer Vision Style Analysis Service:
    Analyzes high-resolution handwriting sample images to produce a measurable
    stylistic profile without artificial heuristic guessing or deep neural networks.

    Measurements:
    1. Stroke Thickness (px): Distance transform ridge analysis on core ink skeleton.
    2. Character/Line Height (px): Median bounding box height across segmented lines.
    3. Line Spacing (px): Median vertical gap and baseline delta between successive lines.
    4. Horizontal Spacing (px): Median inter-component gap (heuristic estimate).
    5. Baseline Slope / Slant Angle (deg): Linear regression on lower stroke baseline contours.
    6. Handwriting Density (ratio): Foreground ink ratio inside active text bounding boxes.
    7. Ink Coverage (%): Overall ink footprint across writing area.
    8. Dominant Ink Color: Median core ink RGB & Hex classification from original un-thresholded color.
    """

    def __init__(self):
        pass

    def analyze_style(self, cv_bgr: np.ndarray, filename: str = "sample") -> StyleProfileResponse:
        t_start = time.time()
        H, W = cv_bgr.shape[:2]

        if H < 30 or W < 30:
            return StyleProfileResponse(
                success=False,
                filename=filename,
                original_size=OriginalSize(width=W, height=H),
                message="Image dimensions are too small to analyze handwriting style.",
            )

        # 1. Background subtraction and robust ink segmentation
        gray = cv2.cvtColor(cv_bgr, cv2.COLOR_BGR2GRAY)

        # Morphological closing with adaptive kernel relative to image size
        kernel_size = max(21, (min(H, W) // 30) | 1)
        bg = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size)))
        diff = cv2.subtract(bg, gray)

        # Otsu thresholding on background-subtracted image (isolates ink from page background)
        _, ink_mask = cv2.threshold(diff, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Clean tiny noise specks
        ink_mask = cv2.morphologyEx(ink_mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2)))

        total_pixels = H * W
        ink_pixel_count = int(np.count_nonzero(ink_mask))

        # Check for blank or unsuitable images
        if ink_pixel_count < 80 or (ink_pixel_count / float(total_pixels)) < 0.0008:
            return StyleProfileResponse(
                success=False,
                filename=filename,
                original_size=OriginalSize(width=W, height=H),
                line_count_detected=0,
                message="No measurable handwriting ink was detected on the page. Please ensure the handwriting is clear.",
            )

        # 2. Step 3 Line Segmentation for line metrics
        seg_res = segment_handwriting_lines(cv_bgr, source_image_for_crops=cv_bgr)
        lines = seg_res.get("lines", []) if seg_res.get("success") else []
        line_count = len(lines)

        # 3. Stroke Thickness via Distance Transform
        dist = cv2.distanceTransform(ink_mask, cv2.DIST_L2, 5)
        dilated = cv2.dilate(dist, np.ones((3, 3), np.uint8))
        # Ridge pixels represent the medial axis / skeleton of the strokes
        ridge = (dist == dilated) & (dist > 0.6)
        ridge_distances = dist[ridge]

        if len(ridge_distances) > 20:
            thickness_px = float(np.median(ridge_distances) * 2.0)
            stroke_metric = MetricValue(
                value=round(thickness_px, 2),
                unit="px",
                is_heuristic=False,
                status="measured",
                confidence="high",
                description="Median stroke width estimated via distance transform ridge analysis",
            )
        else:
            thickness_px = None
            stroke_metric = MetricValue(
                value=None,
                unit="px",
                is_heuristic=False,
                status="unavailable",
                confidence="unavailable",
                description="Stroke thickness could not be reliably determined from ridges",
            )

        # 4. Line Height and Line Spacing
        if line_count > 0:
            line_heights = [l["bbox"]["height"] for l in lines if l.get("bbox")]
            med_height = float(np.median(line_heights)) if line_heights else None
            height_metric = MetricValue(
                value=round(med_height, 1) if med_height is not None else None,
                unit="px",
                is_heuristic=False,
                status="measured" if med_height is not None else "unavailable",
                confidence="high" if med_height is not None else "unavailable",
                description="Median vertical height of segmented text lines",
            )
        else:
            med_height = None
            height_metric = MetricValue(
                value=None,
                unit="px",
                is_heuristic=False,
                status="unavailable",
                confidence="unavailable",
                description="No segmented text lines detected to measure line height",
            )

        if line_count >= 2:
            sorted_lines = sorted(lines, key=lambda l: l["bbox"]["y"])
            y_positions = [l["bbox"]["y"] for l in sorted_lines]
            baseline_deltas = np.diff(y_positions)
            med_spacing = float(np.median(baseline_deltas))
            spacing_metric = MetricValue(
                value=round(med_spacing, 1),
                unit="px",
                is_heuristic=False,
                status="measured",
                confidence="high",
                description="Median vertical distance between successive line baselines",
            )
        else:
            med_spacing = None
            spacing_metric = MetricValue(
                value=None,
                unit="px",
                is_heuristic=False,
                status="unavailable",
                confidence="unavailable",
                description="At least 2 lines are required to measure line spacing",
            )

        # 5. Baseline Slope / Line Inclination (degrees)
        slant_angles = []
        for line in lines:
            bbox = line.get("bbox")
            if not bbox:
                continue
            bx, by, bw, bh = bbox["x"], bbox["y"], bbox["width"], bbox["height"]
            if bw < 40 or bh < 10:
                continue
            line_ink = ink_mask[by : by + bh, bx : bx + bw]
            pts = cv2.findNonZero(line_ink)
            if pts is not None and len(pts) > 25:
                # Fit linear regression line to bottom 30% baseline points
                pts_arr = pts.reshape(-1, 2)
                y_cutoff = np.percentile(pts_arr[:, 1], 60)
                baseline_pts = pts_arr[pts_arr[:, 1] >= y_cutoff]
                if len(baseline_pts) > 10:
                    vx, vy, x0, y0 = cv2.fitLine(baseline_pts, cv2.DIST_L2, 0, 0.01, 0.01)
                    angle_deg = float(np.degrees(np.arctan2(vy[0], vx[0])))
                    # Constrain to realistic handwriting inclination [-20, 20]
                    if -25.0 <= angle_deg <= 25.0:
                        slant_angles.append(angle_deg)

        if slant_angles:
            med_slant = float(np.median(slant_angles))
            slant_metric = MetricValue(
                value=round(med_slant, 2),
                unit="deg",
                is_heuristic=False,
                status="measured",
                confidence="high",
                description="Baseline slope angle relative to horizontal (0° = horizontal, positive = upward slope)",
            )
        else:
            med_slant = 0.0
            slant_metric = MetricValue(
                value=0.0,
                unit="deg",
                is_heuristic=True,
                status="heuristic",
                confidence="low",
                description="Near horizontal baseline (no significant inclination detected)",
            )

        # 6. Horizontal Spacing (Heuristic estimate between character/word components)
        h_gaps = []
        for line in lines:
            bbox = line.get("bbox")
            if not bbox:
                continue
            bx, by, bw, bh = bbox["x"], bbox["y"], bbox["width"], bbox["height"]
            line_ink = ink_mask[by : by + bh, bx : bx + bw]
            num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(line_ink, connectivity=8)
            # Filter valid character component bounds
            comp_boxes = []
            for i in range(1, num_labels):
                cw = stats[i, cv2.CC_STAT_WIDTH]
                ch = stats[i, cv2.CC_STAT_HEIGHT]
                cx = stats[i, cv2.CC_STAT_LEFT]
                if cw >= 3 and ch >= 5 and stats[i, cv2.CC_STAT_AREA] >= 12:
                    comp_boxes.append((cx, cw))

            if len(comp_boxes) > 1:
                comp_boxes.sort(key=lambda b: b[0])
                for j in range(len(comp_boxes) - 1):
                    gap = comp_boxes[j + 1][0] - (comp_boxes[j][0] + comp_boxes[j][1])
                    if 2 <= gap <= (bh * 1.5):  # Ignore overlapping or line-wide gaps
                        h_gaps.append(gap)

        if h_gaps:
            med_h_gap = float(np.median(h_gaps))
            h_metric = MetricValue(
                value=round(med_h_gap, 1),
                unit="px",
                is_heuristic=True,
                status="heuristic",
                confidence="medium",
                description="Estimated horizontal separation between character and word clusters",
            )
        else:
            med_h_gap = None
            h_metric = MetricValue(
                value=None,
                unit="px",
                is_heuristic=True,
                status="unavailable",
                confidence="unavailable",
                description="Horizontal spacing could not be reliably estimated",
            )

        # 7. Handwriting Density & Foreground Coverage
        coverage_pct = (ink_pixel_count / float(total_pixels)) * 100.0
        coverage_metric = MetricValue(
            value=round(coverage_pct, 2),
            unit="%",
            is_heuristic=False,
            status="measured",
            confidence="high",
            description="Percentage of page surface covered by foreground handwriting ink",
        )

        # Density inside bounding boxes of detected lines
        if line_count > 0:
            union_bbox_area = sum(l["bbox"]["width"] * l["bbox"]["height"] for l in lines if l.get("bbox"))
            if union_bbox_area > 0:
                density_val = min(1.0, float(ink_pixel_count) / float(union_bbox_area))
            else:
                density_val = float(coverage_pct / 100.0)
        else:
            density_val = float(coverage_pct / 100.0)

        density_metric = MetricValue(
            value=round(density_val, 3),
            unit="ratio",
            is_heuristic=False,
            status="measured",
            confidence="high",
            description="Ratio of ink pixels to active line bounding area (higher = tighter / bolder writing)",
        )

        # 8. Dominant Ink Color Extraction from Original Image
        core_threshold = np.percentile(dist[ink_mask > 0], 50) if ink_pixel_count > 0 else 0
        core_ink = (ink_mask > 0) & (dist >= max(0.8, core_threshold * 0.6))
        if np.count_nonzero(core_ink) < 30:
            core_ink = ink_mask > 0

        bgr_ink = cv_bgr[core_ink]
        if len(bgr_ink) > 0:
            rgb_ink = bgr_ink[:, [2, 1, 0]]  # BGR -> RGB
            med_r = int(np.median(rgb_ink[:, 0]))
            med_g = int(np.median(rgb_ink[:, 1]))
            med_b = int(np.median(rgb_ink[:, 2]))
            hex_code = f"#{med_r:02x}{med_g:02x}{med_b:02x}"

            # Assess reliability: check standard deviation across pixels
            std_r = float(np.std(rgb_ink[:, 0]))
            std_g = float(np.std(rgb_ink[:, 1]))
            std_b = float(np.std(rgb_ink[:, 2]))
            avg_std = (std_r + std_g + std_b) / 3.0

            color_name = self._categorize_ink_color(med_r, med_g, med_b)
            is_reliable = avg_std < 55.0

            dominant_color = DominantInkColor(
                rgb=[med_r, med_g, med_b],
                hex=hex_code,
                color_name=color_name,
                is_reliable=is_reliable,
                confidence="high" if is_reliable else "medium",
            )
        else:
            dominant_color = DominantInkColor(
                rgb=None,
                hex=None,
                color_name="Unknown / Undetectable",
                is_reliable=False,
                confidence="unavailable",
            )

        # 9. Style Summary & Human-readable Labels
        summary = self._generate_style_summary(
            thickness_px=thickness_px,
            slant_deg=slant_metric.value,
            line_spacing_px=med_spacing,
            line_height_px=med_height,
            density_ratio=density_val,
            color_name=dominant_color.color_name,
        )

        # 10. Generate Annotated Visualization Preview
        annotated_b64 = self._render_annotated_sample(cv_bgr, lines, slant_metric.value)

        elapsed = round(time.time() - t_start, 2)

        return StyleProfileResponse(
            success=True,
            filename=filename,
            original_size=OriginalSize(width=W, height=H),
            line_count_detected=line_count,
            metrics=StyleMetrics(
                stroke_thickness=stroke_metric,
                line_height=height_metric,
                line_spacing=spacing_metric,
                horizontal_spacing=h_metric,
                slant_angle=slant_metric,
                ink_density=density_metric,
                ink_coverage_pct=coverage_metric,
            ),
            dominant_color=dominant_color,
            summary=summary,
            annotated_sample=annotated_b64,
            message="Handwriting style profile computed successfully from original image.",
            analysis_time_sec=elapsed,
        )

    def _categorize_ink_color(self, r: int, g: int, b: int) -> str:
        """Categorizes RGB ink color into clear, natural pen terminology."""
        diff_max_min = max(r, g, b) - min(r, g, b)
        brightness = (r + g + b) // 3

        if diff_max_min < 22:
            if brightness < 65:
                return "Black / Charcoal"
            elif brightness < 125:
                return "Dark Gray / Graphite"
            else:
                return "Pencil / Silver Gray"

        # Blue ink check
        if b > r + 15 and b > g + 8:
            if brightness < 80:
                return "Dark Navy Blue"
            elif brightness < 135:
                return "Royal Blue"
            else:
                return "Light Blue"

        # Blue-Black ink
        if b > r and brightness < 90:
            return "Blue-Black Ink"

        # Green ink check
        if g > r + 15 and g > b + 10:
            return "Emerald / Green Ink"

        # Red / Maroon ink check
        if r > b + 20 and r > g + 15:
            if brightness < 100:
                return "Burgundy / Maroon"
            return "Red Ink"

        # Purple / Violet
        if r > g + 15 and b > g + 15:
            return "Violet / Purple"

        return "Dark Ink"

    def _generate_style_summary(
        self,
        thickness_px: Optional[float],
        slant_deg: Optional[float],
        line_spacing_px: Optional[float],
        line_height_px: Optional[float],
        density_ratio: Optional[float],
        color_name: Optional[str],
    ) -> Dict[str, Any]:
        """Generates natural language labels for UI display."""
        # Stroke weight
        if thickness_px is None:
            weight_label = "Standard Pen"
        elif thickness_px < 2.2:
            weight_label = "Fine / Thin Nib"
        elif thickness_px <= 4.2:
            weight_label = "Medium Ballpoint"
        else:
            weight_label = "Broad / Gel Pen"

        # Slant
        if slant_deg is None or abs(slant_deg) < 1.0:
            slant_label = "Level / Upright"
        elif slant_deg > 1.0:
            slant_label = f"Ascending (+{slant_deg:.1f}°)"
        else:
            slant_label = f"Descending ({slant_deg:.1f}°)"

        # Spacing
        if line_spacing_px is not None and line_height_px is not None:
            ratio = line_spacing_px / max(1.0, line_height_px)
            if ratio < 0.9:
                spacing_label = "Compact Spacing"
            elif ratio <= 1.4:
                spacing_label = "Balanced Spacing"
            else:
                spacing_label = "Spacious / Airy"
        else:
            spacing_label = "Standard Spacing"

        # Density
        if density_ratio is not None:
            if density_ratio < 0.12:
                density_label = "Light / Airy"
            elif density_ratio <= 0.25:
                density_label = "Standard Density"
            else:
                density_label = "Dense & Compact"
        else:
            density_label = "Standard"

        headline = f"{weight_label} with {slant_label} baseline in {color_name or 'dark ink'}."

        return {
            "headline": headline,
            "weight_label": weight_label,
            "slant_label": slant_label,
            "spacing_label": spacing_label,
            "density_label": density_label,
            "ink_label": color_name or "Dark Ink",
        }

    def _render_annotated_sample(
        self, cv_bgr: np.ndarray, lines: List[Dict[str, Any]], slant_deg: Optional[float]
    ) -> Optional[str]:
        """Creates an annotated preview image showing detected lines and baseline guides."""
        try:
            H, W = cv_bgr.shape[:2]
            # Downscale for crisp, fast display if image is huge (>1200px)
            scale = 1.0
            if max(H, W) > 1200:
                scale = 1200.0 / max(H, W)
                preview = cv2.resize(cv_bgr, (int(W * scale), int(H * scale)), interpolation=cv2.INTER_AREA)
            else:
                preview = cv_bgr.copy()

            # Draw gentle line bounding guides
            for idx, line in enumerate(lines[:35]):
                bbox = line.get("bbox")
                if not bbox:
                    continue
                bx = int(bbox["x"] * scale)
                by = int(bbox["y"] * scale)
                bw = int(bbox["width"] * scale)
                bh = int(bbox["height"] * scale)

                # Cyan line box
                cv2.rectangle(preview, (bx, by), (bx + bw, by + bh), (220, 160, 60), 1)

                # Baseline indicator (violet line along lower part of bounding box)
                base_y = by + int(bh * 0.85)
                cv2.line(preview, (bx, base_y), (bx + bw, base_y), (255, 90, 160), 1, cv2.LINE_AA)

            _, buf = cv2.imencode(".jpg", preview, [cv2.IMWRITE_JPEG_QUALITY, 85])
            b64 = base64.b64encode(buf).decode("utf-8")
            return f"data:image/jpeg;base64,{b64}"
        except Exception:
            return None


# Singleton instance
style_service = StyleAnalysisService()
