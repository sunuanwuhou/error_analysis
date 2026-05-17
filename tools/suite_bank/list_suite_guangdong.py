#!/usr/bin/env python3
"""List suite papers mentioning Guangdong / 2008."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.environ.get("PYTHONPATH", "/app"))

from backend.database import get_conn


def main() -> None:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT p.id, p.title, p.folder, COUNT(q.id)::int AS n
            FROM suite_papers p
            LEFT JOIN suite_questions q ON q.paper_id = p.id
            WHERE p.title LIKE %s OR p.title LIKE %s OR p.folder LIKE %s
            GROUP BY p.id, p.title, p.folder
            ORDER BY p.title
            """,
            ("%广东%", "%2008%", "%广东%"),
        ).fetchall()
    for r in rows:
        print(dict(r))


if __name__ == "__main__":
    main()
