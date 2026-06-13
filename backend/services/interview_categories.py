"""面试题型（动态分类）。"""

from __future__ import annotations

import re
import secrets
from typing import Any

from backend.database import get_conn
from backend.security import utcnow

DEFAULT_CATEGORIES: tuple[tuple[str, str, int], ...] = (
    ("comprehensive", "综合分析", 10),
    ("planning", "计划组织协调", 20),
    ("interpersonal", "人际沟通", 30),
    ("motivation", "求职动机与职业发展", 40),
    ("scenario", "情景模拟", 50),
)

_LEGACY_LABEL_TO_ID: dict[str, str] = {label: cid for cid, label, _ in DEFAULT_CATEGORIES}
for cid, label, _ in DEFAULT_CATEGORIES:
    _LEGACY_LABEL_TO_ID[cid] = cid


def _conn_ctx(conn: Any | None):
    if conn is not None:
        from contextlib import contextmanager

        @contextmanager
        def _wrap():
            yield conn

        return _wrap()
    return get_conn()


def seed_interview_categories_if_empty() -> int:
    now = utcnow().isoformat()
    with get_conn() as conn:
        row = conn.execute("SELECT COUNT(*)::int AS c FROM interview_categories").fetchone()
        if int(row["c"] if row else 0) > 0:
            return 0
        for cid, label, sort_order in DEFAULT_CATEGORIES:
            conn.execute(
                """
                INSERT INTO interview_categories (id, label, sort_order, created_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (cid, label, sort_order, now),
            )
        conn.commit()
        return len(DEFAULT_CATEGORIES)


def row_to_category(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "label": row["label"],
        "sort_order": int(row.get("sort_order") or 0),
        "created_at": row["created_at"],
        "question_count": int(row.get("question_count") or 0),
    }


def list_categories(conn: Any | None = None) -> list[dict[str, Any]]:
    sql = """
        SELECT c.id, c.label, c.sort_order, c.created_at,
               COUNT(q.id)::int AS question_count
        FROM interview_categories c
        LEFT JOIN interview_questions q ON q.category = c.id
        GROUP BY c.id, c.label, c.sort_order, c.created_at
        ORDER BY c.sort_order ASC, c.created_at ASC, c.id ASC
    """
    with _conn_ctx(conn) as c:
        rows = c.execute(sql).fetchall()
    return [row_to_category(dict(r)) for r in rows]


def get_category_map(conn: Any | None = None) -> dict[str, str]:
    return {c["id"]: c["label"] for c in list_categories(conn)}


def _normalize_custom_id(raw: str) -> str:
    text = (raw or "").strip().lower()
    text = re.sub(r"[^a-z0-9_\-]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text[:48]


def _new_category_id() -> str:
    return "iv-cat-" + secrets.token_hex(4)


def create_category(label: str, category_id: str = "", sort_order: int | None = None) -> dict[str, Any]:
    lbl = (label or "").strip()
    if not lbl:
        raise ValueError("category_label_required")
    now = utcnow().isoformat()
    with get_conn() as conn:
        cid = _normalize_custom_id(category_id) if category_id.strip() else _new_category_id()
        if not cid:
            cid = _new_category_id()
        exists = conn.execute("SELECT id FROM interview_categories WHERE id = %s", (cid,)).fetchone()
        if exists:
            raise ValueError("category_id_exists")
        label_exists = conn.execute(
            "SELECT id FROM interview_categories WHERE label = %s",
            (lbl,),
        ).fetchone()
        if label_exists:
            raise ValueError("category_label_exists")
        if sort_order is None:
            row = conn.execute("SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM interview_categories").fetchone()
            sort_order = int(row["m"] if row else 0) + 10
        conn.execute(
            """
            INSERT INTO interview_categories (id, label, sort_order, created_at)
            VALUES (%s, %s, %s, %s)
            """,
            (cid, lbl, int(sort_order), now),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT c.id, c.label, c.sort_order, c.created_at, 0::int AS question_count
            FROM interview_categories c WHERE c.id = %s
            """,
            (cid,),
        ).fetchone()
    return row_to_category(dict(row))


def update_category(category_id: str, label: str, sort_order: int | None = None) -> dict[str, Any]:
    cid = category_id.strip()
    lbl = (label or "").strip()
    if not cid:
        raise ValueError("category_id_required")
    if not lbl:
        raise ValueError("category_label_required")
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM interview_categories WHERE id = %s", (cid,)).fetchone()
        if not row:
            raise ValueError("category_not_found")
        dup = conn.execute(
            "SELECT id FROM interview_categories WHERE label = %s AND id <> %s",
            (lbl, cid),
        ).fetchone()
        if dup:
            raise ValueError("category_label_exists")
        if sort_order is None:
            conn.execute("UPDATE interview_categories SET label = %s WHERE id = %s", (lbl, cid))
        else:
            conn.execute(
                "UPDATE interview_categories SET label = %s, sort_order = %s WHERE id = %s",
                (lbl, int(sort_order), cid),
            )
        conn.commit()
        items = list_categories(conn)
    cat = next((x for x in items if x["id"] == cid), None)
    if not cat:
        raise ValueError("category_not_found")
    return cat


def delete_category(category_id: str) -> None:
    cid = category_id.strip()
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM interview_categories WHERE id = %s", (cid,)).fetchone()
        if not row:
            raise ValueError("category_not_found")
        cnt = conn.execute(
            "SELECT COUNT(*)::int AS c FROM interview_questions WHERE category = %s",
            (cid,),
        ).fetchone()
        if int(cnt["c"] if cnt else 0) > 0:
            raise ValueError("category_has_questions")
        total = conn.execute("SELECT COUNT(*)::int AS c FROM interview_categories").fetchone()
        if int(total["c"] if total else 0) <= 1:
            raise ValueError("category_last_one")
        conn.execute("DELETE FROM interview_categories WHERE id = %s", (cid,))
        conn.commit()


def resolve_category_id(raw: str, conn: Any | None = None, auto_create: bool = False) -> str:
    """将 id / 中文标签 / 旧别名 解析为 category id；导入时可自动新建。"""
    text = (raw or "").strip()
    if not text:
        raise ValueError("invalid_category")

    with _conn_ctx(conn) as c:
        row = c.execute("SELECT id FROM interview_categories WHERE id = %s", (text,)).fetchone()
        if row:
            return str(row["id"])
        row = c.execute("SELECT id FROM interview_categories WHERE label = %s", (text,)).fetchone()
        if row:
            return str(row["id"])
        legacy = _LEGACY_LABEL_TO_ID.get(text)
        if legacy:
            row = c.execute("SELECT id FROM interview_categories WHERE id = %s", (legacy,)).fetchone()
            if row:
                return legacy
        if auto_create:
            lbl = text
            cid = _new_category_id()
            now = utcnow().isoformat()
            row = c.execute("SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM interview_categories").fetchone()
            sort_order = int(row["m"] if row else 0) + 10
            c.execute(
                """
                INSERT INTO interview_categories (id, label, sort_order, created_at)
                VALUES (%s, %s, %s, %s)
                """,
                (cid, lbl, sort_order, now),
            )
            return cid
    raise ValueError("invalid_category")


def ensure_valid_category_id(category_id: str, conn: Any | None = None) -> str:
    return resolve_category_id(category_id, conn=conn, auto_create=False)
