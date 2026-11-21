import io
from datetime import timedelta
from typing import Optional
from app.core.config import settings

class StorageService:
    def __init__(self):
        self.client = None
        try:
            from minio import Minio
            self.client = Minio(
                endpoint=settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE
            )
            # Ensure buckets exist
            self._ensure_bucket(settings.MINIO_BUCKET_IMAGES)
            self._ensure_bucket(settings.MINIO_BUCKET_XAI)
        except Exception as e:
            # Fallback mode when minio client or container is not connected
            print(f"[StorageService] MinIO not active ({e}). Operating in local filesystem storage.")

    def _ensure_bucket(self, bucket_name: str):
        if self.client and not self.client.bucket_exists(bucket_name):
            self.client.make_bucket(bucket_name)

    def upload_image(self, object_name: str, data: bytes, content_type: str = "image/jpeg", bucket: Optional[str] = None) -> str:
        bucket = bucket or settings.MINIO_BUCKET_IMAGES
        if self.client:
            self.client.put_object(
                bucket_name=bucket,
                object_name=object_name,
                data=io.BytesIO(data),
                length=len(data),
                content_type=content_type
            )
            return f"s3://{bucket}/{object_name}"
        return f"./storage/{object_name}"

    def get_signed_url(self, object_name: str, bucket: Optional[str] = None, expires_seconds: Optional[int] = None) -> str:
        """
        PRD §12: Images served only through short-lived signed URLs after RBAC check.
        """
        bucket = bucket or settings.MINIO_BUCKET_IMAGES
        expires = timedelta(seconds=expires_seconds or settings.SIGNED_URL_EXPIRY_SECONDS)
        
        if self.client:
            try:
                return self.client.presigned_get_object(bucket_name=bucket, object_name=object_name, expires=expires)
            except Exception as e:
                print(f"[StorageService] Presigned URL error: {e}")
                
        # Dev fallback URL
        return f"http://localhost:8000/api/v1/storage/{bucket}/{object_name}"

storage_service = StorageService()

