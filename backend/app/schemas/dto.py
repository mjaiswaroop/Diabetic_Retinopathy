from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# Auth
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_id: str

class LoginRequest(BaseModel):
    username: str
    password: str
    role: str

# Patient (FR-01: strictly approved fields only)
class PatientCreate(BaseModel):
    age: int = Field(..., ge=1, le=120)
    sex: str = Field(..., pattern="^(male|female|other)$")
    diabetes_type: str = Field(..., pattern="^(type_1|type_2|gestational|unknown)$")
    diabetes_duration_years: int = Field(..., ge=0, le=80)
    consent_status: bool = Field(..., description="Consent status must be true")

class PatientOut(BaseModel):
    id: str
    patient_id: str
    study_id: str
    age: int
    sex: str
    diabetes_type: str
    diabetes_duration_years: int
    consent_status: bool
    created_at: datetime
    class Config:
        from_attributes = True

# Screening
class ScreeningCreate(BaseModel):
    patient_id: str
    site_id: str
    operator_id: str

# Quality Result
class QualityResponse(BaseModel):
    image_id: str
    score: float
    gradable: bool
    defects: List[str]
    recapture_instruction: Optional[str] = None
    model_version: str

# Prediction Result (with screening_id, heatmap, model_version, and timestamp on every result)
class PredictionResponse(BaseModel):
    screening_id: str
    image_id: str
    eye_side: str
    predicted_class: str
    referral_state: str # referable, non_referable, uncertain
    referable_prob: float
    confidence: float
    class_probabilities: Dict[str, float]
    uncertainty_reason: Optional[str] = None
    heatmap_url: Optional[str] = None
    model_version: str
    preprocessing_version: str
    calibration_version: str
    timestamp: str

# Clinician Review (FR-08)
class ReviewCreate(BaseModel):
    screening_id: str
    decision: str = Field(..., pattern="^(confirm|disagree|needs_further_review)$")
    override_referral_state: Optional[str] = None
    notes: Optional[str] = None

# Batch Offline Sync (FR-09)
class SyncRecordItem(BaseModel):
    idempotency_key: str
    screening_id: str
    patient: PatientCreate
    site_id: str
    operator_id: str
    created_at: str

class SyncBatchRequest(BaseModel):
    records: List[SyncRecordItem]

class SyncBatchResponse(BaseModel):
    processed: int
    duplicates: int
    errors: List[Dict[str, Any]]

