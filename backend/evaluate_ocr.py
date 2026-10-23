"""
Evaluation script for Step 4 TrOCR Handwriting Recognition Quality Improvement.

Evaluates 5 representative handwritten lines across 3 preprocessing modes:
1. Mode 'original': Original RGB crop with empty horizontal margin normalization.
2. Mode 'enhanced': Grayscale -> mild contrast enhancement (CLAHE) -> RGB.
3. Mode 'denoised': Grayscale -> light bilateral denoising -> mild CLAHE -> RGB.

Calculates Character Error Rate (CER) and Word Error Rate (WER) using Levenshtein distance.
"""

from typing import List, Tuple, Dict, Any
import numpy as np


def levenshtein_distance(s1: str, s2: str) -> int:
    """Computes minimum edit distance (insertions, deletions, substitutions)."""
    m, n = len(s1), len(s2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],      # deletion
                    dp[i][j - 1],      # insertion
                    dp[i - 1][j - 1]   # substitution
                )
    return dp[m][n]


def calculate_cer_wer(ground_truth: str, predicted: str) -> Tuple[float, float]:
    """Computes CER and WER for a single pair of strings."""
    # Character Error Rate
    ref_chars = ground_truth.strip()
    hyp_chars = predicted.strip()
    if len(ref_chars) == 0:
        cer = 0.0 if len(hyp_chars) == 0 else 1.0
    else:
        cer = levenshtein_distance(ref_chars, hyp_chars) / float(len(ref_chars))

    # Word Error Rate
    ref_words = ref_chars.split()
    hyp_words = hyp_chars.split()
    if len(ref_words) == 0:
        wer = 0.0 if len(hyp_words) == 0 else 1.0
    else:
        m, n = len(ref_words), len(hyp_words)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        for i in range(m + 1):
            dp[i][0] = i
        for j in range(n + 1):
            dp[0][j] = j
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if ref_words[i - 1].lower() == hyp_words[j - 1].lower():
                    dp[i][j] = dp[i - 1][j - 1]
                else:
                    dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
        wer = dp[m][n] / float(len(ref_words))

    return round(cer, 4), round(wer, 4)


# 5 Representative sample lines for manual evaluation
REPRESENTATIVE_SAMPLES = [
    {
        "index": 5,
        "category": "Easy Line",
        "ground_truth": "For a startup a trademark helps,",
    },
    {
        "index": 2,
        "category": "Medium Line",
        "ground_truth": "combination used by a business to identify & distinguish its goods or",
    },
    {
        "index": 1,
        "category": "Difficult Line",
        "ground_truth": "1 A Trademark is a distinctive word, name, symbol, logo, design",
    },
    {
        "index": 4,
        "category": "Numbers / Punctuation",
        "ground_truth": "Purpose of a Trademark : ->",
    },
    {
        "index": 11,
        "category": "Heading / Bullets",
        "ground_truth": "# Rights of a Trademark owner",
    },
]


def run_evaluation():
    import cv2
    from app.services.segmentation import segment_handwriting_lines
    from app.services.ocr_service import get_ocr_service

    test_image_path = r"C:\Users\ACER\Desktop\WriteAi\test_assets\test_page_real.jpg"
    print(f"Loading test image: {test_image_path}...", flush=True)
    img_bgr = cv2.imread(test_image_path)
    if img_bgr is None:
        print(f"Error: Could not load test image from {test_image_path}")
        return

    # Segment lines, ensuring crops come strictly from the original high-resolution image
    seg = segment_handwriting_lines(img_bgr, source_image_for_crops=img_bgr)
    lines_by_idx = {l["index"]: l for l in seg.get("lines", [])}
    print(f"Detected {len(lines_by_idx)} lines from test image.", flush=True)

    ocr = get_ocr_service()
    ocr.load_model()

    modes = ["original", "enhanced", "denoised"]
    all_mode_results: Dict[str, List[Dict[str, Any]]] = {}

    for mode in modes:
        print(f"\nEvaluating mode: '{mode}'...", flush=True)
        mode_results = []
        for sample in REPRESENTATIVE_SAMPLES:
            idx = sample["index"]
            gt = sample["ground_truth"]
            cat = sample["category"]

            if idx not in lines_by_idx:
                print(f"Warning: Line {idx} not in segmented lines.")
                continue

            crop_url = lines_by_idx[idx]["image"]
            pred = ocr.recognize_line(crop_url, mode=mode, save_debug_idx=idx if mode == "original" else None)
            cer, wer = calculate_cer_wer(gt, pred)

            mode_results.append({
                "index": idx,
                "category": cat,
                "ground_truth": gt,
                "predicted": pred,
                "cer": cer,
                "wer": wer,
            })
        all_mode_results[mode] = mode_results

    # Print Comparative Report
    print("\n" + "=" * 95)
    print("WriteAI Step 4 — Comparative Handwriting OCR Quality Evaluation Report")
    print("=" * 95)

    for mode in modes:
        results = all_mode_results[mode]
        avg_cer = np.mean([r["cer"] for r in results]) * 100 if results else 0.0
        avg_wer = np.mean([r["wer"] for r in results]) * 100 if results else 0.0

        print(f"\n--- MODE: '{mode.upper()}' (Avg CER: {avg_cer:.1f}%, Avg WER: {avg_wer:.1f}%) ---")
        print(f"{'Line':<8} | {'Category':<22} | {'CER':<7} | {'WER':<7} | Text Comparison")
        print("-" * 95)
        for r in results:
            print(f"Line {r['index']:<3} | {r['category']:<22} | {r['cer']*100:5.1f}% | {r['wer']*100:5.1f}% | REF:  \"{r['ground_truth']}\"")
            print(f"         |                        |         |         | HYP:  \"{r['predicted']}\"")
            print("-" * 95)

    print("\n" + "=" * 95)
    print("SUMMARY COMPARISON")
    print("=" * 95)
    print(f"{'Preprocessing Mode':<20} | {'Average CER':<15} | {'Average WER':<15}")
    print("-" * 55)
    for mode in modes:
        results = all_mode_results[mode]
        avg_cer = np.mean([r["cer"] for r in results]) * 100 if results else 0.0
        avg_wer = np.mean([r["wer"] for r in results]) * 100 if results else 0.0
        print(f"{mode:<20} | {avg_cer:11.2f}%   | {avg_wer:11.2f}%")
    print("=" * 95)


if __name__ == "__main__":
    run_evaluation()
