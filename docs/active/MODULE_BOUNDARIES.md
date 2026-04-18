# MODULE_BOUNDARIES

## Purpose

Prevent split regression and accidental cross-module coupling.

## Main module ownership

1. `modules/main/05-persistence.js`
- Owns DB read/write, cloud API IO, incremental sync core.
- Must not contain notes-view rendering logic.

2. `modules/main/persistence/05a-note-sync-and-history.js`
- Owns note image refs, note sync, today/history helpers.
- Must not call cloud network APIs directly.

3. `modules/main/persistence/05b-cloud-bootstrap-and-schedule.js`
- Owns cloud bootstrap policy and scheduling decisions.
- Must not render UI trees/cards.

4. `modules/main/36-tab-coordination.js`
- Owns app-view/tab coordination and notes workspace orchestration.
- Must not own add/save/delete data mutation internals.

5. `modules/main/workspace/36a-workspace-data-actions.js`
- Owns scoped clear/delete/add mutation actions for workspace data.
- Must not own AI analyze modal logic.

6. `modules/main/workspace/36c-notes-view-helpers.js`
- Owns notes preview/TOC/workspace header helper rendering.
- Must not mutate cloud state or persistence ops.

7. `modules/main/modal/36b-entry-ai-and-save.js`
- Owns entry-modal AI analyze + save/update workflow.
- Must not own tab switching coordination.

8. `modules/main/13-quiz-flow.js`
- Owns quiz session orchestration and workflow-mode queue entry.
- Must not reintroduce multi-version override chains.

9. `modules/main/modal/13a-quiz-canvas-feedback.js`
- Owns quiz canvas, scratch pad, answer feedback rendering helpers.
- Must not own session selection / queue sourcing policy.

## Hard rules

1. New cross-cutting helper must go to a dedicated split file, not back into `05` or `36` monoliths.
2. No duplicate re-assignment chains like repeated `renderX = function ...` for the same behavior line.
3. `legacy_assets_config.py` is the only source of truth for split bundle composition.
4. If adding a new `modules/main/**` file over `500` lines, split first and then merge.
