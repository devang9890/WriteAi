"""
Automated Test Suite for Step 5 Handwriting Style Analysis Endpoint (POST /api/samples/style).
Tests:
1. POST /api/samples/style with real handwriting sample verifies valid metrics, units, and dominant ink color.
2. POST /api/samples/style with blank image gracefully returns success=False without crashing.
3. Distinguishes measured values from heuristic estimates (is_heuristic flags).
"""

import urllib.request
import json
import cv2
import numpy as np


def send_multipart_style(filename: str, file_bytes: bytes) -> dict:
    url = "http://127.0.0.1:8000/api/samples/style"
    boundary = "----WriteAITestBoundaryStyle12345"
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
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def test_style_api():
    print("=" * 60)
    print("TESTING STEP 5 HANDWRITING STYLE ANALYSIS ENDPOINTS")
    print("=" * 60)

    # 1. Blank Image Test
    print("\n1. Testing Blank Image Handling...")
    blank = np.ones((400, 400, 3), dtype=np.uint8) * 255
    _, blank_bytes = cv2.imencode(".jpg", blank)
    res_blank = send_multipart_style("blank.jpg", blank_bytes.tobytes())
    print(f"   Success: {res_blank.get('success')}, Message: {res_blank.get('message')}")
    assert res_blank.get("success") is False
    assert "no measurable handwriting" in res_blank.get("message", "").lower()

    # 2. Real Handwriting Sample Test
    print("\n2. Testing Real Handwriting Sample (test_page_real.jpg)...")
    sample_path = r"C:\Users\ACER\Desktop\WriteAi\test_assets\test_page_real.jpg"
    with open(sample_path, "rb") as f:
        real_bytes = f.read()

    res_real = send_multipart_style("test_page_real.jpg", real_bytes)
    print(f"   Success: {res_real.get('success')}")
    print(f"   Lines detected: {res_real.get('line_count_detected')}")
    print(f"   Analysis Time: {res_real.get('analysis_time_sec')}s")

    assert res_real.get("success") is True
    metrics = res_real.get("metrics")
    assert metrics is not None

    # Check stroke thickness
    thickness = metrics.get("stroke_thickness")
    print(f"   Stroke Thickness: {thickness.get('value')} {thickness.get('unit')} (status: {thickness.get('status')})")
    assert thickness.get("value") is not None and thickness.get("value") > 0
    assert thickness.get("unit") == "px"
    assert thickness.get("is_heuristic") is False

    # Check line height
    l_height = metrics.get("line_height")
    print(f"   Line Height: {l_height.get('value')} {l_height.get('unit')}")
    assert l_height.get("value") is not None
    assert l_height.get("unit") == "px"

    # Check line spacing
    l_spacing = metrics.get("line_spacing")
    print(f"   Line Spacing: {l_spacing.get('value')} {l_spacing.get('unit')}")
    assert l_spacing.get("value") is not None
    assert l_spacing.get("unit") == "px"

    # Check horizontal spacing (heuristic)
    h_spacing = metrics.get("horizontal_spacing")
    print(f"   Horizontal Spacing: {h_spacing.get('value')} {h_spacing.get('unit')} (is_heuristic: {h_spacing.get('is_heuristic')})")
    assert h_spacing.get("is_heuristic") is True

    # Check slant
    slant = metrics.get("slant_angle")
    print(f"   Slant Angle: {slant.get('value')} {slant.get('unit')}")
    assert slant.get("unit") == "deg"

    # Check dominant ink color
    color = res_real.get("dominant_color")
    print(f"   Dominant Ink: {color.get('color_name')} | Hex: {color.get('hex')} | RGB: {color.get('rgb')}")
    assert color.get("hex") is not None
    assert color.get("rgb") is not None

    # Check summary headline
    summary = res_real.get("summary")
    print(f"   Style Summary: {summary.get('headline')}")
    assert summary.get("headline") is not None

    print("\nAll Step 5 Style Analysis tests passed successfully!")


if __name__ == "__main__":
    test_style_api()
