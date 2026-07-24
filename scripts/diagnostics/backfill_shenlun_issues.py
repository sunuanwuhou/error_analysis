#!/usr/bin/env python3
"""Backfill shenlun_issue_entries from existing successful CC attempts."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.database import get_conn, init_shenlun_tables
from backend.services.shenlun_issues import sync_issue_entries_for_attempt


def main() -> None:
    init_shenlun_tables()
    total = 0
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT a.*, s.question_text_raw, s.node_id, s.paper_year,
                   s.paper_province, s.paper_suite_type
            FROM shenlun_attempts a
            INNER JOIN shenlun_sources s ON s.id = a.source_id
            WHERE a.cc_status = 'success' AND COALESCE(a.cc_result_json, '') <> ''
            ORDER BY a.updated_at ASC
            """
        ).fetchall()

        for row in rows:
            row_d = dict(row)
            try:
                cc_result = json.loads(row_d.get("cc_result_json") or "{}")
            except Exception:
                continue
            if not isinstance(cc_result, dict):
                continue
            source_row = {
                "node_id": row_d.get("node_id"),
                "question_text_raw": row_d.get("question_text_raw"),
                "paper_year": row_d.get("paper_year"),
                "paper_province": row_d.get("paper_province"),
                "paper_suite_type": row_d.get("paper_suite_type"),
            }
            n = sync_issue_entries_for_attempt(
                conn,
                attempt_row=row_d,
                source_row=source_row,
                cc_result=cc_result,
            )
            total += n

        conn.commit()

    print(f"Backfill complete: {len(rows)} attempts processed, {total} issue entries written.")


if __name__ == "__main__":
    main()
