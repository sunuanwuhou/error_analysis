"""广东套卷题库 — 按模块随机练习（省考/统考 + 自然年范围）."""

from __future__ import annotations

import json
import logging
import uuid
import re
from datetime import UTC, datetime
from typing import Any

from backend.database import get_conn

_LOGGER = logging.getLogger(__name__)

REGION_GUANGDONG = "guangdong"
EXAM_TRACK_PROVINCIAL = "provincial"
EXAM_TRACK_UNIFIED = "unified"

# 五大模块（slug）
MAJOR_VERBAL = "verbal"
MAJOR_QUANT = "quant"
MAJOR_REASONING = "reasoning"
MAJOR_MATERIALS = "materials"
MAJOR_COMMON = "common"

MAJOR_MODULE_IDS: tuple[str, ...] = (
    MAJOR_VERBAL,
    MAJOR_QUANT,
    MAJOR_REASONING,
    MAJOR_MATERIALS,
    MAJOR_COMMON,
)

MAJOR_MODULE_LABELS: dict[str, str] = {
    MAJOR_VERBAL: "言语理解",
    MAJOR_QUANT: "数量关系",
    MAJOR_REASONING: "判断推理",
    MAJOR_MATERIALS: "资料分析",
    MAJOR_COMMON: "常识判断",
}

# 与版块横幅一致的写法（答题卡 `SuiteBankPage` 按 meta.section_heading 分段）
CANON_SECTION_HEADING_BY_MODULE: dict[str, str] = {
    MAJOR_VERBAL: "言语理解与表达",
    MAJOR_QUANT: "数量关系",
    MAJOR_REASONING: "判断推理",
    MAJOR_MATERIALS: "资料分析",
    MAJOR_COMMON: "常识判断",
}

BANK_DRILL_PAPER_ID = "__bank_drill__"
DRILL_HISTORY_SOURCE_EXPORT = "export"
DRILL_HISTORY_SOURCE_PRACTICE = "practice"

_YEAR_RE = re.compile(r"(20\d{2}|19\d{2})")


def utc_calendar_year() -> int:
    return datetime.now(tz=UTC).year


def default_year_list(*, calendar_year: int | None = None) -> list[int]:
    """方案 A：连续 5 个自然年（含当前年）."""
    y = int(calendar_year if calendar_year is not None else utc_calendar_year())
    return [y - 4 + i for i in range(5)]


def _normalize_years_for_history(years: list[int]) -> list[int]:
    return sorted({int(y) for y in years if 1990 <= int(y) <= 2100})


def _sanitize_export_file_part(raw: str) -> str:
    text = re.sub(r'[\\/:*?"<>|]+', " ", str(raw or "").strip())
    text = re.sub(r"\s+", " ", text).strip()
    return text or "题目"


def build_bank_drill_export_file_name(*, years: list[int], title_text: str, at: datetime | None = None) -> str:
    dt = at if at is not None else datetime.now()
    years_part = "、".join(str(y) for y in _normalize_years_for_history(years)) or "未选年份"
    time_part = dt.strftime("%H-%M-%S")
    title_part = _sanitize_export_file_part(title_text)
    return f"{years_part}——{time_part}——{title_part}.pdf"


def infer_region(folder: str, source_rel_path: str) -> str:
    blob = f"{folder or ''}\u0000{source_rel_path or ''}"
    return REGION_GUANGDONG if "广东" in blob else ""


def infer_exam_track(folder: str, source_rel_path: str, title: str) -> str:
    blob = f"{folder or ''}\u0000{source_rel_path or ''}\u0000{title or ''}"
    if "统考" in blob:
        return EXAM_TRACK_UNIFIED
    if "省考" in blob:
        return EXAM_TRACK_PROVINCIAL
    return ""


def infer_exam_year(title: str, source_rel_path: str, folder: str) -> int | None:
    for s in (title or "", source_rel_path or "", folder or ""):
        m = _YEAR_RE.search(s)
        if m:
            y = int(m.group(1))
            if 1990 <= y <= 2100:
                return y
    return None


