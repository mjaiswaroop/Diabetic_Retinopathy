import os
import uuid
import hashlib
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import (
    Patient, Screening, EyeImage, QualityResult, AIResult, ClinicianReview, AuditEvent, SyncLog
)
from app.schemas.dto import (
    PatientCreate, PatientOut, ScreeningCreate, QualityResponse,
    PredictionResponse, ReviewCreate, SyncBatchRequest, SyncBatchResponse, Token, LoginRequest
)
from app.core.security import create_access_token, require_role, get_current_user_token
from app.services.referral_engine import calculate_referral_state
from app.services.audit_service import audit_service
from app.ml.base import get_model_adapter

api_router = APIRouter()
model_adapter = get_model_adapter()

# 1. Auth Endpoint
@api_router.post("/auth/login", response_model=Token)
def login(req: LoginRequest):
    token = create_access_token(subject=req.username, role=req.role)
    return Token(
        access_token=token,
        token_type="bearer",
        role=req.role,
        user_id=f"usr-{req.username}"
    )

# 2. Register Patient (FR-01: strictly approved demographic fields only)
@api_router.post("/patients", response_model=PatientOut)
def register_patient(
    patient_in: PatientCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role(["operator", "admin"]))
):
    if not patient_in.consent_status:
        raise HTTPException(status_code=400, detail="Informed consent is strictly required")
        
    study_num = db.query(Patient).count() + 1
    study_id = f"STU-MND-{study_num:03d}"
    patient_id = f"PAT-{study_num:05d}"
    
    patient = Patient(
        patient_id=patient_id,
        study_id=study_id,
        age=patient_in.age,
        sex=patient_in.sex,
        diabetes_type=patient_in.diabetes_type,
        diabetes_duration_years=patient_in.diabetes_duration_years,
        consent_status=patient_in.consent_status
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient

# 3. Create Screening
@api_router.post("/screenings")
def create_screening(
    scr_in: ScreeningCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role(["operator", "admin"]))
):
    scr = Screening(
        patient_id=scr_in.patient_id,
        site_id=scr_in.site_id,
        operator_id=scr_in.operator_id,
        status="images_pending"
    )
    db.add(scr)
    db.commit()
    db.refresh(scr)
    return scr

