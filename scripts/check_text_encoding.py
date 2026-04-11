from __future__ import annotations

import argparse
import sys
from pathlib import Path


TEXT_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".vue",
    ".css",
    ".scss",
    ".html",
    ".json",
    ".md",
    ".py",
    ".ps1",
    ".sh",
    ".yml",
    ".yaml",
}

DEFAULT_SCAN_ROOTS = ["ui", "app", "scripts", "docs"]
SKIP_PARTS = {
    ".git",
    ".idea",
    ".venv",
    "node_modules",
    "dist",
    "build",
    "__pycache__",
}
SKIP_FILES = {"check_text_encoding.py"}
SUSPICIOUS_TOKENS = (
    "锟",
    chr(0xFFFD),
    "鏃",
    "鍒",
    "鍚",
    "鐭",
    "璇",
    "绗",
    "杩",
    "妯",
    "闈",
    "€?",
)


def iter_files(repo_root: Path, roots: list[str]) -> list[Path]:
    collected: list[Path] = []
    for root_name in roots:
        root = repo_root / root_name
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if path.name in SKIP_FILES:
                continue
            if path.suffix.lower() not in TEXT_EXTENSIONS:
                continue
            if any(part in SKIP_PARTS for part in path.parts):
                continue
            collected.append(path)
    return collected


def find_suspicious_lines(text: str) -> list[tuple[int, str]]:
    matches: list[tuple[int, str]] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        if any(token in line for token in SUSPICIOUS_TOKENS):
            matches.append((line_number, line.strip()))
    return matches


def main() -> int:
    parser = argparse.ArgumentParser(description="Check repo text files for UTF-8 decode failures and common mojibake markers.")
    parser.add_argument("roots", nargs="*", help="Relative directories to scan. Defaults to ui app scripts docs.")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    scan_roots = args.roots or DEFAULT_SCAN_ROOTS

    decode_failures: list[tuple[Path, str]] = []
    suspicious_hits: list[tuple[Path, list[tuple[int, str]]]] = []

    for path in iter_files(repo_root, scan_roots):
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError as exc:
            decode_failures.append((path, str(exc)))
            continue

        hits = find_suspicious_lines(text)
        if hits:
            suspicious_hits.append((path, hits[:8]))

    if not decode_failures and not suspicious_hits:
        print("Encoding check passed: no UTF-8 decode failures or suspicious mojibake markers found.")
        return 0

    if decode_failures:
        print("UTF-8 decode failures:")
        for path, error in decode_failures:
            print(f"- {path.relative_to(repo_root)}: {error}")

    if suspicious_hits:
        print("Suspicious mojibake markers:")
        for path, hits in suspicious_hits:
            print(f"- {path.relative_to(repo_root)}")
            for line_number, line in hits:
                safe_line = line.encode("unicode_escape").decode("ascii")
                print(f"  L{line_number}: {safe_line}")

    return 1


if __name__ == "__main__":
    sys.exit(main())
