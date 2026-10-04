import os
import shutil
import uuid
from abc import ABC, abstractmethod
from typing import BinaryIO, Optional
from app.config import settings


class BaseStorageService(ABC):
    @abstractmethod
    def save_file(
        self,
        file_obj: BinaryIO,
        filename: str,
        content_type: str = "application/octet-stream",
        user_id: Optional[str] = None,
        document_id: Optional[str] = None,
    ) -> str:
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

    def _validate_path_containment(self, path: str):
        abs_base = os.path.abspath(self.base_dir)
        abs_target = os.path.abspath(path)
        if not (abs_target == abs_base or abs_target.startswith(abs_base + os.sep)):
            raise PermissionError(f"Security: Access to path '{path}' outside base directory is forbidden.")

    def save_file(
        self,
        file_obj: BinaryIO,
        filename: str,
        content_type: str = "application/octet-stream",
        user_id: Optional[str] = None,
        document_id: Optional[str] = None,
    ) -> str:
        # Sanitize filename to prevent directory traversal
        clean_filename = os.path.basename(filename).strip()
        ext = os.path.splitext(clean_filename)[1].lower()
        if user_id and document_id:
            # Strip invalid chars from IDs
            clean_user_id = os.path.basename(user_id)
            clean_doc_id = os.path.basename(document_id)
            target_dir = os.path.join(self.base_dir, clean_user_id, clean_doc_id)
            target_filename = f"original{ext}"
        else:
            target_dir = self.base_dir
            target_filename = f"{uuid.uuid4().hex}_{clean_filename}"

        self._validate_path_containment(target_dir)
        os.makedirs(target_dir, exist_ok=True)
        target_path = os.path.join(target_dir, target_filename)
        self._validate_path_containment(target_path)

        file_obj.seek(0)
        with open(target_path, "wb") as f:
            shutil.copyfileobj(file_obj, f)

        return target_path

    def get_file(self, storage_path: str) -> bytes:
        self._validate_path_containment(storage_path)
        if not os.path.exists(storage_path):
            raise FileNotFoundError(f"File not found at {storage_path}")
        with open(storage_path, "rb") as f:
            return f.read()

    def delete_file(self, storage_path: str) -> bool:
        self._validate_path_containment(storage_path)
        if os.path.exists(storage_path):
            try:
                os.remove(storage_path)
                # Clean up parent directory if empty
                parent_dir = os.path.dirname(storage_path)
                if os.path.exists(parent_dir) and not os.listdir(parent_dir):
                    os.rmdir(parent_dir)
                return True
            except Exception:
                return False
        return False


class S3StorageService(BaseStorageService):
    def __init__(self):
        import boto3
        from botocore.config import Config

        session = boto3.session.Session()
        addressing_style = "path" if settings.S3_ENDPOINT_URL else "auto"
        region = settings.S3_REGION or "auto"
        client_kwargs = {
            "service_name": "s3",
            "region_name": region,
            "aws_access_key_id": settings.S3_ACCESS_KEY,
            "aws_secret_access_key": settings.S3_SECRET_KEY,
            "config": Config(s3={"addressing_style": addressing_style}, signature_version="s3v4"),
        }
        if settings.S3_ENDPOINT_URL:
            client_kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL

        self.s3_client = session.client(**client_kwargs)
        self.bucket = settings.S3_BUCKET_NAME

    def save_file(
        self,
        file_obj: BinaryIO,
        filename: str,
        content_type: str = "application/octet-stream",
        user_id: Optional[str] = None,
        document_id: Optional[str] = None,
    ) -> str:
        ext = os.path.splitext(filename)[1].lower()
        if user_id and document_id:
            key = f"uploads/{user_id}/{document_id}/original{ext}"
        else:
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


