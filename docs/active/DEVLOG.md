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

## 2026-04-18 - split continuation (workspace/modal/persistence)

### Goal

Continue structural split for large legacy files without AppState migration.

### Added

1. `xingce_v3/modules/main/workspace/36a-workspace-data-actions.js`
2. `xingce_v3/modules/main/modal/36b-entry-ai-and-save.js`
3. `xingce_v3/modules/main/persistence/05a-note-sync-and-history.js`
4. `xingce_v3/modules/main/modal/13a-quiz-canvas-feedback.js`

### Updated

1. `xingce_v3/modules/main/36-tab-coordination.js`
   - extracted scoped clear/delete/add and entry AI/save logic
2. `xingce_v3/modules/main/05-persistence.js`
   - extracted note-sync/history tail block
3. `xingce_v3/modules/main/13-quiz-flow.js`
   - extracted quiz canvas/feedback helper block
4. `scripts/release/legacy_assets_config.py`
   - updated split source mapping for new modules

### Bundle snapshot after this split

1. `legacy-app.home.bundle.js`: `240611 B` (`5582` lines)
2. `legacy-app.workspace.bundle.js`: `157116 B` (`3942` lines)
3. `legacy-app.modal.bundle.js`: `223740 B` (`5102` lines)
4. `legacy-app.bootstrap.bundle.js`: `7799 B` (`215` lines)

### Current guardrail signal

1. split build warning remains on modal threshold (`223740 B > 220000 B`)
2. this is intentional as warning-only (not blocking), and marks the next optimization target

## 2026-04-18 - all-line continuation patch (split + governance)

### Added

1. `xingce_v3/modules/main/workspace/36c-notes-view-helpers.js`
2. `xingce_v3/modules/main/persistence/05b-cloud-bootstrap-and-schedule.js`
3. `docs/active/MODULE_BOUNDARIES.md`

### Updated

1. `xingce_v3/modules/main/13-quiz-flow.js`
   - removed historical override chains
   - retained a single workflow override line for `note/direct/speed`
2. `xingce_v3/modules/main/36-tab-coordination.js`
   - extracted note-view helper block into `36c`
3. `xingce_v3/modules/main/05-persistence.js`
   - extracted cloud bootstrap/schedule policy block into `05b`
4. `scripts/release/build_legacy_assets.py`
   - added split bundle line threshold warning
   - added source file line threshold warning
5. `scripts/release/legacy_assets_config.py`
   - split mapping updates (`05b`, `36c`, modal/home rebalance)
   - added `VIEW_BUNDLE_LINE_WARNINGS` and `SOURCE_FILE_LINE_WARNING`
6. `scripts/check/check_repo_layout.py`
   - allowed legacy add-only prefix `modules/main/persistence/`
7. docs index/rules updated:
   - `docs/INDEX.md`
   - `docs/active/PROJECT_RULES.md`

### Bundle snapshot

1. `legacy-app.home.bundle.js`: `235935 B` (`5539` lines)
2. `legacy-app.workspace.bundle.js`: `166261 B` (`4116` lines)
3. `legacy-app.modal.bundle.js`: `194477 B` (`4356` lines)
4. `legacy-app.bootstrap.bundle.js`: `7799 B` (`215` lines)
5. `legacy-app.bundle.js`: `604247 B` (`14220` lines)

### Guardrail result

1. modal size threshold warning is cleared (`194477 B < 220000 B`)
2. source-line warnings now actively report monolith hotspots for next split steps

## 2026-04-18 - pre-feature final optimization pass

### Added

1. `xingce_v3/modules/main/workspace/36d-notes-tree-status.js`
2. `xingce_v3/modules/main/persistence/05c-cloud-restore-origin-utils.js`

### Updated

1. `xingce_v3/modules/main/13-quiz-flow.js`
   - removed old legacy quiz render/review function set
   - keep single active assignment chain to fenbi mode handlers
2. `xingce_v3/modules/main/36-tab-coordination.js`
   - extracted notes tree status rendering to `36d`
3. `xingce_v3/modules/main/05-persistence.js`
   - extracted cloud restore/origin utility block to `05c`
4. `scripts/release/legacy_assets_config.py`
   - registered `36d` and `05c` split modules

### New size snapshot

1. `legacy-app.home.bundle.js`: `231782 B` (`5453` lines)
2. `legacy-app.workspace.bundle.js`: `170005 B` (`4192` lines)
3. `legacy-app.modal.bundle.js`: `184692 B` (`4188` lines)
4. `legacy-app.bootstrap.bundle.js`: `7799 B` (`215` lines)
5. `legacy-app.bundle.js`: `594053 B` (`14042` lines)

### Monolith line reduction snapshot

1. `modules/main/13-quiz-flow.js`: `727 -> 559`
2. `modules/main/36-tab-coordination.js`: `706 -> 636`
3. `modules/main/05-persistence.js`: `1969 -> 1742`
