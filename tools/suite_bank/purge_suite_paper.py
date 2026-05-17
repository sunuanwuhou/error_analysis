#!/usr/bin/env python3
"""Remove one suite paper row (questions CASCADE)."""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.environ.get("PYTHONPATH", "/app"))

from backend.database import get_conn


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True, help="suite_papers.id")
    args = ap.parse_args()
    pid = args.id.strip()
    with get_conn() as conn:
        row = conn.execute("SELECT id, title FROM suite_papers WHERE id = %s", (pid,)).fetchone()
        if not row:
            print("not found:", pid)
            return
        print("deleting:", dict(row))
        conn.execute("DELETE FROM suite_papers WHERE id = %s", (pid,))
        conn.commit()
    print("OK")


if __name__ == "__main__":
    main()
