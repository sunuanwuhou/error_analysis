#!/usr/bin/env python3
"""Verify suite_bank paper after import."""
from __future__ import annotations

import argparse

from backend.services.suite_bank_service import get_paper_questions


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("paper_id")
    args = ap.parse_args()
    p = get_paper_questions(args.paper_id)
    if not p:
        raise SystemExit("not found")
    print("title:", p["title"])
    print("count:", len(p["questions"]))
    q1 = p["questions"][0]
    print("q1 question_no:", q1["question_no"])
    print("q1 stem:", q1["stem"][:120])
    print("q1 meta:", q1.get("meta"))
    q6 = p["questions"][5]
    print("q6 meta:", q6.get("meta"))
    q16 = p["questions"][15]
    print("q16 meta:", q16.get("meta"))


if __name__ == "__main__":
    main()
