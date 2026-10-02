import io
import base64
import os
from typing import Tuple, Dict, Any
import numpy as np
import cv2
from PIL import Image, ImageOps

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
SUPPORTED_PIL_FORMATS = {"JPEG", "PNG", "WEBP"}


class ImageValidationError(Exception):
    """Raised when an uploaded file fails validation."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def validate_image_file(filename: str, file_bytes: bytes) -> Tuple[int, int]:
    """
    Validates file extension, size, and decodability using Pillow.
    Returns (width, height) of original image if valid.
    """
    # 1. Check size
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise ImageValidationError(
            f"File '{filename}' exceeds maximum allowed size of 10MB ({len(file_bytes) / (1024 * 1024):.1f}MB).",
            status_code=413,
        )

    if len(file_bytes) == 0:
        raise ImageValidationError(f"File '{filename}' is empty.", status_code=400)

    # 2. Check extension
    _, ext = os.path.splitext(filename.lower())
    if ext not in SUPPORTED_EXTENSIONS:
        raise ImageValidationError(
            f"File '{filename}' has unsupported extension '{ext}'. Only PNG, JPG, JPEG, and WEBP are supported.",
            status_code=415,
        )

    # 3. Validate image payload with Pillow
    try:
        with Image.open(io.BytesIO(file_bytes)) as pil_img:
            pil_img.verify()
    except Exception:
        raise ImageValidationError(
            f"File '{filename}' could not be decoded. The file does not appear to be a valid image.",
            status_code=400,
        )

    # Re-open after verify() to get format and dimensions
    try:
        with Image.open(io.BytesIO(file_bytes)) as pil_img:
            if pil_img.format not in SUPPORTED_PIL_FORMATS:
                raise ImageValidationError(
                    f"File '{filename}' format '{pil_img.format}' is unsupported. Only JPEG, PNG, and WEBP are accepted.",
                    status_code=415,
                )
            width, height = pil_img.size
            return width, height
    except ImageValidationError:
        raise
    except Exception as e:
        raise ImageValidationError(f"Error inspecting image '{filename}': {str(e)}", status_code=400)


def preprocess_image(image_bytes: bytes, filename: str = "") -> Dict[str, Any]:
    """
    Executes the Step 2 handwriting preprocessing pipeline:
    1. Decodes image with orientation correction.
    2. Converts to grayscale.
    3. Applies edge-preserving mild bilateral filtering for noise reduction.
    4. Applies adaptive contrast enhancement (CLAHE).
    5. Applies carefully tuned adaptive thresholding / background normalization
       designed to preserve stroke thickness, slant, pen variation, and character loops.
    6. Encodes result to base64 PNG data URL.
    """
    # 1. Validation and dimensions
    orig_w, orig_h = validate_image_file(filename, image_bytes)

    # 2. Decode using Pillow with EXIF orientation correction, then convert to OpenCV NumPy array
    try:
        with Image.open(io.BytesIO(image_bytes)) as pil_img:
            pil_img = ImageOps.exif_transpose(pil_img)
            # Convert to RGB if RGBA/Palette/CMYK
            if pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
            np_img = np.array(pil_img)
            # Pillow is RGB -> OpenCV BGR
            cv_img = cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR)
    except Exception:
        # Fallback to direct cv2.imdecode
        np_arr = np.frombuffer(image_bytes, np.uint8)
        cv_img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if cv_img is None:
        raise ImageValidationError(f"Could not decode image data for '{filename}'.", status_code=400)

    # 3. Convert to Grayscale
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

    # 4. Mild noise reduction using Bilateral Filter
    # Unlike Gaussian Blur which blurs ink edges, Bilateral Filter smooths paper grain
    # while strictly preserving high-contrast handwriting edges and natural stroke variation.
    denoised = cv2.bilateralFilter(gray, d=5, sigmaColor=35, sigmaSpace=35)

    # 5. Contrast Enhancement with CLAHE (Contrast Limited Adaptive Histogram Equalization)
    # Corrects shadows/uneven illumination across paper sheets without blowing out fine strokes.
    clahe = cv2.createCLAHE(clipLimit=1.8, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)

    # 6. Adaptive background normalization & handwriting detail preservation
    # We estimate local background illumination using a large morphological filter,
    # divide to cancel paper shadows, and apply high-fidelity adaptive thresholding
    # with a large neighborhood (blockSize=31) so stroke thickness is never eroded.
    background = cv2.medianBlur(enhanced, 21)
    normalized = cv2.divide(enhanced, background, scale=255)

    # Adaptive Gaussian thresholding carefully calibrated to preserve natural handwriting dynamics
    # and micro-loops without binary speckle artifacts
    processed = cv2.adaptiveThreshold(
        normalized,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,
        C=9,
    )

    # 7. Encode processed image to PNG buffer and base64
    success, buffer = cv2.imencode(".png", processed)
    if not success:
        raise ImageValidationError(f"Failed to encode processed image for '{filename}'.", status_code=500)

    b64_encoded = base64.b64encode(buffer).decode("utf-8")
    data_url = f"data:image/png;base64,{b64_encoded}"

    return {
        "filename": filename,
        "original_size": {
            "width": orig_w,
            "height": orig_h,
        },
        "processed_image": data_url,
    }
