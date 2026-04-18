from __future__ import annotations

import argparse
import fnmatch
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ALLOWED_DOCS_ROOT_FILES = {"README.md", "INDEX.md"}
LEGACY_ALLOWED_NEW_PREFIXES = (
    "xingce_v3/modules/main/workspace/",
    "xingce_v3/modules/main/modal/",
    "xingce_v3/modules/main/knowledge/",
)
RUNTIME_TRACKED_PATTERNS = [
    "data/**",
    "runtime/**",
    "cloudflared/**",
    "**/__pycache__/**",
    "**/*.pyc",
    "app/data.db",
]


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


def _match_any(path: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatch(path, pattern) for pattern in patterns)


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

    tracked_runtime = [path for path in _run_git("ls-files").splitlines() if _match_any(path.strip(), RUNTIME_TRACKED_PATTERNS)]
    if tracked_runtime:
        errors.append(
            "runtime/local artifacts are tracked in git:\n  - " + "\n  - ".join(sorted(tracked_runtime))
        )

    docs_root = ROOT / "docs"
    if docs_root.exists():
        docs_root_files = sorted(path.name for path in docs_root.iterdir() if path.is_file())
        unexpected_docs_root = [name for name in docs_root_files if name not in ALLOWED_DOCS_ROOT_FILES]
        if unexpected_docs_root:
            errors.append(
                "docs root contains unmanaged files (move to docs/active, docs/ops, docs/roadmap, or docs/archive):\n  - "
                + "\n  - ".join(unexpected_docs_root)
            )

    if args.changed:
        added_files = _list_added_files(args.changed)
        legacy_added = [
            path
            for path in added_files
            if (path.startswith("xingce_v3/") or path.startswith("v51_frontend/"))
            and not path.startswith(LEGACY_ALLOWED_NEW_PREFIXES)
        ]
        if legacy_added:
            errors.append(
                "new files were added under legacy frontend paths:\n  - "
                + "\n  - ".join(legacy_added)
                + "\nadd new product files under frontend/src instead; legacy add-only exception: modules/main/{workspace,modal,knowledge}/"
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
