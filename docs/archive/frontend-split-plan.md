# Frontend Split Plan

## Goal

Move `xingce_v3.html` away from one giant page without changing the current FastAPI contract.

## Keep Stable

1. login flow
2. hybrid sync behavior
3. knowledge-tree data shape
4. error editor modal fields
5. current two-pane active layout

## Current Active Layout

The active product layout is now:

1. left navigation tree
2. center workspace

The old right-side related-errors rail is no longer part of the active layout and should not drive the split plan.

## Proposed Modules

### Core State

- `workspace-store.js`
- `cloud-sync-store.js`
- `knowledge-tree-store.js`
- `ai-tools-store.js`

### Panels

- `knowledge-tree-panel.js`
- `knowledge-workspace-panel.js`
- `error-list-panel.js`
- `top-bar-panel.js`

### Modals

- `error-editor-modal.js`
- `knowledge-node-modal.js`
- `knowledge-move-modal.js`
- `import-export-modal.js`
- `ai-tools-modal.js`

### Shared Rendering

- `markdown-render.js`
- `error-card-render.js`
- `toast.js`
- `dom-utils.js`

## Extraction Order

1. toast and small DOM helpers
2. top bar and cloud controls
3. error list panel
4. knowledge tree panel
5. knowledge workspace panel
6. AI tools modal
7. remaining modal and compatibility helpers

## Safety Rules

1. extract one module group at a time
2. do not mix module split with schema changes
3. keep the current runtime behavior stable after each extraction
4. continue treating legacy compatibility helpers as temporary, not product shape

## Done When

1. `xingce_v3.html` no longer owns the whole active UI directly
2. top bar, tree, workspace, and AI tools can be iterated independently
3. further layout cleanup no longer requires editing one giant inline script/style block
