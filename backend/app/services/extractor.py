import io
import os
from typing import List, Dict, Any, Tuple, Optional
from app.services.text_cleaner import clean_text


class DocumentExtractor:
    @staticmethod
    def extract_text_from_file(file_bytes: bytes, filename: str) -> Tuple[List[Dict[str, Any]], int]:
        """
        Extracts structured text from PDF, DOCX, TXT, or Image files.
        Returns a tuple: (pages_data, total_pages_or_sections)
        pages_data = [{"page_number": Optional[int], "text": str, "section_title": Optional[str], "metadata": dict}]
        """
        ext = os.path.splitext(filename)[1].lower()

        if ext == ".pdf":
            return DocumentExtractor._extract_pdf(file_bytes)
        elif ext in [".docx", ".doc"]:
            return DocumentExtractor._extract_docx(file_bytes)
        elif ext in [".txt", ".md", ".csv", ".json", ".log"]:
            return DocumentExtractor._extract_text_plain(file_bytes)
        elif ext in [".png", ".jpg", ".jpeg", ".webp", ".tiff", ".bmp"]:
            return DocumentExtractor._extract_image_ocr(file_bytes, filename)
        else:
            return DocumentExtractor._extract_text_plain(file_bytes)

    @staticmethod
    def _extract_pdf(file_bytes: bytes) -> Tuple[List[Dict[str, Any]], int]:
        pages = []
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                total_pages = len(pdf.pages)
                for idx, page in enumerate(pdf.pages):
                    raw_text = page.extract_text() or ""
                    cleaned = clean_text(raw_text)

                    # Fallback to OCR if page has minimal/no extractable text layer (scanned PDF)
                    if len(cleaned) < 20:
                        try:
                            import pytesseract
                            from PIL import Image
                            page_img = page.to_image(resolution=200).original
                            # Convert to grayscale for cleaner OCR
                            if page_img.mode != "L":
                                page_img = page_img.convert("L")
                            ocr_raw = pytesseract.image_to_string(page_img)
                            ocr_cleaned = clean_text(ocr_raw)
                            if len(ocr_cleaned) > len(cleaned):
                                cleaned = ocr_cleaned
                        except Exception:
                            pass

                    pages.append({
                        "page_number": idx + 1,
                        "section_title": None,
                        "text": cleaned,
                        "metadata": {"page": idx + 1, "format": "pdf"}
                    })
                return pages, total_pages
        except Exception:
            # Fallback to pypdf
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            total_pages = len(reader.pages)
            for idx, page in enumerate(reader.pages):
                raw_text = page.extract_text() or ""
                pages.append({
                    "page_number": idx + 1,
                    "section_title": None,
                    "text": clean_text(raw_text),
                    "metadata": {"page": idx + 1, "format": "pdf_pypdf"}
                })
            return pages, total_pages

    @staticmethod
    def _extract_docx(file_bytes: bytes) -> Tuple[List[Dict[str, Any]], int]:
        import docx
        doc = docx.Document(io.BytesIO(file_bytes))
        sections_data: List[Dict[str, Any]] = []
        current_section_title = None
        current_section_paragraphs = []

        for para in doc.paragraphs:
            p_text = para.text.strip()
            if not p_text:
                continue

            style_name = para.style.name.lower() if para.style else ""
            is_heading = "heading" in style_name or (len(p_text) < 80 and not p_text.endswith("."))

            if is_heading:
                if current_section_paragraphs:
                    section_body = clean_text("\n\n".join(current_section_paragraphs))
                    if section_body:
                        sections_data.append({
                            "page_number": None,
                            "section_title": current_section_title,
                            "text": section_body,
                            "metadata": {
                                "format": "docx",
                                "structure": "section",
                                "section": current_section_title,
                            }
                        })
                    current_section_paragraphs = []
                current_section_title = p_text
            else:
                current_section_paragraphs.append(p_text)

        # Append remaining paragraphs
        if current_section_paragraphs:
            section_body = clean_text("\n\n".join(current_section_paragraphs))
            if section_body:
                sections_data.append({
                    "page_number": None,
                    "section_title": current_section_title,
                    "text": section_body,
                    "metadata": {
                        "format": "docx",
                        "structure": "section",
                        "section": current_section_title,
                    }
                })

        # Extract Tables formatted as structured Markdown tables
        for t_idx, table in enumerate(doc.tables):
            table_rows = []
            for row in table.rows:
                row_cells = [cell.text.strip().replace("\n", " ") for cell in row.cells if cell.text.strip()]
                if row_cells:
                    table_rows.append(" | ".join(row_cells))
            if table_rows:
                table_md = "\n".join(f"| {r} |" for r in table_rows)
                sections_data.append({
                    "page_number": None,
                    "section_title": f"Table {t_idx + 1}",
                    "text": clean_text(table_md),
                    "metadata": {
                        "format": "docx",
                        "structure": "table",
                        "table_index": t_idx + 1,
                    }
                })

        if not sections_data:
            # Fallback for plain docx without distinct headings
            full_text = clean_text("\n\n".join(p.text for p in doc.paragraphs if p.text.strip()))
            sections_data = [{
                "page_number": None,
                "section_title": None,
                "text": full_text,
                "metadata": {"format": "docx", "structure": "document"}
            }]

        return sections_data, len(sections_data)

    @staticmethod
    def _extract_text_plain(file_bytes: bytes) -> Tuple[List[Dict[str, Any]], int]:
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = file_bytes.decode("latin-1")
            except Exception:
                text = file_bytes.decode("utf-8", errors="replace")

        cleaned = clean_text(text)
        line_count = len(cleaned.splitlines())
        return [{
            "page_number": None,
            "section_title": None,
            "text": cleaned,
            "metadata": {"format": "plain_text", "line_count": line_count}
        }], 1

    @staticmethod
    def _extract_image_ocr(file_bytes: bytes, filename: str) -> Tuple[List[Dict[str, Any]], int]:
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes))
        
        # Preprocess for OCR: convert RGBA/palette images to RGB/grayscale
        if img.mode not in ("L", "RGB"):
            img = img.convert("RGB")

        try:
            import pytesseract
            raw_text = pytesseract.image_to_string(img)
            text = clean_text(raw_text)
            if not text:
                text = f"[No readable text detected in image '{filename}']"
        except Exception as e:
            text = f"[OCR processing could not read image '{filename}': {e}]"

        return [{
            "page_number": 1,
            "section_title": None,
            "text": text,
            "metadata": {
                "format": "image",
                "dimensions": f"{img.width}x{img.height}",
                "original_format": img.format or "IMAGE"
            }
        }], 1