def major_module_from_import_section(sec: str) -> str:
    """由 `meta.section_heading`（Word 导入时 `map_question_section_headings` 写入）映射五大模块。"""
    s = (sec or "").strip()
    if not s:
        return ""
    if s.startswith("言语") or "言语理解与表达" in s:
        return MAJOR_VERBAL
    if s in ("数量关系", "数字推理", "数学运算", "数理能力"):
        return MAJOR_QUANT
    if s == "判断推理" or s in ("图形推理", "定义判断", "类比推理", "逻辑判断"):
        return MAJOR_REASONING
    if s == "资料分析" or s.startswith("资料"):
        return MAJOR_MATERIALS
    if s.startswith("常识") or s == "常识知识":
        return MAJOR_COMMON
    return ""


def infer_major_module_from_texts(
    *,
    section_heading: str,
    type_label: str,
    stem_label: str,
) -> str:
    """归类策略：资料字面 → 【小题标签】纠错 → 套卷篇章横幅 → 考点回填。**不使用题干猜模块**。"""
    sec = (section_heading or "").strip()
    tl = (type_label or "").strip()
    lab = (stem_label or "").strip()

    # --- 资料分析 ---
    if "资料分析" in sec or "资料分析" in tl or "资料分析" in lab:
        return MAJOR_MATERIALS

    # --- 【标签】优先于横幅（横幅偶尔串台时粉笔题型更可信）---
    if any(m in lab for m in ("数学运算", "数字推理", "数量关系")):
        return MAJOR_QUANT
    if any(m in lab for m in ("图形推理", "定义判断", "类比推理", "逻辑判断")):
        return MAJOR_REASONING
    if any(m in lab for m in ("逻辑填空", "片段阅读", "语句表达", "语句排序", "标题填入", "接语选择", "词句理解")):
        return MAJOR_VERBAL

    # --- 考点 / 粉笔题型标签：优先于篇章横幅（横幅常停在「言语理解与表达」导致数量整段串台）---
    _quant_tl = (
        "数学运算",
        "数字推理",
        "数量关系",
        "不定方程",
        "行程问题",
        "工程问题",
        "利润问题",
        "浓度问题",
        "排列组合",
        "几何问题",
        "统筹规划",
        "统筹",
        "星期日期",
        "年龄问题",
        "容斥原理",
        "牛吃草",
        "钟表问题",
        "溶液",
        "最值问题",
        "最值",
        "倍数特性",
        "整除",
        "比例计算",
    )
    # 子串匹配：覆盖 Fenbi `type_label` 常见命名（含逗号拼接的多标签）
    _quant_tl_fragments = (
        "数列问题",
        "基础数列",
        "递推数列",
        "多级数列",
        "多重数列",
        "分数数列",
        "幂次数列",
        "机械划分",
        "图形数阵",
        "因数分解数列",
        "因数分解",
        "和差倍比",
        "相遇追及",
        "普通行程",
        "火车过桥",
        "流水行船",
        "环形跑道",
        "平面几何",
        "立体几何",
        "几何结论",
        "几何公式",
        "两集合",
        "三集合",
        "多集合反向构造",
        "植树问题",
        "平均数问题",
        "给具体单位型",
        "给完工时间型",
        "给效率比例型",
        "给情况求概率",
        "给概率求概率",
        "赋值法",
        "代入排除法",
        "代入排除",
        "比例法",
        "最不利构造",
        "不相邻问题",
        "相邻问题",
        "错位排列",
        "构造数列",
        "比赛问题",
        "计数模型问题",
        "方阵问题",
        "周期余数问题",
        "周期余数",
        "余数和同余问题",
        "余数和同余",
        "公约数问题",
        "公倍数与公约数",
        "多位数问题",
        "分段计算问题",
        "分段计算",
        "盈亏法",
        "枚举法",
        "计算问题",
        "作差",
        "作商",
        "作和",
    )
    if any(k in tl or k in lab for k in _quant_tl):
        return MAJOR_QUANT
    if any(k in tl or k in lab for k in _quant_tl_fragments):
        return MAJOR_QUANT

    if any(x in tl or x in lab for x in ("图形推理", "定义判断", "类比推理", "逻辑判断")):
        return MAJOR_REASONING

    _verbal_tl_early = (
        "片段阅读",
        "语句表达",
        "语句排序",
        "语句填空",
        "逻辑填空",
        "选词填空",
        "词语辨析",
        "标题填入",
        "接语选择",
        "阅读理解",
    )
    if any(k in tl for k in _verbal_tl_early):
        return MAJOR_VERBAL
    if "言语理解" in tl or "言语理解与表达" in tl:
        return MAJOR_VERBAL

    # --- 套卷篇章横幅（导入时已写入 meta.section_heading）---
    mapped = major_module_from_import_section(sec)
    if mapped:
        return mapped

    # --- 横幅仍为空 ---
    if (
        "常识判断" in tl
        or "政治理论" in tl
        or ("常识" in tl and not any(k in tl for k in _quant_tl))
    ):
        return MAJOR_COMMON

    if any(k in tl or k in lab for k in ("计算", "方程", "概率", "概率问题")):
        return MAJOR_QUANT

    return ""


