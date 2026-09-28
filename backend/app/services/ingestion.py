import logging
import os
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.document import Document, DocumentChunk, DocumentStatus
from app.services.storage import get_storage_service
from app.services.extractor import DocumentExtractor
from app.services.chunker import DocumentChunker
from app.services.embeddings import EmbeddingService

logger = logging.getLogger(__name__)


class IngestionPipeline:
    def __init__(self):
        self.storage = get_storage_service()
        self.extractor = DocumentExtractor()
        self.chunker = DocumentChunker()
        self.embedding_service = EmbeddingService()

    def process_document(self, document_id: str):
        """
        Executes idempotent background ingestion:
        1. Sets document status to PROCESSING.
        2. Retrieves document and reads file from storage abstraction.
        3. Extracts structured text with page/section preservation and OCR fallback.
        4. Cleans text and splits into bounded semantic chunks with overlap.
        5. Generates 1536-dim vector embeddings.
        6. Cleans previous chunks (safe retry) and persists new chunks in a single transaction.
        7. Marks document as READY or FAILED.
        """
        db: Session = SessionLocal()
        try:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if not doc:
                logger.error("Document %s not found for background ingestion.", document_id)
                return

            # Update status to PROCESSING
            doc.status = DocumentStatus.PROCESSING
            db.commit()

            # Read file bytes from storage
            file_bytes = self.storage.get_file(doc.storage_path)

            # Extract pages / sections
            pages_data, total_pages = self.extractor.extract_text_from_file(
                file_bytes, doc.original_filename
            )

            doc.page_count = total_pages

            # Chunk document pages
            chunk_dicts = self.chunker.chunk_pages(
                pages_data=pages_data,
                document_id=doc.id,
                document_title=doc.title,
            )

            if not chunk_dicts:
                # Document has no extractable text
                doc.status = DocumentStatus.READY
                doc.chunk_count = 0
                doc.error_message = None
                db.commit()
                logger.info("Document %s (%s) processed with 0 chunks.", doc.title, doc.id)
                return

            # Batch compute vector embeddings
            texts_to_embed = [c["text_content"] for c in chunk_dicts]
            embeddings = self.embedding_service.get_embeddings(texts_to_embed)

            # Atomic transaction: delete existing chunks (idempotent retry) & insert fresh chunks
            db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()

            for idx, c_dict in enumerate(chunk_dicts):
                embedding = embeddings[idx] if idx < len(embeddings) else None
                chunk = DocumentChunk(
                    document_id=doc.id,
                    chunk_index=c_dict["chunk_index"],
                    page_number=c_dict["page_number"],
                    section_title=c_dict["section_title"],
                    text_content=c_dict["text_content"],
                    embedding=embedding,
                    chunk_metadata=c_dict["chunk_metadata"],
                )
                db.add(chunk)

            doc.chunk_count = len(chunk_dicts)
            doc.status = DocumentStatus.READY
            doc.error_message = None
            db.commit()
            logger.info(
                "Successfully processed document '%s' (ID: %s) with %d chunks.",
                doc.title,
                doc.id,
                len(chunk_dicts)
            )

        except Exception as e:
            logger.exception("Document processing failed for %s: %s", document_id, e)
            db.rollback()
            try:
                doc = db.query(Document).filter(Document.id == document_id).first()
                if doc:
                    doc.status = DocumentStatus.FAILED
                    # Clean user-facing error message without raw tracebacks
                    error_str = str(e)
                    if len(error_str) > 200:
                        error_str = error_str[:197] + "..."
                    doc.error_message = f"Processing error: {error_str}"
                    db.commit()
            except Exception as update_err:
                logger.error("Failed to update document status to FAILED: %s", update_err)
        finally:
            db.close()


ingestion_pipeline = IngestionPipeline()
