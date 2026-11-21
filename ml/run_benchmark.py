"""
Complete Multi-Pipeline DR Evaluation Script on IDRiD Dataset (455 images)
Stores per-image raw softmax predictions to disk to avoid redundant re-inference.
Computes:
1. Deployed pipeline baseline (224px, dual-pass CLAHE with referral logic)
2. 8-pipeline preprocessing & resolution ablation on the 375 dev images:
   - Raw resize at 224px and 384px
   - FOV Crop only at 224px and 384px
   - FOV Crop + CLAHE at 224px and 384px
   - FOV Crop + Ben Graham (sigma=r/30, circular mask 0.9r) at 224px and 384px
3. Per-class recall, Quadratic Weighted Kappa (QWK), ROC-AUC, ECE, Referable Sensitivity & Specificity.
"""
import os
import time
import json
import argparse
from pathlib import Path
import cv2
import numpy as np
import pandas as pd
import torch
from sklearn.metrics import cohen_kappa_score, roc_auc_score, confusion_matrix

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

def compute_ece(probs: np.ndarray, labels: np.ndarray, n_bins: int = 15) -> float:
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == labels).astype(float)
    ece = 0.0
    for i in range(n_bins):
        bin_lower, bin_upper = bin_boundaries[i], bin_boundaries[i + 1]
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
        prop_in_bin = np.mean(in_bin)
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin
    return float(ece)

