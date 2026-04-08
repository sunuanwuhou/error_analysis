# NEXT_PREVIEW_GUARDRAILS

## Purpose

These rules exist to prevent the `/next` preview from drifting away from the real product.

The preview is allowed to improve the engineering baseline.
It is not allowed to invent fake workflow or fake navigation.

## Non-negotiable rules

1. `/next` must follow the real runtime behavior of the current product.
2. No fake buttons, fake tabs, fake navigation, or fake routes are allowed.
3. Any action shown in `/next` must map to one of:
   - a real backend route
   - a real legacy page that already exists
   - a real API-backed view rendered inside `/next`
4. Layout decisions must start from the current legacy home and workbench shape, not from a generic admin shell.
5. Before adding a new `/next` section, read the corresponding legacy HTML and API behavior first.
6. If a feature is not migrated yet, bridge to the real existing page instead of pretending it is complete.
7. Styling changes are allowed only when they preserve the practical structure:
   - left navigation as anchor
   - center workspace as focus
   - high-frequency actions still easy to discover
8. Runtime truth beats design preference.

## Required implementation sequence

1. Read the legacy entry or runtime code for the feature.
2. Confirm the real route, page, or API exists.
3. Confirm which real user and which real data source are being used for verification.
4. Reproduce the same action path in `/next`.
5. Verify browser-visible behavior, not just API availability.
6. Run preview guardrail checks.
7. Run runtime contract and smoke checks.

## Disallowed mistakes

1. Replacing a real product flow with placeholder tabs.
2. Renaming sections in a way that hides what the user already knows.
3. Creating navigation that does not exist in code.
4. Using interface-only cards as if they were migrated features.
5. Making `/next` look like a different product family.
6. Treating backup payload as automatic proof of current live state.
7. Default-selecting a filter that silently empties the main list.
8. Mounting heavy legacy iframe content on first paint.
9. Reporting success from terminal checks while browser state still disagrees.

## First paint rules

1. The first visible `/next` screen may depend only on the minimum data needed for the visible primary cards.
2. Optional sections such as backup details, codex lists, and bridge iframes must not block first paint.
3. Any slow or optional route bridge must open on demand, not by default.

## Data-source rules

1. Each `/next` section must have an explicit source-of-truth declaration in code or docs.
2. If the source is cached backup data, it must be labeled and treated as cached data.
3. If the source is live entity state, verify it with the active user before calling the section complete.

## Browser truth rule

`/next` is not accepted if either of these is true:

1. browser screenshot disagrees with claimed API state
2. browser still shows empty, failed, or placeholder state for the migrated slice

## Acceptance rule

`/next` is acceptable only when a user can say:

1. the page shape still feels like the current system
2. the actions shown are real
3. the displayed data comes from real APIs or real existing pages
4. the preview helps migration instead of creating another fake frontend line
5. browser-visible state matches claimed runtime state
