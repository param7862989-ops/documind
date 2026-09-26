from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.models.conversation import MessageRole


class Citation(BaseModel):
    document_id: str
    document_title: str
    page_number: Optional[int] = None
    section_title: Optional[str] = None
    excerpt: str
    score: Optional[float] = None


class MessageCreate(BaseModel):
    content: str
    conversation_id: Optional[str] = None
    document_ids: Optional[List[str]] = None  # Specific documents to scope query to


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: MessageRole
    content: str
    citations: List[Citation] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationResponse(BaseModel):
    id: str
    user_id: str
    title: str
    selected_document_ids: List[str] = []
    messages: List[MessageResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CompareRequest(BaseModel):
    document_ids: List[str]
    aspects: Optional[List[str]] = None  # e.g. ["Termination", "Payment terms", "Liabilities"]
    query: Optional[str] = None
