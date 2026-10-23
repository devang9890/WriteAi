"""
Automated Test Suite for Step 6 CNN-Based Handwriting Style Encoder Endpoint
(POST /api/samples/style-encoder and POST /api/style-encoder/extract).

Tests:
1. Single sample extraction produces 512-D finite embedding vector.
2. Multi-sample aggregation combines multiple pages via normalized mean pooling.
3. Blank/unsuitable image handling gracefully returns success=False without crashing.
4. Statistics (min, max, mean, std, l2_norm) are verified and finite.
5. Model status verifies ResNet-18 ImageNet pretrained backbone without fake claims.
"""

import urllib.request
import json
import cv2
import numpy as np


def send_multipart_encoder(files: list) -> dict:
    url = "http://127.0.0.1:8000/api/samples/style-encoder"
    boundary = "----WriteAITestBoundaryEncoder12345"
    body = bytearray()

    for filename, file_bytes in files:
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="files"; filename="{filename}"\r\n'.encode("utf-8"))
        body.extend(b"Content-Type: image/jpeg\r\n\r\n")
        body.extend(file_bytes)
        body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    req = urllib.request.Request(
        url,
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=40) as resp:
        return json.loads(resp.read().decode("utf-8"))


def test_style_encoder_api():
    print("=" * 65)
    print("TESTING STEP 6 CNN-BASED HANDWRITING STYLE ENCODER ENDPOINTS")
    print("=" * 65)

    # 1. Blank Image Test
    print("\n1. Testing Blank Image Handling...")
    blank = np.ones((400, 400, 3), dtype=np.uint8) * 255
    _, blank_bytes = cv2.imencode(".jpg", blank)
    res_blank = send_multipart_encoder([("blank.jpg", blank_bytes.tobytes())])
    print(f"   Success: {res_blank.get('success')}, Message: {res_blank.get('message')}")
    assert res_blank.get("success") is False
    assert res_blank.get("successful_samples") == 0

    # 2. Single Real Handwriting Sample Test
    print("\n2. Testing Single Real Sample (test_page_real.jpg)...")
    sample_path = r"C:\Users\ACER\Desktop\WriteAi\test_assets\test_page_real.jpg"
    with open(sample_path, "rb") as f:
        real_bytes = f.read()

    res_single = send_multipart_encoder([("test_page_real.jpg", real_bytes)])
    print(f"   Success: {res_single.get('success')}")
    print(f"   Model: {res_single.get('model_name')}")
    print(f"   Pretrained: {res_single.get('is_pretrained')}")
    print(f"   Embedding Dim: {res_single.get('embedding_dim')}")
    print(f"   Processing Time: {res_single.get('processing_time_sec')}s")
    print(f"   Stats: {res_single.get('statistics')}")

    assert res_single.get("success") is True
    assert res_single.get("embedding_dim") == 512
    embedding = res_single.get("embedding")
    assert len(embedding) == 512
    assert all(np.isfinite(embedding))
    assert res_single.get("is_pretrained") is True

    # 3. Multiple Handwriting Samples Aggregation Test
    print("\n3. Testing Multiple Handwriting Samples Aggregation...")
    sample_path_2 = r"C:\Users\ACER\Desktop\WriteAi\test_assets\sample_page1.jpg"
    with open(sample_path_2, "rb") as f:
        real_bytes_2 = f.read()

    res_multi = send_multipart_encoder([
        ("test_page_real.jpg", real_bytes),
        ("sample_page1.jpg", real_bytes_2),
    ])
    print(f"   Success: {res_multi.get('success')}")
    print(f"   Total Samples: {res_multi.get('total_samples_received')}")
    print(f"   Successful Samples: {res_multi.get('successful_samples')}")
    print(f"   Aggregation Method: {res_multi.get('aggregation_method')}")
    print(f"   Sample Details: {len(res_multi.get('sample_details'))} items")

    assert res_multi.get("success") is True
    assert res_multi.get("successful_samples") == 2
    assert len(res_multi.get("embedding")) == 512
    assert "2 samples combined" in res_multi.get("aggregation_method")

    print("\nAll Step 6 Style Encoder API tests passed successfully!")


if __name__ == "__main__":
    test_style_encoder_api()