def infer_major_module_for_question_row(
    meta: dict[str, Any],
    type_label: str,
    stem_label: str = "",
) -> str:
    sec = ""
    lab = stem_label
    if isinstance(meta, dict):
        raw = meta.get("section_heading")
        if isinstance(raw, str):
            sec = raw
        raw_l = meta.get("label")
        if isinstance(raw_l, str) and not lab:
            lab = raw_l
    return infer_major_module_from_texts(section_heading=sec, type_label=type_label, stem_label=lab)


def repair_question_meta_section_for_major_module(meta: dict[str, Any], mm: str) -> dict[str, Any]:
    """横幅与五大模块不一致时，按 `major_module` 校正 `meta.section_heading`（修复导入时横幅卡在上一段导致答题卡「言语」含数量）。"""
    if not isinstance(meta, dict):
        return {}
    out = dict(meta)
    canon = CANON_SECTION_HEADING_BY_MODULE.get(mm)
    if not canon:
        return out
    raw = out.get("section_heading")
    sec = raw.strip() if isinstance(raw, str) else ""
    mapped = major_module_from_import_section(sec)
    if mapped and mapped != mm:
        out["section_heading"] = canon
    return out


def migrate_suite_drill_columns() -> None:
    """追加 drill 用列并回填（幂等）。

    扫描 **全库** `suite_questions` / `suite_papers`，不按省份、年份过滤；
    同步回填 `major_module` 并校正 `meta_json.section_heading`（与答题卡分段一致）。
    """
    with get_conn() as conn:
        conn.execute("ALTER TABLE suite_papers ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT ''")
        conn.execute("ALTER TABLE suite_papers ADD COLUMN IF NOT EXISTS exam_track TEXT NOT NULL DEFAULT ''")
        conn.execute("ALTER TABLE suite_papers ADD COLUMN IF NOT EXISTS exam_year INTEGER NULL")
        conn.execute("ALTER TABLE suite_questions ADD COLUMN IF NOT EXISTS major_module TEXT NOT NULL DEFAULT ''")
        try:
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_suite_papers_drill
                ON suite_papers(region, exam_track, exam_year)
                """
            )
        except Exception as ex:
            _LOGGER.warning("suite_bank_drill: drill index suite_papers: %s", ex)
        try:
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_suite_questions_major_module
                ON suite_questions(major_module)
                WHERE major_module <> ''
                """
            )
        except Exception as ex:
            _LOGGER.warning("suite_bank_drill: drill index suite_questions: %s", ex)

        prow = conn.execute(
            "SELECT id, folder, source_rel_path, title FROM suite_papers",
        ).fetchall()
        for r in prow:
            d = dict(r)
            pid = str(d["id"])
            region = infer_region(str(d.get("folder") or ""), str(d.get("source_rel_path") or ""))
            track = infer_exam_track(
                str(d.get("folder") or ""),
                str(d.get("source_rel_path") or ""),
                str(d.get("title") or ""),
            )
            ey = infer_exam_year(
                str(d.get("title") or ""),
                str(d.get("source_rel_path") or ""),
                str(d.get("folder") or ""),
            )
            conn.execute(
                """
                UPDATE suite_papers
                SET region = %s, exam_track = %s, exam_year = %s
                WHERE id = %s
                  AND (region IS DISTINCT FROM %s OR exam_track IS DISTINCT FROM %s OR exam_year IS DISTINCT FROM %s)
                """,
                (region, track, ey, pid, region, track, ey),
            )

        qrows = conn.execute(
            """
            SELECT q.id, q.type_label, q.meta_json
            FROM suite_questions q
            """,
        ).fetchall()
        for r in qrows:
            d = dict(r)
            qid = str(d["id"])
            meta: dict[str, Any] = {}
            raw_m = d.get("meta_json")
            if raw_m:
                try:
                    meta = json.loads(str(raw_m))
                except json.JSONDecodeError:
                    meta = {}
            mm = infer_major_module_for_question_row(meta, str(d.get("type_label") or ""))
            meta_fixed = repair_question_meta_section_for_major_module(meta, mm)
            meta_out = json.dumps(meta_fixed, ensure_ascii=False)
            conn.execute(
                """
                UPDATE suite_questions SET major_module = %s, meta_json = %s
                WHERE id = %s
                  AND (major_module IS DISTINCT FROM %s OR meta_json IS DISTINCT FROM %s)
                """,
                (mm, meta_out, qid, mm, meta_out),
            )
        conn.commit()


