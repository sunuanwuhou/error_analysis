"""面试题库 JSON / Markdown 批量导入解析。"""

from __future__ import annotations

import json
import re
from typing import Any
_DIFFICULTY_LABELS: dict[str, int] = {
    "1": 1,
    "2": 2,
    "3": 3,
    "基础": 1,
    "中等": 2,
    "进阶": 3,
}

_SECTION_KEYS = {
    "题目": "question_text",
    "题干": "question_text",
    "question": "question_text",
    "question_text": "question_text",
    "题型": "category",
    "category": "category",
    "框架": "framework",
    "答题框架": "framework",
    "framework": "framework",
    "参考答案": "sample_answer",
    "参考": "sample_answer",
    "sample_answer": "sample_answer",
    "来源": "source",
    "source": "source",
    "难度": "difficulty",
    "difficulty": "difficulty",
}


def _normalize_category_raw(raw: str) -> str:
    text = (raw or "").strip()
    return text or "综合分析"


def _normalize_difficulty(raw: Any) -> int:
    if isinstance(raw, int) and raw in (1, 2, 3):
        return raw
    text = str(raw or "").strip()
    if text in _DIFFICULTY_LABELS:
        return _DIFFICULTY_LABELS[text]
    try:
        n = int(text)
        if n in (1, 2, 3):
            return n
    except ValueError:
        pass
    return 2


def normalize_question_item(raw: dict[str, Any]) -> dict[str, Any]:
    qtext = str(raw.get("question_text") or raw.get("question") or "").strip()
    if not qtext:
        raise ValueError("question_text_required")
    item: dict[str, Any] = {
        "id": str(raw.get("id") or "").strip(),
        "category": _normalize_category_raw(str(raw.get("category") or "")),
        "difficulty": _normalize_difficulty(raw.get("difficulty", 2)),
        "question_text": qtext,
        "framework": str(raw.get("framework") or "").strip(),
        "sample_answer": str(raw.get("sample_answer") or raw.get("answer") or "").strip(),
        "source": str(raw.get("source") or "").strip(),
    }
    return item


def parse_json_import(content: str) -> list[dict[str, Any]]:
    text = (content or "").strip()
    if not text:
        return []
    data = json.loads(text)
    if isinstance(data, dict) and "items" in data:
        data = data["items"]
    if not isinstance(data, list):
        raise ValueError("json_must_be_array")
    out: list[dict[str, Any]] = []
    for i, row in enumerate(data):
        if not isinstance(row, dict):
            raise ValueError(f"item_{i}_not_object")
        out.append(normalize_question_item(row))
    return out


def _split_markdown_blocks(text: str) -> list[str]:
    parts = re.split(r"\n(?:---|\*\*\*)\s*\n", text.strip())
    return [p.strip() for p in parts if p.strip()]


def _parse_markdown_block(block: str) -> dict[str, Any]:
    item: dict[str, str] = {}
    current_key: str | None = None
    buf: list[str] = []

    def flush() -> None:
        nonlocal current_key, buf
        if current_key is not None:
            item[current_key] = "\n".join(buf).strip()
        buf = []

    for line in block.splitlines():
        m = re.match(r"^#{1,3}\s*(.+?)\s*$", line.strip())
        if m:
            flush()
            title = m.group(1).strip()
            mapped = _SECTION_KEYS.get(title) or _SECTION_KEYS.get(title.replace(" ", ""))
            current_key = mapped
            continue
        m2 = re.match(r"^\*\*(.+?)\*\*\s*$", line.strip())
        if m2:
            flush()
            title = m2.group(1).strip()
            mapped = _SECTION_KEYS.get(title)
            current_key = mapped
            continue
        m3 = re.match(r"^(.+?)[:：]\s*$", line.strip())
        if m3 and m3.group(1).strip() in _SECTION_KEYS:
            flush()
            current_key = _SECTION_KEYS[m3.group(1).strip()]
            continue
        if current_key is not None:
            buf.append(line)
        elif not item.get("question_text") and line.strip():
            # 首段无标题时视为题干
            current_key = "question_text"
            buf.append(line)

    flush()
    if not item.get("question_text"):
        # 整块当作题干
        item["question_text"] = block.strip()
    return normalize_question_item(item)


def parse_markdown_import(content: str) -> list[dict[str, Any]]:
    text = (content or "").strip()
    if not text:
        return []
    blocks = _split_markdown_blocks(text)
    if len(blocks) == 1 and "##" not in blocks[0] and "**题目**" not in blocks[0]:
        # 单题简写：按段落切 ## 或整段
        if re.search(r"^#{1,3}\s", text, re.MULTILINE):
            blocks = [text]
        else:
            return [_parse_markdown_block(text)]
    return [_parse_markdown_block(b) for b in blocks]
