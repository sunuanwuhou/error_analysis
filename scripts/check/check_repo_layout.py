from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _run_git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True, encoding="utf-8")


def _list_tracked(pattern: str) -> list[str]:
    output = _run_git("ls-files", pattern).strip()
    if not output:
        return []
    return [line.strip() for line in output.splitlines() if line.strip()]


def _list_added_files(base_ref: str) -> list[str]:
    output = _run_git("diff", "--name-status", "--diff-filter=A", base_ref, "--").strip()
    if not output:
        return []
    added: list[str] = []
    for line in output.splitlines():
        parts = line.split("\t", 1)
        if len(parts) == 2:
            added.append(parts[1].strip())
    return added


def main() -> int:
    parser = argparse.ArgumentParser(description="Repository layout guard")
    parser.add_argument("--changed", default="", help="git base ref for changed-file checks")
    args = parser.parse_args()

    errors: list[str] = []

    frontend_src = ROOT / "frontend" / "src"
    frontend_entry = frontend_src / "main.ts"
    if not frontend_src.exists() or not frontend_entry.exists():
        errors.append("frontend primary entry is incomplete: expected frontend/src/main.ts")

    tracked_converter_output = _list_tracked("converter/output")
    if tracked_converter_output:
        errors.append(
            "generated converter output is tracked in git:\n  - " + "\n  - ".join(tracked_converter_output)
        )

    tracked_idea = _list_tracked(".idea")
    if tracked_idea:
        errors.append("IDE workspace state is tracked in git:\n  - " + "\n  - ".join(tracked_idea))

    if args.changed:
        added_files = _list_added_files(args.changed)
        legacy_added = [
            path for path in added_files if path.startswith("xingce_v3/") or path.startswith("v51_frontend/")
        ]
        if legacy_added:
            errors.append(
                "new files were added under legacy frontend paths:\n  - "
                + "\n  - ".join(legacy_added)
                + "\nadd new product files under frontend/src instead"
            )

    if errors:
        print("[layout-check] FAILED")
        for item in errors:
            print(f"\n- {item}")
        return 1

    print("[layout-check] OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
