from abc import ABC, abstractmethod
from pydantic import BaseModel
from typing import Dict, List, Optional
import random

class QualityResult(BaseModel):
    score: float
    gradable: bool
    defects: List[str]
    recapture_instruction: Optional[str]
    model_version: str

class PredictionResult(BaseModel):
    class_probabilities: Dict[str, float]
    predicted_class: str
    referable_prob: float
    confidence: float
    calibration_version: str
    model_version: str
    preprocessing_version: str

class ExplanationResult(BaseModel):
    heatmap_url: str
    overlay_url: str
    method: str
    generation_version: str

class ModelAdapter(ABC):
    @abstractmethod
    def assess_quality(self, image_bytes: bytes) -> QualityResult:
        pass
        
    @abstractmethod
    def predict(self, image_bytes: bytes) -> PredictionResult:
        pass
        
    @abstractmethod
    def explain(self, image_bytes: bytes, target_class: Optional[int] = None) -> ExplanationResult:
        pass

class MockModelAdapter(ModelAdapter):
    def assess_quality(self, image_bytes: bytes) -> QualityResult:
        # Heuristic simulation
        return QualityResult(
            score=0.91,
            gradable=True,
            defects=[],
            recapture_instruction=None,
            model_version="v1.4.0-q"
        )
        
    def predict(self, image_bytes: bytes) -> PredictionResult:
        probs = {
            "No DR": 0.08,
            "Mild DR": 0.14,
            "Moderate DR": 0.64,
            "Severe DR": 0.10,
            "Proliferative DR": 0.04
        }
        return PredictionResult(
            class_probabilities=probs,
            predicted_class="Moderate DR",
            referable_prob=0.78,
            confidence=0.89,
            calibration_version="platt-2026.1",
            model_version="v2.1.0-resnet50",
            preprocessing_version="clahe-v2"
        )
        
    def explain(self, image_bytes: bytes, target_class: Optional[int] = None) -> ExplanationResult:
        return ExplanationResult(
            heatmap_url="https://images.unsplash.com/photo-1579684385127-1ef15d508118",
            overlay_url="https://images.unsplash.com/photo-1579684385127-1ef15d508118",
            method="Grad-CAM++",
            generation_version="gradcam-v1"
        )

# Factory
def get_model_adapter() -> ModelAdapter:
    from app.core.config import settings
    if getattr(settings, "MODEL_ADAPTER", "mock") == "onnx":
        try:
            from app.ml.adapters.onnx_adapter import ONNXModelAdapter
            return ONNXModelAdapter()
        except Exception as e:
            print(f"[ModelAdapter] Failed to load ONNX adapter ({e}). Falling back to Mock.")
    return MockModelAdapter()

