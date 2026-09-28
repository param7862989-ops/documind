import re
from typing import List, Dict, Any, Optional


class DocumentChunker:
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_pages(
        self,
        pages_data: List[Dict[str, Any]],
        document_id: str,
        document_title: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Splits extracted pages/sections into bounded semantic chunks with overlap.
        Preserves exact page_number, section_title, chunk_index, and parent metadata.
        """
        chunks = []
        global_chunk_idx = 0

        for item in pages_data:
            page_num = item.get("page_number")
            section_title = item.get("section_title")
            raw_text = item.get("text", "").strip()
            item_meta = item.get("metadata", {})

            if not raw_text:
                continue

            # Split by double newline into paragraphs
            paragraphs = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
            current_chunk_text = ""
            current_section = section_title

            for para in paragraphs:
                # Detect sub-heading if para is short and not ending with punctuation
                if len(para) < 70 and not para.endswith((".", ":", ";", ",", "?", "!")):
                    current_section = para

                # If paragraph itself is longer than chunk_size, split by sentences
                if len(para) > self.chunk_size:
                    sentences = re.split(r"(?<=[.!?])\s+", para)
                    for sent in sentences:
                        sent = sent.strip()
                        if not sent:
                            continue
                        if len(current_chunk_text) + len(sent) + 1 <= self.chunk_size:
                            current_chunk_text = f"{current_chunk_text} {sent}".strip()
                        else:
                            if current_chunk_text:
                                chunks.append(self._create_chunk(
                                    document_id=document_id,
                                    chunk_index=global_chunk_idx,
                                    page_number=page_num,
                                    section_title=current_section,
                                    text_content=current_chunk_text,
                                    extra_meta=item_meta,
                                ))
                                global_chunk_idx += 1

                                # Retain overlap
                                overlap = current_chunk_text[-self.chunk_overlap:] if len(current_chunk_text) > self.chunk_overlap else current_chunk_text
                                current_chunk_text = f"{overlap} {sent}".strip()
                            else:
                                current_chunk_text = sent
                    continue

                if len(current_chunk_text) + len(para) + 2 <= self.chunk_size:
                    current_chunk_text = f"{current_chunk_text}\n\n{para}".strip()
                else:
                    if current_chunk_text:
                        chunks.append(self._create_chunk(
                            document_id=document_id,
                            chunk_index=global_chunk_idx,
                            page_number=page_num,
                            section_title=current_section,
                            text_content=current_chunk_text,
                            extra_meta=item_meta,
                        ))
                        global_chunk_idx += 1

                        if self.chunk_overlap > 0 and len(current_chunk_text) > self.chunk_overlap:
                            overlap = current_chunk_text[-self.chunk_overlap:]
                            current_chunk_text = f"{overlap}\n\n{para}".strip()
                        else:
                            current_chunk_text = para
                    else:
                        current_chunk_text = para

            if current_chunk_text:
                chunks.append(self._create_chunk(
                    document_id=document_id,
                    chunk_index=global_chunk_idx,
                    page_number=page_num,
                    section_title=current_section,
                    text_content=current_chunk_text,
                    extra_meta=item_meta,
                ))
                global_chunk_idx += 1

        return chunks

    def _create_chunk(
        self,
        document_id: str,
        chunk_index: int,
        page_number: Optional[int],
        section_title: Optional[str],
        text_content: str,
        extra_meta: Dict[str, Any],
    ) -> Dict[str, Any]:
        return {
            "document_id": document_id,
            "chunk_index": chunk_index,
            "page_number": page_number,
            "section_title": section_title,
            "text_content": text_content,
            "chunk_metadata": {
                **extra_meta,
                "page": page_number,
                "section": section_title,
                "char_count": len(text_content),
                "token_estimate": max(1, len(text_content) // 4),
            }
        }
