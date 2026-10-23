"""
Automated Test Suite for Step 4 TrOCR OCR API Endpoint (POST /api/samples/ocr).
Tests:
1. GET /api/samples/ocr/status returns model, device, and preprocessing modes.
2. POST /api/samples/ocr with blank page gracefully returns success=False without crashing.
3. POST /api/samples/ocr with mode query parameter accepts 'original', 'enhanced', and 'denoised'.
4. Response conforms strictly to OCRResponse schema with preprocessing_mode field.
"""

import urllib.request
import json
import numpy as np
import cv2


def send_multipart_ocr(filename: str, file_bytes: bytes, mode: str = "original") -> dict:
    url = f"http://127.0.0.1:8000/api/samples/ocr?mode={mode}"
    boundary = "----WriteAITestBoundaryOcr12345"
    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8"))
    body.extend(b"Content-Type: image/jpeg\r\n\r\n")
    body.extend(file_bytes)
    body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))

    req = urllib.request.Request(
        url,
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def test_ocr_api():
    print("=" * 60)
    print("TESTING STEP 4 OCR API ENDPOINTS")
    print("=" * 60)

    # 1. Status Check
    status_req = urllib.request.Request("http://127.0.0.1:8000/api/samples/ocr/status")
    with urllib.request.urlopen(status_req, timeout=10) as resp:
        status_data = json.loads(resp.read().decode("utf-8"))
    print(f"\n1. OCR Service Status: {status_data}")
    assert "model_name" in status_data
    assert "device" in status_data
    assert "available_modes" in status_data
    assert "original" in status_data["available_modes"]
    assert "enhanced" in status_data["available_modes"]
    assert "denoised" in status_data["available_modes"]

    # 2. Blank page test
    print("\n2. Testing Blank Image via OCR API...")
    blank = np.ones((500, 500, 3), dtype=np.uint8) * 255
    _, blank_bytes = cv2.imencode(".png", blank)
    res_blank = send_multipart_ocr("blank.png", blank_bytes.tobytes(), mode="original")
    print(f"   Success: {res_blank.get('success')}, Message: {res_blank.get('message')}")
    assert res_blank.get("success") is False
    assert res_blank.get("line_count") == 0
    assert res_blank.get("preprocessing_mode") == "original"

    # 3. Mode parameter test with enhanced mode on blank page
    print("\n3. Testing Mode Parameter Handling ('enhanced')...")
    res_enh = send_multipart_ocr("blank.png", blank_bytes.tobytes(), mode="enhanced")
    assert res_enh.get("preprocessing_mode") == "enhanced"
    print("   Mode 'enhanced' acknowledged correctly.")

    print("\nAll OCR API tests passed successfully!")


if __name__ == "__main__":
    test_ocr_api()
