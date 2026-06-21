"""广东套卷考情分析 — 卷面知识点频次（公开考纲 + 粉笔标签映射）."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from backend.database import get_conn
from backend.services.suite_bank_drill import (
    EXAM_TRACK_PROVINCIAL,
    EXAM_TRACK_UNIFIED,
    MAJOR_MODULE_LABELS,
    REGION_GUANGDONG,
    default_year_list,
    infer_major_module_for_question_row,
)

_TAXONOMY_PATH = Path(__file__).resolve().parent.parent / "data" / "gd_exam_knowledge_taxonomy.json"

_TAG_SPLIT_RE = re.compile(r"[,，、]")


def _split_tags(raw: str) -> list[str]:
    text = (raw or "").strip()
    if not text:
        return []
    parts: list[str] = []
    for chunk in _TAG_SPLIT_RE.split(text):
        p = chunk.strip()
        if p and p not in parts:
            parts.append(p)
    return parts


@lru_cache(maxsize=1)
def load_taxonomy() -> dict[str, Any]:
    with _TAXONOMY_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def _normalize_years(years: list[int] | None) -> list[int]:
    if years:
        out = sorted({int(y) for y in years if 1990 <= int(y) <= 2100})
        if out:
            return out
    return default_year_list()


def _fetch_questions(
    *,
    exam_track: str,
    years: list[int],
) -> list[dict[str, Any]]:
    track = (exam_track or EXAM_TRACK_PROVINCIAL).strip()
    if track not in (EXAM_TRACK_PROVINCIAL, EXAM_TRACK_UNIFIED):
        track = EXAM_TRACK_PROVINCIAL
    year_ph = ",".join(["%s"] * len(years))
    sql = f"""
        SELECT
          q.id AS question_id,
          q.type_label,
          q.major_module,
          q.meta_json,
          p.id AS paper_id,
          p.title AS paper_title,
          p.exam_year,
          p.exam_track
        FROM suite_questions q
        JOIN suite_papers p ON p.id = q.paper_id
        WHERE (p.region = %s OR p.folder LIKE %s)
          AND p.exam_track = %s
          AND p.exam_year IN ({year_ph})
    """
    params: list[Any] = [REGION_GUANGDONG, "%广东%", track, *years]
    with get_conn() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()
    out: list[dict[str, Any]] = []
    for row in rows:
        rec = dict(row)
        meta: dict[str, Any] = {}
        raw_m = rec.pop("meta_json", None)
        if raw_m:
            try:
                meta = json.loads(str(raw_m))
            except json.JSONDecodeError:
                meta = {}
        rec["meta"] = meta
        stem_label = ""
        if isinstance(meta.get("label"), str):
            stem_label = meta["label"].strip()
        mm = str(rec.get("major_module") or "").strip()
        if not mm:
            mm = infer_major_module_for_question_row(meta, str(rec.get("type_label") or ""), stem_label)
        rec["major_module"] = mm
        rec["stem_label"] = stem_label
        rec["source_tags"] = _split_tags(str(rec.get("type_label") or ""))
        if stem_label and stem_label not in rec["source_tags"]:
            rec["source_tags"].append(stem_label)
        out.append(rec)
    return out


def _best_kp_match(text: str, kps: list[dict[str, Any]]) -> dict[str, Any] | None:
    """最长关键词命中优先（更细的知识点）。"""
    best: dict[str, Any] | None = None
    best_len = 0
    for kp in kps:
        for kw in kp.get("match") or []:
            k = str(kw).strip()
            if not k or k not in text:
                continue
            if len(k) > best_len:
                best_len = len(k)
                best = kp
    return best


def _build_kp_index(taxonomy: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """扁平索引：kp_id -> 节点（含 module/category 信息）。"""
    flat: list[dict[str, Any]] = []
    by_id: dict[str, dict[str, Any]] = {}
    for mod in taxonomy.get("modules") or []:
        mod_id = str(mod.get("id") or "")
        mod_label = str(mod.get("label") or mod_id)
        for cat in mod.get("categories") or []:
            cat_id = str(cat.get("id") or "")
            cat_label = str(cat.get("label") or cat_id)
            for kp in cat.get("knowledge_points") or []:
                node = {
                    "id": str(kp.get("id") or ""),
                    "label": str(kp.get("label") or ""),
                    "match": list(kp.get("match") or []),
                    "module_id": mod_id,
                    "module_label": mod_label,
                    "category_id": cat_id,
                    "category_label": cat_label,
                }
                flat.append(node)
                by_id[node["id"]] = node
    return flat, by_id


def compute_exam_insight(
    *,
    exam_track: str = EXAM_TRACK_PROVINCIAL,
    years: list[int] | None = None,
) -> dict[str, Any]:
    year_list = _normalize_years(years)
    taxonomy = load_taxonomy()
    flat_kps, kp_by_id = _build_kp_index(taxonomy)

    questions = _fetch_questions(exam_track=exam_track, years=year_list)

    # 统计容器
    kp_stats: dict[str, dict[str, Any]] = {}
    for kp in flat_kps:
        kp_stats[kp["id"]] = {
            "count": 0,
            "question_ids": set(),
            "source_tags": set(),
            "by_year": {},
        }

    unmapped_tags: dict[str, dict[str, Any]] = {}
    paper_ids: set[str] = set()
    module_counts: dict[str, int] = {}
    year_module_counts: dict[int, dict[str, int]] = {}

    for q in questions:
        qid = str(q.get("question_id") or "")
        pid = str(q.get("paper_id") or "")
        paper_ids.add(pid)
        year = q.get("exam_year")
        mm = str(q.get("major_module") or "unknown")
        module_counts[mm] = module_counts.get(mm, 0) + 1
        if isinstance(year, int):
            ym = year_module_counts.setdefault(year, {})
            ym[mm] = ym.get(mm, 0) + 1

        matched_kp_ids: set[str] = set()
        for tag in q.get("source_tags") or []:
            hit = _best_kp_match(tag, flat_kps)
            if hit:
                kid = hit["id"]
                matched_kp_ids.add(kid)
                st = kp_stats[kid]
                st["count"] += 1
                st["question_ids"].add(qid)
                st["source_tags"].add(tag)
                if isinstance(year, int):
                    st["by_year"][year] = st["by_year"].get(year, 0) + 1
            else:
                bucket = unmapped_tags.setdefault(tag, {"count": 0, "question_ids": set(), "by_year": {}})
                bucket["count"] += 1
                bucket["question_ids"].add(qid)
                if isinstance(year, int):
                    bucket["by_year"][year] = bucket["by_year"].get(year, 0) + 1

        # 整题文本二次匹配（题干标签未覆盖时）
        if not matched_kp_ids:
            blob = " ".join(q.get("source_tags") or [])
            hit = _best_kp_match(blob, flat_kps)
            if hit:
                kid = hit["id"]
                st = kp_stats[kid]
                st["count"] += 1
                st["question_ids"].add(qid)
                if isinstance(year, int):
                    st["by_year"][year] = st["by_year"].get(year, 0) + 1

    total_q = len(questions)

    # 组装模块树（含 0 次知识点）
    modules_out: list[dict[str, Any]] = []
    for mod in taxonomy.get("modules") or []:
        mod_id = str(mod.get("id") or "")
        mod_q = module_counts.get(mod_id, 0)
        categories_out: list[dict[str, Any]] = []
        for cat in mod.get("categories") or []:
            cat_id = str(cat.get("id") or "")
            points_out: list[dict[str, Any]] = []
            cat_count = 0
            for kp in cat.get("knowledge_points") or []:
                kid = str(kp.get("id") or "")
                st = kp_stats.get(kid) or {"count": 0, "question_ids": set(), "source_tags": set(), "by_year": {}}
                cnt = int(st["count"])
                cat_count += cnt
                points_out.append(
                    {
                        "id": kid,
                        "label": str(kp.get("label") or ""),
                        "count": cnt,
                        "pct": round(cnt / total_q, 4) if total_q else 0.0,
                        "source_tags": sorted(st["source_tags"]),
                        "by_year": dict(sorted(st.get("by_year", {}).items())),
                    }
                )
            points_out.sort(key=lambda x: (-x["count"], x["label"]))
            categories_out.append(
                {
                    "id": cat_id,
                    "label": str(cat.get("label") or ""),
                    "count": cat_count,
                    "pct": round(cat_count / total_q, 4) if total_q else 0.0,
                    "knowledge_points": points_out,
                }
            )
        categories_out.sort(key=lambda x: (-x["count"], x["label"]))
        modules_out.append(
            {
                "id": mod_id,
                "label": str(mod.get("label") or ""),
                "count": mod_q,
                "pct": round(mod_q / total_q, 4) if total_q else 0.0,
                "categories": categories_out,
            }
        )

    unmapped_out = [
        {
            "tag": tag,
            "count": int(st["count"]),
            "pct": round(int(st["count"]) / total_q, 4) if total_q else 0.0,
            "by_year": dict(sorted(st.get("by_year", {}).items())),
        }
        for tag, st in sorted(unmapped_tags.items(), key=lambda x: (-x[1]["count"], x[0]))
    ]

    by_year_out = [
        {
            "year": y,
            "total": sum(year_module_counts.get(y, {}).values()),
            "modules": {
                mid: year_module_counts.get(y, {}).get(mid, 0)
                for mid in MAJOR_MODULE_LABELS
            },
        }
        for y in sorted(year_list)
    ]

    return {
        "filters": {
            "region": "广东",
            "exam_track": exam_track,
            "exam_track_label": "省考" if exam_track == EXAM_TRACK_PROVINCIAL else "统考",
            "years": year_list,
        },
        "summary": {
            "paper_count": len(paper_ids),
            "question_count": total_q,
            "taxonomy_version": taxonomy.get("version"),
            "taxonomy_source_note": taxonomy.get("source_note"),
            "knowledge_point_total": len(flat_kps),
            "unmapped_tag_count": len(unmapped_out),
        },
        "by_major_module": [
            {
                "id": mid,
                "label": MAJOR_MODULE_LABELS.get(mid, mid),
                "count": module_counts.get(mid, 0),
                "pct": round(module_counts.get(mid, 0) / total_q, 4) if total_q else 0.0,
            }
            for mid in MAJOR_MODULE_LABELS
        ],
        "by_year": by_year_out,
        "modules": modules_out,
        "unmapped_tags": unmapped_out,
    }
