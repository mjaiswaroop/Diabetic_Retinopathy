"""
Strict Clinical-Grade End-to-End API Test Suite for Diabetic Retinopathy Pipeline.
Communicates via real HTTP multipart requests with live direct_server.py on port 8000.
Evaluates:
1. 100+ Real unseen images from IDRiD dataset across Grades 0-4.
2. 5 Wide black-border / letterboxed Grade 2-4 images (simulating live camera letterbox).
3. 3 Synthetic true bad images (pure black, pure white, severe blur) for fail-safe ungradable behavior.
Prints raw confusion matrix, sensitivity, specificity, false ungradable rate, and failed image list.
"""

import os
import sys
import json
import time
import requests
import numpy as np
import pandas as pd
import cv2

API_URL = "http://127.0.0.1:8000/api/v1/predict-direct"
HEALTH_URL = "http://127.0.0.1:8000/health"
CSV_PATH = r"C:\Users\jaisw\Downloads\archive\idrid_labels.csv"
IMG_DIR = r"C:\Users\jaisw\Downloads\archive\Imagenes\Imagenes"

def check_server_health():
    print("[Test 0] Checking FastAPI Server Health at", HEALTH_URL)
    try:
        r = requests.get(HEALTH_URL, timeout=5)
        print("Raw /health response:", r.status_code, r.text)
        assert r.status_code == 200, f"Server returned {r.status_code}"
        data = r.json()
        assert data.get("status") == "ok", "Server status is not ok"
        print("Server is Healthy and ready for evaluation.")
    except Exception as e:
        print(f"FATAL: Could not connect to {HEALTH_URL}: {e}")
        sys.exit(1)


def test_synthetic_ungradable():
    print("\n" + "="*80)
    print("[Test 1] Synthetic True Bad Images (Pure Black, Pure White, Extreme Blur)")
    print("="*80)
    
    # 1. Pure black image
    blk = np.zeros((384, 384, 3), dtype=np.uint8)
    _, blk_bytes = cv2.imencode(".jpg", blk)
    r_blk = requests.post(API_URL, files={"file": ("black.jpg", blk_bytes.tobytes(), "image/jpeg")})
    print("\n--- Raw Response for Pure Black Image ---")
    print("Status Code:", r_blk.status_code)
    print("Body:", json.dumps(r_blk.json(), indent=2))
    d_blk = r_blk.json()
    assert d_blk.get("clinical_status") == "UNGRADABLE", f"Expected UNGRADABLE, got {d_blk.get('clinical_status')}"
    assert d_blk.get("referable") is not False, "Pure black image MUST NOT be marked Non-Referable (False)!"
    assert d_blk.get("grade") == -1, f"Expected grade -1, got {d_blk.get('grade')}"
    print(">>> PASS: Pure black correctly rejected as UNGRADABLE with no fail-open.")

    # 2. Pure white image
    wht = np.ones((384, 384, 3), dtype=np.uint8) * 255
    _, wht_bytes = cv2.imencode(".jpg", wht)
    r_wht = requests.post(API_URL, files={"file": ("white.jpg", wht_bytes.tobytes(), "image/jpeg")})
    print("\n--- Raw Response for Pure White Image ---")
    print("Status Code:", r_wht.status_code)
    print("Body:", json.dumps(r_wht.json(), indent=2))
    d_wht = r_wht.json()
    assert d_wht.get("clinical_status") == "UNGRADABLE", f"Expected UNGRADABLE, got {d_wht.get('clinical_status')}"
    assert d_wht.get("referable") is not False, "Pure white image MUST NOT be marked Non-Referable (False)!"
    print(">>> PASS: Pure white correctly rejected as UNGRADABLE with no fail-open.")

    # 3. Extreme optical blur on real fundus
    sample_p = os.path.join(IMG_DIR, "IDRiD_001.jpg")
    img = cv2.imread(sample_p)
    # Proportional Gaussian blur simulating heavy optical defocus (sigma = 5% of image dimension)
    sigma_defocus = int(min(img.shape[:2]) * 0.05)
    blurred = cv2.GaussianBlur(img, (0, 0), sigmaX=sigma_defocus)
    _, blur_bytes = cv2.imencode(".jpg", blurred)
    r_blur = requests.post(API_URL, files={"file": ("blurred.jpg", blur_bytes.tobytes(), "image/jpeg")})
    print("\n--- Raw Response for Extreme Blur Image ---")
    print("Status Code:", r_blur.status_code)
    print("Body:", json.dumps(r_blur.json(), indent=2))
    d_blur = r_blur.json()
    assert d_blur.get("clinical_status") == "UNGRADABLE", f"Expected UNGRADABLE, got {d_blur.get('clinical_status')}"
    assert d_blur.get("referable") is not False, "Blurred image MUST NOT be marked Non-Referable (False)!"
    print(">>> PASS: Extreme blur correctly rejected as UNGRADABLE.")


