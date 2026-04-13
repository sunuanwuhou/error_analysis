from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATTERN = re.compile(r'#U([0-9a-fA-F]{4,6})')


def decode_name(name: str) -> str:
    return PATTERN.sub(lambda match: chr(int(match.group(1), 16)), name)


def rename_paths(root: Path, apply_changes: bool) -> int:
    candidates = sorted((path for path in root.rglob('*') if '#U' in path.name), key=lambda p: len(p.parts), reverse=True)
    changed = 0
    for path in candidates:
        target = path.with_name(decode_name(path.name))
        if path == target:
            continue
        print(f'{path.relative_to(root)} -> {target.relative_to(root)}')
        changed += 1
        if apply_changes:
            target.parent.mkdir(parents=True, exist_ok=True)
            path.rename(target)
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description='Rename #UXXXX-style escaped file names back to readable Unicode names.')
    parser.add_argument('--apply', action='store_true', help='Apply the rename instead of printing a dry-run plan.')
    parser.add_argument('--root', type=Path, default=ROOT, help='Root directory to scan.')
    args = parser.parse_args()

    count = rename_paths(args.root, apply_changes=args.apply)
    print(f'Candidates: {count}')
    if count and not args.apply:
        print('Dry run only. Re-run with --apply to rename the files.')


if __name__ == '__main__':
    main()
