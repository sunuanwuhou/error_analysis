# MIGRATION_LESSONS_LEARNED

## Purpose

This document records the concrete delivery mistakes that happened during the `/next` migration work and turns them into repository rules.

The goal is simple:

1. stop repeating the same migration mistakes
2. make review standards executable
3. force future work to start from runtime truth, not from assumptions

## Core lesson

The migration failed whenever implementation moved ahead of code walk, runtime verification, and real-user data verification.

The migration improved only when work returned to this sequence:

1. read legacy code
2. confirm runtime truth
3. confirm real user and real data source
4. migrate the exact behavior
5. verify in browser

## Non-negotiable rules

1. Do not redesign first.
2. Do not "fill the page" with inferred sections.
3. Do not treat backup payloads as equivalent to current live workspace state without proving that equivalence for the active user.
4. Do not default-select filters that can silently empty the main list.
5. Do not put slow or optional data fetches on the same critical path as the first visible workbench data.
6. Do not mount heavy legacy bridges by default on first paint.
7. Do not claim parity from API availability alone; parity requires browser-visible behavior.
8. Do not trust a successful backend response if browser rendering still disagrees.

## Mistakes that already happened

### 1. False parity by UI shape only

What went wrong:

1. sections were added because they looked reasonable
2. some actions were bridges, not true migrated behavior
3. the page looked populated but did not preserve the old real flow

Rule:

Every visible action in `/next` must be one of:

1. a real migrated behavior
2. a real route bridge to an existing page

Nothing else is allowed.

### 2. Wrong source of truth for homepage data

What went wrong:

1. `/api/backup` was treated as the primary source for homepage content
2. that made the preview depend on whether backup state existed
3. the result was a "normal-looking" page with empty or misleading content

Rule:

Homepage migration must document, per section, whether the source is:

1. live entity state
2. cached backup snapshot
3. derived practice API

This must be explicit before wiring the section.

### 3. Silent empty state caused by default filter

What went wrong:

1. the first knowledge node was selected by default
2. the error list also filtered by selected knowledge node
3. the list opened already filtered to nothing

Rule:

Default filter state must be neutral unless old behavior explicitly shows an active default filter.

### 4. Browser cache and asset mismatch

What went wrong:

1. `/next` HTML and static bundle names drifted
2. browser kept requesting old bundle names
3. the page looked frozen even though the server was up

Rule:

For preview routes:

1. prefer stable asset names where practical
2. do not apply immutable cache headers to `/next-static`
3. verify the exact bundle requested by the browser after every rebuild

### 5. Heavy first paint path

What went wrong:

1. slow backup and codex requests were started during first paint
2. a heavy legacy iframe was mounted by default
3. browser-visible content lagged or failed

Rule:

First paint for `/next` may only depend on:

1. auth state
2. runtime identity
3. minimal homepage context required to render the visible primary cards

Everything else must load after first paint or on demand.

### 6. Trusting HTTP checks over browser behavior

What went wrong:

1. direct API checks looked successful
2. the browser still showed empty or failed state
3. progress was reported too early

Rule:

No migration slice is accepted until both are true:

1. API verification passes
2. browser screenshot or browser-visible DOM confirms the expected state

## Required migration workflow from now on

### Step 1: feature walk

Before changing a section:

1. locate the legacy HTML or JS that renders it
2. locate the backend route or persistence path it depends on
3. write down the exact visible behavior being migrated

### Step 2: source-of-truth declaration

For each migrated section, declare:

1. active user scope
2. data source
3. optional secondary source
4. fallback behavior

### Step 3: minimal implementation

Implement the smallest version that preserves:

1. same action
2. same list meaning
3. same layout slot
4. same user expectation

### Step 4: verification

Verification must include:

1. API response check
2. browser screenshot
3. active-user data check
4. route truth check

### Step 5: only then continue

No adjacent optimization is allowed until the current slice passes all four checks above.

## Review checklist for future `/next` work

Before saying "done", confirm:

1. Is the active login user the user whose data we think we are showing?
2. Is the section using the intended source of truth?
3. Can any default filter hide the list on first load?
4. Does the browser render the same thing the API claims?
5. Is any heavy iframe or optional panel mounted before the main data appears?
6. Did any non-essential request get placed on the first visible render path?
7. Is the migrated section behaviorally equivalent to the old code, not just visually plausible?

## Final rule

If runtime truth, browser truth, and code-walk truth disagree, stop and resolve the disagreement before making the page bigger.
