# NEXT_CUTOVER_EXECUTION_PLAN

## Purpose

This document is the execution plan for fully moving the product to `/next`.

It exists to make the migration:

1. fast enough to keep momentum
2. stable enough to avoid dual-frontend drift
3. exact enough to preserve the old useful workflow

## Final decision

The project is no longer aiming to keep `v51_frontend/` plus `xingce_v3/` as the long-term active frontend.

The final target is:

1. authenticated `/` serves `ui/dist/index.html`
2. `/next` becomes the real mainline during migration
3. legacy becomes reference plus temporary bridge only
4. after cutover, legacy is retired from active ownership

## Current repo truth

As of this document:

1. authenticated `/` still serves `v51_frontend/index.html`
2. `/legacy` serves `xingce_v3/xingce_v3.html`
3. `/next` already exists and is routed by `app/routers/web.py`
4. `ui/src/router/index.ts` still contains many `LegacyBridgePage` routes
5. the current risk is not missing migration intent
6. the current risk is long-lived dual ownership and bridge sprawl

## Migration rules

### Rule 1: `/next` is the only accepted destination

New user-facing implementation work must land in `ui/` unless the task is:

1. baseline capture
2. parity investigation
3. temporary fix needed to keep the current runtime usable before that slice is migrated

### Rule 2: legacy is a baseline, not a co-equal product line

Legacy should be used to:

1. inspect current behavior
2. confirm layout and workflow parity
3. temporarily bridge unmigrated actions

Legacy should not be used to:

1. host long-term new feature work
2. remain the default entry after `/next` parity is achieved
3. justify permanent route bridges

### Rule 3: migrate by workflow, not by page count

The migration unit is a real user workflow slice, not a random collection of pages.

Each slice must include:

1. visible entry point
2. primary user action
3. required data source
4. required persistence path
5. parity proof
6. bridge deletion target

### Rule 4: no permanent bridges

Every bridge route must have:

1. an owning migration slice
2. a deletion condition
3. a deletion milestone

If none can be named, do not add the bridge.

### Rule 5: parity means behavior plus layout plus speed

A `/next` slice is not complete if any of these are worse in a meaningful way:

1. user path depth
2. action discoverability
3. first useful render
4. persistence outcome
5. recovery path when the action fails

## What must be preserved exactly enough

### Functional baseline

The final `/next` product must preserve:

1. login and logout
2. runtime and origin awareness
3. cloud load and cloud save
4. local backup create, restore, delete, and refresh
5. error list, filtering, and detail actions
6. quick add and edit
7. OCR upload and fill-back
8. question image upload and retrieval
9. knowledge tree navigation
10. note viewing and editing
11. practice queue and practice logging
12. review-linked behavior
13. process-image or canvas flow
14. export and transfer tools
15. global search and supporting tools

### Layout baseline

The final `/next` product must preserve:

1. left navigation as the stable orientation anchor
2. center work area as the main focus zone
3. quick-add and high-frequency actions within similar practical reach
4. knowledge navigation without hiding the main work surface
5. familiar modal and tool entry positions where practical
6. mobile access paths with similar action depth

### Performance baseline

The final `/next` product must preserve or improve:

1. first paint cost
2. first useful workbench render
3. list interaction responsiveness
4. modal open responsiveness
5. optional tool loading on demand instead of on first paint

## Execution order

The order below is strict unless a blocker forces a swap.

### Phase 0: baseline freeze

Goal:

1. capture the behavior that `/next` must replace
2. stop parity debates from relying on memory

Deliverables:

1. route inventory
2. bridge inventory
3. legacy-to-next workflow map
4. screenshot baseline for core flows
5. DOM and action anchor checklist for high-frequency paths
6. route-pair screenshot matrix

Exit gate:

1. every critical workflow has a named baseline
2. every existing bridge route is mapped to an intended future owner
3. screenshot capture rules are fixed before implementation expands

Current baseline inventory files:

1. `docs/NEXT_BRIDGE_INVENTORY.md`
2. `docs/NEXT_SCREENSHOT_PARITY_BASELINE.md`

### Phase 1: `/next` shell parity

Scope:

1. authenticated entry shell
2. left navigation
3. workspace frame
4. mobile header and mobile entry path
5. runtime and session identity surfaces

Not included:

1. deep tool logic
2. low-frequency admin surfaces

Exit gate:

1. users can orient themselves in `/next` without opening legacy first
2. shell layout no longer depends on placeholder structure

### Phase 2: error workspace parity

Scope:

1. error list
2. neutral default filters
3. card actions
4. detail view
5. edit flow entry
6. recent and filtered navigation

Why this comes first:

1. it is the main workbench center of gravity
2. layout and interaction problems show up here earliest

Exit gate:

1. `/next/workspace/errors` is a true implementation, not a legacy bridge
2. common error operations no longer require legacy fallback

### Phase 3: quick entry and OCR parity

Scope:

1. quick add
2. edit modal parity where it affects fast capture
3. OCR upload
4. OCR candidate handling
5. fill-back into entry fields
6. image upload and preview in the entry loop

