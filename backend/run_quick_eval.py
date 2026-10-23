import sys
import cv2
import numpy as np
from PIL import Image
import torch
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from app.services.segmentation import segment_handwriting_lines
from evaluate_ocr import calculate_cer_wer

print("Initializing test...", flush=True)
img_path = r"C:\Users\ACER\Desktop\WriteAi\test_assets\test_page_real.jpg"
orig_bgr = cv2.imread(img_path)
seg = segment_handwriting_lines(orig_bgr)
lines_by_idx = {l["index"]: l for l in seg["lines"]}

processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten")
model.eval()
print("Model ready.", flush=True)

def prepare_line_for_ocr(crop_bgr: np.ndarray, mode: str = "original") -> Image.Image:
    if crop_bgr is None or crop_bgr.size == 0:
        return Image.new("RGB", (32, 32), (255, 255, 255))
        
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    bg_val = np.percentile(gray, 85)
    ink_mask = gray < (bg_val - 18)
    
    col_counts = np.sum(ink_mask, axis=0)
    ink_cols = np.where(col_counts >= 2)[0]
    
    if len(ink_cols) > 0:
        x_min = max(0, ink_cols[0] - 12)
        x_max = min(crop_bgr.shape[1], ink_cols[-1] + 13)
        if (x_max - x_min) >= 30:
            crop_bgr = crop_bgr[:, x_min:x_max]
            gray = gray[:, x_min:x_max]

    if mode == "enhanced":
        clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
        enh = clahe.apply(gray)
        return Image.fromarray(cv2.cvtColor(enh, cv2.COLOR_GRAY2RGB))
    elif mode == "denoised":
        denoised = cv2.bilateralFilter(gray, d=3, sigmaColor=15, sigmaSpace=15)
        clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
        enh = clahe.apply(denoised)
        return Image.fromarray(cv2.cvtColor(enh, cv2.COLOR_GRAY2RGB))
    else:  # "original"
        return Image.fromarray(cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB))

# 5 representative lines:
TEST_LINES = [
    (1, "1 A Trademark is a distinctive word, name, symbol, logo, design", "difficult line"),
    (2, "combination used by a business to identify & distinguish its goods or", "medium line"),
    (4, "Purpose of a Trademark : ->", "punctuation/symbols"),
    (5, "For a startup a trademark helps,", "easy line"),
    (11, "# Rights of a Trademark owner", "heading/symbol"),
]

for mode in ["original", "enhanced", "denoised"]:
    print(f"\n=======================================================", flush=True)
    print(f"EVALUATING PREPROCESSING MODE: '{mode}'", flush=True)
    print(f"=======================================================", flush=True)
    cers, wers = [], []
    for idx, gt, label in TEST_LINES:
        if idx not in lines_by_idx:
            continue
        bbox = lines_by_idx[idx]["bbox"]
        x, y, w, h = bbox["x"], bbox["y"], bbox["width"], bbox["height"]
        crop = orig_bgr[y:y+h, x:x+w]
        
        pil_img = prepare_line_for_ocr(crop, mode=mode)
        pixel_values = processor(pil_img, return_tensors="pt").pixel_values
        
        with torch.no_grad():
            out = model.generate(pixel_values, max_new_tokens=64, num_beams=1)
        pred = processor.batch_decode(out, skip_special_tokens=True)[0]
        
        cer, wer = calculate_cer_wer(gt, pred)
        cers.append(cer)
        wers.append(wer)
        print(f"Line {idx} ({label}) | CER: {cer*100:5.1f}% | WER: {wer*100:5.1f}%", flush=True)
        print(f"  GT:   \"{gt}\"", flush=True)
        print(f"  PRED: \"{pred}\"", flush=True)
        
    print(f"\nSummary for mode '{mode}': Avg CER={np.mean(cers)*100:.2f}%, Avg WER={np.mean(wers)*100:.2f}%\n", flush=True)
