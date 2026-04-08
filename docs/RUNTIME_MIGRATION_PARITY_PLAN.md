# RUNTIME_MIGRATION_PARITY_PLAN

## Purpose

This plan defines how the project can migrate toward a more stable MGMT-grade engineering baseline without changing the user-facing workbench shape.

It is a migration contract, not a brainstorming note.

## Fixed migration objective

The objective is:

1. replace the fragile current baseline with a more maintainable one
2. keep the current workbench workflow intact
3. keep layout behavior in high-frequency paths intact
4. cut over only when the new baseline is proven equivalent or safer

The objective is not:

1. redesign the product into a different admin shell
2. move high-frequency buttons for aesthetics
3. merge or remove old useful workflow just because a cleaner architecture exists

## Current runtime truth

The current active chain is:

1. `/login` -> `app/login.html`
2. authenticated `/` -> `v51_frontend/index.html`
3. `v51_frontend/assets/v53-bootstrap.js`
4. `xingce_v3/` bundled styles, modules, and feature pages

The legacy fallback route remains:

1. `/legacy` -> `xingce_v3/xingce_v3.html`

## Non-negotiable parity rules

### Functional parity

The migration cannot be accepted unless all of these still work:

1. auth login and logout
2. runtime info and origin awareness
3. full backup load and save
4. per-error incremental sync
5. knowledge tree navigation
6. note workspace editing
7. quick-create flow
8. OCR-assisted fill-back
9. question image upload and retrieval
10. process-image or canvas workflow
11. practice logging and review-linked attempt behavior
12. codex inbox threads and message flow
13. export and transfer path

### Layout parity

The migration cannot be accepted unless these remain practically unchanged:

1. left navigation remains the primary structural anchor
2. center workspace remains the main focus area
3. quick-create remains easy to reach from the same practical depth
4. notes, errors, and review switching stay familiar
5. cloud/sync status remains visible in the same practical zone
6. process-image entry remains attached to the same practical question flow
7. mobile behavior preserves the current path depth and action discoverability

### Runtime parity

The migration cannot be accepted unless:

1. source-of-truth frontend and runtime frontend are the same chain
2. Docker build truth matches route truth
3. smoke checks match real runtime behavior

## Approved engineering target

The target baseline should borrow these characteristics from MGMT:

1. one active frontend source line
2. explicit router ownership
3. explicit app entry
4. clearer split between:
   - page-level views
   - reusable components
   - API layer
   - state layer
   - composables/helpers
   - typed models
5. build and smoke checks aligned with runtime

## What must stay out of scope

1. replacing the current workbench with a generic back-office shell
2. moving to a permanent aside/header/main shape just because MGMT uses it
3. reinterpreting study tools as CRM-style pages
4. introducing a second long-lived ambiguous frontend baseline

## Migration strategy

### Stage 0: baseline lock

Status: complete

Done:

1. identify the real runtime chain
2. remove the unused experimental frontend line
3. update docs and checks to reflect runtime truth

### Stage 1: capability inventory freeze

Status: current required baseline

The active runtime must be treated as the canonical behavior reference.

Before any rewrite work, we must preserve:

1. visible page structure
2. route behavior
3. active feature entry points
4. request and persistence behavior
5. first-load neutral filter state
6. active-user data truth

### Stage 2: slice-by-slice extraction under the same runtime

The next baseline should be built by extracting one slice at a time behind the same runtime entry.

Recommended order:

1. shell and route bridge
2. auth and runtime bootstrap
3. knowledge tree and workspace shell
4. quick-create and OCR flow
5. notes workspace
6. error list and detail actions
7. cloud backup and sync status
8. process-image/canvas chain
9. practice and codex adjunct flows

Rule:

Do not migrate low-frequency pages first if a high-frequency path still depends on the old shell.

Additional rule:

Do not widen the migration slice when browser-visible behavior still disagrees with API or code-walk truth.

### Stage 3: dual implementation, single appearance

During migration:

1. internal modules may change
2. data plumbing may change
3. tests may change

But:

1. route shape should not change casually
2. visible layout should not drift
3. interaction depth should not increase

### Stage 4: parity proof before cutover

Before removing an old slice, prove:

1. same entry point
2. same visible controls
3. same persistence outcome
4. same major side effects
5. same or better smoke coverage
6. same browser-visible result for the active verification user

## Functional parity checklist

### Auth and entry

1. `/login` loads correctly
2. authenticated `/` lands in the workbench
3. logout returns to login

### Backup and sync

1. `/api/backup` read works
2. `/api/backup` write works
3. `/api/origin-status` works
4. `/api/sync` pull works
5. `/api/sync` push works

### Knowledge and notes

1. knowledge tree renders
2. selecting a node updates workspace content
3. note editing remains available
4. note-related auxiliary pages still load

### Entry and OCR

1. quick-create opens
2. OCR image upload works
3. OCR result can still fill back into entry flow
4. image upload persists correctly

### Process-image/canvas

1. process-image editor still opens from the question flow
2. existing data restores correctly
3. save/export behavior remains intact

### Practice and codex

1. practice attempt save/list flow works
2. daily practice endpoint still works
3. codex thread create/list/detail/message flow works

## Layout parity checklist

These must be reviewed visually during any real cutover:

1. login page composition
2. shell boot state
3. left navigation density and order
4. main workspace width and emphasis
5. quick-create discoverability
6. error list readability
7. note reading and editing width
8. process-image launch position
9. mobile drawer/header/tab behavior

## Deletion rule for future cleanup

No further structural deletion is allowed unless all are true:

1. the runtime no longer imports or routes to the target
2. smoke checks no longer depend on it
3. the replacement path is already verified

## Final acceptance rule

The migration is successful only when the user can truthfully say:

1. the system still works the same way
2. the layout still feels the same where it matters
3. the runtime is easier to maintain
4. the baseline is now stable enough to continue feature work without entry-point confusion

## Lessons now treated as policy

These are no longer optional judgments; they are project rules:

1. code walk before redesign
2. real-user verification before parity claims
3. neutral default filters unless legacy explicitly says otherwise
4. browser verification before migration status updates
5. optional or heavy data must not block first visible migrated content
