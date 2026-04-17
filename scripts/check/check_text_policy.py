from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SKIP_DIRS = {
    '.git',
    '.idea',
    '.mypy_cache',
    '.pytest_cache',
    '.ruff_cache',
    '.venv',
    '__pycache__',
    'cloudflared',
    'converter/output',
    'data',
    'dist',
    'dist-ssr',
    'knowledge_sources',
    'node_modules',
    'runtime',
    'v51_frontend',
    'xingce_v3/vendor',
}

SKIP_FILES = {
    'xingce_v3/modules/legacy-app.bundle.js',
}

BINARY_EXTENSIONS = {
    '.db',
    '.gif',
    '.ico',
    '.jpeg',
    '.jpg',
    '.lockb',
    '.pdf',
    '.png',
    '.pyc',
    '.sqlite',
    '.sqlite3',
    '.webp',
    '.zip',
}

TEXT_EXTENSIONS = {
    '',
    '.css',
    '.dockerignore',
    '.editorconfig',
    '.env',
    '.example',
    '.gitignore',
    '.html',
    '.js',
    '.json',
    '.md',
    '.py',
    '.sh',
    '.toml',
    '.ts',
    '.tsx',
    '.vue',
    '.xml',
    '.yaml',
    '.yml',
}

SUSPICIOUS_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile('\ufffd'), 'contains replacement character \ufffd'),
    (re.compile(r'(?:浣犳|鍏|涓€|锛屼|鐣欒)'), 'contains common mojibake token sequence'),
]

SUSPICIOUS_SCAN_EXTENSIONS = {
    '.css',
    '.html',
    '.js',
    '.json',
    '.md',
    '.ts',
    '.tsx',
    '.vue',
    '.xml',
    '.yaml',
    '.yml',
}

# Transitional debt allowlist.
# Files listed here are still scanned, but violations are downgraded to warnings
# so CI can stay green while the team runs manual cleanup.
KNOWN_TEXT_DEBT: dict[str, str] = {
    'docs/archive/weakness-analysis-plan.md': 'historical mojibake/encoding damage; needs manual rewrite cleanup',
}


def tracked_files() -> list[Path]:
    command = ['git', 'ls-files']
    result = subprocess.run(
        command,
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding='utf-8',
    )
    return [ROOT / line for line in result.stdout.splitlines() if line]


def changed_files(base: str) -> list[Path]:
    result = subprocess.run(
        ['git', 'diff', '--name-only', '--diff-filter=ACMR', base],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding='utf-8',
    )
    untracked = subprocess.run(
        ['git', 'ls-files', '--others', '--exclude-standard'],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding='utf-8',
    )
    names = set(result.stdout.splitlines()) | set(untracked.stdout.splitlines())
    return [ROOT / name for name in sorted(names) if name]


def is_skipped(path: Path) -> bool:
    relative = path.relative_to(ROOT).as_posix()
    if relative in SKIP_FILES:
        return True
    parts = relative.split('/')
    return any('/'.join(parts[: index + 1]) in SKIP_DIRS for index in range(len(parts)))


def is_text_candidate(path: Path) -> bool:
    suffix = path.suffix.lower()
    return suffix in TEXT_EXTENSIONS and suffix not in BINARY_EXTENSIONS


def main() -> None:
    paths = changed_files('HEAD')
    if len(sys.argv) == 2 and sys.argv[1] == '--all':
        paths = tracked_files()
    elif len(sys.argv) == 3 and sys.argv[1] == '--changed':
        paths = changed_files(sys.argv[2])

    errors: list[str] = []
    warnings: list[str] = []
    debt_warnings: list[str] = []

    for path in paths:
        if not path.exists():
            continue
        if is_skipped(path) or not is_text_candidate(path):
            continue

        relative = path.relative_to(ROOT).as_posix()
        data = path.read_bytes()

        file_errors: list[str] = []
        try:
            text = data.decode('utf-8')
        except UnicodeDecodeError as exc:
            file_errors.append(f'{relative}: not valid UTF-8 ({exc})')
            text = ''

        has_crlf = '\r\n' in text
        if has_crlf:
            warnings.append(f'{relative}: contains CRLF line endings')

        if data and not data.endswith(b'\n'):
            file_errors.append(f'{relative}: missing final newline')

        if text:
            scan_suspicious = path.suffix.lower() in SUSPICIOUS_SCAN_EXTENSIONS
            for line_number, line in enumerate(text.splitlines(), start=1):
                if line.rstrip(' \t') != line:
                    file_errors.append(f'{relative}:{line_number}: trailing whitespace')
                if scan_suspicious:
                    for pattern, reason in SUSPICIOUS_PATTERNS:
                        if pattern.search(line):
                            file_errors.append(f'{relative}:{line_number}: suspicious text: {reason}')

        if file_errors:
            debt_reason = KNOWN_TEXT_DEBT.get(relative)
            if debt_reason:
                debt_warnings.append(f'{relative}: {debt_reason}')
                debt_warnings.extend(file_errors)
            else:
                errors.extend(file_errors)

    if errors:
        raise SystemExit('Text policy check failed:\n' + '\n'.join(errors))

    if warnings:
        print('Text policy warnings:')
        print('\n'.join(warnings))
    if debt_warnings:
        print('Text policy debt warnings:')
        print('\n'.join(debt_warnings))

    print('Text policy check passed.')


if __name__ == '__main__':
    main()
