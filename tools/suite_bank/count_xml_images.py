"""Count OOXML image markers in document.xml (stdlib)."""

from __future__ import annotations

import sys
import zipfile
from pathlib import Path


def main() -> None:
    doc = Path(sys.argv[1])
    with zipfile.ZipFile(doc, "r") as zf:
        raw = zf.read("word/document.xml").decode("utf-8", "replace")
    for needle in ("blip", "drawing", "imagedata", "pic:pic", "Relationship Type"):
        print(needle, raw.count(needle))


if __name__ == "__main__":
    main()
