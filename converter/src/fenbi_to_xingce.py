from __future__ import annotations

import argparse
import json
from datetime import date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API_BASE = "https://tiku.fenbi.com/combine"
DEFAULT_QUERY = {
    "kav": "125",
    "av": "127",
    "hav": "125",
    "app": "web",
}


def _norm_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list):
        return "\n".join(_norm_text(v) for v in value if _norm_text(v))
    if isinstance(value, dict):
        for key in ("text", "content", "value", "name", "desc", "title"):
            if key in value and _norm_text(value.get(key)):
                return _norm_text(value.get(key))
        try:
            return json.dumps(value, ensure_ascii=False)
        except Exception:
            return ""
    return ""


def _get_first(d: dict[str, Any], keys: list[str]) -> Any:
    for key in keys:
        if key in d and d[key] not in (None, "", [], {}):
            return d[key]
    return None


def _flatten_dict_nodes(node: Any):
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from _flatten_dict_nodes(v)
    elif isinstance(node, list):
        for v in node:
            yield from _flatten_dict_nodes(v)


def _looks_like_question_record(d: dict[str, Any]) -> bool:
    q = _get_first(
        d,
        [
            "question",
            "stem",
            "content",
            "questionStem",
            "questionContent",
            "title",
            "material",
            "prompt",
        ],
    )
    a = _get_first(d, ["answer", "correctAnswer", "rightAnswer", "answers", "rightAnswers"])
    ana = _get_first(d, ["analysis", "solution", "explanation", "answerExplain", "answerAnalysis"])
    opts = _get_first(d, ["options", "optionList", "choices"])

    has_q = bool(_norm_text(q))
    has_a = bool(_norm_text(a))
    has_ana = bool(_norm_text(ana))
    has_opts = isinstance(opts, list) and len(opts) > 0
    return has_q and (has_a or has_ana or has_opts)


def _format_options(raw: Any) -> str:
    if isinstance(raw, list):
        lines: list[str] = []
        for idx, item in enumerate(raw):
            if isinstance(item, dict):
                label = _norm_text(_get_first(item, ["name", "key", "label", "option", "index"]))
                content = _norm_text(_get_first(item, ["content", "text", "desc", "value", "optionContent"]))
                if not label and idx < 26:
                    label = chr(ord("A") + idx)
                row = f"{label}. {content}".strip()
                lines.append(row)
            else:
                lines.append(_norm_text(item))
        return "\n".join(x for x in lines if x)
    return _norm_text(raw)


def _extract_questions(data: Any) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen: set[str] = set()

    for d in _flatten_dict_nodes(data):
        if not _looks_like_question_record(d):
            continue
        key = _norm_text(_get_first(d, ["id", "questionId", "quizId", "key"]))
        question = _norm_text(
            _get_first(
                d,
                [
                    "question",
                    "stem",
                    "questionStem",
                    "questionContent",
                    "content",
                    "title",
                    "prompt",
                ],
            )
        )
        if not key:
            key = question[:80]
        if not key or key in seen:
            continue
        seen.add(key)

        answer = _norm_text(_get_first(d, ["answer", "correctAnswer", "rightAnswer", "answers", "rightAnswers"]))
        analysis = _norm_text(
            _get_first(d, ["analysis", "solution", "explanation", "answerExplain", "answerAnalysis", "解析"])
        )

        records.append(
            {
                "questionId": _norm_text(_get_first(d, ["id", "questionId", "quizId", "key"])),
                "type": _norm_text(
                    _get_first(
                        d,
                        [
                            "type",
                            "typeName",
                            "category",
                            "categoryName",
                            "moduleName",
                            "subjectName",
                            "questionTypeName",
                        ],
                    )
                ),
                "subtype": _norm_text(_get_first(d, ["subtype", "subType", "bizTypeName", "pointName"])),
                "question": question,
                "options": _format_options(_get_first(d, ["options", "optionList", "choices"])),
                "answer": answer,
                "analysis": analysis,
                "raw": d,
            }
        )

    return records


