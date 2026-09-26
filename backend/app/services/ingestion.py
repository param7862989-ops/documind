import os
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.document import Document, DocumentChunk, DocumentStatus
from app.services.storage import get_storage_service
from app.services.extractor import DocumentExtractor
from app.services.chunker import DocumentChunker
from app.services.embeddings import EmbeddingService


class IngestionPipeline:
    def __init__(self):
        self.storage = get_storage_service()
        self.extractor = DocumentExtractor()
        self.chunker = DocumentChunker()
        self.embedding_service = EmbeddingService()

    def process_document(self, document_id: str):
        """
        Executes background ingestion:
        1. Reads file from storage abstraction
        2. Extracts structured text and page count
        3. Generates chunks with page metadata
        4. Generates vector embeddings
        5. Saves chunks to database
        6. Marks document as READY or FAILED
        """
        db: Session = SessionLocal()
        try:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if not doc:
                print(f"Document {document_id} not found for processing.")
                return

            # Update status to PROCESSING
            doc.status = DocumentStatus.PROCESSING
            db.commit()

            # Read file bytes from storage
            file_bytes = self.storage.get_file(doc.storage_path)

            # Extract pages
            pages_data, total_pages = self.extractor.extract_text_from_file(
                file_bytes, doc.original_filename
            )

            doc.page_count = total_pages

            # Chunk document pages
            chunk_dicts = self.chunker.chunk_pages(pages_data, doc.id)

            if not chunk_dicts:
                # Handle empty or un-extractable document
                doc.status = DocumentStatus.READY
                doc.chunk_count = 0
                db.commit()
                return

            # Batch compute vector embeddings
            texts_to_embed = [c["text_content"] for c in chunk_dicts]
            embeddings = self.embedding_service.get_embeddings(texts_to_embed)

            # Persist chunks
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
            print(f"Successfully processed document {doc.title} ({doc.id}): {len(chunk_dicts)} chunks indexed.")

        except Exception as e:
            print(f"Document processing failed for {document_id}: {e}")
            db.rollback()
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = DocumentStatus.FAILED
                doc.error_message = str(e)
                db.commit()
        finally:
            db.close()


ingestion_pipeline = IngestionPipeline()
