"""
Handwriting Recognition (HTR/OCR) Service using Microsoft TrOCR.

Architecture:
Original Handwritten Page
    ↓
Segmentation Preprocessing (Desk boundary, projection profiling)
    ↓
Detect Line Bounding Boxes
    ↓
Crop from ORIGINAL Page Image
    ↓
OCR-Specific Preprocessing (prepare_line_for_ocr: margin trim, stroke preservation, mode-specific normalization)
    ↓
TrOCRProcessor (Resizing, Normalization, Tokenizer)
    ↓
Vision Encoder (DeiT/ViT extracting visual patch tokens)
    ↓
Text Decoder (RoBERTa autoregressively generating text tokens)
    ↓
Decoded Digital Text String
"""

import io
import os
import base64
import threading
import time
from typing import List, Dict, Any, Optional, Union
import cv2
import numpy as np
from PIL import Image


# =============================================================================
# OCR-SPECIFIC PREPROCESSING
# =============================================================================

def prepare_line_for_ocr(
    line_input: Union[np.ndarray, Image.Image, str],
    mode: str = "original",
    save_debug_path: Optional[str] = None,
) -> Optional[Image.Image]:
    """
    Dedicated OCR-specific preprocessing for handwriting line crops.

    Requirements:
    1. Take the original line crop.
    2. Convert to RGB.
    3. Remove excessive empty horizontal margins if present (without clipping characters).
    4. Apply mild contrast normalization if needed.
    5. Optionally apply very light denoising.
    6. Preserve natural handwriting stroke appearance.
    7. Resize only when necessary for the model via TrOCR processor.

    DO NOT:
    - aggressively threshold or binarize
    - destroy grayscale/color information
    - aggressively sharpen
    - apply large morphological kernels
    - remove faint handwriting

    Supported Modes:
      - 'original' (default):
          Original RGB line crop. Trims excessive blank paper margins.
          Preserves original ink colors, stroke texture, and gradients.
      - 'enhanced':
          Grayscale -> mild contrast enhancement (CLAHE clipLimit=1.5) -> RGB.
          Levels uneven illumination and camera shadows across paper sheets.
      - 'denoised':
          Grayscale -> very mild bilateral filtering (d=3, sigma=15) -> mild CLAHE -> RGB.
          Suppresses paper grain while strictly preserving handwriting stroke edges.
    """
    try:
        # Step 1: Decode/convert input into a NumPy BGR array
        crop_bgr: Optional[np.ndarray] = None

        if isinstance(line_input, Image.Image):
            rgb_arr = np.array(line_input.convert("RGB"))
            crop_bgr = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)

        elif isinstance(line_input, np.ndarray):
            if line_input.size == 0:
                return None
            if len(line_input.shape) == 2:
                crop_bgr = cv2.cvtColor(line_input, cv2.COLOR_GRAY2BGR)
            elif len(line_input.shape) == 3:
                crop_bgr = line_input.copy()

        elif isinstance(line_input, str):
            raw_b64 = line_input
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            data = base64.b64decode(raw_b64)
            pil_img = Image.open(io.BytesIO(data)).convert("RGB")
            crop_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        if crop_bgr is None or crop_bgr.shape[0] < 4 or crop_bgr.shape[1] < 4:
            return None

        # Step 2: Remove excessive empty horizontal margins if present
        # Detect ink extent along columns to prevent extreme aspect ratios (e.g. 25:1)
        gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
        bg_level = float(np.percentile(gray, 85))
        ink_mask = gray < (bg_level - 18)

        col_ink = np.sum(ink_mask, axis=0)
        ink_cols = np.where(col_ink >= 2)[0]

        if len(ink_cols) > 0:
            pad_left = 12
            pad_right = 14
            x_min = max(0, ink_cols[0] - pad_left)
            x_max = min(crop_bgr.shape[1], ink_cols[-1] + pad_right)

            # Only trim if there is significant excess margin (> 30px) and line remains substantial
            if (crop_bgr.shape[1] - (x_max - x_min)) >= 30 and (x_max - x_min) >= 40:
                crop_bgr = crop_bgr[:, x_min:x_max]
                gray = gray[:, x_min:x_max]

        # Step 3: Apply mode-specific transformations
        norm_mode = (mode or "original").lower().strip()

        if norm_mode == "enhanced":
            # Grayscale -> mild contrast enhancement (CLAHE) -> RGB
            clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            result_rgb = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2RGB)
            result_pil = Image.fromarray(result_rgb)

        elif norm_mode == "denoised":
            # Grayscale -> very mild edge-preserving bilateral filter -> mild CLAHE -> RGB
            denoised = cv2.bilateralFilter(gray, d=3, sigmaColor=15, sigmaSpace=15)
            clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
            enhanced = clahe.apply(denoised)
            result_rgb = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2RGB)
            result_pil = Image.fromarray(result_rgb)

        else:  # "original" (default)
            # Original RGB crop preserving authentic ink gradients and paper texture
            result_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
            result_pil = Image.fromarray(result_rgb)

        # Step 4: Optional debug output saving
        if save_debug_path:
            try:
                os.makedirs(os.path.dirname(save_debug_path), exist_ok=True)
                result_pil.save(save_debug_path)
            except Exception as save_err:
                print(f"[OCR] Warning: could not save debug image {save_debug_path}: {save_err}")

        return result_pil

    except Exception as e:
        print(f"[OCR] prepare_line_for_ocr error: {e}")
        return None