def _iter_bank_drill_history_rows_from_practice_records(conn) -> list[tuple[str, str, str, str, list[int], str]]:
    rows = conn.execute(
        """
        SELECT user_id, created_at, updated_at, payload_json
        FROM suite_practice_records
        WHERE paper_id = %s OR practice_subtype = %s
        """,
        (BANK_DRILL_PAPER_ID, "bank_module_drill"),
    ).fetchall()
    out: list[tuple[str, str, str, str, list[int], str]] = []
    for row in rows:
        payload: dict[str, Any] = {}
        raw_payload = dict(row).get("payload_json")
        if raw_payload:
            try:
                payload = json.loads(str(raw_payload))
            except json.JSONDecodeError:
                payload = {}
        user_id = str(dict(row).get("user_id") or "").strip()
        track = str(payload.get("bank_drill_exam_track") or "").strip()
        mod = str(payload.get("bank_drill_major_module") or "").strip()
        if not user_id or not track or not mod:
            continue
        years = _normalize_years_for_history(payload.get("bank_drill_years") or [])
        used_at = str(dict(row).get("updated_at") or dict(row).get("created_at") or datetime.now(tz=UTC).isoformat())
        for item in payload.get("items") or []:
            if not isinstance(item, dict):
                continue
            qid = str(item.get("question_id") or "").strip()
            if not qid:
                continue
            out.append((user_id, qid, track, mod, years, used_at))
    return out


def mark_bank_drill_questions_used(
    user_id: str,
    *,
    question_ids: list[str],
    source_type: str,
    exam_track: str,
    major_module: str,
    years: list[int],
    used_at: str | None = None,
) -> int:
    qids = sorted({str(qid).strip() for qid in question_ids if str(qid).strip()})
    if not qids:
        return 0
    source = str(source_type or "").strip()
    if source not in (DRILL_HISTORY_SOURCE_EXPORT, DRILL_HISTORY_SOURCE_PRACTICE):
        raise ValueError("invalid source_type")
    track = str(exam_track or "").strip()
    mod = str(major_module or "").strip()
    stamp = str(used_at or datetime.now(tz=UTC).isoformat())
    years_json = json.dumps(_normalize_years_for_history(years), ensure_ascii=False)
    with get_conn() as conn:
        for qid in qids:
            conn.execute(
                """
                INSERT INTO suite_bank_drill_history (
                  user_id, question_id, first_source_type, last_source_type,
                  first_used_at, last_used_at, exam_track, major_module,
                  years_json, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, question_id) DO UPDATE SET
                  last_source_type = EXCLUDED.last_source_type,
                  last_used_at = EXCLUDED.last_used_at,
                  exam_track = EXCLUDED.exam_track,
                  major_module = EXCLUDED.major_module,
                  years_json = EXCLUDED.years_json,
                  updated_at = EXCLUDED.updated_at
                """,
                (user_id, qid, source, source, stamp, stamp, track, mod, years_json, stamp, stamp),
            )
        conn.commit()
    return len(qids)


