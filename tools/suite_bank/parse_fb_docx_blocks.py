"""Parse Fenbi-style Word blocks: header + options + 正确答案 line.

规则与版式约定见：docs/active/SUITE_BANK_WORD_IMPORT_RULES.md
"""

from __future__ import annotations

import re
from dataclasses import dataclass


HEADER_RE = re.compile(r"^(\d+)\.\s*【(?P<label>[^\]]+)】\s*(?P<stem_after>.*)$")
ANSWER_RE = re.compile(r"^正确答案:\s*([A-Za-z])\s*\|\s*(.*)$")
# 多选：「正确答案: A,B,D | …」
ANSWER_MULTI_RE = re.compile(r"^正确答案:\s*([A-Za-z]+(?:\s*,\s*[A-Za-z]+)*)\s*\|\s*(.*)$")
# 政治理论等判断题：粉笔写「正确答案: 正确 | …」「正确答案: 错误 | …」（选项为 A/B 正确/错误）
ANSWER_TF_RE = re.compile(r"^正确答案:\s*(正确|错误)\s*\|\s*(.*)$")
OPTION_RE = re.compile(r"^([A-D])\.\s*(.*)$")
DIVIDER_RE = re.compile(r"^-{3,}$")


@dataclass
class ParsedQuestion:
    seq_index: int  # document order 1..
    question_no: int
    label: str
    stem: str
    options_lines: list[str]
    answer: str
    analysis_tail: str
    stem_image: bytes | None = None
    #: 上一题答案之后、本题小题头之前的段落（资料分析等多题共用一段材料）
    shared_material: str = ""


def extract_type_label(tail: str) -> str:
    m = re.search(r"考点:\s*(.+?)(?:自定义备注:|$)", tail)
    return m.group(1).strip() if m else ""


_SECTION_PREFIXES: tuple[str, ...] = tuple(
    sorted(
        ("言语理解与表达", "数理能力", "判断推理", "常识判断", "资料分析", "常识"),
        key=len,
        reverse=True,
    )
)


def _starts_known_section(line: str) -> bool:
    return any(line.startswith(p) for p in _SECTION_PREFIXES)


def infer_section_heading(question_no: int, active_intro_line: str) -> str:
    """Turn Word section preamble into a short banner (e.g. 数字推理)."""
    intro = (active_intro_line or "").strip()
    if intro.startswith("数理能力"):
        if "数字推理与数学运算" in intro:
            return "数字推理" if question_no <= 5 else "数学运算"
        return "数理能力"
    if intro.startswith("言语理解与表达"):
        return "言语理解与表达"
    if intro.startswith("判断推理"):
        return "判断推理"
    if intro.startswith("常识判断") or intro.startswith("常识"):
        return "常识判断"
    if intro.startswith("资料分析"):
        return "资料分析"
    return ""


def map_question_section_headings(paras: list[str]) -> dict[int, str]:
    """Latest section preamble line applies until the next preamble."""
    active_intro = ""
    out: dict[int, str] = {}
    for line in paras:
        hm = HEADER_RE.match(line)
        if hm:
            qn = int(hm.group(1))
            out[qn] = infer_section_heading(qn, active_intro)
            continue
        if _starts_known_section(line):
            active_intro = line
    return out


def parse_fenbi_paragraphs(
    paras: list[str],
    stem_images_by_header_line: dict[int, bytes] | None = None,
) -> list[ParsedQuestion]:
    """Split paragraphs into questions; attach orphan blocks before each header as shared material."""
    out: list[ParsedQuestion] = []
    i = 0
    doc_order = 0
    pending_material: list[str] = []
    active_shared_material = ""
    parsed_any = False

    while i < len(paras):
        hm = HEADER_RE.match(paras[i])
        if not hm:
            if DIVIDER_RE.match(paras[i]):
                i += 1
                continue
            if parsed_any:
                pending_material.append(paras[i])
            i += 1
            continue

        if pending_material:
            chunk = "\n\n".join(x.strip() for x in pending_material if x.strip()).strip()
            if chunk:
                active_shared_material = chunk
            pending_material.clear()

        hdr_line_idx = i
        stem_img = (stem_images_by_header_line or {}).get(hdr_line_idx)

        question_no = int(hm.group(1))
        label = str(hm.group("label") or "")
        stem_parts: list[str] = []
        tail = (hm.group("stem_after") or "").strip()
        if tail:
            stem_parts.append(tail)
        i += 1

        while i < len(paras):
            line = paras[i]
            if HEADER_RE.match(line):
                break
            if ANSWER_RE.match(line) or ANSWER_TF_RE.match(line) or ANSWER_MULTI_RE.match(line):
                break
            if OPTION_RE.match(line):
                break
            if DIVIDER_RE.match(line):
                i += 1
                continue
            stem_parts.append(line)
            i += 1

        opts: list[str] = []
        while i < len(paras):
            om = OPTION_RE.match(paras[i])
            if not om:
                break
            letter = om.group(1).upper()
            body = (om.group(2) or "").strip()
            opts.append(f"{letter}. {body}".strip())
            i += 1

        if i >= len(paras):
            raise ValueError(f"Missing answer after question {question_no}")

        line_ans = paras[i]
        am = ANSWER_RE.match(line_ans)
        amm = ANSWER_MULTI_RE.match(line_ans)
        tfm = ANSWER_TF_RE.match(line_ans) if not am and not amm else None
        if tfm:
            analysis_tail = str(tfm.group(2) or "").strip()
            answer = "A" if tfm.group(1) == "正确" else "B"
        elif am:
            analysis_tail = str(am.group(2) or "").strip()
            answer = str(am.group(1)).upper().strip()
        elif amm:
            analysis_tail = str(amm.group(2) or "").strip()
            raw = str(amm.group(1) or "").strip()
            letters: list[str] = []
            for part in re.split(r"\s*,\s*", raw):
                p = part.strip().upper()
                if len(p) == 1 and p in "ABCD":
                    letters.append(p)
            if not letters:
                raise ValueError(f"Expected A–D letters in multi 正确答案 after Q{question_no}, got: {line_ans[:80]!r}")
            answer = ",".join(letters)
        else:
            raise ValueError(f"Expected 正确答案 line after Q{question_no}, got: {line_ans[:80]!r}")
        i += 1

        if i < len(paras) and DIVIDER_RE.match(paras[i]):
            i += 1

        stem = "\n".join(stem_parts).strip()
        if not stem:
            if stem_img:
                stem = "（见下图）"
            else:
                stem = f"（第 {question_no} 题题干含图形或未从 Word 提取到文字，请对照原版）"

        doc_order += 1
        parsed_any = True
        out.append(
            ParsedQuestion(
                seq_index=doc_order,
                question_no=question_no,
                label=label,
                stem=stem,
                options_lines=opts,
                answer=answer,
                analysis_tail=analysis_tail,
                stem_image=stem_img,
                shared_material=active_shared_material,
            )
        )

    return out
