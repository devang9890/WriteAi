import base64
from dataclasses import dataclass
from typing import Dict, Any, List, Optional, Tuple
import cv2
import numpy as np
from scipy.signal import find_peaks


@dataclass
class SegmentationConfig:
    """
    Configurable parameters for robust handwriting line segmentation using
    ink-strength representation and 1D Horizontal Projection Profile (HPP) peak detection.

    Why this design exists:
    1. Harsh binarization combined with 2D morphological dilation or continuous foreground rows
       causes faint reverse-side writing and paper texture to merge the entire page into one huge box.
    2. By calculating a continuous ink-strength score and detecting peaks in the smoothed 1D projection,
       each handwriting line forms an independent peak. Valleys between peaks structurally prevent
       adjacent lines from merging.
    3. Peak detection parameters (distance, prominence, width) are dynamically derived from image
       dimensions and signal statistics rather than hard-coded coordinates.
    """
    # -------------------------------------------------------------------------
    # 1. Page Detection & Background Illumination
    # -------------------------------------------------------------------------
    detect_page_boundary: bool = True
    bg_closing_ratio: float = 0.05
    paper_noise_percentile: float = 70.0

    # -------------------------------------------------------------------------
    # 2. Horizontal Projection & Peak Detection
    # -------------------------------------------------------------------------
    proj_smooth_ratio: float = 0.012
    min_peak_dist_ratio: float = 0.018
    peak_prominence_factor: float = 0.25
    band_cutoff_ratio: float = 0.35

    # -------------------------------------------------------------------------
    # 3. Line Validation & Tight Bounding Box
    # -------------------------------------------------------------------------
    min_line_width_ratio: float = 0.04
    min_line_ink_pixels: int = 15
    min_line_ink_density: float = 0.010
    padding_x: int = 8
    padding_y: int = 6

    # -------------------------------------------------------------------------
    # 4. Diagnostics & Debugging
    # -------------------------------------------------------------------------
    debug: bool = False


# =============================================================================
# MODULAR PIPELINE FUNCTIONS
# =============================================================================

def detect_page_region(
    image_bgr: np.ndarray, config: SegmentationConfig
) -> Tuple[np.ndarray, Tuple[int, int, int, int]]:
    """
    Detects the paper page region in a desk photograph using contour analysis.

    Why this exists:
    Desk photographs contain dark desk surfaces, pens, and shadows surrounding the paper.
    Identifying the paper polygon allows masking out background desk objects (like pens or laptop borders)
    before projection profile calculation, preventing non-text objects from dominating segmentation.
    If the image is already a clean page scan (paper occupies >92% of the frame), the full image is preserved.
    """
    H, W = image_bgr.shape[:2]
    full_mask = np.ones((H, W), dtype=np.uint8) * 255
    full_bbox = (0, 0, W, H)

    if not config.detect_page_boundary:
        return full_mask, full_bbox

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (15, 15), 0)

    # Threshold separating bright paper from darker desk surfaces
    _, thresh = cv2.threshold(blur, 115, 255, cv2.THRESH_BINARY)
    closed = cv2.morphologyEx(
        thresh,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (35, 35)),
    )

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return full_mask, full_bbox

    largest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest)
    area_ratio = area / float(H * W)

    # If paper is clearly bounded on a desk (between 35% and 92% of image area)
    if 0.35 <= area_ratio <= 0.92:
        peri = cv2.arcLength(largest, True)
        approx = cv2.approxPolyDP(largest, 0.02 * peri, True)
        poly_mask = np.zeros((H, W), dtype=np.uint8)
        cv2.fillPoly(poly_mask, [approx], 255)

        # Mild erosion (4px) to exclude harsh desk edge contrast lines
        page_mask = cv2.erode(
            poly_mask,
            cv2.getStructuringElement(cv2.MORPH_RECT, (4, 4)),
        )
        rx, ry, rw, rh = cv2.boundingRect(approx)
        return page_mask, (rx, ry, rw, rh)

    return full_mask, full_bbox