# =============================================================================
# HANDWRITING OCR SERVICE (SINGLETON)
# =============================================================================

class HandwritingOCRService:
    """
    Dedicated OCR service for handwritten line recognition using Microsoft TrOCR.
    
    Features:
    - Pretrained TrOCR model (microsoft/trocr-base-handwritten)
    - Automatic hardware detection (CUDA GPU acceleration with seamless CPU fallback)
    - Thread-safe singleton model lifecycle: loaded once at startup and reused across requests
    - OCR-specific preprocessing preserving original visual handwriting strokes
    - Deterministic beam/greedy decoding without disruptive repetition penalties
    - Optional debug saving for inspected OCR input crops
    """

    def __init__(
        self,
        model_name: str = "microsoft/trocr-base-handwritten",
        device: Optional[str] = None,
        default_preprocessing_mode: str = "original",
        debug_dir: str = "debug/ocr_inputs",
    ):
        self.model_name = model_name
        self.requested_device = device
        self.device: str = "cpu"
        self.default_preprocessing_mode: str = default_preprocessing_mode
        self.debug_dir = debug_dir
        self.processor = None
        self.model = None
        self._lock = threading.Lock()
        self._is_loaded = False
        self._load_error: Optional[str] = None

        # Determine target device
        self._detect_device()

    def _detect_device(self) -> None:
        """Determines whether CUDA GPU is available, defaulting gracefully to CPU."""
        if self.requested_device:
            self.device = self.requested_device
            return

        try:
            import torch
            if torch.cuda.is_available():
                self.device = "cuda"
            else:
                self.device = "cpu"
        except ImportError:
            self.device = "cpu"

    def load_model(self) -> bool:
        """
        Loads the TrOCR processor and VisionEncoderDecoderModel once into memory.
        Thread-safe to prevent race conditions during concurrent startup requests.
        """
        if self._is_loaded and self.model is not None and self.processor is not None:
            return True

        with self._lock:
            if self._is_loaded and self.model is not None and self.processor is not None:
                return True

            try:
                import torch
                from transformers import TrOCRProcessor, VisionEncoderDecoderModel

                print(f"[OCR] Initializing TrOCR ({self.model_name}) on device: {self.device.upper()}...")
                start_time = time.time()

                self.processor = TrOCRProcessor.from_pretrained(self.model_name)
                self.model = VisionEncoderDecoderModel.from_pretrained(self.model_name)

                # Move model to target device and set to evaluation mode
                self.model.to(self.device)
                self.model.eval()

                elapsed = round(time.time() - start_time, 2)
                self._is_loaded = True
                self._load_error = None
                print(f"[OCR] TrOCR successfully loaded on {self.device.upper()} in {elapsed}s.")
                return True

            except Exception as e:
                self._load_error = str(e)
                print(f"[OCR] Error loading TrOCR model: {e}")
                return False

    def is_loaded(self) -> bool:
        """Returns True if the model and processor are initialized and ready."""
        return self._is_loaded and self.model is not None

    def get_status(self) -> Dict[str, Any]:
        """Returns diagnostic information about the OCR service."""
        cuda_avail = False
        try:
            import torch
            cuda_avail = torch.cuda.is_available()
        except ImportError:
            pass

        return {
            "model_name": self.model_name,
            "device": self.device.upper(),
            "cuda_available": cuda_avail,
            "is_loaded": self._is_loaded,
            "preprocessing_mode": self.default_preprocessing_mode,
            "available_modes": ["original", "enhanced", "denoised"],
            "error": self._load_error,
        }

    def recognize_line(
        self,
        line_input: Union[np.ndarray, Image.Image, str],
        mode: Optional[str] = None,
        save_debug_idx: Optional[int] = None,
    ) -> str:
        """
        Recognizes text from a single cropped handwriting line image.
        
        Steps:
        1. Prepares line crop with OCR-specific preprocessing (original/enhanced/denoised).
        2. Encodes via TrOCRProcessor into pixel tensors.
        3. Evaluates with torch.no_grad() and deterministic decoding.
        4. Decodes token IDs to clean digital text string.
        """
        if not self.load_model():
            raise RuntimeError(f"OCR model is not loaded: {self._load_error}")

        import torch

        active_mode = mode if mode else self.default_preprocessing_mode
        debug_path = None
        if save_debug_idx is not None:
            debug_path = os.path.join(self.debug_dir, f"line_{save_debug_idx:02d}.png")

        # 1. OCR-specific preprocessing
        pil_img = prepare_line_for_ocr(
            line_input=line_input,
            mode=active_mode,
            save_debug_path=debug_path,
        )

        if pil_img is None or pil_img.size[0] < 4 or pil_img.size[1] < 4:
            return ""

        # 2. Extract visual features using processor
        pixel_values = self.processor(pil_img, return_tensors="pt").pixel_values.to(self.device)

        # 3. Deterministic generation (no harmful repetition penalties or n-gram bans)
        with torch.no_grad():
            generated_ids = self.model.generate(
                pixel_values,
                max_new_tokens=64,
                num_beams=1,
            )

        # 4. Decode generated tokens
        recognized_text = self.processor.batch_decode(
            generated_ids, skip_special_tokens=True
        )[0]

        return recognized_text.strip()

    def recognize_lines(
        self,
        line_inputs: List[Union[np.ndarray, Image.Image, str]],
        mode: Optional[str] = None,
        save_debug: bool = True,
    ) -> List[str]:
        """
        Recognizes text sequentially across a batch of handwritten lines.
        Logs model, device, line count, and preprocessing mode clearly.
        Saves debug input crops for the first 5 lines if save_debug is enabled.
        """
        if not self.load_model():
            raise RuntimeError(f"OCR model is not loaded: {self._load_error}")

        active_mode = mode if mode else self.default_preprocessing_mode
        total = len(line_inputs)

        # Required clean diagnostic log
        print(f"[OCR] OCR model: {self.model_name}")
        print(f"[OCR] Device: {self.device.upper()}")
        print(f"[OCR] Lines: {total}")
        print(f"[OCR] Preprocessing mode: {active_mode}")

        t_batch_start = time.time()
        results: List[str] = []

        for idx, line_item in enumerate(line_inputs, start=1):
            t_line_start = time.time()
            save_idx = idx if (save_debug and idx <= 5) else None
            try:
                text = self.recognize_line(line_item, mode=active_mode, save_debug_idx=save_idx)
                elapsed = time.time() - t_line_start
                preview = (text[:35] + "...") if len(text) > 35 else text
                print(f"[OCR] Processing line {idx}/{total} ({elapsed:.2f}s): \"{preview}\"")
                results.append(text)
            except Exception as e:
                print(f"[OCR] Error recognizing line {idx}/{total}: {e}")
                results.append("")

        total_elapsed = round(time.time() - t_batch_start, 2)
        print(f"[OCR] OCR batch completed in {total_elapsed}s. {len(results)} lines processed.")
        return results


# Global singleton OCR service instance
_ocr_service_instance: Optional[HandwritingOCRService] = None
_ocr_instance_lock = threading.Lock()


def get_ocr_service() -> HandwritingOCRService:
    """
    Returns the global singleton instance of HandwritingOCRService.
    Ensures TrOCR is only instantiated once throughout the server lifetime.
    """
    global _ocr_service_instance
    if _ocr_service_instance is None:
        with _ocr_instance_lock:
            if _ocr_service_instance is None:
                _ocr_service_instance = HandwritingOCRService()
    return _ocr_service_instance
