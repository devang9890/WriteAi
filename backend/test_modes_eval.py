import cv2
import numpy as np
from PIL import Image
import torch
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from app.services.segmentation import segment_handwriting_lines
from evaluate_ocr import GROUND_TRUTH_SAMPLES, calculate_cer_wer

img_path = r"C:\Users\ACER\Desktop\WriteAi\test_assets\test_page_real.jpg"
orig_bgr = cv2.imread(img_path)
seg = segment_handwriting_lines(orig_bgr)
lines_by_idx = {l["index"]: l for l in seg["lines"]}

processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten")
model.eval()

def prepare_line_for_ocr(crop_bgr: np.ndarray, mode: str = "original") -> Image.Image:
    """
    OCR-specific preprocessing for TrOCR input.
    Modes:
      - 'original': Convert to RGB, trim excessive empty margins.
      - 'enhanced': Grayscale -> mild contrast enhancement -> RGB.
      - 'denoised': Grayscale -> light denoising -> mild contrast enhancement -> RGB.
    """
    if crop_bgr is None or crop_bgr.size == 0:
        return Image.new("RGB", (32, 32), (255, 255, 255))
        
    # Trim excessive horizontal empty margins if paper is mostly uniform white at margins
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    # Estimate background level from corners/edges
    bg_val = np.percentile(gray, 85)
    ink_mask = gray < (bg_val - 18)
    
    col_counts = np.sum(ink_mask, axis=0)
    ink_cols = np.where(col_counts >= 2)[0]
    
    # If we find ink, trim margins with safe padding
    if len(ink_cols) > 0:
        x_min = max(0, ink_cols[0] - 12)
        x_max = min(crop_bgr.shape[1], ink_cols[-1] + 13)
        # Avoid trimming too aggressively if line is very narrow
        if (x_max - x_min) >= 30:
            crop_bgr = crop_bgr[:, x_min:x_max]
            gray = gray[:, x_min:x_max]

    if mode == "enhanced":
        # Grayscale -> mild contrast enhancement (mild CLAHE) -> RGB
        clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
        enh = clahe.apply(gray)
        return Image.fromarray(cv2.cvtColor(enh, cv2.COLOR_GRAY2RGB))
        
    elif mode == "denoised":
        # Grayscale -> very mild bilateral denoising -> mild CLAHE -> RGB
        denoised = cv2.bilateralFilter(gray, d=3, sigmaColor=15, sigmaSpace=15)
        clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
        enh = clahe.apply(denoised)
        return Image.fromarray(cv2.cvtColor(enh, cv2.COLOR_GRAY2RGB))
        
    else:  # "original"
        rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb)

def eval_mode(mode: str, num_beams: int = 1):
    cers, wers = [], []
    print(f"\n--- Testing mode='{mode}', num_beams={num_beams} ---")
    for sample in GROUND_TRUTH_SAMPLES[:5]: # test first 5 representative lines
        idx = sample["index"]
        gt = sample["ground_truth"]
        if idx not in lines_by_idx:
            continue
        bbox = lines_by_idx[idx]["bbox"]
        x, y, w, h = bbox["x"], bbox["y"], bbox["width"], bbox["height"]
        crop = orig_bgr[y:y+h, x:x+w]
        
        pil_img = prepare_line_for_ocr(crop, mode=mode)
        pixel_values = processor(pil_img, return_tensors="pt").pixel_values
        
        with torch.no_grad():
            gen_kwargs = {"max_new_tokens": 64, "num_beams": num_beams}
            if num_beams > 1:
                gen_kwargs["early_stopping"] = True
            out = model.generate(pixel_values, **gen_kwargs)
            
        pred = processor.batch_decode(out, skip_special_tokens=True)[0]
        cer, wer = calculate_cer_wer(gt, pred)
        cers.append(cer)
        wers.append(wer)
        print(f"Line {idx} (CER: {cer*100:.1f}%, WER: {wer*100:.1f}%):")
        print(f"  REF:  {gt}")
        print(f"  PRED: {pred}")
        
    print(f"Average CER: {np.mean(cers)*100:.2f}%, WER: {np.mean(wers)*100:.2f}%")

eval_mode("original", num_beams=1)
eval_mode("enhanced", num_beams=1)
eval_mode("denoised", num_beams=1)
eval_mode("original", num_beams=2)
