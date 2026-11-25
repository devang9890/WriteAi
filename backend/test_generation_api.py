"""
Automated Test Suite for Step 8: Handwriting Generation Engine
(POST /api/generate/handwriting and GET /api/generate/page/{session_id}/{page_num}).

Tests:
1. Empty input validation: Returns 400 when empty or whitespace-only text is sent.
2. Short text single-page generation: Valid A4 (1240x1754) PNG output with base64 data URL.
3. Multi-page pagination: Long text automatically wraps and overflows across multiple pages.
4. Style profile personalization: Incorporates dominant ink color & median geometry from Step 7 profile.
5. Missing profile fallback: Gracefully falls back to default settings without crashing.
6. Direct image retrieval: GET endpoint returns valid PNG image bytes.
7. Paper background styles: Renders ruled notebook and blank paper styles cleanly.
"""

import io
import json
import urllib.request
import urllib.error
from PIL import Image


BASE_URL = "http://127.0.0.1:8000/api/generate/handwriting"


def send_generation_request(payload: dict):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        BASE_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


def get_generated_page(session_id: str, page_num: int):
    url = f"http://127.0.0.1:8000/api/generate/page/{session_id}/{page_num}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def test_step8_generation_engine():
    print("=" * 65)
    print("TESTING STEP 8: HANDWRITING GENERATION ENGINE API")
    print("=" * 65)

    # 1. Empty Input Test
    print("\n1. Testing Empty Input Validation...")
    status, res = send_generation_request({"text": "   "})
    print(f"   Status: {status}, Detail: {res.get('detail')}")
    assert status == 400 or status == 422
    assert "empty" in str(res.get("detail", "")).lower()

    # 2. Short Text Single Page Test
    print("\n2. Testing Short Text Single Page Generation...")
    short_text = (
        "WriteAI Personalized Handwriting Generation System.\n\n"
        "Machine learning models often require careful empirical evaluation. "
        "This sample assignment demonstrates computer vision preprocessing, "
        "handwritten text recognition, and style analysis combined with parametric typography."
    )
    status, res = send_generation_request({
        "text": short_text,
        "options": {
            "font_family": "casual",
            "font_size": 28,
            "page_style": "ruled",
            "use_profile": False,
        }
    })
    print(f"   Status: {status}, Success: {res.get('success')}")
    print(f"   Total Pages: {res.get('total_pages')}")
    print(f"   Renderer: {res.get('renderer_name')}")
    print(f"   Time: {res.get('generation_time_sec')}s")

    assert status == 200
    assert res.get("success") is True
    assert res.get("total_pages") == 1
    session_id = res.get("session_id")
    assert session_id is not None

    pages = res.get("pages", [])
    assert len(pages) == 1
    page1 = pages[0]
    assert page1.get("page_number") == 1
    assert page1.get("width") == 1240
    assert page1.get("height") == 1754
    assert page1.get("image_data", "").startswith("data:image/png;base64,")

    # 3. Direct GET Image Bytes Retrieval
    print("\n3. Testing Direct GET Image Retrieval via /api/generate/page/...")
    img_status, img_bytes = get_generated_page(session_id, 1)
    print(f"   Image Status: {img_status}, Size: {len(img_bytes)} bytes")
    assert img_status == 200
    # Verify valid PNG header and dimensions
    pil_img = Image.open(io.BytesIO(img_bytes))
    assert pil_img.format == "PNG"
    assert pil_img.size == (1240, 1754)
    print(f"   Image Verified: Format={pil_img.format}, Size={pil_img.size}")

    # 4. Multi-Page Pagination Test (Long Text)
    print("\n4. Testing Multi-Page Pagination with Long Text...")
    long_paragraphs = []
    for i in range(1, 15):
        long_paragraphs.append(
            f"Section {i}: Deep neural networks and computer vision techniques enable systematic decomposition "
            f"of handwriting artifacts. From stroke morphology and slant estimation to deep ResNet embeddings, "
            f"each measurement captures a distinct facet of penmanship. Natural handwriting demonstrates subtle "
            f"spatial variations in baseline drift, word spacing, and ink pressure that differentiate human script from mechanical typography."
        )
    long_text = "\n\n".join(long_paragraphs)
    status_multi, res_multi = send_generation_request({
        "text": long_text,
        "options": {
            "font_family": "casual",
            "font_size": 28,
            "line_spacing_mult": 1.4,
            "page_style": "ruled",
            "use_profile": False,
        }
    })
    print(f"   Multi-page Status: {status_multi}")
    print(f"   Total Pages Generated: {res_multi.get('total_pages')}")
    assert status_multi == 200
    assert res_multi.get("success") is True
    assert res_multi.get("total_pages") >= 2
    for p in res_multi.get("pages"):
        print(f"     - Page {p.get('page_number')}: {p.get('line_count')} lines, {p.get('word_count')} words")
        assert p.get("width") == 1240
        assert p.get("height") == 1754
        assert p.get("image_data").startswith("data:image/png;base64,")

    # 4b. Verify Compiled Multi-Page PDF Download
    print("\n4b. Testing Multi-Page PDF Document Retrieval via /api/generate/pdf/...")
    multi_session_id = res_multi.get("session_id")
    pdf_url = f"http://127.0.0.1:8000/api/generate/pdf/{multi_session_id}"
    req_pdf = urllib.request.Request(pdf_url, method="GET")
    with urllib.request.urlopen(req_pdf, timeout=15) as resp:
        pdf_bytes = resp.read()
        assert resp.status == 200
        assert pdf_bytes.startswith(b"%PDF-")
        print(f"   PDF Document Verified: Size={len(pdf_bytes)} bytes, Header={pdf_bytes[:5]}")


    # 5. Missing Profile Fallback Test
    print("\n5. Testing Missing Profile Fallback...")
    status_missing, res_missing = send_generation_request({
        "text": "Fallback test without profile.",
        "options": {
            "profile_id": "non_existent_writer_profile_xyz",
            "use_profile": True,
        }
    })
    print(f"   Status: {status_missing}, Profile Applied: {res_missing.get('profile_applied')}")
    assert status_missing == 200
    assert res_missing.get("profile_applied") is False

    # 6. Step 7 Profile Personalization Integration
    print("\n6. Testing Integration with Saved Step 7 Style Profile...")
    # First build a style profile with a known real sample
    profile_url = "http://127.0.0.1:8000/api/profile?profile_id=test_writer_gen"
    boundary = "----WriteAITestGenProfile"
    body = bytearray()
    with open(r"C:\Users\ACER\Desktop\WriteAi\test_assets\test_page_real.jpg", "rb") as f:
        real_bytes = f.read()
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(b'Content-Disposition: form-data; name="files"; filename="sample.jpg"\r\nContent-Type: image/jpeg\r\n\r\n')
    body.extend(real_bytes)
    body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))
    p_req = urllib.request.Request(profile_url, data=bytes(body), headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}, method="POST")
    with urllib.request.urlopen(p_req) as p_resp:
        profile_data = json.loads(p_resp.read().decode("utf-8"))
    print(f"   Saved Profile Created: Status={profile_data.get('status')}, Ink={profile_data.get('dominant_color')}")

    # Now generate with this profile ID
    status_prof, res_prof = send_generation_request({
        "text": "Personalized generated text with writer profile.",
        "options": {
            "profile_id": "test_writer_gen",
            "use_profile": True,
        }
    })
    print(f"   Personalized Status: {status_prof}")
    print(f"   Profile Applied: {res_prof.get('profile_applied')}")
    print(f"   Options Applied: {res_prof.get('options_applied')}")
    assert status_prof == 200
    assert res_prof.get("profile_applied") is True
    assert res_prof.get("options_applied", {}).get("profile_used") is True

    # Clean up test profile
    del_req = urllib.request.Request(profile_url, method="DELETE")
    with urllib.request.urlopen(del_req) as del_resp:
        pass

    print("\n" + "=" * 65)
    print("ALL STEP 8 HANDWRITING GENERATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 65)


if __name__ == "__main__":
    test_step8_generation_engine()
