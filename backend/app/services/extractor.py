import io
import os
from typing import List, Dict, Any, Tuple


class DocumentExtractor:
    @staticmethod
    def extract_text_from_file(file_bytes: bytes, filename: str) -> Tuple[List[Dict[str, Any]], int]:
        """
        Extracts structured page-level text from PDF, DOCX, TXT, or Image files.
        Returns a tuple: (pages_data, total_pages)
        pages_data = [{"page_number": int, "text": str, "metadata": dict}]
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
            # Fallback plain text decoding
            return DocumentExtractor._extract_text_plain(file_bytes)

    @staticmethod
    def _extract_pdf(file_bytes: bytes) -> Tuple[List[Dict[str, Any]], int]:
        pages = []
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                total_pages = len(pdf.pages)
                for idx, page in enumerate(pdf.pages):
                    text = page.extract_text() or ""
                    # Fallback to OCR if page has no extractable text layer (scanned PDF)
                    if len(text.strip()) < 20:
                        try:
                            import pytesseract
                            from PIL import Image
                            img = page.to_image(resolution=200).original
                            ocr_text = pytesseract.image_to_string(img)
                            if len(ocr_text.strip()) > len(text.strip()):
                                text = ocr_text
                        except Exception:
                            pass

                    pages.append({
                        "page_number": idx + 1,
                        "text": text.strip(),
                        "metadata": {"page": idx + 1}
                    })
                return pages, total_pages
        except Exception:
            # Fallback to pypdf
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            total_pages = len(reader.pages)
            for idx, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                pages.append({
                    "page_number": idx + 1,
                    "text": text.strip(),
                    "metadata": {"page": idx + 1}
                })
            return pages, total_pages

    @staticmethod
    def _extract_docx(file_bytes: bytes) -> Tuple[List[Dict[str, Any]], int]:
        import docx
        doc = docx.Document(io.BytesIO(file_bytes))
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text.strip())
        for table in doc.tables:
            for row in table.rows:
                row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if row_text:
                    full_text.append(" | ".join(row_text))

        combined_text = "\n\n".join(full_text)
        return [{"page_number": 1, "text": combined_text, "metadata": {"paragraphs": len(doc.paragraphs)}}], 1

    @staticmethod
    def _extract_text_plain(file_bytes: bytes) -> Tuple[List[Dict[str, Any]], int]:
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = file_bytes.decode("latin-1")
            except Exception:
                text = file_bytes.decode("utf-8", errors="replace")
        
        return [{"page_number": 1, "text": text.strip(), "metadata": {}}], 1

    @staticmethod
    def _extract_image_ocr(file_bytes: bytes, filename: str) -> Tuple[List[Dict[str, Any]], int]:
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes))
        try:
            import pytesseract
            text = pytesseract.image_to_string(img)
        except Exception:
            text = f"[OCR not configured for image {filename}]"
        
        return [{
            "page_number": 1,
            "text": text.strip(),
            "metadata": {"dimensions": f"{img.width}x{img.height}", "format": img.format}
        }], 1
