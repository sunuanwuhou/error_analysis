"""Print non-empty paragraphs from a docx (debug)."""

from __future__ import annotations

import argparse
from pathlib import Path

from docx_paragraphs import read_docx_for_suite_import


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("docx", type=Path)
    ap.add_argument("--limit", type=int, default=120)
    args = ap.parse_args()
    lines, imgs = read_docx_for_suite_import(args.docx)
    print("count", len(lines))
    print("embedded_images_at_line_index", sorted(imgs.keys()), "bytes", {k: len(v) for k, v in imgs.items()})
    for i, t in enumerate(lines[: args.limit]):
        print(f"{i}: {t[:200]!r}")


if __name__ == "__main__":
    main()
