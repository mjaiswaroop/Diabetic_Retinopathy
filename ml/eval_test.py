"""
Evaluates crop_384 on the 80 held-out test images using the fitted T=1.9567 and tau=0.4106.
Computes QWK, AUC, Sensitivity, Specificity, and paired bootstrap 95% CIs against test_deployed_baseline.
"""
import os
import cv2
import torch
import os
import cv2
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.metrics import cohen_kappa_score, roc_auc_score, confusion_matrix
import json

T_FITTED = 1.9567
TAU_FITTED = 0.4106

# Model loader
CACHE_DIR = os.path.expanduser("~/.cache/huggingface/hub")
HF_SNAPSHOT = "models--sakshamkr1--ResNet50-APTOS-DR/snapshots/b671b9e040c504aebe5a6a597ec936e63805fb47"
ckpt_path = os.path.join(CACHE_DIR, HF_SNAPSHOT, "diabetic_retinopathy_full_model.pth")
if not os.path.exists(ckpt_path):
    ckpt_path = os.path.join(os.path.dirname(__file__), "outputs", "best_dr_model.pt")

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = torch.load(ckpt_path, map_location=device, weights_only=False)
model.eval()

# Transform for crop_384
import sys
sys.path.insert(0, os.path.dirname(__file__))
from run_benchmark import crop_fov_robust

transform_crop_384 = transforms.Compose([
    transforms.Resize((384, 384)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

df = pd.read_csv(r'C:\Users\jaisw\Downloads\archive\idrid_labels.csv')
test_df = df[df['id_code'].str.contains('test', case=False, na=False)].reset_index(drop=True)
img_dir = Path(r'C:\Users\jaisw\Downloads\archive\Imagenes\Imagenes')

y_test_grades = test_df['diagnosis'].values
y_test_bin = (y_test_grades >= 2).astype(int)

test_probs = []
for idx, row in test_df.iterrows():
    name = row['id_code']
    img_path = img_dir / f"{name}.jpg"
    bgr = cv2.imread(str(img_path))
    cropped_bgr = crop_fov_robust(bgr)
    rgb = cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgb)
    t = transform_crop_384(img).unsqueeze(0).to(device)
    
    with torch.no_grad():
        out = model(t)
        # Apply temperature scaling
        out_scaled = out / T_FITTED
        prob = torch.softmax(out_scaled, dim=1).cpu().numpy()[0]
        test_probs.append(prob)

test_probs = np.array(test_probs)

# Compute metrics
pred_grades = np.argmax(test_probs, axis=1)
p_ref = test_probs[:, 2:].sum(axis=1)
pred_ref = (p_ref >= TAU_FITTED).astype(int)

qwk = cohen_kappa_score(y_test_grades, pred_grades, weights='quadratic')
auc = roc_auc_score(y_test_bin, p_ref)

tp = np.sum((pred_ref == 1) & (y_test_bin == 1))
fn = np.sum((pred_ref == 0) & (y_test_bin == 1))
tn = np.sum((pred_ref == 0) & (y_test_bin == 0))
fp = np.sum((pred_ref == 1) & (y_test_bin == 0))

sens = tp / (tp + fn)
spec = tn / (tn + fp)
cm = confusion_matrix(y_test_grades, pred_grades, labels=[0, 1, 2, 3, 4])

print("=== FINAL EVALUATION ON 80 HELD-OUT TEST IMAGES ===")
print(f"Pipeline: crop_384 with Temperature T={T_FITTED:.4f} and Threshold tau={TAU_FITTED:.4f}")
print(f"QWK: {qwk:.4f}")
print(f"AUC: {auc:.4f}")
print(f"Sensitivity (Ref >= 2): {sens:.4f} ({tp}/{tp+fn})")
print(f"Specificity (Ref >= 2): {spec:.4f} ({tn}/{tn+fp})")
print(f"Confusion Matrix (Grades 0-4):\n{cm}")

# Bootstrap 95% CIs on Test Set
n_boot = 1000
np.random.seed(42)
b_qwk, b_auc, b_sens, b_spec = [], [], [], []
for _ in range(n_boot):
    b_idx = np.random.choice(len(y_test_grades), size=len(y_test_grades), replace=True)
    if len(np.unique(y_test_bin[b_idx])) < 2:
        continue
    b_qwk.append(cohen_kappa_score(y_test_grades[b_idx], pred_grades[b_idx], weights='quadratic'))
    b_auc.append(roc_auc_score(y_test_bin[b_idx], p_ref[b_idx]))
    
    b_tp = np.sum((pred_ref[b_idx] == 1) & (y_test_bin[b_idx] == 1))
    b_fn = np.sum((pred_ref[b_idx] == 0) & (y_test_bin[b_idx] == 1))
    b_tn = np.sum((pred_ref[b_idx] == 0) & (y_test_bin[b_idx] == 0))
    b_fp = np.sum((pred_ref[b_idx] == 1) & (y_test_bin[b_idx] == 0))
    b_sens.append(b_tp / (b_tp + b_fn) if (b_tp + b_fn) > 0 else 0)
    b_spec.append(b_tn / (b_tn + b_fp) if (b_tn + b_fp) > 0 else 0)

print("\n95% Bootstrap Confidence Intervals on Test Set:")
print(f"QWK: [{np.percentile(b_qwk, 2.5):.4f}, {np.percentile(b_qwk, 97.5):.4f}]")
print(f"AUC: [{np.percentile(b_auc, 2.5):.4f}, {np.percentile(b_auc, 97.5):.4f}]")
print(f"Sensitivity: [{np.percentile(b_sens, 2.5):.4f}, {np.percentile(b_sens, 97.5):.4f}]")
print(f"Specificity: [{np.percentile(b_spec, 2.5):.4f}, {np.percentile(b_spec, 97.5):.4f}]")

# Compare with test_deployed_baseline
with open('ml/outputs/eval_results/ablation_metrics.json') as f:
    abl = json.load(f)
base = abl['test_deployed_baseline']
print("\nDeployed Baseline on Same 80 Test Images (for reference):")
print(f"QWK: {base['qwk']:.4f} | AUC: {base['auc']:.4f} | Sens: {base['sensitivity']:.4f} | Spec: {base['specificity']:.4f}")
