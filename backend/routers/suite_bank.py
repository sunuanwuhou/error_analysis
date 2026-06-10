from __future__ import annotations

import html
import json
import re
from urllib.parse import quote
from typing import Any, Optional

from fastapi import APIRouter, Cookie, HTTPException, Query
from fastapi.responses import HTMLResponse

from backend.core import require_module, require_user
from backend.schemas import BankDrillStartPayload, SuitePracticeRecordPayload
from backend.services.suite_bank_drill import (
    BANK_DRILL_PAPER_ID,
    DRILL_HISTORY_SOURCE_EXPORT,
    DRILL_HISTORY_SOURCE_PRACTICE,
    EXAM_TRACK_PROVINCIAL,
    bank_drill_meta,
    bank_drill_start,
    create_bank_drill_export_record,
    delete_bank_drill_export_record,
    clear_bank_drill_history,
    default_year_list,
    fetch_questions_by_ids,
    get_bank_drill_export_record,
    list_bank_drill_export_records,
    mark_bank_drill_questions_used,
    validate_drill_submit,
)
from backend.services.suite_bank_service import (
    SUITE_PRACTICE_SUBTYPE_MODULE,
    SUITE_PRACTICE_SUBTYPE_PAPER,
    SUITE_RECORD_STATUS_COMPLETED,
    SUITE_RECORD_STATUS_IN_PROGRESS,
    append_suite_practice_record,
    get_paper_questions,
    list_papers,
    list_suite_practice_records,
    search_suite_papers,
    search_suite_questions,
    upsert_suite_practice_record,
)

router = APIRouter()

_DATA_IMG_RE = re.compile(
    r'<img\b[^>]*\bsrc\s*=\s*["\'](data:image/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+)["\'][^>]*\/?>',
    re.IGNORECASE,
)


def _session_user_id(xingce_session: Optional[str]) -> str:
    return str(require_module(xingce_session, "xingce_suite")["id"])


def _session_user_id_bank_drill(xingce_session: Optional[str]) -> str:
    """模块随机练：拥有「套卷模块练」或「套卷全库」任一权限即可."""
    user = require_user(xingce_session)
    modules = user.get("modules") or []
    if "xingce_bank_drill" in modules or "xingce_suite" in modules:
        return str(user["id"])
    raise HTTPException(status_code=403, detail="module_forbidden")


def _session_user_id_for_practice_payload(
    xingce_session: Optional[str],
    body: SuitePracticeRecordPayload,
) -> str:
    subtype = (body.practice_subtype or "").strip()
    if subtype == SUITE_PRACTICE_SUBTYPE_MODULE or body.paper_id.strip() == BANK_DRILL_PAPER_ID:
        return _session_user_id_bank_drill(xingce_session)
    return _session_user_id(xingce_session)


def _ensure_bank_drill_payload(body: SuitePracticeRecordPayload) -> None:
    subtype = (body.practice_subtype or "").strip()
    if subtype and subtype != SUITE_PRACTICE_SUBTYPE_MODULE:
        return
    if body.paper_id.strip() != BANK_DRILL_PAPER_ID and subtype != SUITE_PRACTICE_SUBTYPE_MODULE:
        return
    if body.paper_id.strip() != BANK_DRILL_PAPER_ID:
        raise HTTPException(status_code=400, detail="bank drill requires paper_id __bank_drill__")
    yt = body.bank_drill_exam_track or ""
    ys = body.bank_drill_years or []
    mod = body.bank_drill_major_module or ""
    if not yt or not ys or not mod:
        raise HTTPException(status_code=400, detail="bank drill missing track/years/module")
    status = (body.record_status or SUITE_RECORD_STATUS_COMPLETED).strip()
    if status == SUITE_RECORD_STATUS_IN_PROGRESS:
        return
    qids = [str(it.question_id) for it in body.items if str(it.question_id or "").strip()]
    if not qids:
        return
    _rows, err = validate_drill_submit(exam_track=yt, years=ys, major_module=mod, question_ids=qids)
    if err:
        raise HTTPException(status_code=400, detail=err)


def _render_rich_html(raw: str) -> str:
    text = str(raw or "")
    parts = _DATA_IMG_RE.split(text)
    out: list[str] = []
    for idx, part in enumerate(parts):
        if idx % 2 == 1:
            out.append(f'<img class="print-inline-img" alt="" src="{part}" />')
            continue
        escaped = html.escape(part).replace("\n", "<br/>")
        escaped = re.sub(r"[_＿]{3,}", '<span class="print-blank"></span>', escaped)
        out.append(escaped)
    return "".join(out)


