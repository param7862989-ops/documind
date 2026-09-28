from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict
from app.models.document import DocumentStatus


class DocumentBase(BaseModel):
    title: str
    original_filename: str
    file_type: str
    file_size: int


class DocumentResponse(DocumentBase):
    id: str
    user_id: str
    storage_path: str
    content_hash: Optional[str] = None
    status: DocumentStatus
    error_message: Optional[str] = None
    page_count: int
    chunk_count: int
    doc_metadata: Dict[str, Any]
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DocumentChunkResponse(BaseModel):
    id: str
    document_id: str
    chunk_index: int
    page_number: Optional[int] = None
    section_title: Optional[str] = None
    text_content: str
    chunk_metadata: Dict[str, Any]

    model_config = ConfigDict(from_attributes=True)
