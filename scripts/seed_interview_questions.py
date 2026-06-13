#!/usr/bin/env python3
"""写入公务员面试题库种子数据（仅当表为空时插入）。"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.database import init_db, init_interview_tables  # noqa: E402
from backend.services.interview_seed import seed_interview_questions_if_empty  # noqa: E402


def main() -> None:
    init_db()
    init_interview_tables()
    n = seed_interview_questions_if_empty()
    if n:
        print(f"Inserted {n} interview seed questions.")
    else:
        print("Interview question bank already seeded; skipped.")


if __name__ == "__main__":
    main()
