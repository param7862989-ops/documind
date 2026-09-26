from typing import List, Dict, Any


class DocumentChunker:
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_pages(
        self,
        pages_data: List[Dict[str, Any]],
        document_id: str
    ) -> List[Dict[str, Any]]:
        """
        Splits extracted page texts into bounded semantic chunks with overlap,
        annotating each chunk with its exact page_number, chunk_index, and parent document_id.
        """
        chunks = []
        global_chunk_idx = 0

        for page in pages_data:
            page_num = page.get("page_number", 1)
            page_text = page.get("text", "").strip()

            if not page_text:
                continue

            # Split into paragraphs/sentences
            paragraphs = page_text.split("\n\n")
            current_chunk_text = ""
            current_section = None

            for para in paragraphs:
                para = para.strip()
                if not para:
                    continue

                # Check if paragraph looks like a header (short length, no ending period)
                if len(para) < 80 and not para.endswith("."):
                    current_section = para

                if len(current_chunk_text) + len(para) <= self.chunk_size:
                    current_chunk_text = f"{current_chunk_text}\n\n{para}".strip()
                else:
                    if current_chunk_text:
                        chunks.append({
                            "document_id": document_id,
                            "chunk_index": global_chunk_idx,
                            "page_number": page_num,
                            "section_title": current_section,
                            "text_content": current_chunk_text,
                            "chunk_metadata": {
                                "page": page_num,
                                "section": current_section,
                                "char_count": len(current_chunk_text),
                            }
                        })
                        global_chunk_idx += 1

                        # Retain overlap from previous chunk
                        if self.chunk_overlap > 0 and len(current_chunk_text) > self.chunk_overlap:
                            overlap_text = current_chunk_text[-self.chunk_overlap:]
                            current_chunk_text = f"{overlap_text}\n\n{para}".strip()
                        else:
                            current_chunk_text = para
                    else:
                        current_chunk_text = para

            if current_chunk_text:
                chunks.append({
                    "document_id": document_id,
                    "chunk_index": global_chunk_idx,
                    "page_number": page_num,
                    "section_title": current_section,
                    "text_content": current_chunk_text,
                    "chunk_metadata": {
                        "page": page_num,
                        "section": current_section,
                        "char_count": len(current_chunk_text),
                    }
                })
                global_chunk_idx += 1

        return chunks
