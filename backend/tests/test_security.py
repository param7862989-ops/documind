from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.main import app
from app.config import settings, Settings
from app.services.ingestion import ingestion_pipeline

client = TestClient(app)


def get_token(email: str, password: str = "SecurePassword123!"):
    client.post("/api/v1/auth/register", json={"email": email, "password": password, "full_name": "Security User"})
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return login_res.json()["access_token"]


import uuid


def test_password_strength_validation():
    """Verify weak or too-short passwords are rejected at registration."""
    # Too short (< 8 chars)
    res_short = client.post("/api/v1/auth/register", json={
        "email": f"weak_short_{uuid.uuid4().hex[:6]}@documind.ai",
        "password": "short",
        "full_name": "Short Pass"
    })
    assert res_short.status_code == 422

    # All numbers (lacks letters)
    res_numeric = client.post("/api/v1/auth/register", json={
        "email": f"weak_num_{uuid.uuid4().hex[:6]}@documind.ai",
        "password": "1234567890",
        "full_name": "Num Pass"
    })
    assert res_numeric.status_code == 422

    # All letters (lacks numbers or special chars)
    res_alpha = client.post("/api/v1/auth/register", json={
        "email": f"weak_alpha_{uuid.uuid4().hex[:6]}@documind.ai",
        "password": "onlylettershere",
        "full_name": "Alpha Pass"
    })
    assert res_alpha.status_code == 422

    # Strong password passes
    res_valid = client.post("/api/v1/auth/register", json={
        "email": f"strong_pass_{uuid.uuid4().hex[:6]}@documind.ai",
        "password": "ValidPassword123!",
        "full_name": "Valid Pass"
    })
    assert res_valid.status_code == 201


def test_login_invalid_credentials():
    """Verify invalid password returns 401 Unauthorized without leaking technical internals."""
    token = get_token("login_test_user@documind.ai", "CorrectPassword123!")
    
    bad_login = client.post("/api/v1/auth/login", json={
        "email": "login_test_user@documind.ai",
        "password": "WrongPassword999!"
    })
    assert bad_login.status_code == 401
    assert "Invalid email or password" in bad_login.json()["detail"]


def test_token_malformed_and_missing():
    """Verify missing, forged, or malformed JWT tokens are rejected with 401."""
    # Missing token
    res_missing = client.get("/api/v1/auth/me")
    assert res_missing.status_code == 401

    # Malformed / forged token
    res_malformed = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer forged.invalid.token"})
    assert res_malformed.status_code == 401


def test_token_expiration():
    """Verify expired JWT tokens are cleanly rejected with 401."""
    expired_payload = {
        "sub": "some_user_id",
        "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        "iat": datetime.now(timezone.utc) - timedelta(hours=2)
    }
    expired_jwt = jwt.encode(expired_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_jwt}"})
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


def test_cross_user_document_isolation():
    """Verify User A cannot read, chunk-view, retry, or delete User B's documents."""
    token_a = get_token("user_a_sec@documind.ai")
    token_b = get_token("user_b_sec@documind.ai")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A uploads a document
    file_content = b"Confidential User A Executive Strategy Document."
    upload_res = client.post(
        "/api/v1/documents/upload",
        headers=headers_a,
        files={"file": ("user_a_doc.txt", file_content, "text/plain")}
    )
    assert upload_res.status_code == 202
    doc_a_id = upload_res.json()["id"]
    ingestion_pipeline.process_document(doc_a_id)

    # User B attempts to read User A's document -> 404
    res_read = client.get(f"/api/v1/documents/{doc_a_id}", headers=headers_b)
    assert res_read.status_code == 404

    # User B attempts to get User A's document chunks -> 404
    res_chunks = client.get(f"/api/v1/documents/{doc_a_id}/chunks", headers=headers_b)
    assert res_chunks.status_code == 404

    # User B attempts to get User A's document status -> 404
    res_status = client.get(f"/api/v1/documents/{doc_a_id}/status", headers=headers_b)
    assert res_status.status_code == 404

    # User B attempts to retry User A's document -> 404
    res_retry = client.post(f"/api/v1/documents/{doc_a_id}/retry", headers=headers_b)
    assert res_retry.status_code == 404

    # User B attempts to delete User A's document -> 404
    res_delete = client.delete(f"/api/v1/documents/{doc_a_id}", headers=headers_b)
    assert res_delete.status_code == 404


