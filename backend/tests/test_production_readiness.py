import os
import io
import uuid
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.core.database import Base, engine
from app.services.ai_usage import AIUsageService
from app.services.storage import S3StorageService

client = TestClient(app)


def test_top_level_health_liveness():
    """Verify top-level /health endpoint returns 200 and healthy status."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_api_v1_health_liveness():
    """Verify /api/v1/health returns 200."""
    res = client.get(f"{settings.API_V1_STR}/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"


def test_readiness_probe_database_connection():
    """Verify readiness probes test database connectivity without leaking credentials."""
    res = client.get("/health/ready")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"
    # Ensure no credentials or connection strings are exposed in response
    assert "password" not in str(data).lower()
    assert "postgres" not in str(data).lower()

    res_api = client.get(f"{settings.API_V1_STR}/health/ready")
    assert res_api.status_code == 200
    api_data = res_api.json()
    assert api_data["status"] == "ready"
    assert api_data["database"] == "connected"


def test_request_id_tracing_middleware():
    """Verify incoming requests receive X-Request-ID and propagate client-provided X-Request-ID."""
    # Auto-generated request ID
    res1 = client.get("/health")
    assert "x-request-id" in res1.headers
    assert len(res1.headers["x-request-id"]) > 10

    # Custom request ID propagation
    custom_id = "trace-uuid-12345-abcdef"
    res2 = client.get("/health", headers={"X-Request-ID": custom_id})
    assert res2.headers.get("x-request-id") == custom_id


def test_security_headers_present():
    """Verify security headers are applied to all HTTP responses."""
    res = client.get("/")
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("x-frame-options") == "DENY"
    assert res.headers.get("x-xss-protection") == "1; mode=block"


def test_ai_usage_service_metrics_and_quota():
    """Verify AI usage tracking, metric summaries, and quota enforcement."""
    tracker = AIUsageService()
    user_id = "test_user_quota_1"

    # Record operations
    tracker.record_usage(
        user_id=user_id,
        operation="chat_completion",
        model="gpt-4o-mini",
        token_count=120,
        latency_ms=85.5,
    )
    tracker.record_usage(
        user_id=user_id,
        operation="embedding_batch",
        model="text-embedding-3-small",
        token_count=60,
        latency_ms=45.0,
    )

    metrics = tracker.get_user_metrics(user_id)
    assert metrics["requests_last_24h"] == 2
    assert metrics["tokens_last_24h"] == 180
    assert metrics["avg_latency_ms"] > 0

    sys_metrics = tracker.get_system_metrics()
    assert sys_metrics["total_ai_requests"] >= 2
    assert sys_metrics["total_embeddings"] >= 1

    # Test quota enforcement
    tracker.check_user_quota(user_id=user_id, max_daily_operations=5)  # Should pass

    # Simulate hitting quota
    for _ in range(4):
        tracker.record_usage(
            user_id=user_id,
            operation="chat_completion",
            model="gpt-4o-mini",
            token_count=50,
            latency_ms=20.0
        )

    with pytest.raises(Exception) as excinfo:
        tracker.check_user_quota(user_id=user_id, max_daily_operations=5)
    assert "429" in str(excinfo.value) or "quota" in str(excinfo.value).lower()


from app.services.storage import S3StorageService, LocalStorageService, get_storage_service


def test_storage_service_provider_selection():
    """Verify get_storage_service resolves correctly for s3, r2, cloudflare, and local providers."""
    # Test s3 provider selection
    with patch.object(settings, "STORAGE_PROVIDER", "s3"), patch.object(settings, "S3_ACCESS_KEY", "key"):
        service = get_storage_service()
        assert isinstance(service, S3StorageService)

    # Test r2 provider selection
    with patch.object(settings, "STORAGE_PROVIDER", "r2"), patch.object(settings, "S3_ACCESS_KEY", "key"):
        service = get_storage_service()
        assert isinstance(service, S3StorageService)

    # Test cloudflare provider selection
    with patch.object(settings, "STORAGE_PROVIDER", "cloudflare"), patch.object(settings, "S3_ACCESS_KEY", "key"):
        service = get_storage_service()
        assert isinstance(service, S3StorageService)

    # Test fallback to LocalStorageService when provider is local or access key is missing
    with patch.object(settings, "STORAGE_PROVIDER", "local"), patch.object(settings, "S3_ACCESS_KEY", ""):
        service = get_storage_service()
        assert isinstance(service, LocalStorageService)


def test_s3_storage_service_r2_endpoint_and_addressing_config():
    """Verify S3StorageService applies path addressing for custom endpoints and auto addressing otherwise."""
    with patch("boto3.session.Session") as mock_session:
        mock_client = MagicMock()
        mock_session.return_value.client.return_value = mock_client

        # Scenario 1: Cloudflare R2 custom endpoint -> path addressing & s3v4 signature
        with patch.object(settings, "STORAGE_PROVIDER", "s3"), \
             patch.object(settings, "S3_ACCESS_KEY", "mock_key"), \
             patch.object(settings, "S3_SECRET_KEY", "mock_secret"), \
             patch.object(settings, "S3_REGION", "auto"), \
             patch.object(settings, "S3_ENDPOINT_URL", "https://acc-123.r2.cloudflarestorage.com"):

            s3 = S3StorageService()
            call_kwargs = mock_session.return_value.client.call_args[1]
            assert call_kwargs["endpoint_url"] == "https://acc-123.r2.cloudflarestorage.com"
            assert call_kwargs["region_name"] == "auto"
            assert call_kwargs["config"].s3["addressing_style"] == "path"
            assert call_kwargs["config"].signature_version == "s3v4"

        # Scenario 2: Standard AWS S3 (no endpoint_url) -> auto addressing & s3v4 signature
        mock_session.return_value.client.reset_mock()
        with patch.object(settings, "STORAGE_PROVIDER", "s3"), \
             patch.object(settings, "S3_ACCESS_KEY", "mock_key"), \
             patch.object(settings, "S3_SECRET_KEY", "mock_secret"), \
             patch.object(settings, "S3_REGION", "us-east-1"), \
             patch.object(settings, "S3_ENDPOINT_URL", ""):

            s3 = S3StorageService()
            call_kwargs = mock_session.return_value.client.call_args[1]
            assert "endpoint_url" not in call_kwargs
            assert call_kwargs["region_name"] == "us-east-1"
            assert call_kwargs["config"].s3["addressing_style"] == "auto"
            assert call_kwargs["config"].signature_version == "s3v4"


def test_s3_storage_service_abstraction():
    """Verify S3StorageService operations (save, get, delete) with mocked boto3 client."""
    with patch("boto3.session.Session") as mock_session:
        mock_client = MagicMock()
        mock_session.return_value.client.return_value = mock_client

        with patch.object(settings, "STORAGE_PROVIDER", "s3"), \
             patch.object(settings, "S3_ACCESS_KEY", "mock_key"), \
             patch.object(settings, "S3_SECRET_KEY", "mock_secret"), \
             patch.object(settings, "S3_BUCKET_NAME", "test-bucket"):

            s3 = S3StorageService()
            file_data = b"Enterprise contract document data in S3 cloud storage"
            file_obj = io.BytesIO(file_data)

            path = s3.save_file(
                file_obj=file_obj,
                filename="policy.pdf",
                user_id="user_123",
                document_id="doc_456"
            )

            assert path.startswith("s3://test-bucket/uploads/user_123/doc_456/original.pdf")
            mock_client.upload_fileobj.assert_called_once()

            # Mock download
            def fake_download(bucket, key, fileobj):
                fileobj.write(file_data)
            mock_client.download_fileobj.side_effect = fake_download

            retrieved = s3.get_file(path)
            assert retrieved == file_data

            # Test delete
            deleted = s3.delete_file(path)
            assert deleted is True
            mock_client.delete_object.assert_called_once_with(Bucket="test-bucket", Key="uploads/user_123/doc_456/original.pdf")


def test_alembic_upgrade_head_clean_execution():
    """Verify Alembic migration runner compiles and executes on clean database."""
    from alembic.config import Config
    from alembic import command

    alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", "sqlite:///./test_alembic.db")

    try:
        # Run upgrade head
        command.upgrade(alembic_cfg, "head")
        assert os.path.exists("./test_alembic.db")
    finally:
        if os.path.exists("./test_alembic.db"):
            try:
                os.remove("./test_alembic.db")
            except Exception:
                pass
