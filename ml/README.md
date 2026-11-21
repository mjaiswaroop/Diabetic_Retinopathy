# ML Training & Edge Export Pipeline

This directory contains the complete deep learning training, calibration, XAI, and ONNX export modules matching **Slides 4, 5, 12, and 13** of the project presentation.

## Pipeline Modules

| File | Purpose | Team Ownership | PPT Reference |
| :--- | :--- | :--- | :--- |
| `train_iqa.py` | Multi-label Image Quality Assessment & field defect detector (blur, illumination, glare, off-center). Exports `iqa_net.onnx`. | Jagan Sai K | Slide 4 & 5 (Step 1) |
| `train_dr.py` | 5-class severity classification (No DR to PDR) with ResNet-50, class-weighted loss, QWK & AUROC metrics. | Aditya S | Slide 4 & 5 (Step 2) |
| `calibration.py` | Temperature Scaling probability calibration minimizing Negative Log-Likelihood, ECE metric calculation (target < 0.05). | Aditya S | Slide 4 & 13 |
| `gradcam_plusplus.py` | Grad-CAM++ visual attention heatmap generator distinguishing model attention from clinician findings. | Jagan Sai K | Slide 4 & 5 (Step 3) |

## Quick Usage

### 1. Train IQA Quality Gate & Export ONNX
```powershell
python ml/train_iqa.py --epochs 5 --batch-size 32 --img-size 256
```
Outputs:
- `ml/outputs/iqa_net.pt` (PyTorch weights)
- `ml/outputs/iqa_net.onnx` (Edge ONNX runtime model)

### 2. Train DR Classifier with Temperature Calibration & ONNX
```powershell
python ml/train_dr.py --arch resnet50 --epochs 15 --batch-size 16 --img-size 384
```
Outputs:
- `ml/outputs/best_dr_model.pt` (Best QWK checkpoint)
- `ml/outputs/calibration_meta.json` (Optimal temperature T & calibrated ECE)
- `ml/outputs/dr_classifier.onnx` (Ready for edge inference)

### 3. Edge Inference in FastAPI Backend
The generated `.onnx` models plug directly into `backend/app/ml/base.py` via `onnxruntime` for low-latency ($< 2.0\text{s}$) edge execution.

