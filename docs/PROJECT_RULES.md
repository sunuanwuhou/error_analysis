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

1. `docs/PROJECT_RULES.md`
2. `docs/CURRENT_SCOPE.md`
3. `docs/HANDOFF_CONTEXT.md`
4. `docs/DEVLOG.md`
5. `docs/RELEASE_CHECKLIST.md`
6. `docs/SELF_TEST_REPORT.md`

## Frontend cache-bust rule

When the active runtime is the legacy entry (`v51_frontend` + `legacy-app.bundle.js`), runtime restart alone is not enough to prove frontend changes are live.

Required rule after any user-visible change in `xingce_v3/modules/legacy-app.bundle.js`:

1. bump `xingce_v3/legacy-app.bundle.manifest.json` field `built_at`
2. deploy updated bundle + manifest to the runtime that serves the target URL
3. verify the served manifest `built_at` is the new value
4. then ask for browser hard refresh (`Ctrl + F5`) and continue verification

This rule exists to prevent stale-bundle misdiagnosis during restart/debug cycles.

## Packaging rules

1. before final delivery, archive names must be checked
2. avoid broken Chinese filename encoding in archives
3. prefer packaging paths and filenames that do not create escaped names or garbled extraction results
4. package contents and names must be self-checked before handoff

## Honesty rules

1. do not claim a feature is complete unless the code path or runtime behavior has been checked
2. separate confirmed current behavior from target behavior
3. record known gaps explicitly
