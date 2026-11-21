import os
import sys
import json
import numpy as np
import pandas as pd
import cv2
import torch
import torch.nn.functional as F

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
TEMPERATURE = 1.9567
TAU = 0.4106

# Target images: diverse panel including verified Grade 0 healthy cases and known positive DR cases
TARGET_IMAGE_IDS = [
    "IDRiD_370", # Classic false-positive trap image (Grade 0)
    "IDRiD_118", # Verified Grade 0 healthy control
    "IDRiD_139", # Verified Grade 0 healthy control
    "IDRiD_001", # Positive Grade 3 (Severe NPDR)
    "IDRiD_003", # Positive Grade 2 (Moderate NPDR)
    "IDRiD_005", # Positive Grade 4 (PDR)
]

def crop_fov_and_mask_hardened(bgr: np.ndarray, is_20d_lens: bool = False):
    """
    Robust Retinal Aperture Cropper with Handheld Condensing Lens Support.
    - Filters contours by circularity to reject room clutter/fingers.
    - Zero-padding for out-of-bounds bounding circles (prevents aspect-ratio squashing).
    - Upstream 180° rotation for 20D/28D condensing lenses.
    """
    h_orig, w_orig = bgr.shape[:2]
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    total_area = float(h_orig * w_orig)
    
    thresh_val = 15
    _, thresh = cv2.threshold(gray, thresh_val, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    best_c = None
    best_score = -1.0
    
    for c in contours:
        area = cv2.contourArea(c)
        if area < 0.15 * total_area or area > 0.98 * total_area:
            continue
        perimeter = cv2.arcLength(c, True)
        if perimeter == 0:
            continue
        circularity = (4.0 * np.pi * area) / (perimeter ** 2)
        score = circularity * area
        if circularity > 0.50 and score > best_score:
            best_score = score
            best_c = c
            
    if best_c is not None:
        (cx, cy), radius = cv2.minEnclosingCircle(best_c)
        r = int(radius)
        cx, cy = int(cx), int(cy)
        
        # Calculate bounding box bounds with potential out-of-bounds coordinates
        x1_raw, y1_raw = cx - r, cy - r
        x2_raw, y2_raw = cx + r, cy + r
        
        # Calculate padding needed if bounding circle touches/exceeds image borders
        pad_left = max(0, -x1_raw)
        pad_top = max(0, -y1_raw)
        pad_right = max(0, x2_raw - w_orig)
        pad_bottom = max(0, y2_raw - h_orig)
        
        if pad_left > 0 or pad_top > 0 or pad_right > 0 or pad_bottom > 0:
            padded_bgr = cv2.copyMakeBorder(
                bgr, pad_top, pad_bottom, pad_left, pad_right, cv2.BORDER_CONSTANT, value=[0, 0, 0]
            )
            cropped = padded_bgr[y1_raw + pad_top : y2_raw + pad_top, x1_raw + pad_left : x2_raw + pad_left]
        else:
            cropped = bgr[y1_raw:y2_raw, x1_raw:x2_raw]
    else:
        cropped = bgr

    # Resize to canonical 384x384
    crop_384 = cv2.resize(cropped, (384, 384), interpolation=cv2.INTER_AREA)

    # Invert 180° upstream for 20D/28D condensing lens captures
    if is_20d_lens:
        crop_384 = cv2.rotate(crop_384, cv2.ROTATE_180)

    return crop_384


def locate_optic_disc_and_fovea_hardened(crop_384: np.ndarray, is_20d_lens: bool = False):
    """
    Hardened Optic Disc & Fovea Localizer with Vessel Convergence & Exudate Rejection.
    """
    h, w = crop_384.shape[:2]
    r_chan = crop_384[:, :, 2].astype(np.float32)
    g_chan = crop_384[:, :, 1].astype(np.float32)
    
    rg_comb = (r_chan + g_chan) / 2.0
    
    # 1. Exudate suppression via morphological opening with 29x29 ellipse
    morph_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (29, 29))
    disc_morph = cv2.morphologyEx(rg_comb, cv2.MORPH_OPEN, morph_kernel)
    disc_smooth = cv2.GaussianBlur(disc_morph, (25, 25), 0)
    
    # 2. Black-hat vessel convergence on green channel
    vessel_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    blackhat = cv2.morphologyEx(g_chan.astype(np.uint8), cv2.MORPH_BLACKHAT, vessel_kernel)
    vessel_density = cv2.GaussianBlur(blackhat.astype(np.float32), (31, 31), 0)
    vessel_norm = vessel_density / (vessel_density.max() + 1e-6)
    
    # Weight candidate map with vessel convergence
    combined_score = disc_smooth * (1.0 + 0.8 * vessel_norm)
    
    # 3. Inner retinal mask (exclude lens border glare)
    retina_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(retina_mask, (w // 2, h // 2), int(w * 0.42), 1, -1)
    if is_20d_lens:
        # Central specular reflection suppression
        cv2.circle(retina_mask, (w // 2, h // 2), int(w * 0.10), 0, -1)
        
    masked_score = combined_score * retina_mask
    _, _, _, max_loc = cv2.minMaxLoc(masked_score)
    od_x, od_y = max_loc
    
    # 4. Anatomical fovea projection (temporal ~2.5 disc diameters away)
    fovea_offset = int(w * 0.28)
    if od_x < w // 2:
        fov_x = min(w - 25, od_x + fovea_offset)
    else:
        fov_x = max(25, od_x - fovea_offset)
    fov_y = od_y
    
    disc_radius = int(w * 0.08)
    fovea_radius = int(w * 0.125)
    
    return (od_x, od_y), (fov_x, fov_y), disc_radius, fovea_radius


def crop_fov_robust(bgr: np.ndarray, is_20d_lens: bool = False) -> np.ndarray:
    return crop_fov_and_mask_hardened(bgr, is_20d_lens=is_20d_lens)


def locate_optic_disc_and_fovea(crop_384: np.ndarray, is_20d_lens: bool = False):
    return locate_optic_disc_and_fovea_hardened(crop_384, is_20d_lens=is_20d_lens)

def run_audit():
    print("=== STARTING RIGOROUS CLINICAL AUDIT ===")
    
    # 1. Load Model
    cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
    hf_snapshot = "models--sakshamkr1--ResNet50-APTOS-DR/snapshots/b671b9e040c504aebe5a6a597ec936e63805fb47"
    model_path = os.path.join(cache_dir, hf_snapshot, "diabetic_retinopathy_full_model.pth")
    if not os.path.exists(model_path):
        model_path = os.path.join("ml", "outputs", "best_dr_model.pt")
    
    print(f"Loading weights: {model_path}")
    model = torch.load(model_path, map_location="cpu", weights_only=False)
    model.eval()

    # Hook for Grad-CAM++
    features_map = []
    gradients_map = []

    def f_hook(module, inp, out):
        features_map.clear()
        features_map.append(out)

    def b_hook(module, grad_in, grad_out):
        gradients_map.clear()
        gradients_map.append(grad_out[0])

    target_layer = model.layer4[2].conv3
    target_layer.register_forward_hook(f_hook)
    target_layer.register_full_backward_hook(b_hook)

    # 2. Load Ground Truth Labels
    csv_path = r"C:\Users\jaisw\Downloads\archive\idrid_labels.csv"
    df = pd.read_csv(csv_path)
    label_map = dict(zip(df['id_code'], df['diagnosis']))

    img_dir = r"C:\Users\jaisw\Downloads\archive\Imagenes\Imagenes"

    audit_results = []
    agent_lessons_entries = []

    for img_id in TARGET_IMAGE_IDS:
        gt_grade = label_map.get(img_id, None)
        img_file = os.path.join(img_dir, f"{img_id}.jpg")
        if not os.path.exists(img_file):
            print(f"Warning: {img_file} not found. Skipping.")
            continue

        bgr = cv2.imread(img_file)
        h_orig, w_orig = bgr.shape[:2]

        # --- Check 3: Preprocessing & Tensor Parity Check ---
        # Assert BGR to RGB conversion, normalized scale, shape (1, 3, 384, 384)
        cropped_bgr = crop_fov_robust(bgr)
        rgb = cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb, (384, 384), interpolation=cv2.INTER_AREA)
        norm = ((resized.astype(np.float32) / 255.0) - MEAN) / STD
        
        # Parity assertions
        assert not np.isnan(norm).any(), f"NaN detected in preprocessed tensor for {img_id}"
        assert norm.shape == (384, 384, 3), f"Invalid normalized shape {norm.shape}"

        tensor = torch.tensor(norm.transpose(2, 0, 1), dtype=torch.float32).unsqueeze(0)
        tensor.requires_grad = True

        # --- Check 4: Deterministic Consistency Check ---
        torch.manual_seed(42)
        model.eval()
        with torch.no_grad():
            t1 = tensor.clone()
            out1 = model(t1)
        
        torch.manual_seed(42)
        with torch.no_grad():
            t2 = tensor.clone()
            out2 = model(t2)

        max_diff = (out1 - out2).abs().max().item()
        assert max_diff < 1e-5, f"Determinism failure on {img_id}: max diff = {max_diff}"

        # --- Run Grad-CAM++ Forward & Backward ---
        model.zero_grad()
        out = model(tensor)
        cal_probs = torch.softmax(out / TEMPERATURE, dim=-1)[0].detach().numpy()
        pred_grade = int(np.argmax(cal_probs))
        referable_prob = float(np.sum(cal_probs[2:]))
        predicted_referable = referable_prob >= TAU

        # Backward for target class: for Grade 0, backprop the Referable DR risk (sum of logits for Grade >= 2)
        # to inspect whether the model's referable risk falsely attributes to the foveal reflex
        if gt_grade == 0:
            target_score = out[0, 2:].sum()
        else:
            target_score = out[0, pred_grade]
        target_score.backward(retain_graph=True)

        # Grad-CAM++ formula computation
        grad = gradients_map[0] # [1, 2048, 12, 12]
        act = features_map[0]   # [1, 2048, 12, 12]

        grad_2 = grad.pow(2)
        grad_3 = grad.pow(3)
        denom = 2 * grad_2 + (act * grad_3).sum(dim=(2, 3), keepdim=True)
        denom = torch.where(denom != 0.0, denom, torch.ones_like(denom))
        alpha = grad_2 / denom
        weights = (alpha * F.relu(grad)).sum(dim=(2, 3), keepdim=True)
        cam = (weights * act).sum(dim=1, keepdim=True)
        cam = F.relu(cam)[0, 0].detach().numpy()
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
        cam_resized = cv2.resize(cam, (384, 384))

        # --- Check 2: Spatial Attribution Check (Dynamic Fovea & Optic Disc) ---
        (od_x, od_y), (fov_x, fov_y), od_r, fov_r = locate_optic_disc_and_fovea(resized)
        
        fovea_mask = np.zeros((384, 384), dtype=np.uint8)
        cv2.circle(fovea_mask, (fov_x, fov_y), fov_r, 1, -1)

        od_mask = np.zeros((384, 384), dtype=np.uint8)
        cv2.circle(od_mask, (od_x, od_y), od_r, 1, -1)

        total_peak_activation = np.sum(cam_resized > 0.6)
        fovea_peak_activation = np.sum((cam_resized > 0.6) & (fovea_mask == 1))
        od_peak_activation = np.sum((cam_resized > 0.6) & (od_mask == 1))
        
        foveal_pct = (fovea_peak_activation / total_peak_activation * 100) if total_peak_activation > 0 else 0.0
        od_pct = (od_peak_activation / total_peak_activation * 100) if total_peak_activation > 0 else 0.0

        # Region label with highest activation
        y_max, x_max = np.unravel_index(np.argmax(cam_resized), cam_resized.shape)
        dist_to_fovea = np.hypot(x_max - fov_x, y_max - fov_y)
        dist_to_od = np.hypot(x_max - od_x, y_max - od_y)

        if dist_to_fovea <= fov_r:
            max_region = f"Fovea ({fov_x},{fov_y}) [{foveal_pct:.1f}% peak]"
        elif dist_to_od <= od_r:
            max_region = f"Optic Disc ({od_x},{od_y}) [{od_pct:.1f}% peak]"
        elif x_max < 144:
            max_region = f"Nasal Arcade ({x_max},{y_max})"
        elif x_max > 240:
            max_region = f"Temporal Arcade ({x_max},{y_max})"
        else:
            max_region = f"Mid-Periphery ({x_max},{y_max})"

        # --- Check 1: Sanity & Clinical Ground-Truth Cross-Check ---
        fp_failure = (gt_grade == 0 and predicted_referable)
        spatial_failure = (gt_grade == 0 and foveal_pct > 40.0)

        status = "PASS"
        lesson_logged = "None (Passed)"

        if fp_failure:
            status = "FAIL"
            reason = f"False Positive on Grade 0: referable_prob={referable_prob:.3f} >= {TAU}"
            lesson_logged = "FP Failure Logged"
            agent_lessons_entries.append({
                "id": img_id,
                "symptom": f"Healthy Grade 0 misclassified as Referable DR (prob {referable_prob:.2%})",
                "root_cause": "Model over-sensitivity to central reflex without proper FOV crop",
                "fix": "Enforce crop_384 + Temperature scaling T=1.9567"
            })
        elif spatial_failure:
            status = "FAIL"
            reason = f"Spatial trap: >40% peak activation ({foveal_pct:.1f}%) on foveal center"
            lesson_logged = "Spatial Trap Logged"
            agent_lessons_entries.append({
                "id": img_id,
                "symptom": f"Grade 0 foveal trap detected ({foveal_pct:.1f}% foveal activation)",
                "root_cause": "Grad-CAM++ locked onto central avascular darkness",
                "fix": "Neutralize central contrast via FOV crop"
            })
        elif gt_grade >= 2 and not predicted_referable:
            status = "FAIL"
            reason = f"False Negative on Grade {gt_grade}: referable_prob={referable_prob:.3f} < {TAU}"
            lesson_logged = "FN Failure Logged"

        audit_results.append({
            "id": img_id,
            "gt": f"Grade {gt_grade}",
            "pred": f"Grade {pred_grade} ({'Referable' if predicted_referable else 'Non-Referable'})",
            "region": max_region,
            "status": status,
            "lesson": lesson_logged,
            "foveal_pct": foveal_pct,
            "ref_prob": referable_prob
        })

    print(json.dumps(audit_results, indent=2))
    
    # Save output summary
    with open("ml/outputs/eval_results/audit_summary.json", "w") as f:
        json.dump(audit_results, f, indent=2)

    # Run Synthetic 20D Lens Invariance Test
    test_20d_lens_invariance(model)

def test_20d_lens_invariance(model):
    """
    Synthetic 20D Lens Stress Test:
    Takes known Grade 0 (IDRiD_370) and Grade 4 (IDRiD_005):
    - Applies 180° optical inversion.
    - Adds an off-center circular aperture simulating a handheld condensing lens near frame border.
    - Adds an intense central flash reflection (corneal specular glare).
    - Asserts that is_20d_lens=True recovers OD coordinates within +/-15 px and referral status matches 100%.
    """
    print("\n=== RUNNING SYNTHETIC 20D LENS STRESS TEST ===")
    test_cases = [
        ("IDRiD_370", False), # Non-referable Grade 0
        ("IDRiD_005", True),  # Referable Grade 4
    ]
    img_dir = r"C:\Users\jaisw\Downloads\archive\Imagenes\Imagenes"

    for img_id, expected_referable in test_cases:
        path = os.path.join(img_dir, f"{img_id}.jpg")
        raw = cv2.imread(path)
        assert raw is not None, f"Could not load {path}"
        
        # 1. Baseline tabletop coordinates & prediction
        crop_base = crop_fov_and_mask_hardened(raw, is_20d_lens=False)
        (base_od_x, base_od_y), _, _, _ = locate_optic_disc_and_fovea_hardened(crop_base, is_20d_lens=False)
        
        # 2. Synthesize 20D handheld capture:
        # - Rotate 180°
        # - Place in canvas off-center near frame borders (exercising non-square padding guard)
        # - Add central flash glare spot at true retinal center
        h, w = raw.shape[:2]
        inv_180 = cv2.rotate(raw, cv2.ROTATE_180)
        canvas = np.zeros((int(h * 1.25), int(w * 1.25), 3), dtype=np.uint8)
        offset_y, offset_x = int(h * 0.04), int(w * 0.04)
        canvas[offset_y:offset_y+h, offset_x:offset_x+w] = inv_180
        
        # Locate true center of the inverted retina to place realistic specular flash glare
        gray_canvas = cv2.cvtColor(canvas, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray_canvas, 15, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        c = max(contours, key=cv2.contourArea)
        (retina_cx, retina_cy), retina_r = cv2.minEnclosingCircle(c)
        
        synthetic_20d = canvas.copy()
        cv2.circle(synthetic_20d, (int(retina_cx), int(retina_cy)), int(retina_r * 0.07), (255, 255, 255), -1)

        # 3. Process with hardened pipeline under is_20d_lens=True
        crop_20d = crop_fov_and_mask_hardened(synthetic_20d, is_20d_lens=True)
        (od_20d_x, od_20d_y), (fov_20d_x, fov_20d_y), _, _ = locate_optic_disc_and_fovea_hardened(crop_20d, is_20d_lens=True)
        
        # Coordinate deviation
        delta_od = np.hypot(od_20d_x - base_od_x, od_20d_y - base_od_y)
        print(f"[{img_id} 20D Invariance] Baseline OD: ({base_od_x}, {base_od_y}) | 20D Recovered OD: ({od_20d_x}, {od_20d_y}) | Delta: {delta_od:.1f}px")
        
        assert delta_od <= 15.0, f"Optic disc locator failed 20D invariance on {img_id}: delta {delta_od:.1f}px > 15px"
        
        # Test model referral classification parity
        rgb = cv2.cvtColor(crop_20d, cv2.COLOR_BGR2RGB)
        norm = ((rgb.astype(np.float32) / 255.0) - MEAN) / STD
        tensor = torch.tensor(norm.transpose(2, 0, 1), dtype=torch.float32).unsqueeze(0)
        with torch.no_grad():
            out = model(tensor)
            probs = torch.softmax(out / TEMPERATURE, dim=-1)[0].numpy()
            ref_prob = float(np.sum(probs[2:]))
            is_referable = ref_prob >= TAU

        print(f"[{img_id} 20D Invariance] Calibrated Referable Prob: {ref_prob:.2%} | Referral: {is_referable} (Expected: {expected_referable})")
        assert is_referable == expected_referable, f"Referral state changed under 20D optical transformation on {img_id}"

    print("=== SYNTHETIC 20D LENS STRESS TEST: ALL ASSERTS PASSED ===")


if __name__ == "__main__":
    run_audit()

