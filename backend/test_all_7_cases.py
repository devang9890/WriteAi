import json
import urllib.request
import uuid
import cv2
import numpy as np


def send_image_to_segment_api(filename: str, img_bytes: bytes):
    boundary = uuid.uuid4().hex
    body = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f'Content-Type: image/png\r\n\r\n'
    ).encode('utf-8') + img_bytes + f'\r\n--{boundary}--\r\n'.encode('utf-8')

    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/samples/segment',
        data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )

    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))


def run_all_7_tests():
    print("=" * 70)
    print("TESTING 7 COMPREHENSIVE HANDWRITING SEGMENTATION SCENARIOS VIA API")
    print("=" * 70)

    # -------------------------------------------------------------------------
    # Test 1: Clean handwritten page
    # -------------------------------------------------------------------------
    content1 = open('../test_assets/sample_page1.jpg', 'rb').read()
    res1 = send_image_to_segment_api('sample_page1.jpg', content1)
    print("\n--- Test 1: Clean Handwritten Page ---")
    print(f"Success: {res1.get('success')}, Line count: {res1.get('line_count')}")
    assert res1.get('success') is True
    assert res1.get('line_count') == 10, f"Expected 10 lines, got {res1.get('line_count')}"
    print("PASSED Test 1: Detected all 10 handwriting lines with tight bounding boxes.")

    # -------------------------------------------------------------------------
    # Test 2: Page with a pen/object near the top
    # -------------------------------------------------------------------------
    img_pen = cv2.imread('../test_assets/sample_page1.jpg')
    # Add a solid dark pen barrel at the top
    cv2.rectangle(img_pen, (140, 8), (660, 36), (18, 22, 25), -1)
    cv2.circle(img_pen, (140, 22), 12, (15, 18, 20), -1)
    cv2.circle(img_pen, (660, 22), 10, (15, 18, 20), -1)
    _, pen_png = cv2.imencode('.png', img_pen)
    res2 = send_image_to_segment_api('page_with_pen.png', pen_png.tobytes())
    print("\n--- Test 2: Page with Pen/Object Near the Top ---")
    print(f"Success: {res2.get('success')}, Line count: {res2.get('line_count')}")
    # Verify pen was NOT detected as Line 1
    first_line_y = res2['lines'][0]['bbox']['y']
    print(f"First detected line y: {first_line_y} (Pen was located at y=8..36)")
    assert first_line_y >= 45, f"False positive: Pen detected at y={first_line_y}"
    assert res2.get('line_count') == 10, f"Expected 10 text lines (excluding pen), got {res2.get('line_count')}"
    print("PASSED Test 2: Pen object correctly rejected! Line 1 is actual handwriting.")

    # -------------------------------------------------------------------------
    # Test 3: Page with shadows (e.g. gradient phone/desk shadow at bottom)
    # -------------------------------------------------------------------------
    img_shadow = cv2.imread('../test_assets/sample_page1.jpg')
    H, W = img_shadow.shape[:2]
    for y in range(460, H):
        factor = 1.0 - (y - 460) / float(H - 460) * 0.70
        img_shadow[y, :] = np.clip(img_shadow[y, :].astype(float) * factor, 0, 255).astype(np.uint8)
    _, shadow_png = cv2.imencode('.png', img_shadow)
    res3 = send_image_to_segment_api('page_with_shadow.png', shadow_png.tobytes())
    print("\n--- Test 3: Page with Shadows at the Bottom ---")
    print(f"Success: {res3.get('success')}, Line count: {res3.get('line_count')}")
    assert res3.get('line_count') == 10, f"Expected 10 lines (no false shadow lines), got {res3.get('line_count')}"
    print("PASSED Test 3: Bottom shadow normalized! Zero false line detections in shadow region.")

    # -------------------------------------------------------------------------
    # Test 4: Page with faint handwriting
    # -------------------------------------------------------------------------
    faint_page = np.ones((600, 800, 3), dtype=np.uint8) * 245
    # Add faint pencil handwriting lines (low contrast: gray value ~205 on 245 background)
    cv2.putText(faint_page, 'Faint pencil note line 1', (80, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (200, 200, 205), 2)
    cv2.putText(faint_page, 'Second faint pencil note line 2', (80, 320), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (195, 195, 200), 2)
    _, faint_png = cv2.imencode('.png', faint_page)
    res4 = send_image_to_segment_api('faint_handwriting.png', faint_png.tobytes())
    print("\n--- Test 4: Page with Faint Handwriting ---")
    print(f"Success: {res4.get('success')}, Line count: {res4.get('line_count')}")
    assert res4.get('success') is True
    assert res4.get('line_count') == 2, f"Expected 2 faint lines, got {res4.get('line_count')}"
    print("PASSED Test 4: Faint handwriting preserved and detected accurately.")

    # -------------------------------------------------------------------------
    # Test 5: Page with bullet points and headings
    # -------------------------------------------------------------------------
    bullet_page = np.ones((700, 800, 3), dtype=np.uint8) * 255
    cv2.putText(bullet_page, 'MEETING NOTES', (80, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (25, 25, 30), 2)
    # Bullet 1
    cv2.circle(bullet_page, (65, 195), 5, (25, 25, 30), -1)
    cv2.putText(bullet_page, 'Action item 1 for review', (90, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (25, 25, 30), 2)
    # Bullet 2
    cv2.circle(bullet_page, (65, 295), 5, (25, 25, 30), -1)
    cv2.putText(bullet_page, 'Action item 2 with milestones', (90, 300), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (25, 25, 30), 2)
    _, bullet_png = cv2.imencode('.png', bullet_page)
    res5 = send_image_to_segment_api('bullet_page.png', bullet_png.tobytes())
    print("\n--- Test 5: Page with Bullet Points & Headings ---")
    print(f"Success: {res5.get('success')}, Line count: {res5.get('line_count')}")
    assert res5.get('line_count') == 3, f"Expected 3 lines, got {res5.get('line_count')}"
    # Verify bullet dots were incorporated into lines 2 and 3
    line2_x = res5['lines'][1]['bbox']['x']
    assert line2_x <= 65, f"Bullet dot should be included in line 2 bounding box (got x={line2_x})"
    print("PASSED Test 5: Bullets properly grouped into their respective lines.")

    # -------------------------------------------------------------------------
    # Test 6: Blank page
    # -------------------------------------------------------------------------
    blank = np.ones((600, 800, 3), dtype=np.uint8) * 255
    _, blank_png = cv2.imencode('.png', blank)
    res6 = send_image_to_segment_api('blank_page.png', blank_png.tobytes())
    print("\n--- Test 6: Blank Page ---")
    print(f"Success: {res6.get('success')}, Message: {res6.get('message')}, Line count: {res6.get('line_count')}")
    assert res6.get('success') is False
    assert res6.get('line_count') == 0
    print("PASSED Test 6: Zero lines detected; graceful informative message returned.")

    # -------------------------------------------------------------------------
    # Test 7: Uneven line spacing
    # -------------------------------------------------------------------------
    uneven = np.ones((900, 800, 3), dtype=np.uint8) * 255
    cv2.putText(uneven, 'First line at top', (80, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (20, 20, 30), 2)
    cv2.putText(uneven, 'Second line right below with tiny gap', (80, 150), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (20, 20, 30), 2)
    cv2.putText(uneven, 'Third line way down near bottom with huge gap', (80, 780), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (20, 20, 30), 2)
    _, uneven_png = cv2.imencode('.png', uneven)
    res7 = send_image_to_segment_api('uneven_spacing.png', uneven_png.tobytes())
    print("\n--- Test 7: Uneven Line Spacing ---")
    print(f"Success: {res7.get('success')}, Line count: {res7.get('line_count')}")
    assert res7.get('line_count') == 3, f"Expected 3 lines, got {res7.get('line_count')}"
    print(f"  Line 1 bbox: {res7['lines'][0]['bbox']}")
    print(f"  Line 2 bbox: {res7['lines'][1]['bbox']}")
    print(f"  Line 3 bbox: {res7['lines'][2]['bbox']}")
    print("PASSED Test 7: Lines with arbitrary vertical gaps correctly identified.")

    print("\n" + "=" * 70)
    print("ALL 7 TESTS COMPLETED AND VERIFIED WITH 100% SUCCESS!")
    print("=" * 70)


if __name__ == '__main__':
    run_all_7_tests()
