# AGENT_LESSONS.md - Self-Verifying Audit & Failure Mode Log

This document records failure modes, root causes, architectural rules, and regression assertions discovered during development and testing of the Diabetic Retinopathy screening pipeline.

---

## Foundational Architectural Lessons & Pipeline Rules

### 1. Training Distribution vs. Inference Transformation Parity
- **Lesson:** The ResNet-50 backbone (`sakshamkr1/ResNet50-APTOS-DR`) was trained on standard RGB retinal fundus images resized to **384×384** with ImageNet normalization: `mean = [0.485, 0.456, 0.406]`, `std = [0.229, 0.224, 0.225]`.
- **Failure Mode:** Injecting heavy spatial or color filtering at inference time (such as dual-pass CLAHE or Ben Graham local contrast subtraction `cv2.addWeighted`) induces severe out-of-distribution shift. On the IDRiD dataset, CLAHE and Ben Graham caused referable sensitivity to collapse from ~88-91% down to 36.5%–54.9%.
- **Rule:** Never apply uncalibrated CLAHE or Graham blurring at inference unless the underlying backbone weights were specifically fine-tuned with those exact transforms.

### 2. Anatomical False Positives & Foveal Saliency Trap
- **Lesson:** Healthy Grade 0 retinas with prominent foveal avascular reflexes (e.g., `IDRiD_370`) can trigger false positive Grade 2 predictions when using uncropped images with black margins or dual-pass CLAHE, because contrast over-enhancement turns natural foveal darkness into pseudo-hemorrhages.
- **Rule:** FOV cropping (`crop_384`) removes border artifacts and normalizes image scale, achieving 100% specificity (0 False Positives out of 131 non-referable images in the IDRiD dev set).

### 3. Temperature Scaling & Operating Thresholds
- **Lesson:** Raw classification softmax probabilities are frequently overconfident. A temperature scaling parameter ($T = 1.9567$) with sensitivity-calibrated decision threshold ($\tau = 0.4106$) achieves $\ge 90\%$ sensitivity while preserving $\ge 90\%$ specificity for referable DR ($\text{Grade} \ge 2$).

### 4. Determinism & Evaluation Mode
- **Lesson:** PyTorch models must strictly execute with `model.eval()`, `torch.no_grad()`, and constant random seeds to ensure output logits match within $10^{-5}$ across multiple passes.

### 5. FOV Aspect Ratio & Letterbox Floor Trap
- **Lesson:** Hardcoded contour area thresholds (e.g. `area < 0.15 * total_area`) fail on modern smartphone and wide letterboxed displays where the circular retina accounts for only 11%–14% of the canvas. This caused sharp images to be rejected as ungradable or underexposed because the vast black letterbox dragged down the mean luminance.
- **Rule:** Detect circular retinal boundaries using low-threshold binary contours with adaptive area limits (`area >= 0.02 * total_area` and circularity $> 0.35$). Quality gates (blur, illumination, glare) must run strictly on the masked retinal tissue (`mask > 0`), never on the surrounding black borders.

### 6. Clinical Fail-Safe Rule (Zero Fail-Open)
- **Lesson:** If an image is flagged as `UNGRADABLE` (`grade == -1`), the API must return `clinical_status: "UNGRADABLE"`, `referable: None`, `referable_prob: None`, and `dme_status: "UNGRADABLE"`. The UI must never interpret a missing or zero probability as `Non-Referable` (0%) or clear DME. An explicit amber alert requiring clinician review or recapture must be rendered.

### 7. Automated CI Safety Gate
- **Lesson:** Automated regression tests (`ml/test_ci_safety.py`) must run in CI (`.github/workflows/ci.yml`) to guarantee that future commits never regress the ungradable fail-safe, the wide-letterbox crop invariance, or 20D/28D lens optical inversion parity.

---

## Audit Cross-Check Log

### Run ID: AUDIT-2026-11-20-03 (Hardened Vessel Convergence & 20D Lens Invariance)
- **Focus:** Punctate Exudate Decoys, Optical Inversion (20D/28D Condensing Lenses), Aspect Ratio Distortion, and Central Specular Glare.
- **Methodology & Hardening:**
  1. **Exudate Suppression & Vessel Convergence:** Combined a $29\times 29$ morphological opening on $(R+G)/2.0$ with green-channel black-hat vascular density ($1.0 + 0.8 \times \text{VesselDensity}$). Even under confluent circinate exudates (`IDRiD_005`), the optic disc coordinate is locked firmly to vascular roots at $(83, 168)$.
  2. **Non-Square Clamp Guard:** When circular retinal apertures touch frame borders, out-of-bounds boundaries are padded with black (`cv2.copyMakeBorder`) before resizing to $384\times 384$, preserving true 1:1 circular aspect ratio.
  3. **Upstream $180^\circ$ Rotation:** `is_20d_lens=True` rotates the image upstream in `crop_fov_and_mask_hardened`, guaranteeing 1:1 coordinate parity between Grad-CAM++ saliency and anatomical landmarks.
- **Synthetic 20D Stress Test Results:**
  - `IDRiD_370` (Healthy Control): Baseline OD $(310, 144) \to$ 20D Recovered OD $(314, 150)$ (Delta: **7.2px** $\le 15\text{px}$). Non-referable diagnosis preserved (24.43% referable prob < $\tau = 41.06\%$).
  - `IDRiD_005` (High-Risk PDR): Baseline OD $(83, 168) \to$ 20D Recovered OD $(82, 168)$ (Delta: **1.0px** $\le 15\text{px}$). Referable classification preserved (84.07% referable prob $\ge \tau = 41.06\%$).
- **Assertions:** All asserts passed with 0 failures across table-top and inverted handheld indirect lens modalities.
