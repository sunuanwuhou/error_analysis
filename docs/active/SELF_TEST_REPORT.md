# SELF_TEST_REPORT

## Patch under test

Documentation consolidation patch created on 2026-04-02.

## What was changed

1. added a stable documentation set for project rules, scope, handoff, devlog, release checklist, and self-test report
2. updated root `README.md` to point future work to the new doc set
3. updated router and smoke self-test scripts so checks match the actual current practice-attempt routes

## Checks executed

### 1. Legacy assets rebuild

Command:

```bash
python scripts/build_legacy_assets.py
```

Result:

Passed.

### 2. Legacy entry wiring check

Command:

```bash
python scripts/check_legacy_entry.py
```

Result:

Passed.

### 3. Router layout check

Command:

```bash
python scripts/check_router_layout.py
```

Result:

Passed after updating the expected route list to include the already-existing practice-attempt routes.

### 4. Python compile checks

Command:

```bash
python -m compileall app scripts
```

Result:

Passed.

### 5. Legacy smoke test

Command:

```bash
python scripts/smoke_test_legacy_app.py
```

Result:

Passed.

This confirmed that the app booted, auth flow worked in the smoke path, legacy assets were served, runtime info loaded, sync endpoints responded, practice logging worked, practice-attempt write/read worked, knowledge search responded, and codex thread/message flow worked.

### 6. Full-source packaging attempt

Command:

```bash
python scripts/package_release.py --mode full --name error_analysis_docs_patch_full_20260402.zip
```

Result:

Intentionally not used as the final delivery artifact.
The packaging guard correctly stopped the build because the repo still contains pre-existing `#U...` escaped filenames under non-patch areas such as `knowledge_sources/` and `converter/output/`.

### 7. Final patch archive creation

Method:

- built a patch-only zip with the changed docs and self-test scripts
- generated a manifest for the patch archive

Result:

Passed.

### 8. Archive name self-check

Command:

```bash
python scripts/check_archive_names.py dist/error_analysis_docs_patch_20260402.zip
```

Result:

Passed.

## Known limitation of this patch

This patch focuses on documentation truth and delivery discipline.
It does not by itself complete the missing modern process image or canvas schema integration.

## Packaging note

The final delivered artifact is the clean patch package:

- `dist/error_analysis_docs_patch_20260402.zip`

This avoids shipping a full archive with known pre-existing escaped filename debt.