def create_ink_strength_image(
    image_bgr: np.ndarray,
    page_mask: np.ndarray,
    config: SegmentationConfig,
) -> Tuple[np.ndarray, np.ndarray, float]:
    """
    Computes a continuous ink-strength representation and a high-confidence ink mask.

    Why this exists:
    1. A harsh binary image treats faint reverse-side bleed-through, paper grain, and dark handwriting
       equally, causing all rows to have foreground pixels and merging the entire page into one huge box.
    2. Local contrast normalization via morphological closing (bg - gray) measures darkness relative
       to local paper illumination, neutralizing shadows.
    3. Faint bleed-through writing from the reverse side clusters in the low-contrast range (< 70th percentile).
       Subtracting the dynamic paper noise floor and applying a soft power curve (gamma ~ 1.4) suppresses
       bleed-through to zero while preserving real handwriting stroke strength.
    4. Color information (B - R) boosts blue/colored ink strokes, providing an additional separation signal.
    """
    H, W = image_bgr.shape[:2]
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    b, g, r = cv2.split(image_bgr)

    # Estimate paper background illumination via morphological closing
    k_size = int(min(H, W) * config.bg_closing_ratio) | 1
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
    bg = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)

    # Darkness relative to local paper background
    diff = cv2.subtract(bg, gray).astype(np.float32)
    blue_diff = cv2.subtract(b, r).astype(np.float32)

    # Mask out non-paper pixels (desk surface, background objects)
    diff[page_mask == 0] = 0.0
    blue_diff[page_mask == 0] = 0.0

    # Dynamic noise floor from paper background variations
    paper_diff_vals = diff[page_mask > 0]
    if len(paper_diff_vals) > 0:
        noise_floor = float(np.percentile(paper_diff_vals, config.paper_noise_percentile))
    else:
        noise_floor = 15.0

    # Non-linear ink strength score
    darkness = np.maximum(0.0, diff - noise_floor)
    blue_boost = np.maximum(0.0, blue_diff - 5.0)
    ink_strength = np.power(darkness / 50.0, 1.4) * 50.0 + 1.2 * blue_boost

    # High-confidence ink mask for bounding box calculation
    strong_ink = (
        (diff > (noise_floor + 12.0)) | ((blue_diff > 10.0) & (diff > noise_floor))
    ) & (page_mask > 0)

    return ink_strength, strong_ink, noise_floor


