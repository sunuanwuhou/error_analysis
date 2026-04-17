from __future__ import annotations

import argparse
import compileall
import json
import subprocess
import sys
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path

from archive_utils import assert_archive_extract_roundtrip, create_zip_archive, find_suspicious_paths

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = ROOT / 'dist'
EXCLUDE_DIR_NAMES = {
    '.git',
    '.idea',
    '__pycache__',
    'dist',
    'node_modules',
}
EXCLUDE_FILE_SUFFIXES = {'.pyc', '.pyo', '.zip', '.log'}
EXCLUDE_FILE_NAMES = {'.DS_Store'}
EXCLUDE_RELATIVE_PATHS = {
    Path('data/xingce.db'),
}
RUNTIME_INCLUDE_PREFIXES = (
    Path('app'),
    Path('xingce_v3'),
    Path('docs'),
)
RUNTIME_INCLUDE_FILES = {
    Path('README.md'),
    Path('Dockerfile'),
    Path('docker-compose.yml'),
    Path('.env.example'),
    Path('requirements.txt'),
    Path('scripts/archive_utils.py'),
    Path('scripts/build_legacy_assets.py'),
    Path('scripts/check_archive_names.py'),
    Path('scripts/check_legacy_entry.py'),
    Path('scripts/check_router_layout.py'),
    Path('scripts/normalize_escaped_filenames.py'),
    Path('scripts/package_release.py'),
    Path('scripts/smoke_test_legacy_app.py'),
}


def should_include(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    if rel in EXCLUDE_RELATIVE_PATHS:
        return False
    if any(part in EXCLUDE_DIR_NAMES for part in rel.parts[:-1]):
        return False
    if path.name in EXCLUDE_FILE_NAMES:
        return False
    if path.suffix.lower() in EXCLUDE_FILE_SUFFIXES:
        return False
    return path.is_file()



def collect_project_files(mode: str) -> list[Path]:
    suspicious_paths = find_suspicious_paths(ROOT)
    if suspicious_paths:
        preview = ', '.join(str(path.relative_to(ROOT)) for path in suspicious_paths[:5])
        raise RuntimeError(f'Source tree still contains suspicious path names: {preview}')

    all_files = [path.relative_to(ROOT) for path in ROOT.rglob('*') if should_include(path)]
    if mode == 'full':
        return sorted(all_files)

    runtime_files: list[Path] = []
    for rel in all_files:
        if rel in RUNTIME_INCLUDE_FILES or any(rel == prefix or prefix in rel.parents for prefix in RUNTIME_INCLUDE_PREFIXES):
            runtime_files.append(rel)
    return sorted(runtime_files)



def run_step(command: list[str], label: str) -> None:
    print(f'==> {label}')
    subprocess.run(command, cwd=ROOT, check=True)



def compile_python_sources() -> None:
    print('==> Python compileall check')
    ok = compileall.compile_dir(ROOT / 'app', quiet=1)
    ok = compileall.compile_dir(ROOT / 'scripts', quiet=1) and ok
    if not ok:
        raise RuntimeError('compileall check failed')



def file_sha256(path: Path) -> str:
    digest = sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()



def build_release_manifest(archive_path: Path, files: list[Path], mode: str) -> dict[str, object]:
    key_files = [
        Path('xingce_v3/xingce_v3.html'),
        Path('xingce_v3/styles/legacy-app.bundle.css'),
        Path('xingce_v3/modules/legacy-app.bundle.js'),
        Path('app/main.py'),
        Path('app/core.py'),
        Path('scripts/build_legacy_assets.py'),
        Path('scripts/check_legacy_entry.py'),
        Path('scripts/check_router_layout.py'),
        Path('scripts/smoke_test_legacy_app.py'),
        Path('scripts/package_release.py'),
        Path('scripts/check_archive_names.py'),
        Path('scripts/normalize_escaped_filenames.py'),
    ]
    return {
        'built_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'mode': mode,
        'archive': {
            'path': str(archive_path),
            'sha256': file_sha256(archive_path),
        },
        'files': {
            'count': len(files),
            'sample': [str(path) for path in files[:25]],
        },
        'key_file_sha256': {
            str(path): file_sha256(ROOT / path)
            for path in key_files
            if (ROOT / path).exists()
        },
        'checks': [
            'scripts/build_legacy_assets.py',
            'scripts/check_legacy_entry.py',
            'scripts/check_router_layout.py',
            'scripts/smoke_test_legacy_app.py',
            'compileall app/ scripts/',
            'source-path suspicious-name check',
            'archive UTF-8 name self-check',
        ],
    }



def main() -> None:
    parser = argparse.ArgumentParser(description='Build and verify a release zip for the project.')
    parser.add_argument('--output-dir', type=Path, default=DEFAULT_OUTPUT_DIR, help='Directory where the release zip will be written.')
    parser.add_argument('--name', type=str, default=None, help='Optional archive filename (must end with .zip).')
    parser.add_argument('--skip-smoke', action='store_true', help='Skip the live smoke test.')
    parser.add_argument('--mode', choices=('full', 'runtime'), default='full', help='Build a full source release or a slimmer runtime release.')
    args = parser.parse_args()

    run_step([sys.executable, 'scripts/build_legacy_assets.py'], 'Rebuild legacy bundles')
    run_step([sys.executable, 'scripts/check_legacy_entry.py'], 'Check legacy entry wiring')
    run_step([sys.executable, 'scripts/check_router_layout.py'], 'Check router layout')
    compile_python_sources()
    if not args.skip_smoke:
        run_step([sys.executable, 'scripts/smoke_test_legacy_app.py'], 'Run legacy smoke test')

    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    archive_name = args.name or f'error_analysis_release_{args.mode}_{timestamp}.zip'
    if not archive_name.endswith('.zip'):
        raise SystemExit('Archive name must end with .zip')

    files = collect_project_files(args.mode)
    archive_path = args.output_dir / archive_name
    create_zip_archive(ROOT, archive_path, files)
    assert_archive_extract_roundtrip(archive_path)

    manifest = build_release_manifest(archive_path, files, args.mode)
    manifest_path = args.output_dir / archive_name.replace('.zip', '.manifest.json')
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print('==> Release package ready')
    print(f'- Mode: {args.mode}')
    print(f'- Archive: {archive_path}')
    print(f'- Manifest: {manifest_path}')
    print(f'- Files: {len(files)}')
    print(f'- Archive sha256: {manifest["archive"]["sha256"]}')


if __name__ == '__main__':
    main()
