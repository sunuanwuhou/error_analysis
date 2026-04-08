# DEVLOG

## 2026-04-09 - migration lessons learned codified

### Goal

Turn the mistakes made during `/next` migration into repository rules so future work does not repeat the same failure modes.

### Added

1. `docs/MIGRATION_LESSONS_LEARNED.md`

### Updated

1. `docs/NEXT_PREVIEW_GUARDRAILS.md`
2. `docs/RUNTIME_MIGRATION_PARITY_PLAN.md`

### Lessons formalized

1. no parity claims from UI shape alone
2. no homepage data wiring without explicit source-of-truth declaration
3. no default filters that can silently empty first-load lists
4. no preview success claims without browser-visible confirmation
5. no heavy optional requests or iframes on first paint
6. no migration progress reports when runtime truth and browser truth still disagree

### Why this matters

1. several migration mistakes came from assumption-led implementation instead of code-walk-led implementation
2. several false-positive checks happened because terminal/API verification passed while browser-visible behavior still failed
3. the project now needs explicit anti-regression rules inside the repo, not just in chat history

## 2026-04-08 - runtime baseline cleanup

### Goal

Remove entry-point ambiguity, lock the repo to the current Docker-served runtime chain, and clear obviously unused frontend code so future work lands on the path users actually open.

### Changed

1. removed the unused experimental `frontend/` Vite workspace from the repo
2. updated docs to state the real runtime chain: `app/login.html` -> `v51_frontend/index.html` -> `xingce_v3/` bundled assets
3. updated router and smoke self-checks to reflect `/v51` and `/v53` instead of the stale `/new` path
4. updated release packaging metadata so the active runtime entry is part of the release baseline

### Why

1. the real Docker runtime never served `frontend/`
2. keeping two frontend lines in the repo created repeated planning and delivery mistakes
3. the user wants a single correct planning baseline and a one-pass implementation path

### New baseline

1. unauthenticated entry: `app/login.html`
2. authenticated default entry: `v51_frontend/index.html`
3. active assets: `xingce_v3/` plus `v51_frontend/assets/`
4. legacy fallback route remains `/legacy` for `xingce_v3/xingce_v3.html`

### Migration planning follow-up

1. added `docs/MGMT_MIGRATION_BASELINE.md`
2. added `docs/RUNTIME_MIGRATION_PARITY_PLAN.md`
3. fixed the migration direction to “engineering baseline replacement with layout and capability parity”, not product redesign

## 2026-04-02 - documentation consolidation patch

### Goal

Write the real project context into the repository so future work can continue from the codebase itself instead of relying on chat memory.

### Added

1. `docs/README.md`
2. `docs/PROJECT_RULES.md`
3. `docs/CURRENT_SCOPE.md`
4. `docs/HANDOFF_CONTEXT.md`
5. `docs/RELEASE_CHECKLIST.md`
6. `docs/SELF_TEST_REPORT.md`

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
