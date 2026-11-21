from datetime import datetime
from sqlalchemy.orm import Session
from app.models.entities import AuditEvent, Screening, EyeImage, AIResult, QualityResult

class AuditService:
    @staticmethod
    def log_event(
        db: Session,
        actor_id: str,
        role: str,
        site_id: str,
        action: str,
        object_type: str,
        object_id: str,
        metadata: dict = None
    ) -> AuditEvent:
        """
        FR-10: Immutable audit trail logging with strict non-PII compliance.
        """
        event = AuditEvent(
            actor_id=actor_id,
            role=role,
            site_id=site_id,
            action=action,
            object_type=object_type,
            object_id=object_id,
            metadata_json=metadata or {},
            timestamp=datetime.utcnow()
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    @staticmethod
    def get_lineage_trace(db: Session, screening_id: str) -> dict:
        """
        PRD §10 / BACKEND_REQUIREMENTS §6:
        Trace-back lineage: Screening -> Eye Images -> SHA-256 Checksums -> Model Versions -> Preprocessing -> Reviews.
        """
        screening = db.query(Screening).filter(Screening.id == screening_id).first()
        if not screening:
            return {"error": "Screening not found"}

        lineage = {
            "screening_id": screening.id,
            "patient_study_id": screening.patient.study_id if screening.patient else None,
            "site_id": screening.site_id,
            "operator_id": screening.operator_id,
            "status": screening.status,
            "created_at": screening.created_at.isoformat(),
            "eyes": []
        }

        for img in screening.images:
            eye_info = {
                "eye_side": img.eye_side,
                "image_id": img.id,
                "sha256_checksum": img.file_hash,
                "recapture_count": img.recapture_count,
                "quality": None,
                "ai_prediction": None
            }

            if img.quality_result:
                eye_info["quality"] = {
                    "score": img.quality_result.score,
                    "gradable": img.quality_result.gradable,
                    "defects": img.quality_result.defects,
                    "quality_model_version": img.quality_result.model_version
                }

            if img.ai_result:
                eye_info["ai_prediction"] = {
                    "predicted_class": img.ai_result.predicted_class,
                    "referral_state": img.ai_result.referral_state,
                    "referable_prob": img.ai_result.referable_prob,
                    "confidence": img.ai_result.confidence,
                    "model_version": img.ai_result.model_version,
                    "preprocessing_version": img.ai_result.preprocessing_version,
                    "calibration_version": img.ai_result.calibration_version,
                    "heatmap_url": img.ai_result.heatmap_url
                }

            lineage["eyes"].append(eye_info)

        # Reviews lineage
        lineage["clinician_reviews"] = [
            {
                "clinician_id": rev.clinician_id,
                "decision": rev.decision,
                "override_referral_state": rev.override_referral_state,
                "notes": rev.notes,
                "reviewed_at": rev.created_at.isoformat()
            }
            for rev in screening.reviews
        ]

        return lineage

audit_service = AuditService()