def migrate_suite_drill_history() -> None:
    with get_conn() as conn:
        conn.execute(
            "ALTER TABLE suite_bank_drill_history ADD COLUMN IF NOT EXISTS first_source_type TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_history ADD COLUMN IF NOT EXISTS last_source_type TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_history ADD COLUMN IF NOT EXISTS first_used_at TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_history ADD COLUMN IF NOT EXISTS last_used_at TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_history ADD COLUMN IF NOT EXISTS exam_track TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_history ADD COLUMN IF NOT EXISTS major_module TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_history ADD COLUMN IF NOT EXISTS years_json TEXT NOT NULL DEFAULT '[]'"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_history ADD COLUMN IF NOT EXISTS created_at TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_history ADD COLUMN IF NOT EXISTS updated_at TEXT NOT NULL DEFAULT ''"
        )
        try:
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_suite_drill_hist_user_time
                ON suite_bank_drill_history(user_id, updated_at DESC)
                """
            )
        except Exception as ex:
            _LOGGER.warning("suite_bank_drill: history index user_time: %s", ex)
        try:
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_suite_drill_hist_user_track_module
                ON suite_bank_drill_history(user_id, exam_track, major_module, updated_at DESC)
                """
            )
        except Exception as ex:
            _LOGGER.warning("suite_bank_drill: history index track_module: %s", ex)
        backfill_rows = _iter_bank_drill_history_rows_from_practice_records(conn)
        for user_id, qid, track, mod, years, used_at in backfill_rows:
            conn.execute(
                """
                INSERT INTO suite_bank_drill_history (
                  user_id, question_id, first_source_type, last_source_type,
                  first_used_at, last_used_at, exam_track, major_module,
                  years_json, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, question_id) DO UPDATE SET
                  last_source_type = CASE
                    WHEN suite_bank_drill_history.last_source_type = %s THEN suite_bank_drill_history.last_source_type
                    ELSE EXCLUDED.last_source_type
                  END,
                  last_used_at = GREATEST(
                    COALESCE(NULLIF(suite_bank_drill_history.last_used_at, ''), EXCLUDED.last_used_at),
                    EXCLUDED.last_used_at
                  ),
                  exam_track = CASE
                    WHEN suite_bank_drill_history.exam_track <> '' THEN suite_bank_drill_history.exam_track
                    ELSE EXCLUDED.exam_track
                  END,
                  major_module = CASE
                    WHEN suite_bank_drill_history.major_module <> '' THEN suite_bank_drill_history.major_module
                    ELSE EXCLUDED.major_module
                  END,
                  years_json = CASE
                    WHEN suite_bank_drill_history.years_json <> '[]' THEN suite_bank_drill_history.years_json
                    ELSE EXCLUDED.years_json
                  END,
                  updated_at = GREATEST(
                    COALESCE(NULLIF(suite_bank_drill_history.updated_at, ''), EXCLUDED.updated_at),
                    EXCLUDED.updated_at
                  )
                """,
                (
                    user_id,
                    qid,
                    DRILL_HISTORY_SOURCE_PRACTICE,
                    DRILL_HISTORY_SOURCE_PRACTICE,
                    used_at,
                    used_at,
                    track,
                    mod,
                    json.dumps(years, ensure_ascii=False),
                    used_at,
                    used_at,
                    DRILL_HISTORY_SOURCE_PRACTICE,
                ),
            )
        conn.commit()


def clear_bank_drill_history(user_id: str) -> int:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*)::int AS c FROM suite_bank_drill_history WHERE user_id = %s",
            (user_id,),
        ).fetchone()
        cleared = int(dict(row or {}).get("c") or 0)
        conn.execute("DELETE FROM suite_bank_drill_history WHERE user_id = %s", (user_id,))
        conn.commit()
    return cleared


