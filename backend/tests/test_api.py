import io
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
import docx

from app.main import app
from app.services.ingestion import ingestion_pipeline

client = TestClient(app)


def get_authenticated_user_headers(email: str = "user1@documind.ai", password: str = "SecurePass123!"):
    """Helper to register and/or authenticate a user and return Auth headers."""
    reg_payload = {"email": email, "password": password, "full_name": "Test User"}
    client.post("/api/v1/auth/register", json=reg_payload)
    login_resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login_resp.status_code == 200, f"Login failed for {email}: {login_resp.text}"
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_sample_docx_bytes() -> bytes:
    doc = docx.Document()
    doc.add_heading("Master Service Agreement", level=1)
    doc.add_paragraph("This agreement governs the cloud software services provided to Client.")
    doc.add_heading("Section 3: Termination Notice", level=2)
    doc.add_paragraph("Either party may terminate this agreement with 30 days written notice.")
    
    table = doc.add_table(rows=2, cols=2)
    table.cell(0, 0).text = "Deliverable"
    table.cell(0, 1).text = "Deadline"
    table.cell(1, 0).text = "Phase 1 MVP"
    table.cell(1, 1).text = "Q4 2026"

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def create_sample_pdf_bytes() -> bytes:
    # Standard minimal valid PDF 1.4 stream
    pdf_content = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n"
        b"4 0 obj\n<< /Length 55 >>\nstream\n"
        b"BT /F1 12 Tf 100 700 Td (Confidential Enterprise Roadmap) Tj ET\n"
        b"endstream\nendobj\n"
        b"xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000206 00000 n \n"
        b"trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n312\n%%EOF"
    )
    return pdf_content


