import os
import shutil
import uuid
from abc import ABC, abstractmethod
from typing import BinaryIO, Optional
from app.config import settings


class BaseStorageService(ABC):
    @abstractmethod
    def save_file(self, file_obj: BinaryIO, filename: str, content_type: str = "application/octet-stream") -> str:
        """Saves file to storage and returns unique storage path or URI."""
        pass

    @abstractmethod
    def get_file(self, storage_path: str) -> bytes:
        """Retrieves raw file bytes given storage path."""
        pass

    @abstractmethod
    def delete_file(self, storage_path: str) -> bool:
        """Deletes file from storage."""
        pass


class LocalStorageService(BaseStorageService):
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = base_dir or settings.LOCAL_STORAGE_DIR
        os.makedirs(self.base_dir, exist_ok=True)

    def save_file(self, file_obj: BinaryIO, filename: str, content_type: str = "application/octet-stream") -> str:
        ext = os.path.splitext(filename)[1]
        unique_name = f"{uuid.uuid4().hex}_{filename}"
        target_path = os.path.join(self.base_dir, unique_name)
        
        file_obj.seek(0)
        with open(target_path, "wb") as f:
            shutil.copyfileobj(file_obj, f)
        
        return target_path

    def get_file(self, storage_path: str) -> bytes:
        if not os.path.exists(storage_path):
            raise FileNotFoundError(f"File not found at {storage_path}")
        with open(storage_path, "rb") as f:
            return f.read()

    def delete_file(self, storage_path: str) -> bool:
        if os.path.exists(storage_path):
            os.remove(storage_path)
            return True
        return False


class S3StorageService(BaseStorageService):
    def __init__(self):
        import boto3
        from botocore.config import Config

        session = boto3.session.Session()
        client_kwargs = {
            "service_name": "s3",
            "region_name": settings.S3_REGION,
            "aws_access_key_id": settings.S3_ACCESS_KEY,
            "aws_secret_access_key": settings.S3_SECRET_KEY,
            "config": Config(s3={"addressing_style": "virtual"}),
        }
        if settings.S3_ENDPOINT_URL:
            client_kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL

        self.s3_client = session.client(**client_kwargs)
        self.bucket = settings.S3_BUCKET_NAME

    def save_file(self, file_obj: BinaryIO, filename: str, content_type: str = "application/octet-stream") -> str:
        key = f"uploads/{uuid.uuid4().hex}/{filename}"
        file_obj.seek(0)
        self.s3_client.upload_fileobj(
            file_obj,
            self.bucket,
            key,
            ExtraArgs={"ContentType": content_type}
        )
        return f"s3://{self.bucket}/{key}"

    def get_file(self, storage_path: str) -> bytes:
        import io
        if storage_path.startswith("s3://"):
            parts = storage_path.replace("s3://", "").split("/", 1)
            bucket, key = parts[0], parts[1]
        else:
            bucket = self.bucket
            key = storage_path

        out_buffer = io.BytesIO()
        self.s3_client.download_fileobj(bucket, key, out_buffer)
        out_buffer.seek(0)
        return out_buffer.read()

    def delete_file(self, storage_path: str) -> bool:
        if storage_path.startswith("s3://"):
            parts = storage_path.replace("s3://", "").split("/", 1)
            bucket, key = parts[0], parts[1]
        else:
            bucket = self.bucket
            key = storage_path
        self.s3_client.delete_object(Bucket=bucket, Key=key)
        return True


def get_storage_service() -> BaseStorageService:
    if settings.STORAGE_PROVIDER.lower() == "s3" and settings.S3_ACCESS_KEY:
        return S3StorageService()
    return LocalStorageService()