def test_cross_user_conversation_isolation():
    """Verify User B cannot access or delete User A's conversations."""
    token_a = get_token("user_a_conv@documind.ai")
    token_b = get_token("user_b_conv@documind.ai")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates a chat turn
    chat_res = client.post("/api/v1/chat", headers=headers_a, json={
        "content": "Hello confidential AI session"
    })
    assert chat_res.status_code == 200
    conv_id = chat_res.json()["conversation_id"]

    # User B attempts to read User A's conversation -> 404
    res_read = client.get(f"/api/v1/chat/conversations/{conv_id}", headers=headers_b)
    assert res_read.status_code == 404

    # User B attempts to delete User A's conversation -> 404
    res_delete = client.delete(f"/api/v1/chat/conversations/{conv_id}", headers=headers_b)
    assert res_delete.status_code == 404


def test_cross_user_document_query_and_comparison_authorization():
    """Verify passing another user's document ID in chat or comparison returns 403 Forbidden."""
    token_a = get_token("owner_user@documind.ai")
    token_b = get_token("intruder_user@documind.ai")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A uploads a document
    doc_res = client.post(
        "/api/v1/documents/upload",
        headers=headers_a,
        files={"file": ("proprietary_plan.txt", b"Top Secret Financial Model Data", "text/plain")}
    )
    doc_a_id = doc_res.json()["id"]
    ingestion_pipeline.process_document(doc_a_id)

    # User B tries to query User A's document in chat -> 403 Forbidden
    res_chat = client.post("/api/v1/chat", headers=headers_b, json={
        "content": "Tell me the secret financial data",
        "document_ids": [doc_a_id]
    })
    assert res_chat.status_code == 403

    # User B uploads own document and tries comparison with User A's document -> 403 Forbidden
    doc_b_res = client.post(
        "/api/v1/documents/upload",
        headers=headers_b,
        files={"file": ("user_b_plan.txt", b"User B Public Plan", "text/plain")}
    )
    doc_b_id = doc_b_res.json()["id"]

    res_compare = client.post("/api/v1/chat/compare", headers=headers_b, json={
        "document_ids": [doc_b_id, doc_a_id],
        "query": "Compare these two"
    })
    assert res_compare.status_code == 403


def test_path_traversal_sanitization():
    """Verify path traversal filenames (e.g. ../../etc/passwd.txt) are sanitized safely."""
    token = get_token("traversal_user@documind.ai")
    headers = {"Authorization": f"Bearer {token}"}

    upload_res = client.post(
        "/api/v1/documents/upload",
        headers=headers,
        files={"file": ("../../../../etc/passwd.txt", b"Safe Plaintext Content Here", "text/plain")}
    )
    assert upload_res.status_code == 202
    saved_doc = upload_res.json()
    assert ".." not in saved_doc["original_filename"]
    assert saved_doc["original_filename"] == "passwd.txt"


def test_security_headers_present():
    """Verify required HTTP security headers are attached to API responses."""
    res = client.get("/health")
    assert res.status_code == 200
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("X-XSS-Protection") == "1; mode=block"
    assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


def test_rate_limiting_enforcement():
    """Verify rate limiter triggers 429 Too Many Requests when threshold exceeded."""
    # Send rapid login requests with x-test-rate-limit header
    hit_429 = False
    for i in range(25):
        res = client.post(
            "/api/v1/auth/login",
            json={"email": "ratelimit_user@documind.ai", "password": "WrongPassword123!"},
            headers={"x-test-rate-limit": "true", "x-forwarded-for": "198.51.100.42"}
        )
        if res.status_code == 429:
            hit_429 = True
            assert "Retry-After" in res.headers
            assert "Too many requests" in res.json()["detail"]
            break
    assert hit_429 is True


def test_production_secret_key_validation():
    """Verify weak secret keys raise ValueError in production mode."""
    with pytest.raises(ValueError, match="CRITICAL SECURITY"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="documind_default_super_secret_jwt_key_change_in_production_987654321",
            OPENAI_API_KEY="sk-fake-openai-key-for-test"
        )
