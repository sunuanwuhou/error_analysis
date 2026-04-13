from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

TARGETS = {
    'xingce_v3/modules/main/05-persistence.js',
    'xingce_v3/modules/main/30-directory-management.js',
    'xingce_v3/modules/main/36-tab-coordination.js',
}


@dataclass
class DiffStat:
    added: int = 0
    removed: int = 0

    @property
    def net(self) -> int:
        return self.added - self.removed


def _changed_base_from_argv() -> str:
    if len(sys.argv) == 3 and sys.argv[1] == '--changed':
        return sys.argv[2]
    return 'HEAD'


def _diff_name_status(base: str) -> list[str]:
    result = subprocess.run(
        ['git', 'diff', '--name-only', '--diff-filter=ACMR', base],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding='utf-8',
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _file_diff_stat(base: str, rel_path: str) -> DiffStat:
    result = subprocess.run(
        ['git', 'diff', '--unified=0', base, '--', rel_path],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding='utf-8',
    )
    stat = DiffStat()
    for line in result.stdout.splitlines():
        if line.startswith('+++') or line.startswith('---'):
            continue
        if line.startswith('+'):
            stat.added += 1
        elif line.startswith('-'):
            stat.removed += 1
    return stat


def main() -> None:
    base = _changed_base_from_argv()
    changed = set(_diff_name_status(base))

    touched_targets = sorted(TARGETS & changed)
    if not touched_targets:
        print('Legacy monolith guard passed: no guarded files changed.')
        return

    errors: list[str] = []
    details: list[str] = []

    for rel_path in touched_targets:
        stat = _file_diff_stat(base, rel_path)
        details.append(f'- {rel_path}: +{stat.added} / -{stat.removed} / net {stat.net:+d}')
        if stat.net > 0:
            errors.append(
                f'{rel_path}: net growth is {stat.net:+d}. '
                'Guarded legacy modules are bugfix-only and must not grow by default.'
            )

    if errors:
        raise SystemExit(
            'Legacy monolith guard failed.\n'
            + '\n'.join(details)
            + '\n\n'
            + '\n'.join(errors)
            + '\n\n'
            + 'If growth is truly required, move the feature to frontend/ or split the legacy module first.'
        )

    print('Legacy monolith guard passed.')
    print('\n'.join(details))


if __name__ == '__main__':
    main()
