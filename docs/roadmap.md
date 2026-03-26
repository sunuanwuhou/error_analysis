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

### P1: Frontend consolidation

1. continue cleaning duplicated legacy CSS in `xingce_v3.html`
2. keep removing stale compatibility UI from active paths
3. prepare module split around the now-stable two-pane layout

### P2: Shenlun workbench

1. add Shenlun entry and data model
2. import papers, questions, answers, and notes
3. support AI answer comparison
4. connect personal Shenlun notes with structured question context

### P3: Knowledge-source retrieval

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
