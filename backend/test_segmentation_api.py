import io
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


def run_all_tests():
    print("=" * 60)
    print("RUNNING 5 COMPREHENSIVE SEGMENTATION TEST CASES VIA API")
    print("=" * 60)

    # Test 1: Normal handwritten page with several lines
    content1 = open('../test_assets/sample_page1.jpg', 'rb').read()
    res1 = send_image_to_segment_api('sample_page1.jpg', content1)
    print("\n--- Test 1: Normal Handwritten Page ---")
    print(f"Success: {res1.get('success')}, Line count: {res1.get('line_count')}")
    assert res1.get('success') is True
    assert res1.get('line_count') in [10, 11]
    print(f"PASSED Test 1 (Detected {res1.get('line_count')} lines)")

    # Test 2: Single line page
    single = np.ones((600, 800, 3), dtype=np.uint8) * 255
    cv2.putText(single, 'Single handwritten line across the page', (80, 300), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (20, 20, 30), 2)
    _, single_png = cv2.imencode('.png', single)
    res2 = send_image_to_segment_api('single_line.png', single_png.tobytes())
    print("\n--- Test 2: Single Line Page ---")
    print(f"Success: {res2.get('success')}, Line count: {res2.get('line_count')}")
    assert res2.get('success') is True
    assert res2.get('line_count') == 1
    print("PASSED Test 2 (Detected exactly 1 line)")

    # Test 3: Blank page
    blank = np.ones((600, 800, 3), dtype=np.uint8) * 255
    _, blank_png = cv2.imencode('.png', blank)
    res3 = send_image_to_segment_api('blank_page.png', blank_png.tobytes())
    print("\n--- Test 3: Blank Page ---")
    print(f"Success: {res3.get('success')}, Message: {res3.get('message')}, Line count: {res3.get('line_count')}")
    assert res3.get('success') is False
    assert "No handwriting lines could be detected" in res3.get('message', '')
    print("PASSED Test 3 (Correctly reported no lines detected without crashing)")

    # Test 4: Uneven spacing between lines
    uneven = np.ones((900, 800, 3), dtype=np.uint8) * 255
    cv2.putText(uneven, 'First line at top', (80, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (20, 20, 30), 2)
    cv2.putText(uneven, 'Second line right below with small gap', (80, 180), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (20, 20, 30), 2)
    cv2.putText(uneven, 'Third line way down near bottom', (80, 750), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (20, 20, 30), 2)
    _, uneven_png = cv2.imencode('.png', uneven)
    res4 = send_image_to_segment_api('uneven_spacing.png', uneven_png.tobytes())
    print("\n--- Test 4: Uneven Spacing Page ---")
    print(f"Success: {res4.get('success')}, Line count: {res4.get('line_count')}")
    for l in res4.get('lines', []):
        print(f"  Line {l['index']}: y={l['bbox']['y']}, h={l['bbox']['height']}")
    assert res4.get('success') is True
    assert res4.get('line_count') == 3
    print("PASSED Test 4 (Correctly separated lines with uneven gaps)")

    # Test 5: Page with small amount of noise
    noisy = blank.copy()
    np.random.seed(42)
    noise_x = np.random.randint(0, 800, 120)
    noise_y = np.random.randint(0, 600, 120)
    noisy[noise_y, noise_x] = [0, 0, 0]
    _, noisy_png = cv2.imencode('.png', noisy)
    res5 = send_image_to_segment_api('noise_only.png', noisy_png.tobytes())
    print("\n--- Test 5: Small Noise Only ---")
    print(f"Success: {res5.get('success')}, Line count: {res5.get('line_count')}, Message: {res5.get('message')}")
    assert res5.get('success') is False or res5.get('line_count') == 0
    print("PASSED Test 5 (Noise was not converted into fake handwriting lines)")

    print("\n" + "=" * 60)
    print("ALL 5 TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == '__main__':
    run_all_tests()
