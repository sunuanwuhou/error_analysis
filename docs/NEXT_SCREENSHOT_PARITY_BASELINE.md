# NEXT_SCREENSHOT_PARITY_BASELINE

## Purpose

This document makes screenshot comparison a required migration artifact instead of an optional habit.

The rule is simple:

1. legacy is the visual and interaction baseline
2. `/next` must be compared against that baseline
3. parity claims are not accepted without screenshot evidence

## Required comparison method

For every migrated slice:

1. open the legacy route for the same workflow state
2. capture the legacy screenshot
3. open the `/next` route for the same workflow state
4. capture the `/next` screenshot
5. compare layout, action visibility, information density, and path depth
6. record any intentional differences before calling the slice complete

## Required viewport matrix

Every screenshot baseline must be captured in at least:

1. desktop workspace width
2. mobile width

If a slice is primarily tablet-like or split-pane sensitive, add:

1. medium width workspace view

## Required states per slice

Each slice should capture the smallest set of states that proves the real workflow.

### Core states

1. first useful loaded state
2. primary interaction state
3. completed or post-action state

### Modal or tool states

If the slice uses a modal, drawer, or focused tool page, also capture:

1. entry state before open
2. opened state
3. saved or confirmed state if applicable

## Comparison checklist

Check all of these:

1. Is the main focus area in the same practical place?
2. Is the primary action visible at similar practical depth?
3. Is the page visually recognizable as the same workflow?
4. Is important information missing or pushed below the fold?
5. Did `/next` introduce extra chrome that steals focus from the workflow?
6. Does mobile still expose the same action path without hunting?

## Route comparison matrix

This matrix defines the required screenshot pairs for the current known migration surface.

### Shell and home

1. legacy baseline: `/`
2. `/next` target: `/next/workspace`
3. required states:
   - loaded home shell
   - visible navigation
   - visible quick actions

### Error workspace

1. legacy baseline: `/?home_action=workspace_errors`
2. `/next` target: `/next/workspace/errors`
3. required states:
   - neutral default list
   - filtered list
   - card action visible

### Notes workspace

1. legacy baseline: `/?home_action=workspace_notes`
2. `/next` target: `/next/workspace/notes`
3. required states:
   - initial workspace
   - node or note selected

### Error task lane

1. legacy baseline: `/?home_action=taskview_errors`
2. `/next` target: future `/next/workspace/tasks/errors`
3. required states:
   - task lane loaded
   - active task highlighted

### Notes task lane

1. legacy baseline: `/?home_action=taskview_notes`
2. `/next` target: future `/next/workspace/tasks/notes`
3. required states:
   - task lane loaded
   - active note task highlighted

### Quick add

1. legacy baseline: `/?home_action=quickadd`
2. `/next` target: future `/next/actions/quickadd` or equivalent native flow
3. required states:
   - entry open
   - OCR/image controls visible if part of the same flow

### Cloud load and cloud save

1. legacy baseline: `/?home_action=cloud_load`
2. legacy baseline: `/?home_action=cloud_save`
3. `/next` target: future native `/next` actions
4. required states:
   - action trigger visible
   - confirmation or result visible

### Practice flows

1. legacy baseline: `/?home_action=daily`
2. legacy baseline: `/?home_action=full`
3. legacy baseline: `/?home_action=note`
4. legacy baseline: `/?home_action=direct`
5. legacy baseline: `/?home_action=speed`
6. `/next` target: future native practice routes
7. required states:
   - queue view
   - question entry view
   - post-submit state

### Dashboard and history

1. legacy baseline: `/?home_action=dashboard`
2. legacy baseline: `/?home_action=history`
3. `/next` target: future native dashboard and history routes
4. required states:
   - loaded list or dashboard
   - key metrics visible

### Backup tools

1. legacy baseline: `/?home_action=local_backup`
2. legacy baseline: `/?home_action=local_backup_restore`
3. legacy baseline: `/?home_action=local_backup_delete`
4. `/next` target: future native backup routes
5. required states:
   - list view
   - restore confirmation
   - delete confirmation

### Search and import tools

1. legacy baseline: `/?home_action=global_search`
2. legacy baseline: `/?home_action=import`
3. legacy baseline: `/?home_action=quick_import`
4. `/next` target: future native tool routes
5. required states:
   - loaded tool view
   - primary action ready

### Knowledge dialogs

