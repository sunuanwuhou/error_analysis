# PROJECT_RULES

## Project purpose

This system exists to improve exam scores.
The system is a tool, not the final goal.

## Current stage priority

At the current stage, the first priority is to finish and stabilize the system itself.
Only after the system is usable and complete should the project move back into large-scale note input and score improvement execution.

Priority order:

1. system completeness
2. stable delivery
3. efficient note entry and review flow
4. later AI or advanced automation

## Delivery rules

1. deliver usable results directly, not endless discussion
2. the assistant must self-test before delivery
3. do not push the testing burden back to the user
4. each delivery should include updated project docs
5. every release should clearly state what is done, what is missing, and what was actually tested
6. for this docker runtime, any code change must be treated as not-live until the app container has been rebuilt and the served result has been re-verified

## Product rules

1. new versions should inherit the old useful workflow instead of replacing it with a different product shape
2. core layout, button position, and main interaction flow should stay aligned with the user's established usage habits whenever possible
3. non-core flashy features are lower priority than stable data flow and review flow
4. registration should not become an active user-facing product goal for the current phase

## Data rules

The project must preserve and expose the full study chain for each question as much as possible.

Each error/practice record should eventually support:

1. question content
2. answer and my answer
3. classification and knowledge-point binding
4. status and review state
5. structured error analysis
6. source info
7. images
8. process image or canvas data
9. notes and later review trace

## Structured error analysis rules

Structured error analysis is required capability, not optional decoration.
The target structure should include at least:

1. error type
2. trigger point
3. correct model
4. next action

If the live schema is not fully aligned yet, the gap must be documented rather than hidden.

## Documentation rules

Chat memory is not enough.
All important information must be written into repository docs and shipped with the code.

The minimum persistent doc set is:

1. `docs/active/PROJECT_RULES.md`
2. `docs/active/CURRENT_SCOPE.md`
3. `docs/active/HANDOFF_CONTEXT.md`
4. `docs/active/DEVLOG.md`
5. `docs/active/RELEASE_CHECKLIST.md`
6. `docs/active/SELF_TEST_REPORT.md`
7. `docs/active/MODULE_BOUNDARIES.md`

## Frontend cache-bust rule

When the active runtime is the current shell (`v51_frontend/index.html` -> `v53-bootstrap.js` -> `legacy-app.bundle.manifest.json` -> split legacy bundles), runtime restart alone is not enough to prove frontend changes are live.

Required rule after any user-visible change in the served legacy assets under `xingce_v3/modules/` or `xingce_v3/styles/`:

1. bump `xingce_v3/legacy-app.bundle.manifest.json` field `built_at`
2. deploy updated split bundles and manifest to the runtime that serves the target URL
3. verify the served manifest `built_at` is the new value
4. then ask for browser hard refresh (`Ctrl + F5`) and continue verification

This rule exists to prevent stale-bundle misdiagnosis during restart/debug cycles.

## Container deployment verification rule

This project serves app code and static assets from the app container image.
For many changes, editing repository files alone does not update the live runtime.

Mandatory rule after backend or frontend code changes:

1. rebuild/redeploy the app container through WSL:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action up -Service app`
2. do not assume browser refresh, hard refresh, or incognito mode can bypass an old container image
3. verify the live service output directly after deploy
4. for frontend issues, prefer verifying the actual served asset content from:
   - `http://127.0.0.1:8080/assets/...`
5. only after container rebuild + served-asset verification may the change be described as deployed

This rule exists because `/assets` is served from files inside the running container image, not from the local working tree alone.

## Runtime entry contract

Current active authenticated entry:

1. `/` returns `v51_frontend/index.html`
2. `v51_frontend/assets/v53-bootstrap.js` loads `xingce_v3/legacy-app.bundle.manifest.json`
3. the manifest points the browser to `legacy-app.home/workspace/modal/bootstrap.bundle.js`

Working rules:

1. do not assume `xingce_v3/xingce_v3.html` is the active root page for logged-in users
2. do not patch only the monolithic `legacy-app.bundle.js` and assume the live shell will use it
3. before frontend debugging, confirm which served bundle the active page actually loads
4. if a legacy fallback path still exists, document it explicitly instead of treating it as the main runtime

## Note scroll contract (2026-04-12)

For knowledge-note preview pages, the target interaction is fixed:

1. left TOC scrolls independently
2. right note body scrolls independently
3. clicking left TOC item scrolls right body to the anchor

Mandatory implementation contract:

1. `#notesContent` must include class `knowledge-notes-active` before rendering note workspace
2. note preview container must have fixed viewport height in both edit and read modes (never rely on `height:auto` for this view)
3. TOC auto-follow should scroll the real list container (`.note-toc-list`) instead of an outer wrapper when they differ

Mandatory debug order for this issue type:

1. verify active runtime JS entry first (do not patch inactive legacy/module path)
2. verify served bundle contains the expected marker code
3. verify `knowledge-notes-active` exists in live DOM
4. then validate CSS overflow/height chain from parent to child

## Packaging rules

1. before final delivery, archive names must be checked
2. avoid broken Chinese filename encoding in archives
3. prefer packaging paths and filenames that do not create escaped names or garbled extraction results
4. package contents and names must be self-checked before handoff

## Honesty rules

1. do not claim a feature is complete unless the code path or runtime behavior has been checked
2. separate confirmed current behavior from target behavior
3. record known gaps explicitly
