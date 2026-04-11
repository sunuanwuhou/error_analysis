# NEXT_BRIDGE_INVENTORY

## Purpose

This file is the Phase 0 inventory of the current `/next` route surface.

It exists to answer four questions clearly:

1. which `/next` routes are already native
2. which `/next` routes still depend on `LegacyBridgePage`
3. which migration phase owns each bridge
4. when each bridge should be deleted

## Current route status

### Native `/next` routes

These routes already render real Vue views inside `ui/`:

1. `/next/login`
2. `/next/workspace`
3. `/next/workspace/errors`
4. `/next/workspace/notes`
5. `/next/workspace/tasks/errors`
6. `/next/workspace/tasks/notes`
7. all remaining `/next/actions/**` routes now render native route-shell pages
8. all remaining `/next/tools/**` routes now render native route-shell or native workspace pages
9. `/next/legacy`, `/next/v51`, `/next/v53`, and `/next/shenlun` now render native wrappers instead of redirect bridges

### Bridge-based `/next` routes

There are currently no `LegacyBridgePage` routes left in `ui/src/router/index.ts`.

What remains is not bridge cleanup but parity hardening:

1. continue replacing route-shell pages with deeper native feature pages
2. continue replacing embedded legacy surfaces with fully native implementations
3. keep screenshot parity review on every migrated slice

## Bridge counts

Current known counts from `ui/src/router/index.ts`:

1. native `/next` route entries: all
2. `LegacyBridgePage` routes: 0

The route-level bridge inventory is cleared.

The next risk is now feature-depth mismatch inside some native wrappers:

1. action shells that still need deeper native forms
2. embedded legacy wrappers that still need full native replacements
3. screenshot parity that still needs completion against the latest imported backup baseline

### 2026-04-10 parity review note

The current repo no longer has route-level `LegacyBridgePage` entries, but route coverage still needs to be audited against the old workbench action map.

Confirmed on this review:

1. `dashboard` and `history` now render native `/next` route-shell pages instead of embedded legacy wrappers, but still need screenshot and browser-behavior parity review
2. `export`, `import`, `quick-import`, and `type-rules` now render native `/next` route-shell pages; `export` now accepts workbench context through query params so current/filtered scope can stay aligned with the old workspace flow
3. the native workspace knowledge tree now carries old-workspace behaviors more faithfully: current focus in the sidebar, parent/sibling/child navigation, and descendant-aware subtree scope when filtering related errors
4. `knowledge manage` is now better connected to the native workspace flow: current-node actions in the knowledge tree open native edit/move/directory pages with the same selected node context, and the management page now preserves path and sibling navigation instead of feeling like a detached tool
5. `note viewer`, `note editor`, `knowledge manage`, `quick entry`, `practice`, and `process-image/canvas` have native Vue pages, but parity depth still needs browser comparison against legacy
6. `remarks` and `daily journal` were still present in the workspace tool map and were added to the `/next` route surface as embedded legacy wrappers so the migration route tree matches the currently exposed tool entry points

## Deletion priority

After route-level bridge cleanup, the next deletion order is:

1. embedded legacy wrappers for note, process-image, and shell fallback paths
2. action-shell pages that still depend on shallow queue summaries
3. remaining old standalone feature surfaces behind `/assets/*`

## Phase 0 completion rule

Phase 0 is not complete until:

1. route-level bridge cleanup stays at zero
2. screenshot parity uses the same grouping
3. no new `LegacyBridgePage` route is added without explicit justification
