# xingce_v3_lab Roadmap

## Current Baseline

The current baseline is no longer the original single-user local page.

It now includes:

1. authenticated workbench
2. knowledge-tree-centered main workspace
3. hybrid sync
4. backend image storage
5. DeepSeek-first AI integration
6. stable public domain deployment
7. first-wave layout cleanup with the right rail removed

## What Is Done

### v3.1 Mainline

Completed:

1. CORS whitelist from env
2. DeepSeek-first unified AI routing with MiniMax fallback
3. safer cloud save behavior and local storage error visibility
4. search expansion and mastery-level UI
5. UUID migration and per-error incremental sync
6. backend image storage and cleanup tooling
7. AI and practice APIs
8. stable Cloudflare named tunnel on `erroranaly.qzz.io`
9. login-page simplification and layout polish

### Product Direction Stabilized

The active product shape is now:

1. left navigation
2. center workspace
3. focused editing and review

Not the old:

1. three-panel permanent admin-style layout
2. Excel-first ingestion path
3. prototype-only local page

## Current Priority

### P0: Stability And Responsiveness

1. keep hybrid sync reliable across local/public origin boundaries
2. reduce editor friction in the notes workspace and OCR entry flow
3. continue runtime verification against real database-backed data, not only synthetic samples

### P1: OCR Hardening

1. keep the new tiny-image numeric OCR path stable
2. add better fallback selection in the OCR panel so users can switch candidates quickly
3. extend beyond numeric MCQ screenshots into mixed Chinese text stems
4. avoid coupling OCR progress with a risky engine migration before Tesseract improvements are exhausted

### P2: Frontend consolidation

1. continue cleaning duplicated legacy CSS in `xingce_v3.html`
2. keep removing stale compatibility UI from active paths
3. prepare module split around the now-stable two-pane layout

### P3: Shenlun workbench

1. add Shenlun entry and data model
2. import papers, questions, answers, and notes
3. support AI answer comparison
4. connect personal Shenlun notes with structured question context

### P4: Knowledge-source retrieval

1. index imported Shenlun source materials
2. support source-tagged search
3. later add embedding retrieval if keyword/tag search becomes insufficient

## Deferred But Intentional

These are not blocked, but they are not the current first move:

1. full fine-grained sync for all note content types
2. complete HTML-to-modules frontend rewrite
3. generalized AI knowledge-base product layer before Shenlun workflow exists

## Acceptance Standard For The Next Phase

The next stage is considered successful when:

1. Shenlun materials are stable inside this repo
2. docs reflect the real runtime and deployment situation
3. Shenlun data model is defined before UI coding starts
4. AI comparison is designed around structured answer review, not generic chat first

## 2026-03-26 Progress Snapshot

### Completed Recently

1. hybrid sync mainline is running on the named tunnel domain
2. login page and top-bar disclosure were simplified to reduce visible system detail
3. right rail was removed and the notes area was widened around floating TOC only
4. OCR upload, preview, and fill-back flow were connected into the error editor
5. OCR now uses real database-backed regression images during validation, not only examples
6. tiny numeric MCQ screenshots improved from noisy partial extraction to usable stem-plus-options recovery on real samples
7. knowledge tree first level is now meant to stay collapsed by default
8. note TOC behavior has been clarified to right-floating only, with stale TOC cleanup on non-leaf nodes
9. note TOC debugging now has a fixed baseline rule: compare against the pre-2026-03-26 good implementation before changing source logic

### Highest-Value Next Steps

1. finish OCR candidate selection UX so users can recover quickly when the first result is imperfect
2. continue frontend cleanup around the notes editor and active OCR entry path
3. improve OCR handling for mixed-text screenshots without overfitting low-text graphic questions
4. only after the daily capture/edit flow feels fast enough, start Shenlun module buildout
