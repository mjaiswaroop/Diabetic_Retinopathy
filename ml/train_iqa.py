"""
Image Quality Assessment (IQA) & Defect Gate Training Script.
Trains ResNet18 multi-label defect classifier with ONNX export.
Assigned to Jagan Sai K (Quality Gate & XAI Lead) - Slide 4 & 5.
"""
import os
import argparse
import numpy as np
import pandas as pd
import cv2
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import timm
from sklearn.metrics import f1_score, roc_auc_score

DEFECTS = ["blur", "underexposed", "overexposed", "glare", "off_centre"]
MEAN = np.float32([0.485, 0.456, 0.406])
STD = np.float32([0.229, 0.224, 0.225])

def apply_field_degradations(img: np.ndarray, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    """
    Simulates real-world rural clinic fundus defects:
    0: blur, 1: underexposed, 2: overexposed, 3: glare reflection, 4: off-centre
    """
    labels = np.zeros(5, dtype=np.float32)
    if rng.random() < 0.35:
        return img, labels  # 35% remain pristine gradable

    chosen_defects = rng.choice(5, size=rng.integers(1, 3), replace=False)
    # Exclude contradiction: cannot be simultaneously dark and overexposed
    if 1 in chosen_defects and 2 in chosen_defects:
        chosen_defects = chosen_defects[chosen_defects != 2]

    for defect_idx in chosen_defects:
        labels[defect_idx] = 1.0
        if defect_idx == 0:  # Blur
            k = int(rng.uniform(7, 19))
            k = k if k % 2 != 0 else k + 1
            img = cv2.GaussianBlur(img, (k, k), rng.uniform(3.0, 7.0))
        elif defect_idx == 1:  # Underexposed
            factor = rng.uniform(0.15, 0.40)
            img = np.clip(img * factor, 0, 255).astype(np.uint8)
        elif defect_idx == 2:  # Overexposed
            factor = rng.uniform(1.8, 2.5)
            img = np.clip(img * factor + 30, 0, 255).astype(np.uint8)
        elif defect_idx == 3:  # Glare spot
            mask = np.zeros(img.shape[:2], dtype=np.float32)
            for _ in range(rng.integers(1, 3)):
                center = (int(rng.integers(120, 390)), int(rng.integers(120, 390)))
                radius = int(rng.integers(30, 80))
                cv2.circle(mask, center, radius, 1.0, -1)
            mask = cv2.GaussianBlur(mask, (31, 31), 15)[..., None]
            img = np.clip(img * (1.0 - mask) + 255 * mask, 0, 255).astype(np.uint8)
        elif defect_idx == 4:  # Off-centre
            dx = rng.choice([-1, 1]) * rng.uniform(60, 140)
            dy = rng.choice([-1, 1]) * rng.uniform(40, 100)
            M = np.float32([[1, 0, dx], [0, 1, dy]])
            img = cv2.warpAffine(img, M, (img.shape[1], img.shape[0]), borderMode=cv2.BORDER_CONSTANT, borderValue=0)

    return img, labels

class IQADataset(Dataset):
    def __init__(self, filenames: list[str], img_dir: str, is_eval: bool = False, img_size: int = 256):
        self.filenames = filenames
        self.img_dir = img_dir
        self.is_eval = is_eval
        self.img_size = img_size

    def __len__(self):
        return len(self.filenames)

    def __getitem__(self, idx: int):
        rng = np.random.default_rng(2026 + idx if self.is_eval else None)
        path = os.path.join(self.img_dir, f"{self.filenames[idx]}.jpeg")
        
        # Load image or generate synthetic fallback if path missing
        if os.path.exists(path):
            img = cv2.imread(path)
        else:
            img = np.full((512, 512, 3), 128, dtype=np.uint8)

        degraded_img, labels = apply_field_degradations(img, rng)
        resized = cv2.resize(cv2.cvtColor(degraded_img, cv2.COLOR_BGR2RGB), (self.img_size, self.img_size), interpolation=cv2.INTER_AREA)
        norm = (resized.astype(np.float32) / 255.0 - MEAN) / STD
        tensor = torch.from_numpy(norm.transpose(2, 0, 1))
        return tensor, torch.from_numpy(labels)

def train_iqa(args):
    os.makedirs(args.out_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[IQA Training] Device: {device} | Model: resnet18 | Epochs: {args.epochs}")

    # Build model with 5 defect output logits
    model = timm.create_model("resnet18", pretrained=True, num_classes=5).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    criterion = nn.BCEWithLogitsLoss()

    # Load splits manifest (or dummy list for smoke test)
    if os.path.exists(args.splits_csv):
        df = pd.read_csv(args.splits_csv)
        train_names = df[df.split == "train"].image.tolist()[:args.limit or None]
        val_names = df[df.split == "val"].image.tolist()[:args.limit or None]
    else:
        print("[IQA Training] splits.csv not found; running with generated sample dataset.")
        train_names = [f"sample_{i}" for i in range(100)]
        val_names = [f"sample_{i}" for i in range(30)]

    train_loader = DataLoader(
        IQADataset(train_names, args.img_dir, is_eval=False, img_size=args.img_size),
        batch_size=args.batch_size, shuffle=True, num_workers=args.workers
    )
    val_loader = DataLoader(
        IQADataset(val_names, args.img_dir, is_eval=True, img_size=args.img_size),
        batch_size=args.batch_size, shuffle=False, num_workers=args.workers
    )

    best_f1 = 0.0
    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
            running_loss += loss.item()

        # Validation
        model.eval()
        preds, targets = [], []
        with torch.no_grad():
            for x, y in val_loader:
                preds.append(torch.sigmoid(model(x.to(device))).cpu().numpy())
                targets.append(y.numpy())

        preds = np.concatenate(preds) > 0.5
        targets = np.concatenate(targets)
        mean_f1 = np.mean([f1_score(targets[:, i], preds[:, i], zero_division=0) for i in range(5)])
        gradable_acc = ((targets.sum(1) == 0) == (preds.sum(1) == 0)).mean()

        print(f"Epoch {epoch:02d} | Train Loss: {running_loss/len(train_loader):.4f} | Defect Mean F1: {mean_f1:.3f} | Gradability Acc: {gradable_acc:.3f}")

        if mean_f1 > best_f1:
            best_f1 = mean_f1
            torch.save(model.state_dict(), os.path.join(args.out_dir, "iqa_net.pt"))

    # Export to ONNX for edge inference (Varsha's deliverable)
    dummy_input = torch.randn(1, 3, args.img_size, args.img_size).to(device)
    onnx_path = os.path.join(args.out_dir, "iqa_net.onnx")
    torch.onnx.export(
        model, dummy_input, onnx_path,
        input_names=["input"], output_names=["defect_logits"],
        dynamic_axes={"input": {0: "batch_size"}, "defect_logits": {0: "batch_size"}},
        opset_version=14
    )
    print(f"✓ Best IQA model saved to {args.out_dir}/iqa_net.pt and exported to {onnx_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--img-size", type=int, default=256)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--img-dir", type=str, default="data/proc512")
    parser.add_argument("--splits-csv", type=str, default="data/splits.csv")
    parser.add_argument("--out-dir", type=str, default="ml/outputs")
    train_iqa(parser.parse_args())

