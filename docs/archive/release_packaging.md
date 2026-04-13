# Release packaging and archive safety

## Goal

This project now includes a release packaging flow that does six things before shipping a zip:

- rebuilds the current legacy entry bundles
- checks that the real legacy entry still points at the expected assets
- checks that the FastAPI route map is still wired to the expected router modules
- runs a live backend smoke test against the real app entry
- refuses to package if the source tree still contains suspicious `#U...` file names
- validates the archive entry names and extraction roundtrip so path encoding problems are caught before delivery

## Main commands

### 1. Build and verify a full source release zip

```bash
python scripts/package_release.py --mode full --output-dir dist
```

This command will:

1. rebuild `xingce_v3/styles/legacy-app.bundle.css` and `xingce_v3/modules/legacy-app.bundle.js`
2. run `scripts/check_legacy_entry.py`
3. run `scripts/check_router_layout.py`
4. run `compileall` for `app/` and `scripts/`
5. run `scripts/smoke_test_legacy_app.py`
6. create a zip archive
7. extract the archive to a temp directory and verify the extracted paths match the archive entries
8. write a manifest json with archive and key-file checksums

### 2. Build a slimmer runtime release zip

```bash
python scripts/package_release.py --mode runtime --output-dir dist
```

Runtime mode keeps the deployable app, legacy assets, and release-check scripts, while excluding heavy source-side content that is not required for direct runtime deployment.

### 3. Check the router layout after refactors

```bash
python scripts/check_router_layout.py
```

This verifies that the expected paths are still registered and still point at the intended router modules after backend refactors.

### 4. Check an existing archive for path-name issues

```bash
python scripts/check_archive_names.py dist/your_release.zip
```

This check is designed to catch delivery problems such as:

- suspicious `#U...` path names
- backslash-style archive paths
- absolute archive paths
- extraction roundtrip mismatches

### 5. Normalize existing `#U...` file names in the source tree

```bash
python scripts/normalize_escaped_filenames.py
python scripts/normalize_escaped_filenames.py --apply
```

The release packager also refuses to build if the source tree itself still contains suspicious `#U...` paths.

## Packaging rules

The release packager excludes runtime and cache noise that should not overwrite a live project by accident:

- `data/xingce.db`
- `__pycache__/`
- `.pyc` / `.pyo`
- nested `.zip`
- `.idea/`
- `dist/`
- `node_modules/`

Runtime mode further narrows the package to the live app, legacy entry assets, release docs, and the verification scripts needed to rebuild or re-check the deployable entry.

## Recommended delivery flow

```bash
python scripts/normalize_escaped_filenames.py --apply
python scripts/package_release.py --mode runtime --output-dir dist
python scripts/check_archive_names.py dist/error_analysis_release_runtime_YYYYMMDDTHHMMSSZ.zip
```

Only deliver the archive after all commands pass.
