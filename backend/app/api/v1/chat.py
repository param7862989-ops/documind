from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limiter import rate_limiter
from app.models.user import User
from app.models.conversation import Conversation, Message, MessageRole
from app.models.document import Document
from app.schemas.chat import (
    MessageCreate,
    MessageResponse,
    ConversationResponse,
    CompareRequest,
    Citation,
)
from app.api.deps import get_current_active_user
from app.services.rag import rag_service

router = APIRouter()


@router.post("", response_model=MessageResponse)
def send_chat_message(
    request: Request,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Submits a query to the AI RAG engine with conversational memory,
    retrieves context chunks, and stores the user and assistant turns.
    Rate limited to 40 queries/minute per user/IP.
    """
    rate_limiter.check(request, action_name="chat_message", max_requests=40, window_seconds=60)

    # Validate that all requested document IDs belong to current user
    if payload.document_ids and len(payload.document_ids) > 0:
        owned_count = (
            db.query(Document.id)
            .filter(Document.id.in_(payload.document_ids), Document.user_id == current_user.id)
            .count()
        )
        if owned_count != len(payload.document_ids):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="One or more selected documents do not belong to your account."
            )

    conversation = None
    if payload.conversation_id:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == payload.conversation_id, Conversation.user_id == current_user.id)
            .first()
        )
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found or access denied."
            )

    if not conversation:
        title = payload.content[:45] + ("..." if len(payload.content) > 45 else "")
        conversation = Conversation(
            user_id=current_user.id,
            title=title,
            selected_document_ids=payload.document_ids or []
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # Record User Message
    user_msg = Message(
        conversation_id=conversation.id,
        role=MessageRole.USER,
        content=payload.content,
        citations=[]
    )
    db.add(user_msg)
    db.commit()

    # Load recent conversation history (newest 10 messages, ordered chronologically)
    recent_msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(10)
        .all()
    )
    history = [{"role": m.role.value, "content": m.content} for m in reversed(recent_msgs)]

    # Target documents
    target_doc_ids = payload.document_ids or conversation.selected_document_ids

    # Retrieve relevant document chunks
    retrieved_chunks = rag_service.retrieve_relevant_chunks(
        db=db,
        query=payload.content,
        user_id=current_user.id,
        document_ids=target_doc_ids,
        top_k=6
    )

    # Generate answer with citations
    rag_result = rag_service.generate_grounded_answer(
        query=payload.content,
        retrieved_chunks=retrieved_chunks,
        conversation_history=history
    )

    # Save Assistant Message
    assistant_msg = Message(
        conversation_id=conversation.id,
        role=MessageRole.ASSISTANT,
        content=rag_result["answer"],
        citations=[c.model_dump() for c in rag_result["citations"]]
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return assistant_msg


@router.get("/conversations", response_model=List[ConversationResponse])
def list_conversations(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    List user conversations ordered by recent activity.
    """
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return conversations


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Retrieve full conversation history and message stream.
    """
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied."
        )
    return conversation


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Delete a conversation and its messages with ownership verification.
    """
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied."
        )
    db.delete(conversation)
    db.commit()
    return None


@router.post("/compare")
def compare_documents(
    request: Request,
    payload: CompareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Performs multi-document comparison by retrieving relevant evidence independently
    from each selected document to prevent any single document from dominating.
    Rate limited to 20 comparisons/minute per user/IP.
    """
    rate_limiter.check(request, action_name="chat_compare", max_requests=20, window_seconds=60)
    if len(payload.document_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select at least two documents to compare."
        )

    # Validate that current user owns all requested documents
    owned_docs = (
        db.query(Document.id)
        .filter(Document.id.in_(payload.document_ids), Document.user_id == current_user.id)
        .all()
    )
    owned_doc_ids = {d[0] for d in owned_docs}
    if len(owned_doc_ids) != len(payload.document_ids):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="One or more selected documents do not belong to your account."
        )

    query = payload.query or "Compare the main terms, obligations, termination clauses, and key differences."

    # Independent retrieval per document
    all_chunks = []
    for doc_id in payload.document_ids:
        doc_chunks = rag_service.retrieve_relevant_chunks(
            db=db,
            query=query,
            user_id=current_user.id,
            document_ids=[doc_id],
            top_k=4,
        )
        all_chunks.extend(doc_chunks)

    result = rag_service.generate_grounded_answer(
        query=query,
        retrieved_chunks=all_chunks,
        is_comparison=True
    )

    return result
