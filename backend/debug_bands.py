import cv2
import numpy as np
from app.services.segmentation import (
    SegmentationConfig,
    detect_page_region,
    create_ink_strength_image,
    calculate_horizontal_projection,
    detect_line_bands,
)

img = cv2.imread(r"C:\Users\ACER\Desktop\WriteAi\test_assets\test_page_real.jpg")
cfg = SegmentationConfig()
page_mask, roi = detect_page_region(img, cfg)
ink_str, strong_ink, noise_floor = create_ink_strength_image(img, page_mask, cfg)
raw_proj, smoothed_proj = calculate_horizontal_projection(ink_str, cfg)
bands = detect_line_bands(smoothed_proj, img.shape[0], cfg)

print(f"Total bands: {len(bands)}")
for i, (y1, y2, py) in enumerate(bands[:5]):
    print(f"Band {i+1}: y1={y1}, y2={y2}, peak={py}")
