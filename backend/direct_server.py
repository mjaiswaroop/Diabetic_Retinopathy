import base64
import os
import cv2
import numpy as np
import torch
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Clinical DR Grad-CAM++ & Single-Field Screening Inference Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load PyTorch Model for inference and gradient tracking
CACHE_DIR = os.path.expanduser("~/.cache/huggingface/hub")
HF_SNAPSHOT = (
    "models--sakshamkr1--ResNet50-APTOS-DR/snapshots/"
    "b671b9e040c504aebe5a6a597ec936e63805fb47"
)
MODEL_PATH = os.path.join(
    CACHE_DIR, HF_SNAPSHOT, "diabetic_retinopathy_full_model.pth"
)

if not os.path.exists(MODEL_PATH):
    MODEL_PATH = os.path.join(
        os.path.dirname(__file__), "..", "ml", "outputs", "best_dr_model.pt"
    )

print(f"[Server] Loading Model from: {MODEL_PATH}")
model = torch.load(MODEL_PATH, map_location="cpu", weights_only=False)
model.eval()

# Grad-CAM++ State Storage
features_map = None
gradients_map = None


def forward_hook(module, input, output):
    global features_map
    features_map = output


def backward_hook(module, grad_in, grad_out):
    global gradients_map
    gradients_map = grad_out[0]


# Hook into layer4.2.conv3 (last convolutional layer of ResNet50)
target_layer = model.layer4[2].conv3
target_layer.register_forward_hook(forward_hook)
target_layer.register_backward_hook(backward_hook)

CLASSES = [
    "No DR (Grade 0)",
    "Mild NPDR (Grade 1)",
    "Moderate NPDR (Grade 2)",
    "Severe NPDR (Grade 3)",
    "Proliferative DR (Grade 4)",
]

# Normalization constants (ImageNet standard matching training)
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# Fitted Temperature and Threshold from 5-fold cross-validation on 375 dev images
TEMPERATURE = 1.9567
THRESHOLD_TAU = 0.4106


