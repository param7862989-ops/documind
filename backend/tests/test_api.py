import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "DocuMind" in data["service"]


def test_auth_and_document_workflow():
    # 1. Register User
    reg_payload = {
        "email": "tester@documind.ai",
        "password": "SecretPassword123!",
        "full_name": "Integration Tester"
    }
    reg_resp = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_resp.status_code in [201, 400]  # 400 if already created in previous run

    # 2. Login
    login_resp = client.post("/api/v1/auth/login", json={
        "email": "tester@documind.ai",
        "password": "SecretPassword123!"
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Fetch Me
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "tester@documind.ai"

    # 4. Upload Sample Document
    file_content = b"Non-Disclosure Agreement\nSection 4: Confidentiality Term\nThe receiving party shall maintain strict confidentiality for a period of 5 years."
    files = {"file": ("nda_agreement.txt", file_content, "text/plain")}
    upload_resp = client.post("/api/v1/documents/upload", headers=headers, files=files)
    assert upload_resp.status_code == 202
    doc_id = upload_resp.json()["id"]

    # 5. List Documents
    docs_resp = client.get("/api/v1/documents", headers=headers)
    assert docs_resp.status_code == 200
    assert any(d["id"] == doc_id for d in docs_resp.json())

    # 6. Chat with RAG
    chat_resp = client.post("/api/v1/chat", headers=headers, json={
        "content": "What is the confidentiality term in years?",
        "document_ids": [doc_id]
    })
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    assert "content" in chat_data
    assert len(chat_data["content"]) > 0
