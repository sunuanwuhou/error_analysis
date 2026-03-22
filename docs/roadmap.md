# xingce_v3_lab Roadmap

## Current Goal

Keep `xingce_v3_lab` focused on one thing:

1. manual question entry
2. manual analysis storage
3. knowledge-tree-based note taking
4. per-user cloud-backed sync

This project is no longer on the Excel/OCR-first path.

## Fixed Product Rules

1. Keep the knowledge tree as the single study structure.
2. A knowledge node itself can hold Markdown.
3. Errors can bind directly to any knowledge node.
4. The left panel is navigation, not an admin console.
5. The center panel is always the current knowledge node workspace.
6. The right panel is always the current node's related errors.
7. Legacy compatibility data may stay in storage, but it must not drive the main UI anymore.

## What Is Done

### Phase 1: Cloud-backed workbench

- dedicated login page
- per-user backup storage
- Docker + Cloudflare entry
- local/cloud backup restore flow

### Phase 2: Knowledge tree foundation

- knowledge tree became the main note structure
- `errors[].noteNodeId` added
- node itself can now store `contentMd`
- error-to-node binding and drag reassignment work
- node delete / move / rename are supported

### Phase 3: Tree interaction cleanup

- left tree now defaults to collapsed navigation
- noisy per-node action buttons removed from the tree
- node create / rename / move moved into a unified modal
- selected node path auto-expands

## Current Priority

1. Make the right related-errors panel semantically clear:
   - direct errors
   - descendants-included errors
2. Remove remaining active old compatibility UI paths from the main experience.
3. Continue reducing 鈥減rototype/admin鈥?feel without changing core behavior.

## Still Open

### P0

- add explicit right-panel relation mode switching
- align header counts with the selected relation mode
- make the right panel self-sufficient for reading
  - full question details stay in the right panel
  - remove jump-to-note / jump-to-list as primary actions

### P1

- reduce legacy compatibility rendering paths in `xingce_v3.html`
- hide or retire old note-type UI from active flow
- make right-panel and workspace wording fully consistent

### P2

- split the giant single HTML page into maintainable modules
- keep FastAPI backend unchanged while moving the frontend to structured modules

## Acceptance Standard

The current stage is only 鈥渄one鈥?when:

1. left tree is readable at a glance
2. current node can always be edited directly in the center
3. right panel clearly tells whether it shows direct errors or descendants
4. right panel can show a full related error without forced navigation
5. node operations no longer rely on prompt-driven flows
6. users do not need to understand the internal data model to use the UI
## Current Baseline

- latest baseline commit when this roadmap was refreshed: `d407f5d`

## Next Working Order

1. right-panel relation mode
2. compatibility cleanup on active paths
3. module split preparation
