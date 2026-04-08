# MGMT_MIGRATION_BASELINE

## Goal

Use `customer-mgmt` as the engineering-quality reference, not as the product-shape reference.

The migration target is:

1. one stable frontend baseline
2. clearer module boundaries
3. safer build and verification flow
4. no user-visible workflow regression
5. no layout regression in high-frequency paths

This migration is **not** a permission slip to redesign the product into a different admin shell.

## What We Borrow From MGMT

### Engineering structure

1. single active frontend line
2. explicit app entry
3. explicit router ownership
4. clearer split across:
   - views
   - components
   - api
   - stores
   - composables
   - types
5. reproducible build path
6. smoke-test-friendly runtime behavior

### Delivery discipline

1. source chain and runtime chain must be the same thing
2. visible changes must land on the runtime users actually open
3. routes, build, and smoke checks must track real runtime truth

## What We Must Not Copy From MGMT

1. do not replace the current study workbench with a generic admin layout
2. do not move buttons or flows just to look more standard
3. do not drop process-image, OCR, review-chain, or knowledge-binding behavior
4. do not accept “functionally similar” if the user’s real path becomes slower or less familiar

## Locked Migration Rules

### Rule 1: Baseline replacement, not product replacement

We are changing the baseline to something more stable.
We are not changing the product shape unless a specific change is approved.

### Rule 2: Layout parity first

For the main workbench:

1. left navigation behavior must stay aligned with current habits
2. center workspace priority must stay aligned with current habits
3. quick entry, note editing, review, OCR, and process-image access must keep the same practical path depth

### Rule 3: Capability parity first

Before any cutover is accepted, the new baseline must preserve:

1. auth flow
2. backup and sync flow
3. knowledge-tree navigation
4. quick entry
5. OCR-assisted fill-back
6. image upload and retrieval
7. process-image or canvas chain
8. practice logging and related review actions
9. codex inbox flow

### Rule 4: One cutover chain

Future migration work should follow this order:

1. map active runtime capabilities
2. define target module boundaries
3. migrate one user-visible slice at a time behind the same runtime entry
4. verify parity
5. only after parity is proven, retire the old slice

Do not run two competing long-lived frontend products in the repo again.

## Current Approved Direction

The current repo baseline is:

1. `app/login.html`
2. `v51_frontend/index.html`
3. `v51_frontend/assets/v53-bootstrap.js`
4. `xingce_v3/` bundled assets and feature pages

The next-generation baseline, if built, must replace this chain cleanly.
It must not sit beside it indefinitely as another ambiguous “main frontend”.

## Acceptance Standard

This migration direction is successful only if all are true:

1. the new baseline is more stable than the current one
2. the user’s high-frequency workflow is not broken
3. layout behavior in core paths is not unexpectedly changed
4. runtime truth, source truth, and delivery truth stay aligned
5. the repo remains easy to hand off without re-discovering the real entry point