Exit gate:

1. daily capture can be completed fully inside `/next`
2. OCR no longer depends on a legacy page jump

### Phase 4: knowledge and notes parity

Scope:

1. knowledge tree navigation
2. node selection
3. note summary access
4. note viewer
5. note editor
6. note-linked navigation from workspace actions

Exit gate:

1. knowledge-guided learning flow can stay inside `/next`
2. note-related bridge routes are removed or reduced to rollback-only status

### Phase 5: practice and review parity

Scope:

1. note-first flow
2. direct-do flow
3. speed-drill flow
4. practice logging
5. attempt-linked review outcomes
6. history and dashboard surfaces required to support the loop

Exit gate:

1. the study loop can start, complete, and record results inside `/next`

### Phase 6: process-image and canvas parity

Scope:

1. process-image entry from the question flow
2. existing data restore
3. editing
4. preview
5. save
6. export or downstream handoff behavior if currently depended on

Why this is a dedicated phase:

1. it is high-risk
2. it has specialized UI
3. partial migration here creates the most confusion

Exit gate:

1. process-image no longer requires a legacy page
2. saved data matches legacy-visible behavior

### Phase 7: system tools parity

Scope:

1. cloud load and save
2. local backups
3. export and transfer
4. global search
5. remarks and journal if still active
6. remaining small tools currently exposed through bridges

Exit gate:

1. the remaining bridge list is short, explicit, and non-core

### Phase 8: root cutover

Scope:

1. authenticated `/` switches to `ui/dist/index.html`
2. `/next` becomes an alias or staging path only if still needed
3. legacy is kept only for rollback and verification

Exit gate:

1. real users land in `/next` by default
2. smoke checks use the new route truth

### Phase 9: legacy retirement

Scope:

1. remove obsolete bridge routes
2. remove `v51_frontend/` from active runtime ownership
3. keep only minimal rollback support if explicitly required
4. update docs, packaging, and checks to one active frontend line

Exit gate:

1. there is one active frontend truth in the repo
2. handoff no longer requires explaining dual ownership

## Bridge reduction plan

### Bridge classes

Current bridge routes in `ui/src/router/index.ts` fall into these groups:

1. workspace navigation bridges
2. action bridges
3. tool bridges
4. page bridges

### Deletion rule

Delete a bridge when all are true:

1. `/next` has a real implementation for the slice
2. the same primary action can complete in `/next`
3. smoke coverage exists for the `/next` path
4. browser-visible parity was checked

### Hard limit

No new bridge should be added for any slice that has already entered active migration.

That means:

1. once a slice is in execution, effort goes to replacing the bridge
2. not to making the bridge more polished

## Required artifacts for each slice

Each migration slice must produce:

1. code implementation in `ui/`
2. a route owner
3. data-source declaration
4. parity checklist
5. screenshot pair evidence against the legacy baseline
6. smoke or contract checks
7. a bridge deletion patch or explicit rollback note

## Definition of done for a migrated slice

A slice is complete only when all are true:

1. the main user path is implemented in `/next`
2. the visible structure matches old user habits closely enough
3. required API and persistence behavior match expected outcomes
4. screenshot comparison against the matching legacy state is complete
5. browser-visible state matches the claimed data state
6. first paint is not blocked by unrelated optional requests
7. the legacy bridge for that slice is removed or clearly demoted to rollback-only use

## Review checklist

Before calling a slice done, verify:

1. Is the old workflow still recognizable without relearning the product?
2. Is the first visible state based on the right source of truth?
3. Can neutral default filters still show meaningful content?
4. Can the full action complete without opening legacy?
5. Do paired legacy and `/next` screenshots confirm that claim?
6. Did we remove a bridge instead of adding one?
7. Did layout parity survive on both desktop and mobile?
8. Did we verify browser truth, not only API truth?
9. Is this slice making final cutover easier instead of expanding dual ownership?

## What to avoid

1. Do not migrate low-frequency pages before the workbench center is stable.
2. Do not build fake complete sections backed only by bridges.
3. Do not let `/next` become a second homepage plus a permanent set of legacy launch buttons.
4. Do not claim progress from route count.
5. Do not keep polishing `v51_frontend/` once its replacement slice is in active migration.

## Immediate next actions

1. inventory all current `LegacyBridgePage` routes by slice owner
2. freeze the shell, error workspace, and quick-entry parity checklist
3. convert the first high-frequency bridge set into real `/next` implementations
4. start deleting bridges as soon as each slice clears review

## 2026-04-09 frozen baseline

This section freezes the current project truth so later work no longer depends on memory.

### Frozen decisions

1. The target is still full cutover to `/next`.
2. The user requirement is not "rough parity" but "old-version switch with the same habits, layout, and workflow".
3. `Codex` and `AI` tools are out of scope for the active parity push.
4. Legacy is the comparison baseline only, not an acceptable long-term runtime surface.
5. Work continues in the current thread and current repo state; no reset or restart is part of the plan.

