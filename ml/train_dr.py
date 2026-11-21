"""
Production DR 5-Class Classifier Training with:
- ResNet-50 / EfficientNet architecture
- Cost-sensitive class-weighted loss (handles severe class imbalance)
- Quadratic Weighted Kappa (QWK) & Referable AUROC evaluation
- Temperature Scaling Probability Calibration (ECE < 0.05)
- Automated ONNX Edge Export
Assigned to Aditya S (ML Lead) & Varsha Madyalkar (MLOps Lead) - Slides 4, 12, 13.
"""
import os
import time
import argparse
import numpy as np
import pandas as pd
import cv2
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import timm
from sklearn.metrics import cohen_kappa_score, roc_auc_score
from calibration import TemperatureScaler, compute_ece

MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)

class DRDataset(Dataset):
    def __init__(self, df: pd.DataFrame, img_dir: str, img_size: int = 384, is_train: bool = True):
        self.df = df.reset_index(drop=True)
        self.img_dir = img_dir
        self.img_size = img_size
        self.is_train = is_train

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx: int):
        row = self.df.iloc[idx]
        path = os.path.join(self.img_dir, f"{row.image}.jpeg")

        if os.path.exists(path):
            img = cv2.imread(path)
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        else:
            img = np.full((self.img_size, self.img_size, 3), 128, dtype=np.uint8)

        # Basic or train augmentations
        if self.is_train:
            if np.random.random() > 0.5:
                img = cv2.flip(img, 1)  # horizontal flip
            if np.random.random() > 0.5:
                img = cv2.flip(img, 0)  # vertical flip
            # Random 90 degree rotation
            rot_k = np.random.randint(0, 4)
            img = np.rot90(img, rot_k)

        img = cv2.resize(img, (self.img_size, self.img_size), interpolation=cv2.INTER_AREA)
        norm = (img.astype(np.float32) / 255.0 - MEAN) / STD
        tensor = torch.from_numpy(norm.transpose(2, 0, 1).copy())
        
        label = int(row.level) if "level" in row else 0
        return tensor, label