class SupabaseStorageService(BaseStorageService):
    def __init__(self):
        import httpx
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError(
                "SupabaseStorageService requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be configured."
            )
        self.supabase_url = settings.SUPABASE_URL.rstrip("/")
        self.service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY
        self.bucket = (settings.SUPABASE_STORAGE_BUCKET or "documind-documents").strip()
        self.headers = {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
        }
        self.timeout = httpx.Timeout(30.0, connect=10.0)

    def _parse_and_validate_uri(self, storage_path: str) -> str:
        """
        Parses and strictly validates a Supabase storage URI.
        Expected format: supabase://<bucket>/<object_key>
        Validates:
        - Scheme must be supabase://
        - Bucket matches configured bucket
        - Key contains no path traversal (..) or invalid segments
        """
        if not storage_path.startswith("supabase://"):
            raise ValueError(f"Invalid Supabase storage URI scheme: '{storage_path}'. Expected 'supabase://'")

        path_without_scheme = storage_path[len("supabase://"):]
        if "/" not in path_without_scheme:
            raise ValueError(f"Malformed Supabase storage URI: '{storage_path}'. Missing key.")

        bucket, key = path_without_scheme.split("/", 1)
        if bucket != self.bucket:
            raise ValueError(
                f"Security: Storage bucket mismatch. URI bucket '{bucket}' does not match configured '{self.bucket}'."
            )

        key = key.strip()
        if not key or ".." in key or key.startswith("/"):
            raise ValueError(f"Security: Invalid or unsafe object key in URI: '{storage_path}'")

        return key

    def save_file(
        self,
        file_obj: BinaryIO,
        filename: str,
        content_type: str = "application/octet-stream",
        user_id: Optional[str] = None,
        document_id: Optional[str] = None,
    ) -> str:
        import httpx
        import urllib.parse

        # Sanitize filename and construct key
        clean_filename = os.path.basename(filename).strip()
        ext = os.path.splitext(clean_filename)[1].lower()
        if user_id and document_id:
            clean_user_id = os.path.basename(user_id).strip()
            clean_doc_id = os.path.basename(document_id).strip()
            key = f"uploads/{clean_user_id}/{clean_doc_id}/original{ext}"
        else:
            key = f"uploads/{uuid.uuid4().hex}/{clean_filename}"

        # URL encode path segments safely
        encoded_key = "/".join(urllib.parse.quote(seg, safe="") for seg in key.split("/"))
        encoded_bucket = urllib.parse.quote(self.bucket, safe="")

        file_obj.seek(0)
        file_bytes = file_obj.read()

        url = f"{self.supabase_url}/storage/v1/object/{encoded_bucket}/{encoded_key}"
        upload_headers = {
            **self.headers,
            "Content-Type": content_type or "application/octet-stream",
            "x-upsert": "true",
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, headers=upload_headers, content=file_bytes)
                if resp.status_code not in (200, 201):
                    try:
                        error_detail = resp.json()
                    except ValueError:
                        error_detail = resp.text[:500]

                    raise RuntimeError(
                        f"Supabase storage upload failed with status "
                        f"{resp.status_code}: {error_detail}"
                    )

        except httpx.TimeoutException as e:
            raise TimeoutError(f"Supabase storage upload timed out: {e}") from e
        except Exception as e:
            if not isinstance(e, (RuntimeError, TimeoutError)):
                raise RuntimeError(f"Supabase storage upload error: {type(e).__name__}") from e
            raise

        return f"supabase://{self.bucket}/{key}"

    def get_file(self, storage_path: str) -> bytes:
        import httpx
        import urllib.parse

        key = self._parse_and_validate_uri(storage_path)
        encoded_key = "/".join(urllib.parse.quote(seg, safe="") for seg in key.split("/"))
        encoded_bucket = urllib.parse.quote(self.bucket, safe="")

        url = f"{self.supabase_url}/storage/v1/object/authenticated/{encoded_bucket}/{encoded_key}"

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.get(url, headers=self.headers)
                if resp.status_code == 404:
                    raise FileNotFoundError(f"File not found in Supabase storage: {storage_path}")
                if resp.status_code != 200:
                    raise RuntimeError(
                        f"Supabase storage download failed with status {resp.status_code}."
                    )
                return resp.content
        except httpx.TimeoutException as e:
            raise TimeoutError(f"Supabase storage download timed out: {e}") from e
        except Exception as e:
            if not isinstance(e, (FileNotFoundError, RuntimeError, TimeoutError)):
                raise RuntimeError(f"Supabase storage download error: {type(e).__name__}") from e
            raise

    def delete_file(self, storage_path: str) -> bool:
        import httpx
        import urllib.parse

        try:
            key = self._parse_and_validate_uri(storage_path)
        except Exception:
            return False

        encoded_key = "/".join(urllib.parse.quote(seg, safe="") for seg in key.split("/"))
        encoded_bucket = urllib.parse.quote(self.bucket, safe="")

        url = f"{self.supabase_url}/storage/v1/object/{encoded_bucket}/{encoded_key}"

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.delete(url, headers=self.headers)
                return resp.status_code in (200, 204, 404)
        except Exception:
            return False


def get_storage_service() -> BaseStorageService:
    provider = settings.STORAGE_PROVIDER.lower()
    if provider in ("supabase", "supabase_storage") and settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        return SupabaseStorageService()
    if provider in ("s3", "r2", "cloudflare") and settings.S3_ACCESS_KEY:
        return S3StorageService()
    return LocalStorageService()
