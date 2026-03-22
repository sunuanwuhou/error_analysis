# Frontend Split Plan

## Goal

Move `xingce_v3.html` away from a single giant page without changing the current FastAPI backend contract.

## Keep Stable

1. login flow
2. full-backup cloud sync
3. knowledge tree data shape
4. error editor modal fields
5. right-panel related error flow

## Proposed Frontend Modules

### Core State

- `workspace-store.js`
- `cloud-sync-store.js`
- `knowledge-tree-store.js`

### Panels

- `knowledge-tree-panel.js`
- `knowledge-workspace-panel.js`
- `related-errors-panel.js`
- `error-list-panel.js`

### Modals

- `error-editor-modal.js`
- `knowledge-node-modal.js`
- `knowledge-move-modal.js`
- `import-export-modal.js`

### Shared Rendering

- `markdown-render.js`
- `error-card-render.js`
- `toast.js`
- `dom-utils.js`

## Extraction Order

1. toast and small DOM helpers
2. right-panel related errors
3. knowledge tree panel
4. knowledge node modal
5. center knowledge workspace
6. remaining import/export and legacy support

## Current Status

- static asset serving is the first prerequisite
- the first extracted module should own:
  - knowledge tree rendering
  - right-panel related errors rendering
  - related helper actions and toggles
- the center workspace render is the second extracted module:
  - `renderKnowledgeNotesViewV2`
  - `renderNotesByType`
  - knowledge workspace helper rendering
- the knowledge-node interaction layer is the third extracted module:
  - knowledge node modal open/submit/render
  - error move modal open/apply/render
  - node drag/drop and error drag/drop reassignment
  - node move/delete/rename action handlers
- the main HTML still keeps compatibility functions, but the active three-panel path is now overridden from external modules

## Safety Rules

1. extract one module at a time
2. after each extraction, keep runtime HTML behavior unchanged
3. do not couple the split with backend or data-model changes
4. keep `notesByType` compatibility only until active UI is fully detached from it

## Done When

1. the main file no longer owns all three panels directly
2. right-panel and knowledge-tree logic can be edited independently
3. removing legacy compatibility paths becomes straightforward
