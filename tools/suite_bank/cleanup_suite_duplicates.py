#!/usr/bin/env python3
"""Merge duplicate suite_papers by folder+logical title (dedupe_key).

Same as app startup migrate: keeps word版本/ rows first; among same class,
prefers larger question bundles. Safe to run multiple times.

Container:
  docker compose exec -T app python3 /app/tools/suite_bank/cleanup_suite_duplicates.py
"""

from __future__ import annotations

import sys
from pathlib import Path

repo_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(repo_root))

from backend.database import get_conn  # noqa: E402
from backend.services.suite_bank_service import migrate_suite_papers_schema  # noqa: E402


def main() -> None:
    migrate_suite_papers_schema()
    with get_conn() as conn:
        n = int(conn.execute("SELECT COUNT(*)::int AS c FROM suite_papers").fetchone()["c"])
        dups = conn.execute(
            """
            SELECT dedupe_key, COUNT(*)::int AS c
            FROM suite_papers
            GROUP BY dedupe_key
            HAVING COUNT(*) > 1
            """
        ).fetchall()
    print(f"suite_papers total rows: {n}")
    if dups:
        print("WARN: duplicate dedupe_key groups remain:", len(dups))
        for row in dups[:50]:
            print(dict(row))
        if len(dups) > 50:
            print("…")
    else:
        print("OK: no duplicate dedupe_key groups")


if __name__ == "__main__":
    main()
