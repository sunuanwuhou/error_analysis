# DEVLOG

## 2026-04-02 - documentation consolidation patch

### Goal

Write the real project context into the repository so future work can continue from the codebase itself instead of relying on chat memory.

### Added

1. `docs/README.md`
2. `docs/active/PROJECT_RULES.md`
3. `docs/active/CURRENT_SCOPE.md`
4. `docs/active/HANDOFF_CONTEXT.md`
5. `docs/active/RELEASE_CHECKLIST.md`
6. `docs/active/SELF_TEST_REPORT.md`

### Updated

1. `README.md`
2. `scripts/check_router_layout.py`
3. `scripts/smoke_test_legacy_app.py`

### What this patch fixes

1. project rules are now explicit inside the repo
2. the current stage is fixed as system-first
3. current capability versus current gap is documented separately
4. delivery expectations are now part of the shipped code package
5. future sessions have a handoff anchor in the repo
6. router self-check now reflects the actual practice-attempt routes already present in the app
7. smoke coverage now touches practice-attempt write and read flow
8. final delivery now has a clean patch archive path even though the full repo still contains pre-existing escaped filename debt outside the patch scope

### Important findings captured in docs

1. the modern frontend already supports OCR-assisted quick entry, knowledge binding, source fields, and question image upload
2. the legacy chain still includes process-image related functionality
3. the modern typed schema does not yet fully carry process image or canvas as a first-class field
4. structured error analysis target fields are richer than the currently normalized live model
5. full-source packaging is currently blocked by pre-existing `#U...` escaped filenames in non-patch areas, and this was detected during self-test instead of being hidden

### Self-test summary for this patch

1. legacy asset rebuild check passed
2. legacy entry wiring check passed
3. router layout check passed
4. Python compile checks passed
5. legacy smoke test passed
6. clean patch archive creation passed
7. archive name self-check passed

### Next recommended code patch after this doc patch

1. add process image or canvas fields into the modern schema and save path
2. extend structured error analysis fields beyond rootReason and errorReason
3. clean the repo-level escaped filename debt in `knowledge_sources/` and `converter/output/` before attempting a full-source release archive again
4. verify export payload includes the richer fields after schema expansion

## 2026-04-18 - legacy split hardening and doc layout normalization

### Goal

Continue the legacy split line without introducing AppState migration in this patch, and add build-time guardrails to prevent split regression.

### Added

1. `scripts/release/legacy_assets_config.py` now includes split governance config:
   - `VIEW_BUNDLE_SIZE_WARNINGS`
   - `DUPLICATE_FUNCTION_NAME_ALLOWLIST`
   - `DUPLICATE_FUNCTION_SCAN_PREFIXES`
2. docs structure normalization:
   - `docs/INDEX.md`
   - `docs/active/README.md`
   - `docs/ops/README.md`
   - `docs/roadmap/README.md`

### Updated

1. `scripts/release/build_legacy_assets.py`
   - added duplicate function-name warning scanner
   - added split bundle size threshold warnings
2. split assignment in `scripts/release/legacy_assets_config.py`
   - moved quiz-heavy and modal-interaction modules out of `home` into `modal`
3. continued tree/module split files under:
   - `xingce_v3/modules/main/workspace/`
   - `xingce_v3/modules/main/modal/`
   - `xingce_v3/modules/main/knowledge/`
4. repository layout checker and doc links to match the new `docs/{active,ops,roadmap,archive}` structure

### Result snapshot

1. `legacy-app.home.bundle.js`: `263595 B` (`6109` lines)
2. `legacy-app.workspace.bundle.js`: `150363 B` (`3748` lines)
3. `legacy-app.modal.bundle.js`: `209709 B` (`4591` lines)
4. `legacy-app.bootstrap.bundle.js`: `7799 B` (`215` lines)

### Self-test summary

1. `python3 -m py_compile scripts/release/build_legacy_assets.py scripts/release/legacy_assets_config.py`
2. `python3 scripts/release/build_legacy_assets.py`
3. `python3 scripts/check_legacy_entry.py`
4. `python3 scripts/check_repo_layout.py`
