"""
Automated Test Suite for Step 7: Personalized Handwriting Style Profile
(POST /api/profile, GET /api/profile, DELETE /api/profile).

Tests:
1. Initial state: GET returns 404 when no profile is created.
2. Single sample build: Profile created with 512-D embedding and aggregated morphological metrics.
3. Disk retrieval: GET returns the persisted profile accurately.
4. Multiple samples aggregation: Combines 2 real pages using median pooling and normalized embeddings.
5. Robustness / Resilience: Tolerates blank or corrupted samples alongside valid pages.
6. Sample comparison: Cosine similarity and individual metric comparisons are computed.
7. Profile deletion / reset: DELETE removes the profile from disk.
"""

import json
import urllib.request
import urllib.error
import cv2
import numpy as np


BASE_URL = "http://127.0.0.1:8000/api/profile"
TEST_PAGE_REAL = r"C:\Users\ACER\Desktop\WriteAi\test_assets\test_page_real.jpg"
SAMPLE_PAGE_1 = r"C:\Users\ACER\Desktop\WriteAi\test_assets\sample_page1.jpg"


def send_multipart_profile(files: list, profile_id: str = "test_profile_writer") -> dict:
    url = f"{BASE_URL}?profile_id={profile_id}"
    boundary = "----WriteAITestBoundaryProfile777"
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
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_profile(profile_id: str = "test_profile_writer"):
    url = f"{BASE_URL}?profile_id={profile_id}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


def delete_profile(profile_id: str = "test_profile_writer"):
    url = f"{BASE_URL}?profile_id={profile_id}"
    req = urllib.request.Request(url, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


def test_step7_profile_api():
    print("=" * 65)
    print("TESTING STEP 7: PERSONALIZED HANDWRITING STYLE PROFILE API")
    print("=" * 65)

    profile_id = "test_writer_unit"

    # Clean up any lingering test profile
    delete_profile(profile_id)

    # 1. Initial State: GET returns 404
    print("\n1. Testing GET on non-existent profile (should return 404)...")
    status, res = get_profile(profile_id)
    print(f"   Status: {status}, Detail: {res.get('detail')}")
    assert status == 404, f"Expected 404, got {status}"

    # Load test image bytes
    with open(TEST_PAGE_REAL, "rb") as f:
        real_bytes_1 = f.read()

    with open(SAMPLE_PAGE_1, "rb") as f:
        real_bytes_2 = f.read()

    # 2. Single Sample Profile Creation
    print("\n2. Testing profile creation with single real handwriting page...")
    res_single = send_multipart_profile([("test_page_real.jpg", real_bytes_1)], profile_id=profile_id)
    print(f"   Success: {res_single.get('success')}")
    print(f"   Profile Status: {res_single.get('status')}")
    print(f"   Valid Samples: {res_single.get('valid_samples_count')}")
    print(f"   Embedding Dim: {res_single.get('embedding_dim')}")
    print(f"   Aggregated Metrics: {res_single.get('aggregated_metrics')}")

    assert res_single.get("success") is True
    assert res_single.get("status") == "ready"
    assert res_single.get("valid_samples_count") == 1
    assert res_single.get("embedding_dim") == 512
    assert len(res_single.get("embedding")) == 512

    metrics = res_single.get("aggregated_metrics")
    assert metrics is not None
    assert metrics.get("stroke_thickness", {}).get("value") is not None and metrics["stroke_thickness"]["value"] > 0
    assert metrics.get("line_height", {}).get("value") is not None and metrics["line_height"]["value"] > 0
    assert metrics.get("ink_density", {}).get("value") is not None
    assert metrics.get("ink_coverage_pct", {}).get("value") is not None

    # 3. Persistence: GET profile from disk
    print("\n3. Testing GET saved profile from disk...")
    status, res_get = get_profile(profile_id)
    print(f"   GET Status: {status}")
    print(f"   Retrieved Profile ID: {res_get.get('profile_id')}")
    print(f"   Retrieved Timestamp: {res_get.get('updated_at')}")

    assert status == 200
    assert res_get.get("profile_id") == profile_id
    assert res_get.get("embedding_dim") == 512
    assert res_get.get("valid_samples_count") == 1

    # 4. Multi-sample Profile Aggregation
    print("\n4. Testing multi-sample profile aggregation (2 real pages)...")
    res_multi = send_multipart_profile([
        ("test_page_real.jpg", real_bytes_1),
        ("sample_page1.jpg", real_bytes_2),
    ], profile_id=profile_id)

    print(f"   Success: {res_multi.get('success')}")
    print(f"   Valid Samples: {res_multi.get('valid_samples_count')}/{res_multi.get('total_samples_analyzed')}")
    print(f"   Comparisons Count: {len(res_multi.get('sample_comparisons'))}")

    assert res_multi.get("success") is True
    assert res_multi.get("valid_samples_count") == 2
    assert len(res_multi.get("sample_comparisons")) == 2
    for comp in res_multi.get("sample_comparisons"):
        print(f"     - Sample '{comp.get('filename')}': cosine similarity = {comp.get('cosine_similarity')}")
        assert comp.get("success") is True
        assert comp.get("cosine_similarity") is not None
        assert -1.0 <= comp.get("cosine_similarity") <= 1.0

    # 5. Resilience: Blank / corrupted image does not crash profile creation
    print("\n5. Testing resilience when a blank image is uploaded alongside valid image...")
    blank = np.ones((400, 400, 3), dtype=np.uint8) * 255
    _, blank_bytes = cv2.imencode(".jpg", blank)

    res_resilient = send_multipart_profile([
        ("valid_real.jpg", real_bytes_1),
        ("blank_corrupt.jpg", blank_bytes.tobytes()),
    ], profile_id=profile_id)

    print(f"   Success: {res_resilient.get('success')}")
    print(f"   Total: {res_resilient.get('total_samples_analyzed')}, Valid: {res_resilient.get('valid_samples_count')}")
    assert res_resilient.get("success") is True
    assert res_resilient.get("valid_samples_count") == 1
    assert res_resilient.get("total_samples_analyzed") == 2
    blank_comp = [c for c in res_resilient.get("sample_comparisons") if c.get("filename") == "blank_corrupt.jpg"][0]
    assert blank_comp.get("success") is False
    print(f"   Blank sample handled safely: {blank_comp.get('error_message')}")

    # 6. Profile deletion / reset
    print("\n6. Testing profile deletion...")
    del_status, del_res = delete_profile(profile_id)
    print(f"   Delete Status: {del_status}, Message: {del_res.get('message')}")
    assert del_status == 200
    assert del_res.get("success") is True

    # Confirm 404 after deletion
    status, _ = get_profile(profile_id)
    assert status == 404
    print("   Profile 404 verified after deletion.")

    print("\n" + "=" * 65)
    print("ALL STEP 7 PERSONALIZED STYLE PROFILE TESTS PASSED SUCCESSFULLY!")
    print("=" * 65)


if __name__ == "__main__":
    test_step7_profile_api()
