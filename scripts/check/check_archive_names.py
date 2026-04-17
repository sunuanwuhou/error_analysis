from __future__ import annotations

import argparse
from pathlib import Path

from archive_utils import assert_archive_extract_roundtrip, assert_archive_names_clean


def main() -> None:
    parser = argparse.ArgumentParser(description='Validate zip archive entry names and roundtrip extraction.')
    parser.add_argument('archive', type=Path, help='Path to the zip archive to inspect.')
    args = parser.parse_args()

    inspection = assert_archive_names_clean(args.archive)
    assert_archive_extract_roundtrip(args.archive)

    print('Archive name check passed:')
    print(f'- Archive: {args.archive}')
    print(f'- Entries: {inspection.entry_count}')


if __name__ == '__main__':
    main()