def create_sample_image_bytes() -> bytes:
    img = Image.new("RGB", (200, 80), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((10, 30), "DocuMind OCR", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# =========================================================================
# 1. Health & Foundation Tests
# =========================================================================

def test_health_endpoints():
    res1 = client.get("/health")
    assert res1.status_code == 200
    assert res1.json()["status"] == "healthy"

    res2 = client.get("/api/v1/health")
    assert res2.status_code == 200
    assert res2.json()["status"] == "healthy"


# =========================================================================
# 2. Multi-Format Upload & Ingestion Tests (PDF, DOCX, TXT, Images)
# =========================================================================

def test_upload_and_process_txt_document():
    headers = get_authenticated_user_headers("txt_tester@documind.ai")
    txt_bytes = b"Security Policy\nSection 1: Data Encryption\nAll customer data at rest must be encrypted with AES-256."
    
    files = {"file": ("security_policy.txt", txt_bytes, "text/plain")}
    resp = client.post("/api/v1/documents/upload", headers=headers, files=files)
    assert resp.status_code == 202
    doc_data = resp.json()
    assert doc_data["status"] == "QUEUED"
    assert doc_data["content_hash"] is not None
    doc_id = doc_data["id"]

    # Run ingestion pipeline
    ingestion_pipeline.process_document(doc_id)

    # Check status is READY
    status_resp = client.get(f"/api/v1/documents/{doc_id}/status", headers=headers)
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "READY"
    assert status_resp.json()["chunk_count"] > 0

    # Retrieve chunks
    chunks_resp = client.get(f"/api/v1/documents/{doc_id}/chunks", headers=headers)
    assert chunks_resp.status_code == 200
    chunks = chunks_resp.json()
    assert len(chunks) > 0
    assert "AES-256" in chunks[0]["text_content"]


def test_upload_and_process_docx_document():
    headers = get_authenticated_user_headers("docx_tester@documind.ai")
    docx_bytes = create_sample_docx_bytes()

    files = {"file": ("msa_agreement.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    resp = client.post("/api/v1/documents/upload", headers=headers, files=files)
    assert resp.status_code == 202
    doc_id = resp.json()["id"]

    ingestion_pipeline.process_document(doc_id)

    status_resp = client.get(f"/api/v1/documents/{doc_id}/status", headers=headers)
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "READY"

    chunks_resp = client.get(f"/api/v1/documents/{doc_id}/chunks", headers=headers)
    assert chunks_resp.status_code == 200
    chunks = chunks_resp.json()
    assert len(chunks) > 0


def test_upload_and_process_pdf_document():
    headers = get_authenticated_user_headers("pdf_tester@documind.ai")
    pdf_bytes = create_sample_pdf_bytes()

    files = {"file": ("roadmap.pdf", pdf_bytes, "application/pdf")}
    resp = client.post("/api/v1/documents/upload", headers=headers, files=files)
    assert resp.status_code == 202
    doc_id = resp.json()["id"]

    ingestion_pipeline.process_document(doc_id)

    status_resp = client.get(f"/api/v1/documents/{doc_id}/status", headers=headers)
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "READY"


def test_upload_and_process_image_ocr():
    headers = get_authenticated_user_headers("img_tester@documind.ai")
    img_bytes = create_sample_image_bytes()

    files = {"file": ("diagram_notes.png", img_bytes, "image/png")}
    resp = client.post("/api/v1/documents/upload", headers=headers, files=files)
    assert resp.status_code == 202
    doc_id = resp.json()["id"]

    ingestion_pipeline.process_document(doc_id)

    status_resp = client.get(f"/api/v1/documents/{doc_id}/status", headers=headers)
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "READY"


# =========================================================================
# 3. File Validation & Security Reject Tests
# =========================================================================

def test_reject_unsupported_file_extension():
    headers = get_authenticated_user_headers("sec_tester@documind.ai")
    files = {"file": ("malicious_script.sh", b"echo 'hello'", "application/x-sh")}
    resp = client.post("/api/v1/documents/upload", headers=headers, files=files)
    assert resp.status_code == 400
    assert "Unsupported file format" in resp.json()["detail"]


def test_reject_fake_extension_magic_byte_mismatch():
    headers = get_authenticated_user_headers("sec_tester@documind.ai")
    # Executable DOS header disguised as a PDF
    fake_pdf = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
    files = {"file": ("fake_invoice.pdf", fake_pdf, "application/pdf")}
    resp = client.post("/api/v1/documents/upload", headers=headers, files=files)
    assert resp.status_code == 400
    assert "Invalid file content" in resp.json()["detail"]


def test_reject_empty_file():
    headers = get_authenticated_user_headers("sec_tester@documind.ai")
    files = {"file": ("empty.txt", b"", "text/plain")}
    resp = client.post("/api/v1/documents/upload", headers=headers, files=files)
    assert resp.status_code == 400
    assert "Cannot upload an empty file" in resp.json()["detail"]


# =========================================================================
# 4. Per-User Ownership & Isolation Tests
# =========================================================================

def test_document_ownership_isolation():
    headers_user_a = get_authenticated_user_headers("user_a@documind.ai", "PassA123!")
    headers_user_b = get_authenticated_user_headers("user_b@documind.ai", "PassB123!")

    # User A uploads a document
    files = {"file": ("user_a_private.txt", b"Confidential financial statement for User A.", "text/plain")}
    upload_resp = client.post("/api/v1/documents/upload", headers=headers_user_a, files=files)
    assert upload_resp.status_code == 202
    doc_id = upload_resp.json()["id"]

    ingestion_pipeline.process_document(doc_id)

    # User B attempts to GET User A's document -> 404
    get_resp = client.get(f"/api/v1/documents/{doc_id}", headers=headers_user_b)
    assert get_resp.status_code == 404

    # User B attempts to GET status -> 404
    status_resp = client.get(f"/api/v1/documents/{doc_id}/status", headers=headers_user_b)
    assert status_resp.status_code == 404

    # User B attempts to GET chunks -> 404
    chunks_resp = client.get(f"/api/v1/documents/{doc_id}/chunks", headers=headers_user_b)
    assert chunks_resp.status_code == 404

    # User B attempts to DELETE User A's document -> 404
    del_resp = client.delete(f"/api/v1/documents/{doc_id}", headers=headers_user_b)
    assert del_resp.status_code == 404

    # User B lists documents -> does not include User A's document
    list_resp = client.get("/api/v1/documents", headers=headers_user_b)
    assert list_resp.status_code == 200
    assert not any(d["id"] == doc_id for d in list_resp.json())


# =========================================================================
# 5. Idempotent Ingestion Retry & Document Deletion Tests
# =========================================================================

def test_idempotent_ingestion_retry():
    headers = get_authenticated_user_headers("retry_tester@documind.ai")
    txt_content = b"Service Level Agreement\n99.9% uptime guaranteed."
    files = {"file": ("sla.txt", txt_content, "text/plain")}
    
    upload_resp = client.post("/api/v1/documents/upload", headers=headers, files=files)
    assert upload_resp.status_code == 202
    doc_id = upload_resp.json()["id"]

    # First ingestion run
    ingestion_pipeline.process_document(doc_id)
    chunks_1 = client.get(f"/api/v1/documents/{doc_id}/chunks", headers=headers).json()
    count_1 = len(chunks_1)
    assert count_1 > 0

    # Retry ingestion run
    ingestion_pipeline.process_document(doc_id)
    chunks_2 = client.get(f"/api/v1/documents/{doc_id}/chunks", headers=headers).json()
    count_2 = len(chunks_2)

    # Chunks must not duplicate on retry
    assert count_1 == count_2


def test_document_deletion_and_cleanup():
    headers = get_authenticated_user_headers("delete_tester@documind.ai")
    files = {"file": ("to_delete.txt", b"Temporary file to delete.", "text/plain")}
    upload_resp = client.post("/api/v1/documents/upload", headers=headers, files=files)
    doc_id = upload_resp.json()["id"]

    ingestion_pipeline.process_document(doc_id)

    # Delete document
    del_resp = client.delete(f"/api/v1/documents/{doc_id}", headers=headers)
    assert del_resp.status_code == 204

    # Verify document no longer exists
    get_resp = client.get(f"/api/v1/documents/{doc_id}", headers=headers)
    assert get_resp.status_code == 404


# =========================================================================
# 6. Conversational RAG & Citations
# =========================================================================

def test_conversational_rag_query():
    headers = get_authenticated_user_headers("rag_tester@documind.ai")
    contract_text = b"Consulting Contract\nSection 8: Payment Terms\nThe client agrees to net-30 payment terms upon invoice receipt."
    files = {"file": ("contract.txt", contract_text, "text/plain")}

    upload_resp = client.post("/api/v1/documents/upload", headers=headers, files=files)
    doc_id = upload_resp.json()["id"]
    ingestion_pipeline.process_document(doc_id)

    chat_resp = client.post("/api/v1/chat", headers=headers, json={
        "content": "What are the payment terms?",
        "document_ids": [doc_id]
    })
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    assert chat_data["content"] is not None
    assert len(chat_data["content"]) > 0
