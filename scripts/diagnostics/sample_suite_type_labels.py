#!/usr/bin/env python3
"""Sample suite_questions type_label distribution (diagnostic)."""
from __future__ import annotations

from collections import Counter

from backend.database import get_conn


def main() -> None:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT q.type_label, q.major_module, p.exam_track, p.exam_year, p.folder
            FROM suite_questions q
            JOIN suite_papers p ON p.id = q.paper_id
            """
        ).fetchall()

    print("total_questions", len(rows))
    c: Counter[str] = Counter()
    empty = 0
    for r in rows:
        tl = (r.get("type_label") or "").strip()
        if not tl:
            empty += 1
            continue
        for part in tl.replace("，", ",").split(","):
            part = part.strip()
            if part:
                c[part] += 1
    print("empty_type_label", empty)
    print("unique_tags", len(c))
    for tag, n in c.most_common(80):
        print(f"{n:4d}  {tag}")


if __name__ == "__main__":
    main()