# 4. Upload Image & Pre-validation (FR-02, FR-03)
@api_router.post("/images")
async def upload_image(
    screening_id: str = Form(...),
    eye_side: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role(["operator", "admin"]))
):
    if eye_side not in ["L", "R"]:
        raise HTTPException(status_code=400, detail="eye_side must be 'L' or 'R'")
        
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds maximum 15MB limit")
        
    sha256 = hashlib.sha256(content).hexdigest()
    
    os.makedirs("./storage", exist_ok=True)
    file_path = f"./storage/{sha256}_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(content)
        
    image = EyeImage(
        screening_id=screening_id,
        eye_side=eye_side,
        file_path=file_path,
        file_hash=sha256
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return {"image_id": image.id, "eye_side": eye_side, "file_hash": sha256}

# 5. Quality Check (FR-02)
@api_router.post("/quality-check", response_model=QualityResponse)
def quality_check(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role(["operator", "admin"]))
):
    image = db.query(EyeImage).filter(EyeImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
        
    # Read bytes & assess
    with open(image.file_path, "rb") as f:
        raw_bytes = f.read()
        
    res = model_adapter.assess_quality(raw_bytes)
    
    qr = QualityResult(
        image_id=image_id,
        score=res.score,
        gradable=res.gradable,
        defects=res.defects,
        recapture_instruction=res.recapture_instruction,
        model_version=res.model_version
    )
    image.recapture_count += 1
    db.add(qr)
    db.commit()
    
    return QualityResponse(
        image_id=image_id,
        score=res.score,
        gradable=res.gradable,
        defects=res.defects,
        recapture_instruction=res.recapture_instruction,
        model_version=res.model_version
    )

# 6. Predict (Refuses 422 if ungradable as per BACKEND_REQUIREMENTS §3)
@api_router.post("/predict", response_model=PredictionResponse)
def predict(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role(["operator", "admin"]))
):
    image = db.query(EyeImage).filter(EyeImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
        
    qr = db.query(QualityResult).filter(QualityResult.image_id == image_id).order_by(QualityResult.created_at.desc()).first()
    if not qr or not qr.gradable:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="IMAGE_UNGRADABLE: Inference refused on ungradable retina image."
        )
        
    with open(image.file_path, "rb") as f:
        raw_bytes = f.read()
        
    pred = model_adapter.predict(raw_bytes)
    xai_res = model_adapter.explain(raw_bytes)
    
    referral_state, reason = calculate_referral_state(
        gradable=qr.gradable,
        quality_score=qr.score,
        referable_prob=pred.referable_prob,
        confidence=pred.confidence
    )
    
    ai_record = AIResult(
        image_id=image_id,
        predicted_class=pred.predicted_class,
        referral_state=referral_state,
        referable_prob=pred.referable_prob,
        confidence=pred.confidence,
        class_probabilities=pred.class_probabilities,
        uncertainty_reason=reason,
        heatmap_url=xai_res.heatmap_url,
        model_version=pred.model_version,
        preprocessing_version=pred.preprocessing_version,
        calibration_version=pred.calibration_version
    )
    db.add(ai_record)
    
    # Audit log event for prediction inference
    screening = db.query(Screening).filter(Screening.id == image.screening_id).first()
    audit = AuditEvent(
        actor_id=current_user["user_id"],
        role=current_user.get("role", "operator"),
        site_id=screening.site_id if screening else "unknown",
        action="RUN_AI_PREDICTION",
        object_type="EyeImage",
        object_id=image_id,
        metadata_json={
            "screening_id": image.screening_id,
            "referral_state": referral_state,
            "referable_prob": pred.referable_prob,
            "model_version": pred.model_version
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(ai_record)
    
    return PredictionResponse(
        screening_id=image.screening_id,
        image_id=image_id,
        eye_side=image.eye_side,
        predicted_class=pred.predicted_class,
        referral_state=referral_state,
        referable_prob=pred.referable_prob,
        confidence=pred.confidence,
        class_probabilities=pred.class_probabilities,
        uncertainty_reason=reason,
        heatmap_url=xai_res.heatmap_url,
        model_version=pred.model_version,
        preprocessing_version=pred.preprocessing_version,
        calibration_version=pred.calibration_version,
        timestamp=ai_record.created_at.isoformat()
    )

# 7. Clinician Review (FR-08)
@api_router.post("/doctor-review")
def doctor_review(
    review_in: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role(["clinician", "admin"]))
):
    review = ClinicianReview(
        screening_id=review_in.screening_id,
        clinician_id=current_user["user_id"],
        decision=review_in.decision,
        override_referral_state=review_in.override_referral_state,
        notes=review_in.notes
    )
    db.add(review)
    
    # Update screening status to reviewed
    screening = db.query(Screening).filter(Screening.id == review_in.screening_id).first()
    if screening:
        screening.status = "reviewed"
        
    # Write audit event
    audit = AuditEvent(
        actor_id=current_user["user_id"],
        role="clinician",
        site_id=screening.site_id if screening else "unknown",
        action="SUBMIT_CLINICIAN_REVIEW",
        object_type="Screening",
        object_id=review_in.screening_id,
        metadata_json={"decision": review_in.decision, "override": review_in.override_referral_state}
    )
    db.add(audit)
    db.commit()
    return {"status": "Review recorded successfully"}

# 8. Offline Background Sync (FR-09)
@api_router.post("/sync", response_model=SyncBatchResponse)
def batch_sync(
    batch: SyncBatchRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role(["operator", "admin"]))
):
    processed = 0
    duplicates = 0
    errors = []
    
    for item in batch.records:
        existing = db.query(SyncLog).filter(SyncLog.idempotency_key == item.idempotency_key).first()
        if existing:
            duplicates += 1
            continue
            
        try:
            # Register patient if needed
            patient = Patient(
                patient_id=f"PAT-{item.idempotency_key[:8]}",
                study_id=f"STU-{item.idempotency_key[:8]}",
                age=item.patient.age,
                sex=item.patient.sex,
                diabetes_type=item.patient.diabetes_type,
                diabetes_duration_years=item.patient.diabetes_duration_years,
                consent_status=item.patient.consent_status
            )
            db.add(patient)
            db.flush()
            
            screening = Screening(
                id=item.screening_id,
                patient_id=patient.id,
                site_id=item.site_id,
                operator_id=item.operator_id,
                status="analyzed"
            )
            db.add(screening)
            
            sync_entry = SyncLog(
                idempotency_key=item.idempotency_key,
                screening_id=item.screening_id,
                status="synced"
            )
            db.add(sync_entry)
            db.commit()
            processed += 1
        except Exception as e:
            db.rollback()
            errors.append({"idempotency_key": item.idempotency_key, "error": str(e)})
            
    return SyncBatchResponse(processed=processed, duplicates=duplicates, errors=errors)

# 10. Audit Lineage Endpoint (PRD §10 & BACKEND_REQUIREMENTS §6)
@api_router.get("/screenings/{screening_id}/lineage")
def get_screening_lineage(
    screening_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role(["clinician", "admin", "researcher"]))
):
    """
    Returns full trace-back: Image SHA256 -> Quality model -> ResNet50 model -> CLAHE version -> Doctor reviews.
    """
    lineage = audit_service.get_lineage_trace(db, screening_id)
    if "error" in lineage:
        raise HTTPException(status_code=404, detail=lineage["error"])
    return lineage

# 12. Query Audit Log (FR-10 / Admin)
@api_router.get("/audit")
def get_audit_logs(
    action: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role(["admin", "researcher"]))
):
    query = db.query(AuditEvent)
    if action and action != "all":
        query = query.filter(AuditEvent.action == action)
    logs = query.order_by(AuditEvent.timestamp.desc()).limit(limit).all()
    return logs

# 11. Health & System Version
@api_router.get("/health")
def health():
    return {"status": "ok", "service": "XAI DR Screening FastAPI", "models_loaded": True}

