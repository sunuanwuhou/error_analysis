#!/usr/bin/env python3
"""Print lines that look like section intros (诊断)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

SB = Path(__file__).resolve().parent
sys.path.insert(0, str(SB))
from docx_paragraphs import non_empty_paragraphs

ROOT = SB.parent.parent
DOC = ROOT / "word版本/广东省考/2008年广东省公务员录用考试《行测》题.docx"


def main() -> None:
    paras = non_empty_paragraphs(DOC)
    for i, t in enumerate(paras):
        if "本部分" in t or re.match(r"^(数理能力|言语理解与表达|判断推理|常识|资料分析)", t):
            print(f"{i}: {t[:100]}")


if __name__ == "__main__":
    main()
