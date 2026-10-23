import cv2
import numpy as np
from PIL import Image
import torch
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

img_path = r"C:\Users\ACER\Desktop\WriteAi\test_assets\test_page_real.jpg"
orig_bgr = cv2.imread(img_path)

# Let's crop exact lines manually or cleanly from the page to see what TrOCR does with clean crops:
# Line 4: "Purpose of a Trademark : ->"
# In test_page_real.jpg:
# x: ~110 to ~460, y: ~225 to ~260
clean_crop_4 = orig_bgr[226:262, 110:460]
cv2.imwrite(r"C:\Users\ACER\Desktop\WriteAi\backend\debug\ocr_inputs\clean_line_04.png", clean_crop_4)

# Line 11: "# Rights of a Trademark owner"
# Looking at test_page_real.jpg:
# x: ~80 to ~530, y: ~445 to ~485
clean_crop_11 = orig_bgr[445:485, 80:530]
cv2.imwrite(r"C:\Users\ACER\Desktop\WriteAi\backend\debug\ocr_inputs\clean_line_11.png", clean_crop_11)

print("Saved clean test crops.")

processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten")
model.eval()

def test_crop(name, crop):
    rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)
    pixel_values = processor(pil_img, return_tensors="pt").pixel_values
    
    # Repetition penalty = 1.2 vs 1.0 (standard)
    with torch.no_grad():
        out_old = model.generate(pixel_values, max_new_tokens=48, num_beams=1, no_repeat_ngram_size=3, repetition_penalty=1.2)
        out_clean = model.generate(pixel_values, max_new_tokens=48, num_beams=1)
        out_beam = model.generate(pixel_values, max_new_tokens=48, num_beams=2, early_stopping=True)
        
    t_old = processor.batch_decode(out_old, skip_special_tokens=True)[0]
    t_clean = processor.batch_decode(out_clean, skip_special_tokens=True)[0]
    t_beam = processor.batch_decode(out_beam, skip_special_tokens=True)[0]
    print(f"\n{name}:")
    print(f"  Old params (rep_pen=1.2): {t_old}")
    print(f"  Clean greedy (rep_pen=1.0): {t_clean}")
    print(f"  Beam 2:                    {t_beam}")

test_crop("Line 4 ('Purpose of a Trademark : ->')", clean_crop_4)
test_crop("Line 11 ('# Rights of a Trademark owner')", clean_crop_11)