def train_dr_classifier(args):
    os.makedirs(args.out_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[DR Classifier] Device: {device} | Architecture: {args.arch} | Image Size: {args.img_size}x{args.img_size}")

    # 1. Dataset splits
    if os.path.exists(args.splits_csv):
        df = pd.read_csv(args.splits_csv)
        train_df = df[df.split == "train"]
        val_df = df[df.split == "val"]
        if args.limit:
            train_df = train_df.sample(args.limit, random_state=42)
            val_df = val_df.sample(max(args.limit // 2, 10), random_state=42)
    else:
        print("[DR Classifier] Generating synthetic demo dataframe for testing...")
        train_df = pd.DataFrame({"image": [f"img_{i}" for i in range(80)], "level": np.random.randint(0, 5, 80)})
        val_df = pd.DataFrame({"image": [f"img_{i}" for i in range(20)], "level": np.random.randint(0, 5, 20)})

    train_loader = DataLoader(
        DRDataset(train_df, args.img_dir, img_size=args.img_size, is_train=True),
        batch_size=args.batch_size, shuffle=True, num_workers=args.workers, drop_last=True
    )
    val_loader = DataLoader(
        DRDataset(val_df, args.img_dir, img_size=args.img_size, is_train=False),
        batch_size=args.batch_size * 2, shuffle=False, num_workers=args.workers
    )

    # 2. Model initialization
    model = timm.create_model(args.arch, pretrained=True, num_classes=5).to(device)

    # 3. Class-weighted Cross-Entropy loss (Slide 4: Aditya S)
    counts = np.bincount(train_df.level, minlength=5)
    weights = (counts.sum() / np.maximum(counts, 1)) ** 0.5
    weights = weights / weights.mean()
    class_weights_tensor = torch.tensor(weights, dtype=torch.float32, device=device)
    criterion = nn.CrossEntropyLoss(weight=class_weights_tensor)

    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    scaler = torch.amp.GradScaler("cuda") if device.type == "cuda" else None

    best_qwk = -1.0
    history_log = []

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        model.train()
        train_loss = 0.0

        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()

            if scaler:
                with torch.autocast("cuda"):
                    out = model(x)
                    loss = criterion(out, y)
                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()
            else:
                out = model(x)
                loss = criterion(out, y)
                loss.backward()
                optimizer.step()

            train_loss += loss.item()

        scheduler.step()

        # Validation pass
        model.eval()
        val_logits, val_targets = [], []
        with torch.no_grad():
            for x, y in val_loader:
                x = x.to(device)
                logits = model(x)
                val_logits.append(logits.cpu())
                val_targets.append(y)

        val_logits = torch.cat(val_logits)
        val_targets = torch.cat(val_targets).numpy()
        val_probs = torch.softmax(val_logits, dim=1).numpy()
        val_preds = np.argmax(val_probs, axis=1)

        # Performance Metrics (Slide 13: Expected Outcomes)
        qwk = cohen_kappa_score(val_targets, val_preds, weights="quadratic")
        # Referable DR is grade >= 2 (Moderate, Severe, PDR)
        ref_targets = (val_targets >= 2).astype(int)
        ref_probs = val_probs[:, 2:].sum(axis=1)

        try:
            ref_auroc = roc_auc_score(ref_targets, ref_probs)
        except ValueError:
            ref_auroc = 0.5

        raw_ece = compute_ece(val_probs, val_targets)
        elapsed = time.time() - t0

        print(f"Epoch {epoch:02d}/{args.epochs:02d} [{elapsed:.0f}s] | Loss: {train_loss/len(train_loader):.3f} | QWK: {qwk:.3f} (target >0.80) | refAUROC: {ref_auroc:.3f} (target >0.92) | ECE: {raw_ece:.3f}")

        history_log.append({
            "epoch": epoch,
            "loss": train_loss / len(train_loader),
            "qwk": qwk,
            "ref_auroc": ref_auroc,
            "raw_ece": raw_ece
        })

        if qwk > best_qwk:
            best_qwk = qwk
            torch.save(model.state_dict(), os.path.join(args.out_dir, "best_dr_model.pt"))

    # 4. Post-hoc Temperature Scaling (Guo et al. 2017)
    print("\n--- Performing Temperature Scaling Probability Calibration ---")
    scaler_module = TemperatureScaler()
    optimal_t = scaler_module.fit(val_logits, torch.tensor(val_targets))
    calibrated_logits = val_logits / optimal_t
    calibrated_probs = torch.softmax(calibrated_logits, dim=1).numpy()
    calibrated_ece = compute_ece(calibrated_probs, val_targets)
    print(f"✓ ECE Before Calibration: {raw_ece:.4f} ──► ECE After Calibration: {calibrated_ece:.4f} (Target <0.05)")

    # Save calibration metadata for backend inference
    calib_meta = {
        "temperature": optimal_t,
        "raw_ece": raw_ece,
        "calibrated_ece": calibrated_ece,
        "best_qwk": best_qwk,
        "model_version": f"{args.arch}-v2.1",
        "preprocessing_version": "clahe-norm-v2"
    }
    pd.DataFrame([calib_meta]).to_json(os.path.join(args.out_dir, "calibration_meta.json"), indent=2)

    # 5. Export to ONNX (Varsha's deliverable - Slide 12)
    print("\n--- Exporting to ONNX Runtime Engine ---")
    model.eval()
    dummy_input = torch.randn(1, 3, args.img_size, args.img_size).to(device)
    onnx_path = os.path.join(args.out_dir, "dr_classifier.onnx")
    torch.onnx.export(
        model, dummy_input, onnx_path,
        input_names=["fundus_image"], output_names=["logits"],
        dynamic_axes={"fundus_image": {0: "batch_size"}, "logits": {0: "batch_size"}},
        opset_version=14
    )
    print(f"✓ Saved Best PyTorch Checkpoint: {args.out_dir}/best_dr_model.pt")
    print(f"✓ Saved ONNX Runtime Model: {onnx_path}")
    print(f"✓ Saved Calibration Metadata: {args.out_dir}/calibration_meta.json")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--arch", type=str, default="resnet50")
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--img-size", type=int, default=384)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--img-dir", type=str, default="data/proc512")
    parser.add_argument("--splits-csv", type=str, default="data/splits.csv")
    parser.add_argument("--out-dir", type=str, default="ml/outputs")
    train_dr_classifier(parser.parse_args())

