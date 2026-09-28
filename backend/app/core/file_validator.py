import hashlib
import io
import os
import zipfile
from typing import Tuple, Set
from fastapi import HTTPException, UploadFile, status

ALLOWED_EXTENSIONS: Set[str] = {
    ".pdf",
    ".docx",
    ".doc",
    ".txt",
    ".md",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".tiff",
    ".bmp",
}

# Known executable binary signatures that must be rejected unconditionally
EXECUTABLE_SIGNATURES = [
    b"MZ",  # Windows PE / DOS executable (.exe, .dll)
    b"\x7fELF",  # Linux ELF executable
    b"\xca\xfe\xba\xbe",  # Mach-O fat binary / Java class
    b"\xce\xfa\xed\xfe",  # Mach-O 32-bit
    b"\xcf\xfa\xed\xfe",  # Mach-O 64-bit
]


def verify_magic_bytes(header: bytes, ext: str, full_content: bytes) -> bool:
    """
    Verifies actual binary signature matches the claimed extension.
    """
    # First, verify not an executable disguised as a document
    for sig in EXECUTABLE_SIGNATURES:
        if header.startswith(sig):
            return False

    if ext == ".pdf":
        return header.startswith(b"%PDF-")

    elif ext == ".docx":
        if not header.startswith(b"PK\x03\x04"):
            return False
        # Verify ZIP contains Word document parts
        try:
            with zipfile.ZipFile(io.BytesIO(full_content)) as zf:
                namelist = zf.namelist()
                return any(
                    name.startswith("word/") or name == "[Content_Types].xml"
                    for name in namelist
                )
        except Exception:
            return False

    elif ext == ".doc":
        # Legacy Word OLE Compound Document or ZIP
        return header.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1") or header.startswith(b"PK\x03\x04")

    elif ext == ".png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")

    elif ext in [".jpg", ".jpeg"]:
        return header.startswith(b"\xff\xd8\xff")

    elif ext == ".webp":
        return len(header) >= 12 and header.startswith(b"RIFF") and header[8:12] == b"WEBP"

    elif ext == ".bmp":
        return header.startswith(b"BM")

    elif ext == ".tiff":
        return header.startswith(b"II*\x00") or header.startswith(b"MM\x00*")

    elif ext in [".txt", ".md"]:
        # Verify plain text can be decoded without null byte bombs
        if b"\x00" in header[:256]:
            return False
        try:
            full_content.decode("utf-8")
            return True
        except UnicodeDecodeError:
            try:
                full_content.decode("latin-1")
                return True
            except Exception:
                return False

    return True


async def validate_uploaded_file(
    file: UploadFile,
    max_bytes: int = 50 * 1024 * 1024
) -> Tuple[bytes, str, str, str]:
    """
    Safely reads and validates an uploaded file:
    1. Validates extension against whitelist.
    2. Streams content up to max_bytes (preventing memory exhaustion).
    3. Rejects empty files (0 bytes).
    4. Computes SHA-256 checksum.
    5. Validates file header / magic bytes against claimed extension.
    
    Returns: (file_bytes, safe_filename, file_type, content_hash)
    """
    raw_filename = file.filename or "uploaded_document"
    safe_filename = os.path.basename(raw_filename).strip()
    ext = os.path.splitext(safe_filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Supported formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Stream file in bounded chunks to protect RAM and enforce size limit
    chunk_size = 64 * 1024  # 64 KB chunks
    total_bytes = 0
    buffer = io.BytesIO()
    hasher = hashlib.sha256()

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total_bytes += len(chunk)
        if total_bytes > max_bytes:
            max_mb = max_bytes // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File exceeds maximum allowed size of {max_mb} MB."
            )
        buffer.write(chunk)
        hasher.update(chunk)

    if total_bytes == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot upload an empty file (0 bytes)."
        )

    content_bytes = buffer.getvalue()
    content_hash = hasher.hexdigest()

    # Magic byte verification
    header = content_bytes[:32]
    is_valid_signature = verify_magic_bytes(header, ext, content_bytes)

    if not is_valid_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file content: The uploaded file's binary signature does not match claimed '{ext}' extension."
        )

    file_type = ext.lstrip(".")
    return content_bytes, safe_filename, file_type, content_hash