def crop_fov_robust(bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 15, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return bgr
    c = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(c)
    total_area = bgr.shape[0] * bgr.shape[1]
    # Plausibility check: 0.30 <= ratio <= 0.98
    if area < 0.30 * total_area or area > 0.98 * total_area:
        return bgr
    x, y, w, h = cv2.boundingRect(c)
    return bgr[y:y+h, x:x+w]

def apply_ben_graham(bgr_crop: np.ndarray) -> np.ndarray:
    h, w = bgr_crop.shape[:2]
    r = min(h, w) // 2
    sigma = max(r / 30.0, 1.0)
    blur = cv2.GaussianBlur(bgr_crop, (0, 0), sigma)
    bg = cv2.addWeighted(bgr_crop, 4, blur, -4, 128)
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(mask, (w // 2, h // 2), int(r * 0.90), 255, -1)
    return cv2.bitwise_and(bg, bg, mask=mask)

def apply_clahe(bgr: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lab[:, :, 0] = clahe.apply(lab[:, :, 0])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

def preprocess_image(bgr: np.ndarray, mode: str, target_size: int) -> torch.Tensor:
    if mode == "raw":
        proc = bgr
    elif mode == "crop":
        proc = crop_fov_robust(bgr)
    elif mode == "crop_clahe":
        cropped = crop_fov_robust(bgr)
        proc = apply_clahe(cropped)
    elif mode == "crop_bg":
        cropped = crop_fov_robust(bgr)
        proc = apply_ben_graham(cropped)
    else:
        raise ValueError(f"Unknown mode: {mode}")

    rgb = cv2.cvtColor(proc, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (target_size, target_size), interpolation=cv2.INTER_AREA)
    norm = ((resized.astype(np.float32) / 255.0) - MEAN) / STD
    return torch.tensor(norm.transpose(2, 0, 1), dtype=torch.float32).unsqueeze(0)

def run_deployed_pipeline(bgr: np.ndarray, model: torch.nn.Module) -> np.ndarray:
    """Exact inference logic in direct_server.py: 224px dual-pass CLAHE with heuristic switching."""
    # Pass 1: Calibrated RGB
    img_rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    r1 = cv2.resize(img_rgb, (224, 224)).astype(np.float32) / 255.0
    t1 = torch.tensor(((r1 - MEAN) / STD).transpose(2, 0, 1), dtype=torch.float32).unsqueeze(0)

    # Pass 2: CLAHE
    c_bgr = apply_clahe(bgr)
    c_rgb = cv2.cvtColor(c_bgr, cv2.COLOR_BGR2RGB)
    r2 = cv2.resize(c_rgb, (224, 224)).astype(np.float32) / 255.0
    t2 = torch.tensor(((r2 - MEAN) / STD).transpose(2, 0, 1), dtype=torch.float32).unsqueeze(0)

    with torch.no_grad():
        p1 = torch.softmax(model(t1), dim=-1)[0].numpy()
        p2 = torch.softmax(model(t2), dim=-1)[0].numpy()

    ref1 = float(np.sum(p1[2:]))
    ref2 = float(np.sum(p2[2:]))

    if ref1 > 0.50 or ref2 > 0.50:
        chosen = p1 if ref1 > ref2 else p2
    elif p1[1] > 0.30 or p2[1] > 0.30:
        chosen = p1 if p1[1] > p2[1] else p2
    else:
        chosen = (p1 + p2) / 2.0
    return chosen

def evaluate_predictions(probs: np.ndarray, targets: np.ndarray, threshold: float = 0.50):
    preds = np.argmax(probs, axis=1)
    qwk = cohen_kappa_score(targets, preds, weights="quadratic")
    ref_targets = (targets >= 2).astype(int)
    ref_probs = np.sum(probs[:, 2:], axis=1)
    
    try:
        auc = roc_auc_score(ref_targets, ref_probs)
    except ValueError:
        auc = 0.5

    ref_preds = (ref_probs >= threshold).astype(int)
    tp = np.sum((ref_preds == 1) & (ref_targets == 1))
    fn = np.sum((ref_preds == 0) & (ref_targets == 1))
    tn = np.sum((ref_preds == 0) & (ref_targets == 0))
    fp = np.sum((ref_preds == 1) & (ref_targets == 0))

    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    ece = compute_ece(probs, targets)
    cm = confusion_matrix(targets, preds, labels=[0, 1, 2, 3, 4])

    return {
        "qwk": float(qwk),
        "auc": float(auc),
        "sensitivity": float(sensitivity),
        "specificity": float(specificity),
        "ece": float(ece),
        "tp": int(tp), "fn": int(fn), "tn": int(tn), "fp": int(fp),
        "confusion_matrix": cm.tolist()
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=str, default=r"C:\Users\jaisw\Downloads\archive\idrid_labels.csv")
    parser.add_argument("--img-dir", type=str, default=r"C:\Users\jaisw\Downloads\archive\Imagenes\Imagenes")
    parser.add_argument("--out-dir", type=str, default=r"ml\outputs\eval_results")
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    df = pd.read_csv(args.csv)
    print(f"[Dataset Audit] Loaded {len(df)} total rows from {args.csv}")

    is_test = df["id_code"].str.contains("test")
    test_df = df[is_test].reset_index(drop=True)
    dev_df = df[~is_test].reset_index(drop=True)
    print(f"[Split Audit] Dev set count: {len(dev_df)} | Held-out test count: {len(test_df)}")

    # Load ResNet-50
    model_path = r"C:\Users\jaisw\.cache\huggingface\hub\models--sakshamkr1--ResNet50-APTOS-DR\snapshots\b671b9e040c504aebe5a6a597ec936e63805fb47\diabetic_retinopathy_full_model.pth"
    model = torch.load(model_path, map_location="cpu", weights_only=False)
    model.eval()

    # Pipelines to evaluate on dev set
    pipelines = [
        ("deployed_pipeline", "deployed", 224),
        ("raw_224", "raw", 224),
        ("raw_384", "raw", 384),
        ("crop_224", "crop", 224),
        ("crop_384", "crop", 384),
        ("crop_clahe_224", "crop_clahe", 224),
        ("crop_clahe_384", "crop_clahe", 384),
        ("crop_bg_224", "crop_bg", 224),
        ("crop_bg_384", "crop_bg", 384),
    ]

    all_results = {}
    saved_probs = {}

    for name, mode, size in pipelines:
        t0 = time.time()
        print(f"\n---> Running Pipeline: {name} (mode: {mode}, size: {size}) on 375 Dev Images...")
        dev_probs = []
        dev_targets = []

        for idx, row in dev_df.iterrows():
            img_path = os.path.join(args.img_dir, f"{row.id_code}.jpg")
            bgr = cv2.imread(img_path)
            if bgr is None:
                continue

            if mode == "deployed":
                p = run_deployed_pipeline(bgr, model)
            else:
                t = preprocess_image(bgr, mode, size)
                with torch.no_grad():
                    p = torch.softmax(model(t), dim=-1)[0].numpy()

            dev_probs.append(p)
            dev_targets.append(int(row.diagnosis))

        dev_probs = np.array(dev_probs)
        dev_targets = np.array(dev_targets)
        saved_probs[f"dev_{name}"] = dev_probs.tolist()

        metrics = evaluate_predictions(dev_probs, dev_targets)
        elapsed = time.time() - t0
        all_results[f"dev_{name}"] = metrics
        print(f"[{name}] QWK: {metrics['qwk']:.4f} | AUC: {metrics['auc']:.4f} | Sens: {metrics['sensitivity']:.4f} | Spec: {metrics['specificity']:.4f} | ECE: {metrics['ece']:.4f} ({elapsed:.1f}s)")

    # Run Deployed Baseline on Test Set as well
    print("\n---> Running Deployed Baseline on 80 Held-Out Test Images...")
    test_probs = []
    test_targets = []
    for idx, row in test_df.iterrows():
        img_path = os.path.join(args.img_dir, f"{row.id_code}.jpg")
        bgr = cv2.imread(img_path)
        p = run_deployed_pipeline(bgr, model)
        test_probs.append(p)
        test_targets.append(int(row.diagnosis))

    test_probs = np.array(test_probs)
    test_targets = np.array(test_targets)
    saved_probs["test_deployed_baseline"] = test_probs.tolist()
    test_metrics = evaluate_predictions(test_probs, test_targets)
    all_results["test_deployed_baseline"] = test_metrics
    print(f"[test_deployed_baseline] QWK: {test_metrics['qwk']:.4f} | AUC: {test_metrics['auc']:.4f} | Sens: {test_metrics['sensitivity']:.4f} | Spec: {test_metrics['specificity']:.4f} | ECE: {test_metrics['ece']:.4f}")

    # Save all raw probabilities and metrics to disk
    with open(os.path.join(args.out_dir, "raw_probabilities.json"), "w") as f:
        json.dump(saved_probs, f)
    with open(os.path.join(args.out_dir, "ablation_metrics.json"), "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\n✓ Successfully exported all per-image probabilities and metrics to {args.out_dir}")

if __name__ == "__main__":
    main()