def _option_lines(raw: str) -> list[str]:
    return [item.strip() for item in re.split(r"\n|\|", str(raw or "").strip()) if item.strip()]


def _option_letter(line: str, idx: int) -> str:
    plain = re.sub(r"<[^>]+>", "", str(line or "")).strip()
    m = re.match(r"^([A-Da-d])", plain)
    if m:
        return str(m.group(1)).upper()
    return chr(65 + idx)


def _normalize_export_shared_material(raw: str) -> str:
    return re.sub(r"\s+", " ", str(raw or "").strip())


def _group_export_questions(question_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups_by_mod: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for q in question_rows:
        mod = str(q.get("major_module") or "").strip()
        label = str(q.get("major_module_label") or mod or "题目")
        if mod not in groups_by_mod:
            groups_by_mod[mod] = {
                "major_module": mod,
                "major_module_label": label,
                "questions": [],
            }
            order.append(mod)
        groups_by_mod[mod]["questions"].append(q)
    return [groups_by_mod[mid] for mid in order]


def _render_bank_drill_export_html(
    *,
    title_text: str,
    file_name: str,
    track_label: str,
    years: list[int],
    count: int,
    groups: list[dict[str, Any]],
    now_text: Any,
) -> HTMLResponse:
    question_no = 1
    body_parts: list[str] = []
    answer_parts: list[str] = []
    for group in groups:
        prev_shared_material_norm = ""
        body_parts.append(f'<section class="print-group"><h2 class="print-group-title">{html.escape(str(group.get("major_module_label") or ""))}</h2>')
        for q in group.get("questions") or []:
            meta = q.get("meta") or {}
            section_heading = str(meta.get("section_heading") or "").strip()
            shared_material = str(meta.get("shared_material") or "").strip()
            shared_material_norm = _normalize_export_shared_material(shared_material)
            body_parts.append('<section class="print-question">')
            body_parts.append('<div class="print-q-head">')
            body_parts.append(f'<span class="print-q-no">第 {question_no} 题</span>')
            body_parts.append(f'<span class="print-q-module">{html.escape(str(group.get("major_module_label") or ""))}</span>')
            if section_heading:
                body_parts.append(f'<span class="print-q-section">{html.escape(section_heading)}</span>')
            body_parts.append('</div>')
            if shared_material:
                if shared_material_norm and shared_material_norm == prev_shared_material_norm:
                    body_parts.append('<div class="print-material print-material-repeat">')
                    body_parts.append('<div class="print-material-label">给定资料</div>')
                    body_parts.append('<div class="print-material-repeat-text">沿用上题给定资料</div></div>')
                else:
                    body_parts.append('<div class="print-material"><div class="print-material-label">给定资料</div>')
                    body_parts.append(f'<div class="print-rich">{_render_rich_html(shared_material)}</div></div>')
                    prev_shared_material_norm = shared_material_norm
            img_data = str(q.get("img_data") or "").strip()
            if img_data:
                src = img_data if img_data.startswith("data:") else f"data:image/png;base64,{img_data}"
                body_parts.append(f'<img class="print-stem-img" src="{src}" alt="题干插图" />')
            body_parts.append(f'<div class="print-stem print-rich">{_render_rich_html(str(q.get("stem") or ""))}</div>')
            option_lines = _option_lines(str(q.get("options") or ""))
            if option_lines:
                body_parts.append('<div class="print-options">')
                for oi, line in enumerate(option_lines):
                    body_parts.append('<div class="print-option">')
                    body_parts.append(f'<span class="print-option-letter">{_option_letter(line, oi)}.</span>')
                    body_parts.append(f'<span class="print-option-text">{_render_rich_html(line)}</span>')
                    body_parts.append('</div>')
                body_parts.append('</div>')
            body_parts.append('</section>')
            answer_parts.append(
                f'<div class="print-answer-item"><span>第 {question_no} 题</span><strong>{html.escape(str(q.get("answer") or "—"))}</strong></div>'
            )
            question_no += 1
        body_parts.append('</section>')

    html_doc = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{html.escape(file_name)}</title>
  <style>
    body {{ max-width: 860px; margin: 0 auto; padding: 24px 20px 48px; color: #0f172a; font-family: 'PingFang SC','Microsoft YaHei',system-ui,sans-serif; }}
    .print-head {{ margin-bottom: 20px; border-bottom: 2px solid #cbd5e1; padding-bottom: 14px; }}
    .print-head h1 {{ margin: 0 0 12px; font-size: 28px; }}
    .print-meta {{ display:flex; flex-wrap:wrap; gap:8px 18px; font-size:13px; color:#475569; }}
    .print-body {{ display:flex; flex-direction:column; gap:18px; }}
    .print-group {{ display:flex; flex-direction:column; gap:14px; }}
    .print-group-title {{ margin:4px 0 0; font-size:22px; }}
    .print-question {{ break-inside:avoid; page-break-inside:avoid; border:1px solid #e2e8f0; border-radius:14px; padding:16px; background:#fff; }}
    .print-q-head {{ display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:10px; }}
    .print-q-no {{ font-size:17px; font-weight:800; }}
    .print-q-module {{ font-size:12px; color:#075985; background:#e0f2fe; border:1px solid #bae6fd; border-radius:999px; padding:3px 10px; }}
    .print-q-section {{ font-size:12px; color:#3730a3; background:#eef2ff; border:1px solid #c7d2fe; border-radius:999px; padding:3px 10px; }}
    .print-material {{ margin-bottom:12px; padding:12px; border:1px solid #cbd5e1; border-radius:12px; background:#f8fafc; }}
    .print-material-label {{ font-size:12px; font-weight:700; color:#334155; margin-bottom:8px; }}
    .print-material-repeat {{ background:#f8fafc; border-style:dashed; }}
    .print-material-repeat-text {{ color:#64748b; font-size:13px; }}
    .print-stem-img, .print-inline-img {{ max-width:100%; height:auto; display:block; }}
    .print-stem-img {{ margin-bottom:12px; }}
    .print-stem {{ font-size:15px; line-height:1.8; margin-bottom:12px; }}
    .print-rich {{ line-height:1.8; word-break:break-word; }}
    .print-blank {{ display:inline-block; min-width:4.5em; border-bottom:1.6px solid #0f172a; margin:0 4px; vertical-align:baseline; }}
    .print-options {{ display:flex; flex-direction:column; gap:8px; }}
    .print-option {{ display:flex; gap:8px; align-items:flex-start; line-height:1.7; }}
    .print-option-letter {{ min-width:22px; font-weight:700; }}
    .print-option-text {{ flex:1; }}
    .print-answer-sheet {{ margin-top:8px; break-before:page; page-break-before:always; border:1px solid #cbd5e1; border-radius:16px; padding:20px; background:#fff; }}
    .print-answer-sheet h2 {{ margin:0 0 14px; font-size:22px; }}
    .print-answer-grid {{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px 14px; }}
    .print-answer-item {{ display:flex; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid #e2e8f0; border-radius:10px; background:#f8fafc; font-size:14px; }}
    @media print {{ body {{ max-width:none; padding:0; }} .print-question, .print-answer-sheet {{ box-shadow:none; }} }}
  </style>
</head>
<body>
  <header class="print-head">
    <h1>{html.escape(title_text)}</h1>
    <div class="print-meta">
      <span>考试类型：{html.escape(track_label)}</span>
      <span>年份：{"、".join(str(y) for y in years)}</span>
      <span>每题型题量：{int(count)}</span>
      <span>总题量：{question_no - 1}</span>
      <span>导出标记：{html.escape(str(now_text))}</span>
      <span>文件名：{html.escape(file_name)}</span>
    </div>
  </header>
  <main class="print-body">
    {"".join(body_parts)}
    <section class="print-answer-sheet">
      <h2>参考答案</h2>
      <div class="print-answer-grid">
        {"".join(answer_parts)}
      </div>
    </section>
  </main>
  <script>window.setTimeout(function(){{ document.title={json.dumps(file_name, ensure_ascii=False)}; window.print(); }}, 120);</script>
</body>
</html>"""
    return HTMLResponse(
        html_doc,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(file_name)}",
        },
    )


@router.get("/api/suite-bank/bank-drill/meta")
def api_suite_bank_bank_drill_meta(
    exam_track: str = Query(..., description="provincial | unified"),
    years: Optional[list[int]] = Query(None),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    uid = _session_user_id_bank_drill(xingce_session)
    ys = years if years else default_year_list()
    try:
        return bank_drill_meta(user_id=uid, exam_track=exam_track.strip(), years=ys)
    except ValueError as ex:
        raise HTTPException(status_code=400, detail=str(ex)) from ex


@router.post("/api/suite-bank/bank-drill/start")
def api_suite_bank_bank_drill_start(
    body: BankDrillStartPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    uid = _session_user_id_bank_drill(xingce_session)
    ys = body.years if body.years else default_year_list()
    try:
        return bank_drill_start(
            user_id=uid,
            exam_track=body.exam_track.strip(),
            years=ys,
            major_module=body.major_module.strip(),
            count=int(body.count),
        )
    except ValueError as ex:
        raise HTTPException(status_code=400, detail=str(ex)) from ex


@router.get("/api/suite-bank/bank-drill/export-print", response_class=HTMLResponse)
def api_suite_bank_bank_drill_export_print(
    exam_track: str = Query(..., description="provincial | unified"),
    years: str = Query("", description="comma-separated years"),
    count: int = Query(10, ge=1, le=80),
    modules: str = Query("", description="comma-separated module ids"),
    xingce_session: Optional[str] = Cookie(default=None),
) -> HTMLResponse:
    uid = _session_user_id_bank_drill(xingce_session)
    ys = [int(item.strip()) for item in str(years or "").split(",") if item.strip().isdigit()]
    if not ys:
        ys = default_year_list()
    module_ids = [item.strip() for item in str(modules or "").split(",") if item.strip()]
    if not module_ids:
        raise HTTPException(status_code=400, detail="modules required")

    groups: list[dict[str, Any]] = []
    exported_ids: list[str] = []
    for module_id in module_ids:
        res = bank_drill_start(
            user_id=uid,
            exam_track=exam_track.strip(),
            years=ys,
            major_module=module_id,
            count=int(count),
        )
        if res.get("questions"):
            groups.append(res)
            exported_ids.extend(str(q.get("id") or "").strip() for q in (res.get("questions") or []))

    if not groups:
        raise HTTPException(status_code=400, detail="no exportable questions")

    track_label = "省考" if exam_track.strip() == EXAM_TRACK_PROVINCIAL else "统考"
    now_text = bank_drill_meta(user_id=uid, exam_track=exam_track.strip(), years=ys).get("calendar_year")
    export_record = create_bank_drill_export_record(
        uid,
        exam_track=exam_track.strip(),
        years=ys,
        modules=[str(group.get("major_module") or "").strip() for group in groups],
        count=int(count),
        question_ids=exported_ids,
        title_text="、".join(str(group.get("major_module_label") or "").strip() for group in groups if str(group.get("major_module_label") or "").strip()),
    )
    if exported_ids:
        for group in groups:
            mark_bank_drill_questions_used(
                uid,
                question_ids=[str(q.get("id") or "").strip() for q in (group.get("questions") or [])],
                source_type=DRILL_HISTORY_SOURCE_EXPORT,
                exam_track=exam_track.strip(),
                major_module=str(group.get("major_module") or ""),
                years=ys,
            )
    return _render_bank_drill_export_html(
        title_text="今日练习导出",
        file_name=str(export_record.get("file_name") or "export.pdf"),
        track_label=track_label,
        years=ys,
        count=int(count),
        groups=groups,
        now_text=now_text,
    )


@router.post("/api/suite-bank/bank-drill/history/reset")
def api_suite_bank_bank_drill_history_reset(
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    uid = _session_user_id_bank_drill(xingce_session)
    cleared = clear_bank_drill_history(uid)
    return {"ok": True, "cleared_count": cleared}


@router.get("/api/suite-bank/bank-drill/exports")
def api_suite_bank_bank_drill_exports(
    limit: int = Query(50, ge=1, le=200),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    uid = _session_user_id_bank_drill(xingce_session)
    return {"items": list_bank_drill_export_records(uid, limit=limit)}


@router.get("/api/suite-bank/bank-drill/exports/{export_id}/print", response_class=HTMLResponse)
def api_suite_bank_bank_drill_export_reprint(
    export_id: str,
    xingce_session: Optional[str] = Cookie(default=None),
) -> HTMLResponse:
    uid = _session_user_id_bank_drill(xingce_session)
    rec = get_bank_drill_export_record(uid, export_id)
    if not rec:
        raise HTTPException(status_code=404, detail="export record not found")
    rows = fetch_questions_by_ids(rec.get("question_ids") or [])
    if not rows:
        raise HTTPException(status_code=404, detail="export questions not found")
    for row in rows:
        mod = str(row.get("major_module") or "").strip()
        row["major_module_label"] = {
            "verbal": "言语理解",
            "quant": "数量关系",
            "reasoning": "判断推理",
            "materials": "资料分析",
            "common": "常识判断",
        }.get(mod, mod or "题目")
    track_raw = str(rec.get("exam_track") or "").strip()
    track_label = "省考" if track_raw == EXAM_TRACK_PROVINCIAL else "统考"
    return _render_bank_drill_export_html(
        title_text=str(rec.get("title_text") or "今日练习导出"),
        file_name=str(rec.get("file_name") or "export.pdf"),
        track_label=track_label,
        years=rec.get("years") or [],
        count=int(rec.get("count") or 0),
        groups=_group_export_questions(rows),
        now_text=rec.get("created_at") or "",
    )


@router.delete("/api/suite-bank/bank-drill/exports/{export_id}")
def api_suite_bank_bank_drill_export_delete(
    export_id: str,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    uid = _session_user_id_bank_drill(xingce_session)
    ok = delete_bank_drill_export_record(uid, export_id)
    if not ok:
        raise HTTPException(status_code=404, detail="export record not found")
    return {"ok": True}


@router.get("/api/suite-bank/papers")
def api_suite_bank_papers(xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    _session_user_id(xingce_session)
    return {"papers": list_papers()}


@router.get("/api/suite-bank/papers/{paper_id}")
def api_suite_bank_paper_detail(paper_id: str, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    _session_user_id(xingce_session)
    row = get_paper_questions(paper_id)
    if not row:
        raise HTTPException(status_code=404, detail="paper not found")
    return row


@router.get("/api/suite-bank/search")
def api_suite_bank_search(
    q: str = Query("", description="关键词，空格分割 AND"),
    limit: int = Query(80, ge=1, le=200),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    _session_user_id(xingce_session)
    paper_lim = max(1, min(limit // 2 + 20, 60))
    return {
        "items": search_suite_questions(q, limit=limit),
        "papers": search_suite_papers(q, limit=paper_lim),
    }


@router.post("/api/suite-bank/practice-records")
def api_suite_bank_practice_record_post(
    body: SuitePracticeRecordPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    uid = _session_user_id_for_practice_payload(xingce_session, body)
    _ensure_bank_drill_payload(body)
    rid = append_suite_practice_record(uid, body=body.model_dump())
    if body.paper_id.strip() == BANK_DRILL_PAPER_ID:
        mark_bank_drill_questions_used(
            uid,
            question_ids=[str(it.question_id or "").strip() for it in body.items],
            source_type=DRILL_HISTORY_SOURCE_PRACTICE,
            exam_track=str(body.bank_drill_exam_track or "").strip(),
            major_module=str(body.bank_drill_major_module or "").strip(),
            years=body.bank_drill_years or [],
        )
    return {"id": rid, "ok": True}


@router.put("/api/suite-bank/practice-records/sync")
def api_suite_bank_practice_record_sync(
    body: SuitePracticeRecordPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    """定时云端同步：须带 client_session_id；进行中可不交卷."""
    uid = _session_user_id_for_practice_payload(xingce_session, body)
    if not str(body.client_session_id or "").strip():
        raise HTTPException(status_code=400, detail="client_session_id required")
    _ensure_bank_drill_payload(body)
    rid = upsert_suite_practice_record(uid, body=body.model_dump())
    if body.paper_id.strip() == BANK_DRILL_PAPER_ID:
        mark_bank_drill_questions_used(
            uid,
            question_ids=[str(it.question_id or "").strip() for it in body.items],
            source_type=DRILL_HISTORY_SOURCE_PRACTICE,
            exam_track=str(body.bank_drill_exam_track or "").strip(),
            major_module=str(body.bank_drill_major_module or "").strip(),
            years=body.bank_drill_years or [],
        )
    return {"id": rid, "ok": True}


@router.get("/api/suite-bank/practice-records")
def api_suite_bank_practice_record_list(
    limit: int = Query(40, ge=1, le=200),
    paper_id: str = Query("", description="只看某套卷"),
    practice_subtype: str = Query(
        "",
        description="paper_exam | bank_module_drill，空=全部",
    ),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    st = practice_subtype.strip() or None
    if st and st not in (SUITE_PRACTICE_SUBTYPE_PAPER, SUITE_PRACTICE_SUBTYPE_MODULE):
        raise HTTPException(status_code=400, detail="invalid practice_subtype")
    if st == SUITE_PRACTICE_SUBTYPE_MODULE:
        uid = _session_user_id_bank_drill(xingce_session)
    else:
        uid = _session_user_id(xingce_session)
    pid = paper_id.strip() or None
    rows = list_suite_practice_records(uid, limit=limit, paper_id=pid, practice_subtype=st)
    return {"records": rows}
