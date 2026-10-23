import cv2
import time
from app.services.segmentation import segment_handwriting_lines
from app.services.ocr_service import get_ocr_service

print("=" * 60)
print("TESTING STEP 4: TrOCR HANDWRITTEN TEXT RECOGNITION")
print("=" * 60)

print("\n1. Segmenting lines from test_page_real.jpg...")
img = cv2.imread(r"C:\Users\ACER\Desktop\WriteAi\test_assets\test_page_real.jpg")
seg = segment_handwriting_lines(img)
print(f"Segmented {seg['line_count']} lines.")

print("\n2. Initializing TrOCR model (downloading on first load if not cached)...")
ocr = get_ocr_service()
t0 = time.time()
loaded = ocr.load_model()
print(f"Model load status: {loaded} in {time.time() - t0:.2f}s")
print(f"Device: {ocr.device.upper()}")

print("\n3. Transcribing first 6 lines with TrOCR:")
for line in seg["lines"][:6]:
    idx = line["index"]
    crop_url = line["image"]
    t_start = time.time()
    text = ocr.recognize_line(crop_url)
    elapsed = time.time() - t_start
    print(f"  [Line {idx}] ({elapsed:.2f}s): \"{text}\"")

print("\nTest completed successfully!")