def migrate_suite_drill_exports() -> None:
    with get_conn() as conn:
        conn.execute(
            "ALTER TABLE suite_bank_drill_exports ADD COLUMN IF NOT EXISTS file_name TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_exports ADD COLUMN IF NOT EXISTS exam_track TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_exports ADD COLUMN IF NOT EXISTS years_csv TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_exports ADD COLUMN IF NOT EXISTS modules_csv TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_exports ADD COLUMN IF NOT EXISTS count INTEGER NOT NULL DEFAULT 0"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_exports ADD COLUMN IF NOT EXISTS question_ids_json TEXT NOT NULL DEFAULT '[]'"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_exports ADD COLUMN IF NOT EXISTS title_text TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_exports ADD COLUMN IF NOT EXISTS created_at TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_bank_drill_exports ADD COLUMN IF NOT EXISTS updated_at TEXT NOT NULL DEFAULT ''"
        )
        try:
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_suite_drill_exports_user_time
                ON suite_bank_drill_exports(user_id, updated_at DESC)
                """
            )
        except Exception as ex:
            _LOGGER.warning("suite_bank_drill: exports index user_time: %s", ex)
        conn.commit()


def create_bank_drill_export_record(
    user_id: str,
    *,
    exam_track: str,
    years: list[int],
    modules: list[str],
    count: int,
    question_ids: list[str],
    title_text: str,
) -> dict[str, Any]:
    stamp = datetime.now()
    created_at = stamp.isoformat()
    export_id = "bde_" + uuid.uuid4().hex[:26]
    years_norm = _normalize_years_for_history(years)
    module_norm = [str(m).strip() for m in modules if str(m).strip()]
    title_norm = _sanitize_export_file_part(title_text)
    file_name = build_bank_drill_export_file_name(years=years_norm, title_text=title_norm, at=stamp)
    qids = [str(qid).strip() for qid in question_ids if str(qid).strip()]
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO suite_bank_drill_exports (
              id, user_id, file_name, exam_track, years_csv, modules_csv,
              count, question_ids_json, title_text, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                export_id,
                user_id,
                file_name,
                str(exam_track or "").strip(),
                ",".join(str(y) for y in years_norm),
                ",".join(module_norm),
                int(count),
                json.dumps(qids, ensure_ascii=False),
                title_norm,
                created_at,
                created_at,
            ),
        )
        conn.commit()
    return {
        "id": export_id,
        "file_name": file_name,
        "exam_track": str(exam_track or "").strip(),
        "years": years_norm,
        "modules": module_norm,
        "count": int(count),
        "question_ids": qids,
        "title_text": title_norm,
        "created_at": created_at,
        "updated_at": created_at,
    }


def _export_row_to_api(row: dict[str, Any]) -> dict[str, Any]:
    raw_qids = row.get("question_ids_json")
    question_ids: list[str] = []
    if raw_qids:
        try:
            parsed = json.loads(str(raw_qids))
            if isinstance(parsed, list):
                question_ids = [str(x).strip() for x in parsed if str(x).strip()]
        except json.JSONDecodeError:
            question_ids = []
    years = [int(x) for x in str(row.get("years_csv") or "").split(",") if str(x).strip().isdigit()]
    modules = [str(x).strip() for x in str(row.get("modules_csv") or "").split(",") if str(x).strip()]
    return {
        "id": str(row.get("id") or ""),
        "file_name": str(row.get("file_name") or ""),
        "exam_track": str(row.get("exam_track") or ""),
        "years": years,
        "modules": modules,
        "count": int(row.get("count") or 0),
        "question_ids": question_ids,
        "title_text": str(row.get("title_text") or ""),
        "created_at": str(row.get("created_at") or ""),
        "updated_at": str(row.get("updated_at") or ""),
    }


def list_bank_drill_export_records(user_id: str, *, limit: int = 50) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), 200))
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, file_name, exam_track, years_csv, modules_csv, count,
                   question_ids_json, title_text, created_at, updated_at
            FROM suite_bank_drill_exports
            WHERE user_id = %s
            ORDER BY updated_at DESC, created_at DESC
            LIMIT %s
            """,
            (user_id, lim),
        ).fetchall()
    return [_export_row_to_api(dict(row)) for row in rows]


