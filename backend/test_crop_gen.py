import os
import cv2
import numpy as np
from PIL import Image
import torch
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from app.services.segmentation import segment_handwriting_lines

# 1. Load original image
img_path = r"C:\Users\ACER\Desktop\WriteAi\test_assets\test_page_real.jpg"
orig_bgr = cv2.imread(img_path)
h, w = orig_bgr.shape[:2]
print(f"Loaded original image: {w}x{h}")

# 2. Run segmentation
seg = segment_handwriting_lines(orig_bgr)
lines = seg["lines"]
print(f"Detected lines: {len(lines)}")

# Create debug dir
debug_dir = r"C:\Users\ACER\Desktop\WriteAi\backend\debug\ocr_inputs"
os.makedirs(debug_dir, exist_ok=True)

# Save first 5 crops as currently extracted
for i in range(min(5, len(lines))):
    line = lines[i]
    idx = line["index"]
    bbox = line["bbox"]
    x, y, bw, bh = bbox["x"], bbox["y"], bbox["width"], bbox["height"]
    crop = orig_bgr[y:y+bh, x:x+bw]
    out_file = os.path.join(debug_dir, f"line_{idx:02d}_current.png")
    cv2.imwrite(out_file, crop)
    print(f"Line {idx}: bbox=({x}, {y}, {bw}, {bh}), aspect={bw/bh:.2f}, saved to {out_file}")

# Load processor and model
print("Loading TrOCR model...")
processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten")
model.eval()

# Let's test Line 1 and Line 2 with different generation parameters and preprocessing
for line_idx in [1, 2]:
    line = lines[line_idx - 1]
    bbox = line["bbox"]
    x, y, bw, bh = bbox["x"], bbox["y"], bbox["width"], bbox["height"]
    crop_bgr = orig_bgr[y:y+bh, x:x+bw]
    crop_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
    pil_crop = Image.fromarray(crop_rgb)
    
    pixel_values = processor(pil_crop, return_tensors="pt").pixel_values
    
    # Test 1: Current settings (num_beams=1, no_repeat_ngram_size=3, repetition_penalty=1.2)
    with torch.no_grad():
        out1 = model.generate(
            pixel_values,
            max_new_tokens=64,
            num_beams=1,
            no_repeat_ngram_size=3,
            repetition_penalty=1.2,
        )
    text1 = processor.batch_decode(out1, skip_special_tokens=True)[0]
    
    # Test 2: Standard greedy (no repetition penalty)
    with torch.no_grad():
        out2 = model.generate(
            pixel_values,
            max_new_tokens=64,
            num_beams=1,
        )
    text2 = processor.batch_decode(out2, skip_special_tokens=True)[0]
    
    # Test 3: Beam search (num_beams=4)
    with torch.no_grad():
        out3 = model.generate(
            pixel_values,
            max_new_tokens=64,
            num_beams=4,
            early_stopping=True,
        )
    text3 = processor.batch_decode(out3, skip_special_tokens=True)[0]
    
    # Test 4: Beam search (num_beams=2)
    with torch.no_grad():
        out4 = model.generate(
            pixel_values,
            max_new_tokens=64,
            num_beams=2,
            early_stopping=True,
        )
    text4 = processor.batch_decode(out4, skip_special_tokens=True)[0]

    print(f"\n--- Line {line_idx} ---")
    print(f"Current setting (rep penalty=1.2):  {text1}")
    print(f"Standard greedy (num_beams=1):       {text2}")
    print(f"Beam search (num_beams=2):           {text4}")
    print(f"Beam search (num_beams=4):           {text3}")
