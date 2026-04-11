# DEVLOG

## 2026-04-10 - docker parity route-surface patch

### Goal

Keep Docker plus the existing domain/runtime chain unchanged, rebuild the app from the current branch, and continue the `/next` migration by closing route-surface gaps against the old workbench action map.

### Done

1. rebuilt the Docker app from the current branch while keeping the existing `8080` local entry and Cloudflare domain chain unchanged
2. verified the rebuilt Docker app still responds on `http://127.0.0.1:8080`
3. compared the current `/next` route surface against the migration docs and exposed workspace tool links
4. added `/next` route coverage for legacy `remarks` and `daily journal` tool entry points:
   - `/next/tools/remarks`
   - `/next/tools/remarks/daily-log`
   - `/next/tools/journal`
   - `/next/tools/journal/today`
   - `/next/tools/journal/template`
5. moved `/next/actions/dashboard` and `/next/tools/history` off embedded legacy wrappers and into native `/next` route-shell pages
6. rebuilt the dashboard/history route-shell content to preserve the old information structure:
   - dashboard keeps summary metrics, task pools, weakness groups, and reminders
   - history keeps session summary rows and adds recent attempt context from the current API
7. updated the bridge inventory to record the current parity findings

### Findings

1. route-level `LegacyBridgePage` cleanup is still at zero, but parity is not complete
2. `export`, `import`, `quick-import`, and `type-rules` remain wrapper-style `/next` routes
3. `dashboard` and `history` are now native `/next` pages, but still need browser-visible parity proof against legacy
4. `note viewer`, `note editor`, `knowledge manage`, `quick entry`, `practice`, and `process-image/canvas` now have native Vue pages, but still need browser-visible parity proof against legacy
5. the current migration risk is feature depth mismatch, not missing migration intent

### Self-test summary for this patch

1. `ui` production build passed
2. Docker rebuild and container restart passed
3. `http://127.0.0.1:8080` returned `200` after rebuild

## 2026-04-09 - next-only cutover plan locked

### Goal

Turn the migration direction from "stabilize legacy runtime while preview improves" into a precise execution plan for full `/next` takeover.

### Added

1. `docs/NEXT_CUTOVER_EXECUTION_PLAN.md`
2. `docs/NEXT_SCREENSHOT_PARITY_BASELINE.md`
3. `docs/NEXT_BRIDGE_INVENTORY.md`

### Updated

1. `docs/RUNTIME_MIGRATION_PARITY_PLAN.md`
2. `docs/README.md`

### Decision locked

1. `/next` is the only accepted long-term frontend destination
2. legacy remains parity reference and temporary bridge only
3. migration must proceed by workflow slices, not by scattered page rewrites
4. each migrated slice must delete bridges instead of creating permanent dual ownership
5. final success means authenticated `/` serves `ui/dist/index.html`
6. screenshot comparison against original pages is now a required migration artifact
7. current `/next` bridge routes are now explicitly inventoried and assigned deletion owners

## 2026-04-09 - first native workspace bridges removed

### Goal

Start turning `/next` into a real product surface instead of a shell that only launches legacy pages.

### Changed

1. `/next/workspace/errors` now renders `WorkspacePage.vue` natively
2. `/next/workspace/notes` now renders `WorkspacePage.vue` natively
3. `WorkspacePage.vue` now supports route-driven home, error-workspace, and notes-workspace modes
4. `ui/src/styles.css` now includes workspace-mode layout support

### Result

1. two core workspace routes no longer depend on `LegacyBridgePage`
2. current `/next` native route count increased from 1 to 3
3. current `/next` bridge count decreased from 53 to 51

## 2026-04-09 - task-lane workspace bridges removed

### Goal

Keep shrinking the core workspace bridge surface before moving deeper into action-level flows.

### Changed

1. `/next/workspace/tasks/errors` now renders `WorkspacePage.vue` natively
2. `/next/workspace/tasks/notes` now renders `WorkspacePage.vue` natively
3. `WorkspacePage.vue` now supports native task-lane modes backed by the same workbench queue data

### Result

1. the four main workspace routes under `/next/workspace/**` are now native
2. current `/next` native route count increased from 3 to 5
3. current `/next` bridge count decreased from 51 to 49

## 2026-04-09 - route-level bridge inventory cleared

### Goal

Remove `LegacyBridgePage` as the routing layer so every `/next` route now lands on a native Vue page instead of an immediate redirect shell.

### Changed

1. added `ui/src/views/RouteShellPage.vue`
2. rewrote `ui/src/router/index.ts` to remove all `LegacyBridgePage` route usage
3. moved login, backup, search, action-shell, and embedded-shell routes onto native `/next` views

### Result

1. `LegacyBridgePage` is no longer referenced from `ui/src/router/index.ts`
2. route-level `/next` bridge count is now 0
3. the remaining work is deeper feature replacement and screenshot parity, not route redirect cleanup

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
## 2026-04-10 `/next` import/type-rules native migration

- Kept the Docker/domain chain unchanged and continued the legacy-to-`/next` migration inside the current branch.
- Moved `/next/tools/import`, `/next/tools/quick-import`, and `/next/tools/type-rules` off embedded legacy wrappers and into native `RouteShellPage` surfaces.
- Preserved the old import interaction order: file-first full-backup detection, manual JSON paste, merge/replace choice, and type-rule editing with keyword/type/subtype rows.
- Reused the existing backup snapshot API instead of inventing a parallel persistence path, so imported data and type rules still land in the same workspace snapshot the old product uses.
- Added a knowledge-scoped `JSON导入` entry inside the native notes workspace so quick import can inherit the currently selected knowledge node and keep the old in-context import experience.
- Moved `/next/tools/export` to a native route-shell page and passed workspace filters / selected knowledge node into it so the old “current scope” export behavior can continue without reopening the legacy shell.
- Tightened the native knowledge-tree experience in `WorkspacePage.vue`: the sidebar now keeps a visible current focus block, the note workspace gained parent/sibling/child navigation, and knowledge-scoped error filtering now follows the full subtree so behavior matches the old workspace more closely.
- Wired the native knowledge-tree workspace back into the native node management pages: current-node actions now jump directly to edit/move/directory pages, and `KnowledgeManagePage.vue` now keeps the same current-node focus, path, sibling navigation, and return links so the user stays inside one consistent knowledge-tree workflow.
- Added encoding guardrails before continuing parity work: introduced `.editorconfig`, `.gitattributes`, and `scripts/check_text_encoding.py`, then repaired the visible `/next` router metadata strings that had already drifted into mojibake so future button-parity work has a stable UTF-8 baseline.