def _to_backup(records: list[dict[str, Any]], source: str) -> dict[str, Any]:
    errors: list[dict[str, Any]] = []
    today = date.today().isoformat()
    for idx, item in enumerate(records, start=1):
        analysis = item.get("analysis") or ""
        if not analysis:
            analysis = "来源字段未命中，已保留 raw 供二次映射。"

        errors.append(
            {
                "id": idx,
                "addDate": today,
                "type": item.get("type") or "未分类",
                "subtype": item.get("subtype") or "未分类",
                "subSubtype": "",
                "question": item.get("question") or "",
                "options": item.get("options") or "",
                "answer": item.get("answer") or "",
                "myAnswer": "",
                "rootReason": "",
                "errorReason": "",
                "analysis": analysis,
                "status": "focus",
                "difficulty": 0,
                "imgData": None,
                "analysisImgData": None,
                "srcYear": "",
                "srcProvince": "",
                "srcOrigin": source,
                "quiz": None,
                "meta": {
                    "questionId": item.get("questionId") or "",
                    "raw": item.get("raw") or {},
                },
            }
        )

    return {
        "xc_version": 2,
        "exportTime": datetime.now().isoformat(timespec="seconds"),
        "errors": errors,
        "revealed": [],
        "expTypes": [],
        "expMain": [],
        "expMainSub": [],
        "expMainSub2": [],
        "notesByType": {},
        "noteImages": {},
        "typeRules": None,
        "dirTree": None,
        "globalNote": f"Imported from fenbi on {today}",
        "knowledgeTree": None,
        "knowledgeNotes": {},
        "knowledgeExpanded": [],
        "todayDate": "",
        "todayDone": 0,
        "history": [],
    }


def _http_get_json(url: str, cookie: str | None = None) -> Any:
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json, text/plain, */*",
    }
    if cookie:
        headers["Cookie"] = cookie

    req = Request(url=url, method="GET", headers=headers)
    with urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    return json.loads(raw)


def build_solution_url(key: str, routecs: str, fmt: str = "json") -> str:
    query = {
        "format": fmt,
        "key": key,
        "routecs": routecs,
    }
    query.update(DEFAULT_QUERY)
    return f"{API_BASE}/exercise/getSolution?{urlencode(query)}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Fenbi solution and export xingce backup JSON.")
    parser.add_argument("--key", required=True, help="Fenbi exercise key, e.g. 1_1_3l4gahr")
    parser.add_argument("--routecs", default="xingce", help="routecs value")
    parser.add_argument("--cookie", default="", help="Fenbi cookie string from logged-in browser")
    parser.add_argument(
        "--output",
        default=str(Path(__file__).resolve().parents[1] / "output" / "fenbi_xingce_backup.json"),
        help="Output backup JSON path",
    )
    parser.add_argument(
        "--raw-output",
        default=str(Path(__file__).resolve().parents[1] / "output" / "fenbi_solution_raw.json"),
        help="Save raw API payload for mapping review",
    )
    args = parser.parse_args()

    url = build_solution_url(args.key, args.routecs, "json")

    try:
        payload = _http_get_json(url, args.cookie or None)
    except Exception as exc:
        raise SystemExit(f"Request failed: {exc}")

    Path(args.raw_output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.raw_output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    if isinstance(payload, dict) and payload.get("code") not in (None, 0):
        raise SystemExit(f"API returned non-zero code: {payload.get('code')} msg={payload.get('msg')}")

    data = payload.get("data") if isinstance(payload, dict) else payload
    records = _extract_questions(data)
    if not records:
        raise SystemExit(
            "No question records extracted. Check cookie/login and inspect raw payload for field mapping."
        )

    backup = _to_backup(records, source=f"fenbi::{args.key}")
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Fetched: {len(records)} questions")
    print(f"Raw payload: {Path(args.raw_output)}")
    print(f"Backup JSON: {output_path}")


if __name__ == "__main__":
    main()
