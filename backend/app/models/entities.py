import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from app.db.session import Base

def gen_uuid():
    return str(uuid.uuid4())

class Patient(Base):
    __tablename__ = "patients"
    
    id = Column(String, primary_key=True, default=gen_uuid)
    patient_id = Column(String, unique=True, index=True)
    study_id = Column(String, unique=True, index=True)
    age = Column(Integer, nullable=False)
    sex = Column(String, nullable=False)  # male, female, other
    diabetes_type = Column(String, nullable=False)
    diabetes_duration_years = Column(Integer, nullable=False)
    consent_status = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    screenings = relationship("Screening", back_populates="patient")

class Screening(Base):
    __tablename__ = "screenings"
    
    id = Column(String, primary_key=True, default=gen_uuid)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    site_id = Column(String, nullable=False, index=True)
    operator_id = Column(String, nullable=False)
    status = Column(String, default="created") # created, images_pending, ready_for_analysis, analyzed, needs_review, reviewed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    patient = relationship("Patient", back_populates="screenings")
    images = relationship("EyeImage", back_populates="screening")
    reviews = relationship("ClinicianReview", back_populates="screening")

class EyeImage(Base):
    __tablename__ = "eye_images"
    
    id = Column(String, primary_key=True, default=gen_uuid)
    screening_id = Column(String, ForeignKey("screenings.id"), nullable=False)
    eye_side = Column(String, nullable=False) # L or R
    file_path = Column(String, nullable=False)
    file_hash = Column(String, nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    recapture_count = Column(Integer, default=0)
    unable_to_capture = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    screening = relationship("Screening", back_populates="images")
    quality_result = relationship("QualityResult", back_populates="image", uselist=False)
    ai_result = relationship("AIResult", back_populates="image", uselist=False)

class QualityResult(Base):
    __tablename__ = "quality_results"
    
    id = Column(String, primary_key=True, default=gen_uuid)
    image_id = Column(String, ForeignKey("eye_images.id"), nullable=False)
    score = Column(Float, nullable=False)
    gradable = Column(Boolean, nullable=False)
    defects = Column(JSON, default=list) # blur, underexposed, etc.
    recapture_instruction = Column(String, nullable=True)
    model_version = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    image = relationship("EyeImage", back_populates="quality_result")

class AIResult(Base):
    __tablename__ = "ai_results"
    
    id = Column(String, primary_key=True, default=gen_uuid)
    image_id = Column(String, ForeignKey("eye_images.id"), nullable=False)
    predicted_class = Column(String, nullable=False)
    referral_state = Column(String, nullable=False) # referable, non_referable, uncertain
    referable_prob = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    class_probabilities = Column(JSON, nullable=False)
    uncertainty_reason = Column(String, nullable=True)
    heatmap_url = Column(String, nullable=True)
    model_version = Column(String, nullable=False)
    preprocessing_version = Column(String, nullable=False)
    calibration_version = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    image = relationship("EyeImage", back_populates="ai_result")

class ClinicianReview(Base):
    __tablename__ = "clinician_reviews"
    
    id = Column(String, primary_key=True, default=gen_uuid)
    screening_id = Column(String, ForeignKey("screenings.id"), nullable=False)
    clinician_id = Column(String, nullable=False)
    decision = Column(String, nullable=False) # confirm, disagree, needs_further_review
    override_referral_state = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    screening = relationship("Screening", back_populates="reviews")

class AuditEvent(Base):
    __tablename__ = "audit_events"
    
    id = Column(String, primary_key=True, default=gen_uuid)
    actor_id = Column(String, nullable=False)
    role = Column(String, nullable=False)
    site_id = Column(String, nullable=False)
    action = Column(String, nullable=False)
    object_type = Column(String, nullable=False)
    object_id = Column(String, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class SyncLog(Base):
    __tablename__ = "sync_log"
    
    id = Column(String, primary_key=True, default=gen_uuid)
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    screening_id = Column(String, nullable=False)
    status = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

