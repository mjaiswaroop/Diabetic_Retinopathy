"""
Grad-CAM++ Heatmap Generation for Explainable AI (XAI).
Assigned to Jagan Sai K (Quality Gate & XAI Lead) - Slide 4 & 5.
Reference: Chattopadhay et al., "Grad-CAM++", IEEE WACV 2018.
"""
import torch
import torch.nn.functional as F
import numpy as np
import cv2

class GradCAMPlusPlus:
    def __init__(self, model: torch.nn.Module, target_layer: torch.nn.Module):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        self.hook_layers()

    def hook_layers(self):
        def forward_hook(module, input, output):
            self.activations = output

        def backward_hook(module, grad_in, grad_out):
            self.gradients = grad_out[0]

        self.target_layer.register_forward_hook(forward_hook)
        self.target_layer.register_full_backward_hook(backward_hook)

    def generate_heatmap(self, input_tensor: torch.Tensor, target_class: int = None) -> np.ndarray:
        self.model.eval()
        logits = self.model(input_tensor)

        if target_class is None:
            target_class = logits.argmax(dim=1).item()

        score = logits[0, target_class]
        self.model.zero_grad()
        score.backward(retain_graph=True)

        gradients = self.gradients[0].cpu().data.numpy()      # [C, H, W]
        activations = self.activations[0].cpu().data.numpy()  # [C, H, W]

        # Grad-CAM++ weight formula
        grad_2 = gradients ** 2
        grad_3 = grad_2 * gradients
        sum_activations = activations.sum(axis=(1, 2), keepdims=True)
        eps = 1e-7

        alpha = grad_2 / (2 * grad_2 + sum_activations * grad_3 + eps)
        weights = (alpha * np.maximum(gradients, 0)).sum(axis=(1, 2))

        cam = np.zeros(activations.shape[1:], dtype=np.float32)
        for i, w in enumerate(weights):
            cam += w * activations[i]

        cam = np.maximum(cam, 0)
        if cam.max() > 0:
            cam = cam / cam.max()
        return cam

    def create_overlay(self, original_rgb: np.ndarray, heatmap: np.ndarray, colormap=cv2.COLORMAP_JET) -> np.ndarray:
        h, w = original_rgb.shape[:2]
        resized_cam = cv2.resize(heatmap, (w, h))
        colored_cam = cv2.applyColorMap(np.uint8(255 * resized_cam), colormap)
        colored_cam = cv2.cvtColor(colored_cam, cv2.COLOR_BGR2RGB)
        overlay = np.uint8(original_rgb * 0.55 + colored_cam * 0.45)
        return overlay

