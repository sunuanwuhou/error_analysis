# HANDOFF_CONTEXT

## Why this document exists

This file is the cross-session project handoff context.
It should allow a new session or a new contributor to understand the project without re-asking the user for the same things.

## User background and project goal

The user is building an error-analysis system for exam improvement.
The final goal is score improvement, especially for xingce-style exam preparation.
The system is valuable only if it improves question capture, error analysis, review, and later retention.

## What the user repeatedly cares about

1. do not keep discussing after the requirement is already clear
2. deliver usable results directly
3. self-test before delivery
4. preserve old useful workflow instead of replacing it with a different product habit
5. write project truth into docs, not only into chat
6. make each version easy to hand off and continue

## Current stage decision

The project is currently in the system-first stage.
That means:

1. first finish and stabilize the system
2. then continue large-scale note input
3. then enter the real score-improvement phase

## The user's target workflow

The desired question workflow is not only a simple note form.
It should eventually cover the full learning chain for a single item:

1. record the question
2. save the answer and my answer
3. bind to knowledge point
4. record review status and confidence if needed
5. support structured error analysis
6. support images
7. support process image or canvas
8. allow later review and export

## Structured error analysis target

The desired structured error analysis is richer than a single free-text reason.
The target direction includes at least:

1. error type
2. trigger point
3. correct model
4. next action

## Current repo reality snapshot

Based on the current repository scan:

### Confirmed present

1. backend auth, sync, practice, OCR, image, and codex APIs exist
2. the modern frontend has a quick-create panel with OCR fill-back, question image upload, source fields, knowledge-point binding, and review-state saving
3. the workspace store normalizes standard error-entry fields such as question, answer, my answer, analysis, rootReason, errorReason, source info, and images
4. export and transfer UI exists
5. the legacy bundle still contains process-image editor and process-image preview related logic

### Confirmed mismatch or unfinished alignment

1. the modern typed data model does not yet expose process image or canvas as a first-class normalized field
2. the structured error analysis target is only partially represented in the modern schema
3. repo docs previously reflected many historical directions but did not pin the current user priority strongly enough

## Product direction for ongoing work

The safest direction is:

1. keep the repo runnable and packageable
2. keep legacy useful paths available where needed
3. move toward a unified modern schema without silently losing process image, structured error analysis, or review-chain data
4. prefer system completeness over new shiny branches

## Current documentation contract

From this patch onward, the repo should preserve at least these truths:

1. `PROJECT_RULES.md` defines hard rules
2. `CURRENT_SCOPE.md` defines current boundary
3. `HANDOFF_CONTEXT.md` preserves project context
4. `DEVLOG.md` records version changes
5. `RELEASE_CHECKLIST.md` defines the delivery gate
6. `SELF_TEST_REPORT.md` records what was actually checked

## Immediate next implementation priorities after this doc patch

1. unify process image or canvas into the modern data model and save path
2. map structured error analysis target fields into explicit schema fields
3. check layout and interaction parity against the old high-frequency flow
4. keep export and backup chain aligned with the richer data model

## Things to avoid repeating

1. do not force the user to restate project phase and delivery rules every session
2. do not treat partial discussion as final delivery
3. do not claim parity or completeness without code-path verification
4. do not let documentation drift away from the real repo state
