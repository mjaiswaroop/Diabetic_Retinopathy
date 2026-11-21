"""
Temperature Scaling for Probability Calibration.
Reference: Guo et al., "On Calibration of Modern Neural Networks", ICML 2017.
Assigned to Aditya S (ML Pipeline Lead) - Slide 4 & 5.
"""
import torch
import torch.nn as nn
import numpy as np

class TemperatureScaler(nn.Module):
    def __init__(self):
        super().__init__()
        self.temperature = nn.Parameter(torch.ones(1) * 1.5)

    def forward(self, logits: torch.Tensor) -> torch.Tensor:
        return logits / self.temperature

    def fit(self, val_logits: torch.Tensor, val_labels: torch.Tensor, lr: float = 0.01, max_iter: int = 100):
        """
        Learns optimal temperature T by minimizing NLL on validation set.
        """
        self.cuda() if val_logits.is_cuda else self.cpu()
        nll_criterion = nn.CrossEntropyLoss()
        optimizer = torch.optim.LBFGS([self.temperature], lr=lr, max_iter=max_iter)

        def eval_step():
            optimizer.zero_grad()
            loss = nll_criterion(self.forward(val_logits), val_labels)
            loss.backward()
            return loss

        optimizer.step(eval_step)
        print(f"[TemperatureScaler] Optimal Temperature T: {self.temperature.item():.4f}")
        return self.temperature.item()

def compute_ece(probs: np.ndarray, labels: np.ndarray, n_bins: int = 15) -> float:
    """
    Computes Expected Calibration Error (ECE). Target from Slide 13: ECE < 0.05.
    """
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == labels).astype(float)

    ece = 0.0
    n_samples = len(labels)

    for i in range(n_bins):
        bin_lower, bin_upper = bin_boundaries[i], bin_boundaries[i + 1]
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
        prop_in_bin = np.mean(in_bin)

        if prop_in_bin > 0:
            avg_accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            ece += np.abs(avg_accuracy_in_bin - avg_confidence_in_bin) * prop_in_bin

    return float(ece)

