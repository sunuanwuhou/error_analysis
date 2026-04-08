# CURRENT_SCOPE

## Scope baseline for the current delivery line

This document defines what the project should treat as current priority and what should not interrupt the current line of work.

## Current objective

Turn the current repo into a stable, clearly documented error-analysis workbench that can keep evolving toward the user's real exam workflow without losing requirements between sessions.

## Must keep in scope

### A. Stable project truth inside the repo

This delivery must lock the following information into docs:

1. project goal and current phase
2. hard delivery rules
3. version boundary
4. handoff context
5. self-test evidence
6. release checklist

### B. Core study workflow continuity

The system should continue supporting or moving toward:

1. error entry
2. knowledge-point binding
3. OCR-assisted capture
4. review state management
5. export or backup path
6. image-related capture
7. structured error analysis completion
8. process image or canvas completion

### C. Legacy workflow alignment

When modernizing the frontend or data model, do not silently discard the old chain that the user already depends on.
The current repo should be evaluated against this rule whenever layout or workflow is changed.

## Repo-confirmed current capabilities

The following are confirmed from the current repository state and should be treated as real baseline, not guesses:

1. authenticated workbench and backend auth routes exist
2. the Docker-served login page is `app/login.html`
3. the authenticated default runtime entry is `v51_frontend/index.html`
4. `v51_frontend/assets/v53-bootstrap.js` bootstraps the active shell and loads bundled assets from `xingce_v3/`
2. hybrid backup and sync APIs exist
3. OCR image endpoint exists
5. the repo includes export/transfer UI and practice logging endpoints
6. the active runtime still contains process-image related UI and preview chain

## Current documented gaps

These gaps should remain visible until code is aligned:

1. process image or canvas is still not a first-class unified normalized field in the active data model
2. structured error analysis target fields are richer than the currently normalized entry schema
3. current docs in the repo were previously scattered and did not function as a single source of truth
4. product direction and current user priority were not clearly fixed inside the codebase docs

## This delivery does not claim

This delivery does not claim that the following are fully complete in code today:

1. full process canvas integration across modern frontend and backend schema
2. final legacy-perfect layout parity across every page
3. complete structured error analysis schema with all target subfields
4. full exam platform transformation beyond the error-analysis workbench baseline

## Items intentionally out of the current front line

Unless they are required to unblock the core workflow, these should not take priority over system completion:

1. broad new AI product layers
2. flashy redesign for its own sake
3. nonessential account features
4. peripheral modules that do not improve the main error-analysis chain

## Acceptance standard for this documentation patch line

This patch line is successful when:

1. the repo itself contains stable handoff docs
2. future sessions can recover project intent from the repo without relying on chat memory alone
3. delivery rules are explicit
4. current capability versus current gap is stated honestly
