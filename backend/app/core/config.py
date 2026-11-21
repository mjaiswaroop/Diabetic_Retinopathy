from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "XAI DR Screening Service"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "production-secret-dr-screening-rural-health-key-xai"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours
    
    # Model adapter config: "onnx" (Real AI Inference) or "mock"
    MODEL_ADAPTER: str = "onnx"
    
    # Thresholds (PRD §4 / §10)
    REFERABLE_THRESHOLD: float = 0.50
    UNCERTAINTY_THRESHOLD: float = 0.65
    QUALITY_CUTOFF: float = 0.60
    
    # Database: PostgreSQL (with fallback to SQLite for local standalone testing)
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/dr_screening"
    
    # MinIO / S3 Object Storage (PRD §5 & §12)
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False
    MINIO_BUCKET_IMAGES: str = "fundus-images"
    MINIO_BUCKET_XAI: str = "xai-overlays"
    SIGNED_URL_EXPIRY_SECONDS: int = 1800  # 30-minute short-lived signed URLs

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()