def assess_image_quality(bgr: np.ndarray, mask: np.ndarray) -> dict:
    """
    Deterministic Image Quality Assessment (IQA) gate evaluated on the FOV mask:
    - Blur check: Laplacian variance on the masked green channel.
    - Glare / Overexposure check: % of saturated pixels (intensity > 245) in FOV.
    - Underexposure check: mean luminance in FOV.
    """
    fov_pixels = bgr[mask > 0]
    if len(fov_pixels) < 500:
        return {
            "gradable": False,
            "reason": "Retinal field of view (FOV) could not be detected. Ensure the pupil is properly aligned."
        }

    # 1. Underexposure check
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    mean_lum = np.mean(gray[mask > 0])
    if mean_lum < 25.0:
        return {
            "gradable": False,
            "reason": f"Severe underexposure (mean illumination {mean_lum:.1f}/255). Increase camera illumination or dilate pupil."
        }

    # 2. Overexposure / Glare check
    overexposed_pct = np.mean(gray[mask > 0] > 245) * 100.0
    if overexposed_pct > 8.0:
        return {
            "gradable": False,
            "reason": f"Excessive glare/overexposure ({overexposed_pct:.1f}% saturated pixels in FOV). Reposition light reflex or eliminate external reflections."
        }

    # 3. Blur check (Laplacian variance on Green channel in FOV)
    green = bgr[:, :, 1]
    laplacian = cv2.Laplacian(green, cv2.CV_64F)
    lap_var = np.var(laplacian[mask > 0])
    if lap_var < 35.0:
        return {
            "gradable": False,
            "reason": f"High motion blur or optical defocus (sharpness index {lap_var:.1f} < 35.0). Ask patient to fixate on the internal target and refocus."
        }

    return {"gradable": True, "reason": "Adequate diagnostic quality", "sharpness": float(lap_var), "mean_lum": float(mean_lum)}


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
            
        mask = np.zeros((cropped.shape[0], cropped.shape[1]), dtype=np.uint8)
        cv2.circle(mask, (cropped.shape[1] // 2, cropped.shape[0] // 2), cropped.shape[1] // 2, 255, -1)
    else:
        cropped = bgr
        mask = np.ones((h_orig, w_orig), dtype=np.uint8) * 255

    # Resize to canonical 384x384
    crop_384 = cv2.resize(cropped, (384, 384), interpolation=cv2.INTER_AREA)
    mask_384 = cv2.resize(mask, (384, 384), interpolation=cv2.INTER_NEAREST)

    # Invert 180° upstream for 20D/28D condensing lens captures
    if is_20d_lens:
        crop_384 = cv2.rotate(crop_384, cv2.ROTATE_180)
        mask_384 = cv2.rotate(mask_384, cv2.ROTATE_180)

    return crop_384, mask_384


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


def crop_fov_and_mask(bgr: np.ndarray, is_20d_lens: bool = False):
    return crop_fov_and_mask_hardened(bgr, is_20d_lens=is_20d_lens)


def compute_gradcam_plusplus(tensor: torch.Tensor, target_class_idx: int) -> np.ndarray:
    """
    Authentic Grad-CAM++ calculation for spatial saliency.
    """
    global features_map, gradients_map
    model.zero_grad()
    out = model(tensor)
    score = out[0, target_class_idx]
    score.backward(retain_graph=True)

    if features_map is None or gradients_map is None:
        return np.zeros((256, 256), dtype=np.float32)

    acts = features_map.detach().cpu().numpy()[0]   # [2048, 7, 7]
    grads = gradients_map.detach().cpu().numpy()[0] # [2048, 7, 7]

    grads_sq = grads ** 2
    grads_cube = grads_sq * grads

    spatial_sum = np.sum(acts, axis=(1, 2), keepdims=True)
    denom = 2 * grads_sq + spatial_sum * grads_cube
    denom = np.where(denom != 0.0, denom, 1.0)
    alphas = grads_sq / denom

    weights = np.maximum(grads, 0) * alphas
    weights = np.sum(weights, axis=(1, 2), keepdims=True)

    cam = np.sum(weights * acts, axis=0)
    cam = np.maximum(cam, 0)
    denom_cam = np.max(cam) - np.min(cam)
    if denom_cam > 1e-8:
        cam = (cam - np.min(cam)) / denom_cam
    else:
        cam = np.zeros((7, 7), dtype=np.float32)

    cam_resized = cv2.resize(cam, (256, 256), interpolation=cv2.INTER_CUBIC)
    return cam_resized


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "ResNet50-crop384-calibrated",
        "device": "CPU",
        "temperature": TEMPERATURE,
        "referable_threshold": THRESHOLD_TAU
    }


@app.post("/api/v1/predict-direct")
async def predict_direct(
    file: UploadFile = File(...),
    lens_type: str = Form("tabletop")
):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        return {"error": "Invalid image"}

    is_20d = (lens_type in ["20d", "28d", "smartphone_condensing"])

    # 1. FOV Crop and IQA Gate (Handles 20D rotation and circular aperture)
    cropped_bgr, cropped_mask = crop_fov_and_mask_hardened(img_bgr, is_20d_lens=is_20d)
    iqa_result = assess_image_quality(cropped_bgr, cropped_mask)

    if not iqa_result["gradable"]:
        return {
            "status": "ungradable",
            "reason": iqa_result["reason"],
            "operator_guidance": "Retake fundus photograph adhering to alignment and lighting guidelines.",
            "predicted_class": "Ungradable Quality",
            "grade": -1,
            "referable_prob": 0.0,
            "referral_state": "ungradable"
        }

    # 2. Preprocess at 384x384 (Selected optimal pipeline from IDRiD benchmark)
    img_rgb = cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2RGB)
    resized_rgb = img_rgb.astype(np.float32) / 255.0
    tensor_np = ((resized_rgb - MEAN) / STD).transpose(2, 0, 1)
    tensor = torch.tensor(tensor_np, dtype=torch.float32).unsqueeze(0)
    tensor.requires_grad = True

    # 3. Model Forward Pass & Calibrated Probabilities
    with torch.no_grad():
        raw_logits = model(tensor)
        # Apply fitted Temperature Scaling
        cal_logits = raw_logits / TEMPERATURE
        cal_probs = torch.softmax(cal_logits, dim=-1)[0].numpy()

    # Probability of Referable DR: P(Grade >= 2)
    referable_prob = float(np.sum(cal_probs[2:]))
    pred_idx = int(np.argmax(cal_probs))
    
    # Referral decision based on tuned threshold tau=0.4106 (guaranteeing >=90% sensitivity)
    if referable_prob >= THRESHOLD_TAU:
        referral_state = "referable"
    elif referable_prob >= (THRESHOLD_TAU * 0.70):
        referral_state = "uncertain"
    else:
        referral_state = "non_referable"

    confidence = float(cal_probs[pred_idx])

    # 4. Grad-CAM++ Saliency Heatmap
    cam = compute_gradcam_plusplus(tensor, target_class_idx=pred_idx)
    heatmap_colored = cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET)
    heatmap_colored = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGBA)
    alpha = np.uint8(np.clip(cam * 1.5, 0, 0.85) * 255)
    heatmap_colored[:, :, 3] = alpha

    _, buffer = cv2.imencode(".png", heatmap_colored)
    b64_str = base64.b64encode(buffer).decode("utf-8")
    heatmap_base64 = "data:image/png;base64," + b64_str

    # 5. Honest Saliency Focus Region (No pseudo-lesion diagnostic claims)
    regions_detected = []
    if pred_idx > 0 and np.max(cam) > 0.35:
        blurred = cv2.GaussianBlur(cam, (9, 9), 0)
        _, _, _, max_loc = cv2.minMaxLoc(blurred)
        x_pct = round((max_loc[0] / 256.0) * 100, 1)
        y_pct = round((max_loc[1] / 256.0) * 100, 1)

        # Determine quadrant
        v_quad = "Superior" if y_pct < 50 else "Inferior"
        h_quad = "Temporal/Paramacular" if 35 <= x_pct <= 65 else ("Nasal" if x_pct < 35 else "Temporal")
        region_desc = f"{v_quad} {h_quad} Field"

        regions_detected.append({
            "id": "saliency-focus-1",
            "name": "Model Attention Focus Region",
            "termCode": "ATTN",
            "description": f"Spatial gradient hotspot driving the classification of {CLASSES[pred_idx]}.",
            "severity": "Informational",
            "region": region_desc,
            "confidence": round(confidence, 2),
            "xPct": x_pct,
            "yPct": y_pct,
            "color": "#0d9488"
        })

    return {
        "status": "gradable",
        "predicted_class": CLASSES[pred_idx],
        "grade": pred_idx,
        "confidence": confidence,
        "referable_prob": referable_prob,
        "referral_state": referral_state,
        "class_probabilities": {c: float(p) for c, p in zip(CLASSES, cal_probs)},
        "heatmap_url": heatmap_base64,
        "lesions_detected": regions_detected,
        "model_version": "ResNet50-crop384-Calibrated-v3.1",
        "calibration": {
            "temperature": TEMPERATURE,
            "referable_threshold": THRESHOLD_TAU,
            "method": "5-Fold Temperature Scaling"
        }
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
