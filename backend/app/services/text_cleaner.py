import io
import re
from typing import Optional


def clean_text(text: str) -> str:
    """
    Normalizes text extracted from documents:
    1. Removes null bytes and unprintable control characters (except newline, carriage return, tab).
    2. Normalizes non-standard whitespace while preserving intentional paragraph breaks (\n\n).
    3. Normalizes hyphenated line breaks (e.g. 'confiden-\ntiality' -> 'confidentiality').
    4. Preserves numbers, dates, currency symbols, headings, legal terms, and punctuation.
    """
    if not text:
        return ""

    # Remove null characters and control characters except \t, \n, \r
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Normalize carriage returns
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")

    # Fix dehyphenation across linebreaks (e.g., "agree-\nment" -> "agreement")
    cleaned = re.sub(r"(\w+)-\n(\w+)", r"\1\2", cleaned)

    # Replace 3 or more consecutive newlines with exactly 2 newlines (preserve paragraphs)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    # Replace multiple horizontal spaces/tabs on the same line with a single space
    cleaned = re.sub(r"[ \t]+", " ", cleaned)

    # Fix spaces before line breaks
    cleaned = re.sub(r" \n", "\n", cleaned)

    return cleaned.strip()
