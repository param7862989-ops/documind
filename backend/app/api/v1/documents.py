import io
import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session

from app.config import settings
from app.core.database import get_db
from app.core.file_validator import validate_uploaded_file
from app.core.rate_limiter import rate_limiter
from app.models.user import User
from app.models.document import Document, DocumentStatus, DocumentChunk
from app.schemas.document import DocumentResponse, DocumentChunkResponse
from app.api.deps import get_current_active_user
from app.services.storage import get_storage_service
from app.services.ingestion import ingestion_pipeline

router = APIRouter()


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Securely uploads a document:
    1. Rate limits upload frequency (30 uploads/min per user/IP).
    2. Validates extension, magic byte header, and maximum file size (streaming).
    3. Computes content SHA-256 hash.
    4. Persists file to cloud/local object storage using structured user/doc keys.
    5. Creates document record with QUEUED status.
    6. Dispatches non-blocking background ingestion worker.
    """
    rate_limiter.check(request, action_name="documents_upload", max_requests=30, window_seconds=60)

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    content_bytes, safe_filename, file_type, content_hash = await validate_uploaded_file(
        file=file,
        max_bytes=max_bytes
    )

    doc_id = str(uuid.uuid4())
    storage = get_storage_service()
    storage_path = storage.save_file(
        file_obj=io.BytesIO(content_bytes),
        filename=safe_filename,
        content_type=file.content_type or "application/octet-stream",
        user_id=current_user.id,
        document_id=doc_id,
    )

    title = safe_filename.rsplit(".", 1)[0]
    doc = Document(
        id=doc_id,
        user_id=current_user.id,
        title=title,
        original_filename=safe_filename,
        file_type=file_type,
        file_size=len(content_bytes),
        storage_path=storage_path,
        content_hash=content_hash,
        status=DocumentStatus.QUEUED,
        doc_metadata={
            "content_type": file.content_type,
            "original_filename": safe_filename,
        },
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Dispatch asynchronous background ingestion
    background_tasks.add_task(ingestion_pipeline.process_document, doc.id)

    return doc


@router.get("", response_model=List[DocumentResponse])
def list_documents(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    List all documents owned by the authenticated user with real-time status.
    """
    documents = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return documents


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Retrieve document details and status by ID with ownership verification.
    """
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied."
        )
    return doc


@router.get("/{document_id}/status")
def get_document_status(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Lightweight endpoint for frontend polling of document processing state.
    """
    doc = (
        db.query(
            Document.id,
            Document.status,
            Document.page_count,
            Document.chunk_count,
            Document.error_message
        )
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied."
        )
    return {
        "id": doc[0],
        "status": doc[1],
        "page_count": doc[2],
        "chunk_count": doc[3],
        "error_message": doc[4],
    }


@router.get("/{document_id}/chunks", response_model=List[DocumentChunkResponse])
def get_document_chunks(
    document_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Retrieve extracted chunks and metadata for a specific document with user ownership verification.
    """
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied."
        )

    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index.asc())
        .limit(limit)
        .all()
    )
    return chunks


@router.post("/{document_id}/retry", response_model=DocumentResponse)
def retry_document_processing(
    document_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Safely re-triggers background ingestion for a failed or stuck document.
    """
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied."
        )

    doc.status = DocumentStatus.QUEUED
    doc.error_message = None
    db.commit()
    db.refresh(doc)

    background_tasks.add_task(ingestion_pipeline.process_document, doc.id)
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Delete a document, its chunks, embeddings, and remove the file from storage.
    """
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied."
        )

    # Delete storage file
    storage = get_storage_service()
    try:
        storage.delete_file(doc.storage_path)
    except Exception as e:
        print(f"Warning: Failed to delete storage file {doc.storage_path}: {e}")

    db.delete(doc)
    db.commit()
    return None