def calculate_horizontal_projection(
    ink_strength: np.ndarray, config: SegmentationConfig
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Computes row-wise ink-strength projection and applies 1D Gaussian smoothing.

    Why this exists:
    Summing continuous ink-strength values produces a smooth 1D signal where each text line
    manifests as a clear peak, and inter-line gaps manifest as deep valleys.
    A 1D Gaussian filter removes intra-word stroke jitter while preserving inter-line valleys.
    """
    H = ink_strength.shape[0]
    raw_proj = np.sum(ink_strength, axis=1)

    k_smooth = max(5, int(H * config.proj_smooth_ratio) | 1)
    smoothed_proj = cv2.GaussianBlur(
        raw_proj.reshape(-1, 1), (1, k_smooth), 0
    ).flatten()

    return raw_proj, smoothed_proj


def detect_line_bands(
    smoothed_proj: np.ndarray,
    img_h: int,
    config: SegmentationConfig,
) -> List[Tuple[int, int, int]]:
    """
    Detects individual handwriting line bands using peak detection on the 1D projection.

    Why this exists:
    1. Rather than grouping all continuous non-zero rows (which merged the entire page),
       we detect true local maxima (peaks) in the 1D projection using scipy.signal.find_peaks.
    2. Minimum peak distance is dynamically derived from image height (roughly ~1.8% of height)
       to prevent ascender/descender humps within the same word from splitting a line.
    3. Prominence threshold ensures small background undulations are rejected while
       genuine handwriting lines are captured.
    4. Each peak defines a line band [y1, y2] by tracing where the signal drops below
       an adaptive fraction of the peak score, bounded by the midpoints/valleys to adjacent peaks.
       This guarantees that vertically adjacent lines NEVER merge.
    """
    active = smoothed_proj[smoothed_proj > 100.0]
    if len(active) == 0 or np.max(smoothed_proj) < 200.0:
        return []

    min_dist = max(18, int(img_h * config.min_peak_dist_ratio))
    prominence = max(600.0, float(np.percentile(active, 25) * config.peak_prominence_factor))

    peaks, _ = find_peaks(smoothed_proj, distance=min_dist, prominence=prominence)
    if len(peaks) == 0:
        return []

    # Compute valley midpoints between adjacent peaks
    midpoints = [0]
    for i in range(len(peaks) - 1):
        p1, p2 = peaks[i], peaks[i + 1]
        mid = p1 + int(np.argmin(smoothed_proj[p1:p2]))
        midpoints.append(mid)
    midpoints.append(img_h)

    # Form vertical bands around each peak
    bands: List[Tuple[int, int, int]] = []
    for i, p in enumerate(peaks):
        top_limit = midpoints[i]
        bot_limit = midpoints[i + 1]
        p_val = smoothed_proj[p]
        cutoff = max(400.0, config.band_cutoff_ratio * p_val)

        # Trace upward to band start
        y1 = p
        while y1 > top_limit and smoothed_proj[y1] > cutoff:
            y1 -= 1

        # Trace downward to band end
        y2 = p
        while y2 < bot_limit and smoothed_proj[y2] > cutoff:
            y2 += 1

        bands.append((y1, y2, p))

    return bands


def filter_line_candidates(
    bands: List[Tuple[int, int, int]],
    strong_ink: np.ndarray,
    page_mask: np.ndarray,
    config: SegmentationConfig,
    page_dimensions: Tuple[int, int],
) -> List[Dict[str, Any]]:
    """
    Fits tight bounding boxes around actual ink in each detected band and filters artifacts.

    Why this exists:
    1. Band boundaries [y1, y2] constrain the vertical extent of each line.
    2. Connected components inside each band are grouped horizontally using word proximity
       clustering (max_gap <= 12% width) to bridge words on the same line while isolating
       stray border noise or page edge specks.
    3. Clean ruling line filtering rejects thin horizontal notebook lines (>40% width, <=3px height).
    4. Tight bounding boxes are fitted with small configurable padding (5-10px) around active text.
    """
    total_w, total_h = page_dimensions
    min_w = int(total_w * config.min_line_width_ratio)
    max_word_gap = max(40, int(total_w * 0.12))

    # Clean ruling lines from strong ink mask
    strong_ink_u8 = (strong_ink.astype(np.uint8) * 255)
    num_c, lbls, stats, _ = cv2.connectedComponentsWithStats(strong_ink_u8)
    clean_ink = np.zeros_like(strong_ink_u8)
    for i in range(1, num_c):
        cw = stats[i, cv2.CC_STAT_WIDTH]
        ch = stats[i, cv2.CC_STAT_HEIGHT]
        if cw > 0.40 * total_w and ch <= 3:
            continue
        clean_ink[lbls == i] = 255

    valid_lines: List[Dict[str, Any]] = []

    for y1, y2, peak_y in bands:
        strip = clean_ink[y1:y2, :]
        ys, xs = np.where(strip > 0)
        if len(xs) < config.min_line_ink_pixels:
            continue

        num_s, s_lbls, s_stats, _ = cv2.connectedComponentsWithStats(strip)
        comps = [s_stats[k] for k in range(1, num_s) if s_stats[k, cv2.CC_STAT_AREA] >= 4]
        if not comps:
            continue

        # Group components by horizontal word proximity
        comps.sort(key=lambda c: c[0])
        clusters = [[comps[0]]]
        for c in comps[1:]:
            prev = clusters[-1][-1]
            gap = c[0] - (prev[0] + prev[2])
            if gap <= max_word_gap:
                clusters[-1].append(c)
            else:
                clusters.append([c])

        # Filter clusters to those with meaningful ink
        valid_clusters = [cl for cl in clusters if sum(c[4] for c in cl) >= 20]
        if not valid_clusters:
            continue

        all_comps = [c for cl in valid_clusters for c in cl]
        xmin = min(c[0] for c in all_comps)
        xmax = max(c[0] + c[2] for c in all_comps)
        ymin = y1 + min(c[1] for c in all_comps)
        ymax = y1 + max(c[1] + c[3] for c in all_comps)

        # Apply tight padding (5-10px) around active handwriting
        bx1 = max(0, xmin - config.padding_x)
        bx2 = min(total_w, xmax + config.padding_x)
        by1 = max(0, ymin - config.padding_y)
        by2 = min(total_h, ymax + config.padding_y)
        bw = bx2 - bx1
        bh = by2 - by1

        if bw < min_w or bh < 8:
            continue

        total_ink = len(xs)
        density = total_ink / float(bw * bh) if (bw * bh) > 0 else 0.0
        if density < config.min_line_ink_density and total_ink < 40:
            continue

        valid_lines.append({
            "x": int(bx1),
            "y": int(by1),
            "width": int(bw),
            "height": int(bh),
            "peak_y": int(peak_y),
            "ink_pixels": int(total_ink),
            "density": float(round(density, 3)),
        })

    # Sort strictly from top to bottom
    valid_lines.sort(key=lambda b: b["y"])
    return valid_lines


def crop_line(image_bgr: np.ndarray, bbox: Dict[str, int]) -> str:
    """
    Crops a detected text line from the original high-resolution image
    and encodes to base64 PNG data URL.
    """
    x, y, w, h = bbox["x"], bbox["y"], bbox["width"], bbox["height"]
    crop = image_bgr[y:y + h, x:x + w]
    success, buffer = cv2.imencode(".png", crop)
    if not success:
        return ""
    b64 = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def annotate_detected_lines(
    image_bgr: np.ndarray,
    lines: List[Dict[str, Any]],
) -> str:
    """
    Draws neat bounding boxes and Line 1..N badges onto the page preview.
    """
    annotated = image_bgr.copy()
    line_color = (237, 58, 124)  # Violet #7c3aed in BGR
    badge_color = (237, 58, 124)

    for line in lines:
        bbox = line["bbox"]
        idx = line["index"]
        x, y, w, h = bbox["x"], bbox["y"], bbox["width"], bbox["height"]

        cv2.rectangle(annotated, (x, y), (x + w, y + h), line_color, 2)

        label = f"Line {idx}"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.42
        thickness = 1
        (label_w, label_h), _ = cv2.getTextSize(label, font, font_scale, thickness)

        badge_y2 = y if (y - (label_h + 6)) >= 0 else (y + label_h + 8)
        badge_y1 = badge_y2 - (label_h + 6)
        badge_x1 = x
        badge_x2 = x + label_w + 10

        cv2.rectangle(annotated, (badge_x1, badge_y1), (badge_x2, badge_y2), badge_color, -1)
        text_origin = (badge_x1 + 5, badge_y2 - 3)
        cv2.putText(
            annotated,
            label,
            text_origin,
            font,
            font_scale,
            (255, 255, 255),
            thickness,
            cv2.LINE_AA,
        )

    success, buffer = cv2.imencode(".png", annotated)
    if not success:
        return ""
    b64 = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def render_projection_profile_image(
    smoothed_proj: np.ndarray,
    bands: List[Tuple[int, int, int]],
) -> np.ndarray:
    """
    Renders the 1D horizontal projection profile graph with peak markers and detected line bands.
    Used for debug mode and visual verification.
    """
    H = len(smoothed_proj)
    plot_w = 280
    plot_img = np.ones((H, plot_w, 3), dtype=np.uint8) * 250

    max_val = max(1.0, float(np.max(smoothed_proj)))
    scale = (plot_w - 40) / max_val

    # Draw projection curve in violet
    for y in range(H - 1):
        x1 = int(smoothed_proj[y] * scale)
        x2 = int(smoothed_proj[y + 1] * scale)
        cv2.line(plot_img, (x1, y), (x2, y + 1), (180, 80, 100), 1)

    # Mark detected bands and peaks
    for y1, y2, p in bands:
        cv2.rectangle(plot_img, (2, y1), (10, y2), (40, 180, 50), -1)
        px = int(smoothed_proj[p] * scale)
        cv2.circle(plot_img, (px, p), 3, (0, 0, 220), -1)

    return plot_img


# =============================================================================
# MAIN SEGMENTATION ENTRY POINT
# =============================================================================

def segment_handwriting_lines(
    image: np.ndarray,
    source_image_for_crops: Optional[np.ndarray] = None,
    config: Optional[SegmentationConfig] = None,
) -> Dict[str, Any]:
    """
    Main handwriting line detection and segmentation function.

    Modular Pipeline:
    1. detect_page_region: Detects paper sheet boundary in desk photographs.
    2. create_ink_strength_image: Normalizes local paper illumination, calculates ink strength,
       and suppresses faint bleed-through from the back of the sheet.
    3. calculate_horizontal_projection: Computes smoothed 1D row projection signal.
    4. detect_line_bands: Detects prominent peaks and defines line bands bounded by valley midpoints.
    5. filter_line_candidates: Fits tight horizontal and vertical bounding boxes around text ink.
    6. crop_line: Extracts high-resolution line crops.
    7. annotate_detected_lines: Generates visual preview with bounding boxes.
    """
    if config is None:
        config = SegmentationConfig()

    if image is None or image.size == 0:
        return {
            "success": False,
            "message": "Input image is empty or invalid.",
            "line_count": 0,
            "lines": [],
            "original_size": {"width": 0, "height": 0},
            "annotated_image": "",
        }

    # Normalize image representation
    if len(image.shape) == 2:
        bgr_display = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    else:
        bgr_display = image.copy()

    crops_source = source_image_for_crops if source_image_for_crops is not None else bgr_display
    img_h, img_w = bgr_display.shape[:2]

    # Step 1: Detect page region in desk photograph
    page_mask, (roi_x, roi_y, roi_w, roi_h) = detect_page_region(bgr_display, config)

    # Step 2: Ink strength calculation & bleed-through suppression
    ink_strength, strong_ink, noise_floor = create_ink_strength_image(
        bgr_display, page_mask, config
    )

    # Step 3: Horizontal projection profile calculation
    raw_proj, smoothed_proj = calculate_horizontal_projection(ink_strength, config)

    # Step 4: Line band detection via projection peaks
    bands = detect_line_bands(smoothed_proj, img_h, config)

    # Step 5: Tight bounding box extraction & candidate filtering
    line_candidates = filter_line_candidates(
        bands,
        strong_ink,
        page_mask,
        config,
        page_dimensions=(img_w, img_h),
    )

    if not line_candidates:
        return {
            "success": False,
            "message": "No handwriting lines could be detected.",
            "line_count": 0,
            "lines": [],
            "original_size": {"width": img_w, "height": img_h},
            "annotated_image": annotate_detected_lines(bgr_display, []),
        }

    # Step 6: Crop individual lines and format output
    extracted_lines: List[Dict[str, Any]] = []
    for idx, cand in enumerate(line_candidates, start=1):
        bbox = {
            "x": cand["x"],
            "y": cand["y"],
            "width": cand["width"],
            "height": cand["height"],
        }
        line_crop_url = crop_line(crops_source, bbox)

        extracted_lines.append({
            "index": idx,
            "bbox": bbox,
            "image": line_crop_url,
            "quality": {
                "density": cand.get("density", 0.0),
                "ink_pixels": cand.get("ink_pixels", 0),
            } if config.debug else None,
        })

    # Step 7: Annotated page preview
    annotated_preview_url = annotate_detected_lines(bgr_display, extracted_lines)

    # Optional debug visualization
    debug_images = None
    if config.debug:
        plot_img = render_projection_profile_image(smoothed_proj, bands)
        success, buf = cv2.imencode(".png", plot_img)
        plot_url = f"data:image/png;base64,{base64.b64encode(buf).decode('utf-8')}" if success else None
        debug_images = {
            "projection_graph": plot_url,
            "bands_count": len(bands),
            "peaks_count": len(bands),
            "noise_floor": float(round(noise_floor, 2)),
        }

    return {
        "success": True,
        "line_count": len(extracted_lines),
        "original_size": {
            "width": img_w,
            "height": img_h,
        },
        "annotated_image": annotated_preview_url,
        "lines": extracted_lines,
        "diagnostics": debug_images,
    }
