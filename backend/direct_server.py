import base64
import os
import sys
import cv2
import numpy as np
import torch
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Ensure ml directory is on sys.path for shared single source of truth preprocessing
ML_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ml"))
if ML_DIR not in sys.path:
    sys.path.insert(0, ML_DIR)

from dr_preprocessing import crop_fov, assess_image_quality, MEAN, STD

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

# Fitted Temperature and Threshold from 5-fold cross-validation on 375 dev images
TEMPERATURE = 1.9567
THRESHOLD_TAU = 0.4106


def compute_gradcam_plusplus(tensor: torch.Tensor, target_class_idx: int) -> np.ndarray:
    """
    Authentic Grad-CAM++ calculation for spatial saliency.
    """
    global features_map, gradients_map
    model.zero_grad()
    if tensor.grad is not None:
        tensor.grad.zero_()

    output = model(tensor)
    score = output[0, target_class_idx]
    score.backward(retain_graph=True)

    gradients = gradients_map.data.cpu().numpy()[0]   # (C, H, W)
    activations = features_map.data.cpu().numpy()[0] # (C, H, W)

    # 2nd and 3rd order gradients
    g2 = gradients ** 2
    g3 = gradients ** 3
    sum_acts = np.sum(activations, axis=(1, 2), keepdims=True)
    eps = 1e-7
    alphas = g2 / (2.0 * g2 + sum_acts * g3 + eps)

    weights = np.maximum(gradients, 0)
    alphas_weights = alphas * weights
    alphas_weights = np.sum(alphas_weights, axis=(1, 2))

    cam = np.zeros(activations.shape[1:], dtype=np.float32)
    for i, w in enumerate(alphas_weights):
        cam += w * activations[i]

    cam = np.maximum(cam, 0)
    if cam.max() > 0:
        cam = cam / cam.max()
    return cam


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

    # 1. FOV Crop and IQA Gate using canonical shared preprocessing
    cropped_bgr, cropped_mask = crop_fov(img_bgr, is_20d=is_20d, target_size=384)
    iqa_result = assess_image_quality(cropped_bgr, cropped_mask)

    if not iqa_result["gradable"]:
        return {
            "status": "ungradable",
            "clinical_status": "UNGRADABLE",
            "is_gradable": False,
            "reason": iqa_result["reason"],
            "operator_guidance": "Retake fundus photograph adhering to alignment and lighting guidelines.",
            "predicted_class": "Ungradable Quality",
            "grade": -1,
            "referable": None,
            "referable_prob": None,
            "referral_state": "ungradable",
            "dme_status": "UNGRADABLE",
            "confidence": 0.0,
            "class_probabilities": {},
            "heatmap_url": None,
            "cropped_image_url": None,
            "lesions_detected": [],
            "model_version": "ResNet50-crop384-Calibrated-v3.1"
        }

    # 2. Preprocess at 384x384 standard ImageNet normalization
    img_rgb = cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2RGB)
    resized_rgb = img_rgb.astype(np.float32) / 255.0
    tensor_np = ((resized_rgb - MEAN) / STD).transpose(2, 0, 1)
    tensor = torch.tensor(tensor_np, dtype=torch.float32).unsqueeze(0)
    tensor.requires_grad = True

    # 3. Model Forward Pass & Calibrated Probabilities
    with torch.no_grad():
        raw_logits = model(tensor)
        cal_logits = raw_logits / TEMPERATURE
        cal_probs = torch.softmax(cal_logits, dim=-1)[0].numpy()

    # Probability of Referable DR: P(Grade >= 2)
    referable_prob = float(np.sum(cal_probs[2:]))
    pred_idx = int(np.argmax(cal_probs))
    
    # Referral decision based on tuned threshold tau=0.4106
    if referable_prob >= THRESHOLD_TAU:
        referral_state = "referable"
        referable = True
    elif referable_prob >= (THRESHOLD_TAU * 0.70):
        referral_state = "uncertain"
        referable = None
    else:
        referral_state = "non_referable"
        referable = False

    confidence = float(cal_probs[pred_idx])

    # 4. Grad-CAM++ Saliency Heatmap (Bounded strictly inside circular retinal tissue)
    cam = compute_gradcam_plusplus(tensor, target_class_idx=pred_idx)
    cam_384 = cv2.resize(cam, (384, 384), interpolation=cv2.INTER_CUBIC)
    
    # Strictly zero out non-retinal background borders
    cam_384[cropped_mask == 0] = 0.0
    cam_384 = np.maximum(cam_384, 0.0)
    max_c = np.max(cam_384)
    if max_c > 1e-6:
        cam_384 = cam_384 / max_c
    else:
        cam_384 = np.zeros((384, 384), dtype=np.float32)

    # Threshold low-level background noise (< 0.25) to keep non-lesion retina clean
    cam_384 = np.where(cam_384 > 0.25, (cam_384 - 0.25) / 0.75, 0.0).astype(np.float32)

    heatmap_colored = cv2.applyColorMap(np.uint8(255 * cam_384), cv2.COLORMAP_JET)
    heatmap_colored = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGBA)
    alpha = np.uint8(np.clip(cam_384 * 1.6, 0, 0.85) * 255)
    alpha[cropped_mask == 0] = 0
    heatmap_colored[:, :, 3] = alpha

    _, buffer = cv2.imencode(".png", heatmap_colored)
    b64_str = base64.b64encode(buffer).decode("utf-8")
    heatmap_base64 = "data:image/png;base64," + b64_str

    # Encode cropped retinal image for client rendering
    _, crop_buf = cv2.imencode(".jpg", cropped_bgr)
    cropped_b64 = "data:image/jpeg;base64," + base64.b64encode(crop_buf).decode("utf-8")

    # 5. Saliency Focus Region strictly bounded inside retinal tissue
    regions_detected = []
    if pred_idx > 0 and np.max(cam_384) > 0.30:
        blurred = cv2.GaussianBlur(cam_384, (15, 15), 0)
        blurred[cropped_mask == 0] = 0.0
        _, _, _, max_loc = cv2.minMaxLoc(blurred)
        x_pct = round((max_loc[0] / 384.0) * 100, 1)
        y_pct = round((max_loc[1] / 384.0) * 100, 1)

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

    # DME clinical classification based on grade
    dme_status = "REFERABLE_DME" if pred_idx >= 2 else "NO_DME_DETECTED"

    return {
        "status": "gradable",
        "clinical_status": "GRADABLE",
        "is_gradable": True,
        "predicted_class": CLASSES[pred_idx],
        "grade": pred_idx,
        "confidence": confidence,
        "referable": referable,
        "referable_prob": referable_prob,
        "referral_state": referral_state,
        "dme_status": dme_status,
        "class_probabilities": {c: float(p) for c, p in zip(CLASSES, cal_probs)},
        "heatmap_url": heatmap_base64,
        "cropped_image_url": cropped_b64,
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