def get_bank_drill_export_record(user_id: str, export_id: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, file_name, exam_track, years_csv, modules_csv, count,
                   question_ids_json, title_text, created_at, updated_at
            FROM suite_bank_drill_exports
            WHERE user_id = %s AND id = %s
            LIMIT 1
            """,
            (user_id, export_id),
        ).fetchone()
    if not row:
        return None
    return _export_row_to_api(dict(row))


def delete_bank_drill_export_record(user_id: str, export_id: str) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM suite_bank_drill_exports WHERE user_id = %s AND id = %s LIMIT 1",
            (user_id, export_id),
        ).fetchone()
        if not row:
            return False
        conn.execute(
            "DELETE FROM suite_bank_drill_exports WHERE user_id = %s AND id = %s",
            (user_id, export_id),
        )
        conn.commit()
    return True


def bank_drill_meta(*, user_id: str, exam_track: str, years: list[int]) -> dict[str, Any]:
    """各模块可用题数（广东 + track + 年份），默认排除该用户历史导出/做过题目."""
    track = str(exam_track or "").strip()
    if track not in (EXAM_TRACK_PROVINCIAL, EXAM_TRACK_UNIFIED):
        raise ValueError("invalid exam_track")
    ys = sorted({int(y) for y in years if 1990 <= int(y) <= 2100})
    if not ys:
        raise ValueError("years required")

    placeholders = ",".join(["%s"] * len(ys))
    sql = f"""
      SELECT q.major_module AS mod,
             COUNT(*)::int AS total_count,
             COUNT(*) FILTER (WHERE h.question_id IS NULL)::int AS available_count,
             COUNT(*) FILTER (WHERE h.question_id IS NOT NULL)::int AS used_count
      FROM suite_questions q
      JOIN suite_papers p ON p.id = q.paper_id
      LEFT JOIN suite_bank_drill_history h
        ON h.user_id = %s
       AND h.question_id = q.id
      WHERE p.region = %s
        AND p.exam_track = %s
        AND p.exam_year IS NOT NULL
        AND p.exam_year IN ({placeholders})
        AND q.major_module <> ''
      GROUP BY q.major_module
    """
    params: list[Any] = [user_id, REGION_GUANGDONG, track, *ys]
    sql_cat = """
      SELECT DISTINCT p.exam_year AS y
      FROM suite_papers p
      WHERE p.region = %s AND p.exam_track = %s AND p.exam_year IS NOT NULL
      ORDER BY p.exam_year DESC
    """
    with get_conn() as conn:
        cat_rows = conn.execute(sql_cat, (REGION_GUANGDONG, track)).fetchall()
        year_catalog = [int(dict(r)["y"]) for r in cat_rows if dict(r).get("y") is not None]
        rows = conn.execute(sql, tuple(params)).fetchall()
    total_counts: dict[str, int] = {mid: 0 for mid in MAJOR_MODULE_IDS}
    available_counts: dict[str, int] = {mid: 0 for mid in MAJOR_MODULE_IDS}
    used_counts: dict[str, int] = {mid: 0 for mid in MAJOR_MODULE_IDS}
    for r in rows:
        d = dict(r)
        k = str(d.get("mod") or "")
        if k in total_counts:
            total_counts[k] = int(d.get("total_count") or 0)
            available_counts[k] = int(d.get("available_count") or 0)
            used_counts[k] = int(d.get("used_count") or 0)
    modules_out = []
    for mid in MAJOR_MODULE_IDS:
        modules_out.append(
            {
                "id": mid,
                "label": MAJOR_MODULE_LABELS[mid],
                "count": available_counts[mid],
                "total_count": total_counts[mid],
                "used_count": used_counts[mid],
            }
        )
    cy = utc_calendar_year()
    return {
        "region": REGION_GUANGDONG,
        "exam_track": track,
        "years": ys,
        "default_years": default_year_list(calendar_year=cy),
        "year_catalog": year_catalog,
        "calendar_year": cy,
        "modules": modules_out,
    }


def bank_drill_sample_question_ids(
    *,
    user_id: str,
    exam_track: str,
    years: list[int],
    major_module: str,
    count: int,
) -> list[str]:
    track = str(exam_track or "").strip()
    mod = str(major_module or "").strip()
    if track not in (EXAM_TRACK_PROVINCIAL, EXAM_TRACK_UNIFIED):
        raise ValueError("invalid exam_track")
    if mod not in MAJOR_MODULE_IDS:
        raise ValueError("invalid major_module")
    ys = sorted({int(y) for y in years if 1990 <= int(y) <= 2100})
    if not ys:
        raise ValueError("years required")
    k = max(1, min(int(count), 500))

    placeholders = ",".join(["%s"] * len(ys))
    sql = f"""
      SELECT q.id AS id
      FROM suite_questions q
      JOIN suite_papers p ON p.id = q.paper_id
      WHERE p.region = %s
        AND p.exam_track = %s
        AND p.exam_year IS NOT NULL
        AND p.exam_year IN ({placeholders})
        AND q.major_module = %s
        AND NOT EXISTS (
          SELECT 1
          FROM suite_bank_drill_history h
          WHERE h.user_id = %s
            AND h.question_id = q.id
        )
      ORDER BY random()
      LIMIT %s
    """
    params: list[Any] = [REGION_GUANGDONG, track, *ys, mod, user_id, k]
    with get_conn() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()
    return [str(dict(r)["id"]) for r in rows]


def fetch_questions_by_ids(question_ids: list[str]) -> list[dict[str, Any]]:
    if not question_ids:
        return []
    placeholders = ",".join(["%s"] * len(question_ids))
    sql = f"""
      SELECT q.id, q.paper_id, q.seq_no, q.question_no, q.stem, q.options, q.answer, q.analysis,
             q.type_label, q.img_data, q.meta_json, q.major_module,
             p.title AS paper_title, p.folder AS paper_folder
      FROM suite_questions q
      JOIN suite_papers p ON p.id = q.paper_id
      WHERE q.id IN ({placeholders})
    """
    with get_conn() as conn:
        rows = conn.execute(sql, tuple(question_ids)).fetchall()
    by_id: dict[str, dict[str, Any]] = {}
    for r in rows:
        rec = dict(r)
        if rec.get("meta_json"):
            try:
                rec["meta"] = json.loads(str(rec["meta_json"]))
            except json.JSONDecodeError:
                rec["meta"] = {}
        else:
            rec["meta"] = {}
        del rec["meta_json"]
        by_id[str(rec["id"])] = rec
    return [by_id[i] for i in question_ids if i in by_id]


def validate_drill_submit(
    *,
    exam_track: str,
    years: list[int],
    major_module: str,
    question_ids: list[str],
) -> tuple[list[dict[str, Any]], str | None]:
    """校验题目集合是否符合筛选；返回 (questions_ordered, error)."""
    track = str(exam_track or "").strip()
    mod = str(major_module or "").strip()
    ys = {int(y) for y in years if 1990 <= int(y) <= 2100}
    if track not in (EXAM_TRACK_PROVINCIAL, EXAM_TRACK_UNIFIED):
        return [], "invalid exam_track"
    if mod not in MAJOR_MODULE_IDS:
        return [], "invalid major_module"
    if not ys:
        return [], "years required"
    if not question_ids:
        return [], "no questions"
    if len(question_ids) != len(set(question_ids)):
        return [], "duplicate question ids"

    rows = fetch_questions_by_ids(question_ids)
    if len(rows) != len(question_ids):
        return [], "unknown question id"

    for r in rows:
        if str(r.get("major_module") or "") != mod:
            return [], "module mismatch"

    with get_conn() as conn:
        pids = list({str(r["paper_id"]) for r in rows})
        ph = ",".join(["%s"] * len(pids))
        check_sql = f"""
          SELECT id, region, exam_track, exam_year FROM suite_papers WHERE id IN ({ph})
        """
        prow = {str(dict(x)["id"]): dict(x) for x in conn.execute(check_sql, tuple(pids)).fetchall()}

    for r in rows:
        pid = str(r["paper_id"])
        p = prow.get(pid)
        if not p:
            return [], "paper missing"
        if str(p.get("region") or "") != REGION_GUANGDONG:
            return [], "region mismatch"
        if str(p.get("exam_track") or "") != track:
            return [], "exam_track mismatch"
        ey = p.get("exam_year")
        if ey is None or int(ey) not in ys:
            return [], "year mismatch"

    return rows, None


def bank_drill_start(
    *,
    user_id: str,
    exam_track: str,
    years: list[int],
    major_module: str,
    count: int,
) -> dict[str, Any]:
    ids = bank_drill_sample_question_ids(
        user_id=user_id,
        exam_track=exam_track,
        years=years,
        major_module=major_module,
        count=count,
    )
    questions = fetch_questions_by_ids(ids)
    session_id = "bd_" + uuid.uuid4().hex[:26]
    return {
        "session_id": session_id,
        "exam_track": exam_track,
        "years": sorted(set(int(y) for y in years)),
        "major_module": major_module,
        "major_module_label": MAJOR_MODULE_LABELS.get(major_module, major_module),
        "requested_count": int(count),
        "actual_count": len(questions),
        "questions": questions,
    }
