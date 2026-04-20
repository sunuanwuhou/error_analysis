from __future__ import annotations

import runpy
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CHECK_DIR = ROOT / "check"
CHECKS = (
    CHECK_DIR / "check_repo_layout.py",
    CHECK_DIR / "check_legacy_entry.py",
    CHECK_DIR / "check_router_layout.py",
)


def main() -> int:
    failed: list[str] = []
    for script in CHECKS:
        try:
            runpy.run_path(str(script), run_name="__main__")
        except SystemExit as exc:
            code = int(exc.code or 0)
            if code != 0:
                failed.append(f"{script.name} (exit={code})")
        except Exception as exc:  # pragma: no cover - defensive guard
            failed.append(f"{script.name} (error={exc})")
    if failed:
        print("[check_repo_layout] FAILED")
        for item in failed:
            print(f"- {item}")
        return 1
    print("[check_repo_layout] OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