1. legacy baseline: `/?home_action=dir_modal`
2. legacy baseline: `/?home_action=knowledge_move`
3. legacy baseline: `/?home_action=knowledge_node`
4. `/next` target: future native dialog routes
5. required states:
   - dialog open
   - form controls visible

### Note pages

1. legacy baseline: `/assets/note_editor.html`
2. legacy baseline: `/assets/note_viewer.html`
3. `/next` target: future native note editor and viewer routes
4. required states:
   - loaded editor or viewer
   - content area visible

### Process-image and canvas

1. legacy baseline: `/assets/process_image_editor.html`
2. legacy baseline: `/?home_action=canvas`
3. `/next` target: future native process-image and canvas routes
4. required states:
   - loaded editing surface
   - restored existing data
   - saved state

### Remarks and journal

1. legacy baseline: `/?home_action=remark_list`
2. legacy baseline: `/?home_action=remark_daily_log`
3. legacy baseline: `/?home_action=daily_journal`
4. legacy baseline: `/?home_action=daily_journal_today`
5. legacy baseline: `/?home_action=daily_journal_template`
6. `/next` target: future native routes only if these tools remain in scope
7. required states:
   - loaded entry
   - insert or create action visible

## Artifact rules

Store screenshot evidence in a stable, reviewable location.

Recommended structure:

1. one folder per migration slice
2. one subfolder per viewport
3. matching `legacy` and `next` filenames

Recommended filename pattern:

1. `01-legacy-loaded.png`
2. `01-next-loaded.png`
3. `02-legacy-open-modal.png`
4. `02-next-open-modal.png`

## Automation

Current capture script:

1. `ui/scripts/capture-parity.mjs`
2. command: `cd ui && npm run capture:parity`
3. default login: `admin` / `admin123456` unless `PARITY_USERNAME` and `PARITY_PASSWORD` override it

## Acceptance rule

No `/next` slice is accepted until:

1. screenshot pairs exist
2. browser-visible parity review is complete
3. any intentional layout change is explicitly recorded
4. the bridge deletion decision is made

## 2026-04-09 frozen parity baseline

This section freezes the current verification baseline used for the active parity push.

### Real-data baseline

1. verification must run against the synced remote cloud snapshot, not a placeholder dataset
2. current verified dataset after sync:
   - `136` errors
   - `56` knowledge nodes
3. the same authenticated dataset must be used for legacy and `/next` comparisons

### Current artifact location

1. all active screenshot evidence lives under `artifacts/screenshot-parity/`
2. existing core slices already being compared there include:
   - `home-shell`
   - `error-workspace`
   - `notes-workspace`
   - `task-errors`
   - `task-notes`
   - `quick-add`
   - `daily-practice`

### Active parity priority

The current comparison order is fixed as:

1. home shell
2. error workspace
3. notes workspace
4. task workspaces
5. quick add and edit flow
6. note viewer and note editor
7. practice flows
8. process-image and canvas
9. backup, search, export, and remaining small tools

## Phase-to-screenshot mapping

### Phase 7: shell and home parity

Required pairs:

1. `home-shell/desktop/`
2. `home-shell/mobile/`

Required states:

1. loaded state
2. navigation visible
3. quick actions visible

### Phase 8: workspace parity

Required pairs:

1. `error-workspace/desktop/`
2. `notes-workspace/desktop/`
3. `task-errors/desktop/`
4. `task-notes/desktop/`

Required states:

1. loaded state
2. active selection or highlighted section
3. primary action visible

### Phase 9: entry, notes, and practice parity

Required pairs:

1. `quick-add/desktop/`
2. `note-viewer/desktop/`
3. `note-editor/desktop/`
4. `daily-practice/desktop/`
5. `note-first/desktop/`
6. `direct-work/desktop/`
7. `speed-drill/desktop/`

Required states:

1. opened state
2. active interaction state
3. saved or submitted state where applicable

### Phase 10: process and system tools parity

Required pairs:

1. `process-image/desktop/`
2. `canvas/desktop/`
3. `backup-tools/desktop/`
4. `global-search/desktop/`
5. any remaining in-scope tool slice

Required states:

1. loaded state
2. restored data state if existing content is expected
3. confirmed save or restore state if mutation exists

## Review rule for the current push

For phases 7-10, screenshots are not only evidence. They are the release gate.

Do not call a page complete if:

1. the screenshot still looks like a different product at a glance
2. the layout hierarchy is visibly different from legacy
3. the page hides high-frequency actions deeper than legacy
4. the page only looks correct with empty or fake data