### Frozen runtime baseline

1. local app base URL: `http://127.0.0.1:8000`
2. active verification data source: synced remote cloud snapshot
3. current verified workspace data after sync:
   - `136` errors
   - `56` knowledge nodes
4. screenshot parity artifacts live under `artifacts/screenshot-parity/`
5. route-level bridge cleanup is already done; the remaining work is behavior, layout, and visual parity

### Frozen ownership

Primary implementation files:

1. `ui/src/router/index.ts`
2. `ui/src/views/WorkspacePage.vue`
3. `ui/src/views/EntryFlowPage.vue`
4. `ui/src/views/PracticePage.vue`
5. `ui/src/views/NotePage.vue`
6. `ui/src/views/KnowledgeManagePage.vue`
7. `ui/src/views/ProcessCanvasPage.vue`
8. `ui/src/views/RouteShellPage.vue`
9. `ui/src/styles.css`

Primary backend support files:

1. `app/main.py`
2. `app/routers/errors.py`
3. `app/routers/knowledge.py`
4. `app/routers/backup.py`

## Frozen execution phases from current state

The earlier phases established route ownership and native `/next` entry points. The active plan now continues from the current state and focuses only on old-version parity.

### Phase 7: shell and home parity

Goal:

1. make `/next/workspace` visually recognizable as the old home shell
2. restore old information hierarchy before adding any new surface area

Scope:

1. top shell layout
2. left navigation rhythm
3. center home cards and density
4. right-side backup and status surfaces
5. quick action positions
6. mobile home path

Required evidence:

1. paired legacy and `/next` screenshots for loaded home state
2. paired screenshots with visible navigation and quick actions
3. browser verification against synced real data

Exit gate:

1. home shell no longer looks like a different product
2. the first screen exposes the same practical actions as legacy
3. counts and key state shown on the page match the synced runtime data

### Phase 8: high-frequency workspace parity

Goal:

1. make the main workbench pages feel like the old workspace instead of generic dashboard pages

Scope:

1. `/next/workspace/errors`
2. `/next/workspace/notes`
3. `/next/workspace/tasks/errors`
4. `/next/workspace/tasks/notes`
5. list density
6. card hierarchy
7. detail emphasis
8. old-style top action placement

Required evidence:

1. paired desktop screenshots for each workspace page
2. mobile screenshot where action depth changed
3. one browser-visible verification per page using synced real data

Exit gate:

1. the page structure is recognizably the same workflow as legacy
2. important items are not pushed below the fold compared with legacy
3. the user can move between home, errors, notes, and task views without relearning navigation

### Phase 9: entry, notes, and practice flow parity

Goal:

1. make the core work loops match the old version closely enough that the user can switch without friction

Scope:

1. quick add
2. add and edit flow
3. OCR upload and fill-back
4. note viewer
5. note editor
6. daily practice
7. note-first practice
8. direct-do practice
9. speed-drill practice
10. post-submit result state

Required evidence:

1. paired screenshots for open state and active state
2. completed action verification for save or submit
3. browser-visible confirmation that real entities changed as expected

Exit gate:

1. fast capture can be completed entirely in `/next`
2. note flow can be read and edited entirely in `/next`
3. practice flow starts, submits, and records results without dropping to legacy
4. the centered modal or focused work surface looks and behaves like the old version

### Phase 10: process, tools, and final cutover gate

Goal:

1. finish the remaining parity-sensitive surfaces and lock the release gate for root cutover

Scope:

1. process-image
2. canvas
3. cloud load and cloud save
4. local backup create, restore, delete, refresh
5. export and transfer
6. global search
7. remaining small system tools still needed in the old workflow

Required evidence:

1. paired screenshots for each active tool
2. save and restore verification where state mutation exists
3. final parity review pass across the full route list still in scope

Exit gate:

1. remaining gaps are only intentional and documented
2. authenticated `/` can switch to `/next` without breaking the old working habits
3. legacy can be reduced to rollback-only support

## Hard acceptance gates

No phase is allowed to close early. A phase is accepted only if all rules below are true.

1. The page uses synced real data, not placeholder or stale preview data.
2. The primary user action can be completed in `/next`.
3. A legacy screenshot and a `/next` screenshot exist for the same state.
4. The `/next` page is recognizably the same workflow at a glance.
5. The visual density and action depth are not meaningfully worse than legacy.
6. Browser-visible truth matches API truth.
7. Any remaining difference is written down as intentional, temporary, and owned.

## Out of scope during the parity push

The items below must not expand while phases 7-10 are active.

1. net-new design exploration
2. unrelated feature work
3. `Codex` surfaces
4. `AI` tool surfaces
5. cosmetic refactors that do not improve old-version parity

## Final release condition

The cutover is considered ready only when all are true:

1. `/next` can replace the old version for the user's daily workflow
2. core screens are visually close enough that the switch feels familiar
3. screenshot evidence exists for every in-scope phase
4. root cutover no longer depends on explaining major differences away