def test_wide_black_border_regression():
    print("\n" + "="*80)
    print("[Test 2] Wide Black-Border / Letterbox Regression (Reproducing Live Bug)")
    print("="*80)
    
    # Select 5 known Grade 2-4 images
    df = pd.read_csv(CSV_PATH)
    ref_cases = df[df["diagnosis"] >= 2].head(5)
    
    for idx, row in ref_cases.iterrows():
        img_id = row["id_code"]
        true_grade = int(row["diagnosis"])
        p = os.path.join(IMG_DIR, f"{img_id}.jpg")
        img = cv2.imread(p)
        h, w = img.shape[:2]
        
        # Place retina inside a 2x3 wide canvas where retina occupies ~12-15% of total area
        canvas = np.zeros((h * 2, w * 3, 3), dtype=np.uint8)
        canvas[h//2:h//2+h, w:w+w] = img
        
        _, buf = cv2.imencode(".jpg", canvas)
        r = requests.post(API_URL, files={"file": (f"{img_id}_wide.jpg", buf.tobytes(), "image/jpeg")})
        res = r.json()
        
        print(f"\n--- Case {img_id} (True Grade {true_grade}) in 2x3 Wide Black Canvas ---")
        print(f"Status: {res.get('status')}, Grade: {res.get('grade')}, Referable: {res.get('referable')}, RefProb: {res.get('referable_prob')}")
        
        # Assertions
        assert res.get("status") == "gradable", f"FAIL: {img_id} was falsely rejected as ungradable! Reason: {res.get('reason')}"
        assert res.get("clinical_status") == "GRADABLE", f"FAIL: clinical_status is {res.get('clinical_status')}"
        assert res.get("referable") is True or res.get("referral_state") == "referable", (
            f"FAIL: {img_id} (True Grade {true_grade}) was not classified as Referable DR! Got {res.get('referral_state')}"
        )
        print(f">>> PASS: {img_id} successfully cropped, graded, and classified as Referable DR.")


def test_full_dataset_evaluation(sample_size=120):
    print("\n" + "="*80)
    print(f"[Test 3] Full Dataset Validation ({sample_size} Images across Grades 0-4)")
    print("="*80)
    
    df = pd.read_csv(CSV_PATH)
    # Stratified sample across all 5 grades
    sample_df = df.groupby("diagnosis", group_keys=False).apply(
        lambda x: x.sample(min(len(x), sample_size // 5), random_state=42)
    )
    if len(sample_df) < sample_size:
        remaining = df[~df["id_code"].isin(sample_df["id_code"])].sample(sample_size - len(sample_df), random_state=42)
        sample_df = pd.concat([sample_df, remaining])
        
    print(f"Selected {len(sample_df)} evaluation images across grades:")
    print(sample_df["diagnosis"].value_counts().sort_index().to_dict())
    
    y_true = []
    y_pred = []
    ref_true = []
    ref_pred = []
    ungradable_count = 0
    false_negatives = []
    
    t0 = time.time()
    for i, (_, row) in enumerate(sample_df.iterrows()):
        img_id = row["id_code"]
        true_grade = int(row["diagnosis"])
        p = os.path.join(IMG_DIR, f"{img_id}.jpg")
        if not os.path.exists(p):
            continue
            
        with open(p, "rb") as f:
            r = requests.post(API_URL, files={"file": (f"{img_id}.jpg", f.read(), "image/jpeg")})
            
        if r.status_code != 200:
            print(f"HTTP Error {r.status_code} on {img_id}")
            continue
            
        res = r.json()
        status = res.get("status")
        pred_grade = res.get("grade")
        referable_prob = res.get("referable_prob")
        referral_state = res.get("referral_state")
        
        is_ref_true = true_grade >= 2
        ref_true.append(is_ref_true)
        
        if status == "ungradable" or pred_grade == -1:
            ungradable_count += 1
            y_pred.append(-1)
            ref_pred.append(False) # counting ungradable as non-referable for raw sensitivity check
            if is_ref_true:
                false_negatives.append({
                    "id": img_id,
                    "true_grade": true_grade,
                    "pred_grade": -1,
                    "reason": res.get("reason"),
                    "referable_prob": None
                })
        else:
            y_pred.append(pred_grade)
            is_ref_pred = (referral_state == "referable")
            ref_pred.append(is_ref_pred)
            if is_ref_true and not is_ref_pred:
                false_negatives.append({
                    "id": img_id,
                    "true_grade": true_grade,
                    "pred_grade": pred_grade,
                    "referable_prob": referable_prob,
                    "probs": res.get("class_probabilities")
                })
                
        y_true.append(true_grade)
        
        if (i + 1) % 25 == 0:
            print(f"Evaluated {i + 1}/{len(sample_df)} images... (elapsed {time.time()-t0:.1f}s)")
            
    # Metrics Calculation
    ref_true = np.array(ref_true)
    ref_pred = np.array(ref_pred)
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    
    tp = int(np.sum((ref_true == True) & (ref_pred == True)))
    fn = int(np.sum((ref_true == True) & (ref_pred == False)))
    tn = int(np.sum((ref_true == False) & (ref_pred == False)))
    fp = int(np.sum((ref_true == False) & (ref_pred == True)))
    
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    false_ungradable_rate = ungradable_count / len(y_true) if len(y_true) > 0 else 0.0
    
    # 5x5 confusion matrix (for gradable predictions)
    valid_mask = (y_pred >= 0)
    cm = np.zeros((5, 5), dtype=int)
    for t, p in zip(y_true[valid_mask], y_pred[valid_mask]):
        cm[t, p] += 1
        
    print("\n" + "="*80)
    print("EVALUATION RESULTS & RAW CLINICAL METRICS")
    print("="*80)
    print(f"Total Evaluated Images: {len(y_true)}")
    print(f"Ungradable Images Rejected by Quality Gate: {ungradable_count} ({false_ungradable_rate*100:.2f}%)")
    print(f"Target False Ungradable Rate: < 2.00% -> {'PASS' if false_ungradable_rate < 0.02 else 'FAIL'}")
    print("\n--- 5x5 Confusion Matrix (Rows: True Grade 0-4, Columns: Predicted Grade 0-4) ---")
    header = "       Pred 0   Pred 1   Pred 2   Pred 3   Pred 4"
    print(header)
    for row_idx, row in enumerate(cm):
        print(f"True {row_idx}:  " + "     ".join(f"{val:3d}" for val in row))
        
    print("\n--- Referable DR Screening Performance ---")
    print(f"True Positive (TP): {tp}")
    print(f"False Negative (FN): {fn}")
    print(f"True Negative (TN): {tn}")
    print(f"False Positive (FP): {fp}")
    print(f"Referable DR Sensitivity: {sensitivity*100:.2f}% (Target: >= 85.0%)")
    print(f"Referable DR Specificity: {specificity*100:.2f}% (Target: >= 80.0%)")
    
    print("\n--- All False Negatives (Grade >= 2 predicted as Non-Referable or Ungradable) ---")
    if false_negatives:
        for fn_case in false_negatives:
            print(f"  * Image ID: {fn_case['id']} | True Grade: {fn_case['true_grade']} | Pred Grade: {fn_case['pred_grade']} | RefProb: {fn_case.get('referable_prob')}")
    else:
        print("  None! (Zero False Negatives)")

    # Assertions
    assert false_ungradable_rate < 0.02, f"False ungradable rate {false_ungradable_rate*100:.2f}% exceeds 2% threshold"
    print(f"\n>>> Full Dataset Validation Complete. Sensitivity: {sensitivity*100:.2f}%, Specificity: {specificity*100:.2f}%")


if __name__ == "__main__":
    check_server_health()
    test_synthetic_ungradable()
    test_wide_black_border_regression()
    test_full_dataset_evaluation(sample_size=100)

