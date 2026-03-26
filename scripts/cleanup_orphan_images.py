#!/usr/bin/env python3
"""Remove image files that no longer have a live DB reference."""

from __future__ import annotations

import sqlite3
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "data" / "xingce.db"
IMAGES_DIR = BASE_DIR / "data" / "images"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def main() -> None:
    if not IMAGES_DIR.exists():
        print("images dir not found, skipping")
        return

    deleted = 0
    with get_conn() as conn:
        for user_dir in IMAGES_DIR.iterdir():
            if not user_dir.is_dir():
                continue
            user_id = user_dir.name
            for img_file in user_dir.iterdir():
                if not img_file.is_file():
                    continue
                sha256 = img_file.name
                row = conn.execute(
                    "SELECT ref_count FROM user_images WHERE hash = ? AND user_id = ?",
                    (sha256, user_id),
                ).fetchone()
                if not row or row["ref_count"] <= 0:
                    img_file.unlink()
                    conn.execute(
                        "DELETE FROM user_images WHERE hash = ? AND user_id = ?",
                        (sha256, user_id),
                    )
                    deleted += 1
                    print(f"deleted orphan: {user_id}/{sha256}")
        conn.commit()

    print(f"cleanup done, {deleted} orphan(s) removed")


if __name__ == "__main__":
    main()
