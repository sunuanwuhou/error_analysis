from __future__ import annotations

from pathlib import Path
from typing import Optional


def ocr_image(image_path: Path) -> Optional[str]:
    """Placeholder OCR hook.

    First lab version keeps OCR optional. This function is the future extension
    point for PaddleOCR / Tesseract integration.
    """
    if not image_path.exists():
        return None
    return None
