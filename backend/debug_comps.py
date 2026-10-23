import cv2
import numpy as np
from app.services.segmentation import (
    SegmentationConfig,
    detect_page_region,
    create_ink_strength_image,
    calculate_horizontal_projection,
    detect_line_bands,
    filter_line_candidates,
)

img = cv2.imread(r"C:\Users\ACER\Desktop\WriteAi\test_assets\test_page_real.jpg")
cfg = SegmentationConfig()
page_mask, roi = detect_page_region(img, cfg)
ink_str, strong_ink, noise_floor = create_ink_strength_image(img, page_mask, cfg)
raw_proj, smoothed_proj = calculate_horizontal_projection(ink_str, cfg)
bands = detect_line_bands(smoothed_proj, img.shape[0], cfg)

cands = filter_line_candidates(bands, strong_ink, page_mask, cfg, (img.shape[1], img.shape[0]))
for i, c in enumerate(cands[:5]):
    print(f"Cand {i+1}: {c}")

# Let's inspect components inside Band 1
y1, y2, py = bands[0]
strong_ink_u8 = (strong_ink.astype(np.uint8) * 255)
strip = strong_ink_u8[y1:y2, :]
num_s, s_lbls, s_stats, _ = cv2.connectedComponentsWithStats(strip)
print("\nComps in Band 1:")
for k in range(1, num_s):
    print(f"  comp {k}: x={s_stats[k, 0]}, y={s_stats[k, 1]}, w={s_stats[k, 2]}, h={s_stats[k, 3]}, area={s_stats[k, 4]}")
