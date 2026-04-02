from __future__ import annotations

import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

BAD_NAME_TOKENS = ('#U',)


def has_suspicious_name(name: str) -> bool:
    return any(token in name for token in BAD_NAME_TOKENS)


def find_suspicious_paths(root: Path) -> list[Path]:
    return sorted(path for path in root.rglob('*') if has_suspicious_name(str(path.relative_to(root))))


@dataclass
class ArchiveInspection:
    archive_path: Path
    entry_count: int
    names: list[str]


def create_zip_archive(source_root: Path, archive_path: Path, relative_paths: list[Path]) -> Path:
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(archive_path, 'w', compression=ZIP_DEFLATED, compresslevel=9) as zf:
        for rel_path in relative_paths:
            abs_path = source_root / rel_path
            zf.write(abs_path, arcname=rel_path.as_posix())
    return archive_path


def inspect_zip_archive(archive_path: Path) -> ArchiveInspection:
    with ZipFile(archive_path, 'r') as zf:
        names = sorted(zf.namelist())
    return ArchiveInspection(archive_path=archive_path, entry_count=len(names), names=names)


def assert_archive_names_clean(archive_path: Path) -> ArchiveInspection:
    inspection = inspect_zip_archive(archive_path)
    offenders = [name for name in inspection.names if has_suspicious_name(name)]
    if offenders:
        preview = ', '.join(offenders[:5])
        raise RuntimeError(f'Archive contains suspicious encoded names: {preview}')
    if any('\\' in name for name in inspection.names):
        raise RuntimeError('Archive contains backslash paths; expected POSIX-style paths only.')
    if any(name.startswith('/') for name in inspection.names):
        raise RuntimeError('Archive contains absolute paths, which are not allowed.')
    return inspection


def assert_archive_extract_roundtrip(archive_path: Path) -> None:
    inspection = assert_archive_names_clean(archive_path)
    temp_dir = Path(tempfile.mkdtemp(prefix='archive-roundtrip-'))
    try:
        with ZipFile(archive_path, 'r') as zf:
            zf.extractall(temp_dir)
        extracted = sorted(
            str(path.relative_to(temp_dir)).replace('\\', '/')
            for path in temp_dir.rglob('*')
            if path.is_file()
        )
        if extracted != inspection.names:
            raise RuntimeError('Archive extraction roundtrip mismatch: extracted file set differs from zip entries.')
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
