# xingce_v3_lab Roadmap

## Current Baseline

The project is now an authenticated study workbench instead of the original single-user local page.

Current baseline:

1. authenticated login and register flow
2. knowledge-tree-centered main workspace
3. hybrid sync with full-backup and per-error incremental save
4. backend-managed image storage
5. DeepSeek-first AI routing with MiniMax fallback
6. stable public domain deployment
7. active two-pane layout after right-rail retirement

## What Is Already Done

### v3.1 Mainline

Completed:

1. CORS whitelist from env
2. unified AI routing with DeepSeek-first fallback behavior
3. safer cloud save behavior and clearer local-storage error visibility
4. search expansion and mastery-level UI
5. UUID migration and per-error incremental sync
6. backend image storage and cleanup tooling
7. AI and practice APIs
8. stable Cloudflare named tunnel on `erroranaly.qzz.io`
9. login-page simplification and layout polish
10. first-pass entry-flow cleanup for the OCR modal

### Product Shape Is Stabilized

The active product shape is now:

1. left navigation
2. center workspace
3. focused entry, editing, and review

It is no longer:

1. a permanent three-panel admin layout
2. an Excel-first ingestion tool
3. a prototype-only local page

## Active Priorities

### P0: Stability And Flow Smoothness

Goal:

Keep daily capture and review on a near-zero-friction path.

Current focus:

1. keep hybrid sync reliable across local/public origin boundaries
2. verify reconnect behavior so incremental sync does not silently lose data
3. reduce editor friction in the notes workspace and OCR entry flow
4. keep validation grounded in real database-backed samples, not only synthetic examples

Concrete cleanup items:

1. remove the stale right-side spacing that still leaves extra room in the notes area
2. restore working TOC rendering in the note preview path instead of keeping partially disconnected TOC logic
3. delete remaining `.notes-panel-right` legacy CSS and reduce `!important` collisions
4. surface a clear "last sync time" indicator in the UI because notes and knowledge content still rely mainly on full-backup persistence

### P1: OCR Hardening

Goal:

Get screenshot paste to usable saved entry under 30 seconds for normal question capture.

Current focus:

1. keep the tiny-image numeric OCR path stable on real samples
2. add visible OCR candidate switching so users can recover quickly when the first extraction is imperfect
3. improve mixed Chinese text stem recognition
4. keep low-text image questions on a manual-first path instead of pretending OCR is strong enough
5. avoid coupling OCR work with a risky engine migration before current Tesseract improvements are exhausted

Preferred UX direction:

1. show 2-3 candidate previews directly above the question field
2. let one click replace the current stem
3. label candidates with confidence hints
4. keep retry possible without re-uploading the image

### P2: Entry Flow Simplification

Goal:

Open modal to fastest-safe save in fewer than 5 steps.

Already applied on 2026-03-26:

1. widened the modal
2. added a flow banner
3. made advanced fields collapsible
4. kept OCR embedded in the stem-entry workflow

Next implementation moves:

1. visually separate minimum-required fields from optional metadata
2. keep question, options, answer, and knowledge attachment grouped together
3. split save actions into "save" and "save and continue refining"
4. avoid forcing AI-analysis fields on the first-pass capture path
5. collapse optional fields more aggressively on mobile or small screens

### P3: Frontend Consolidation And Module Split

Goal:

Move away from `xingce_v3.html` as one giant page without changing the FastAPI contract or current runtime behavior.

Rules:

1. extract one module group at a time
2. do not mix module split with schema changes
3. preserve the current two-pane layout
4. keep each extraction independently verifiable

Recommended extraction order:

1. `toast.js` and `dom-utils.js`
2. `markdown-render.js` and `error-card-render.js`
3. `top-bar-panel.js` and `cloud-sync-store.js`
4. `error-list-panel.js`
5. `knowledge-tree-panel.js` and `knowledge-tree-store.js`
6. `knowledge-workspace-panel.js`
7. `ai-tools-modal.js` and `ai-tools-store.js`
8. remaining modal and compatibility helpers

Acceptance after each step:

1. login and logout still work
2. cloud sync load and save still work
3. CRUD on error entries still works
4. page refresh does not lose local data
5. the extracted module behaves the same as before the split

### P4: Connect Existing AI Capability To Real UI Entry Points

Goal:

Use the AI endpoints that already exist instead of leaving them backend-only.

Best next integration sequence:

1. `/diagnose` first as the smallest end-to-end validation
2. `/generate-question` plus `/evaluate-answer` as the highest-value practice loop
3. `/distill` to support note writing from current-node errors

Other ready endpoints that still need UI attachment:

1. `/module-summary-for-claude`
2. `/discover-patterns`
3. `/suggest-restructure`
4. `/practice/daily`

## Deferred But Intentional

These are explicitly not the current first move:

1. full fine-grained sync for all note content types
2. full rewrite before incremental module extraction proves out
3. generalized AI knowledge-base productization ahead of the actual workflow
4. Shenlun module buildout, data model, and import flow

Current boundary:

The repository may continue holding Shenlun source material, but Shenlun implementation work is deferred until the daily xingce capture and review path feels fast and stable enough.

## Acceptance Standard For The Next Phase

The next stage is considered successful when:

1. daily capture and edit flow is clearly faster and lighter to use
2. OCR candidate recovery is visible and practical
3. notes workspace layout and TOC behavior are stable
4. at least one existing AI endpoint is wired into a real user-facing flow
5. the roadmap and supporting docs match the actual runtime state

## 2026-03-26 Progress Snapshot

### Completed Recently

1. hybrid sync mainline is running on the named tunnel domain
2. login-page and top-bar disclosure were simplified
3. the old right rail was removed from the active layout
4. OCR upload, preview, and fill-back flow were connected into the error editor
5. OCR validation now uses real database-backed regression images
6. tiny numeric MCQ screenshots improved from noisy partial extraction to usable stem-plus-options recovery
7. the first level of the knowledge tree is intended to stay collapsed by default
8. note TOC handling was narrowed to a floating-right baseline with stale TOC cleanup on non-leaf nodes
9. the entry modal already has a clearer first-pass structure than before
10. OCR backend routing now supports `umi-ocr` sidecar plus Tesseract fallback
11. Docker runtime now includes an `ocr-wechat` profile for the Umi-OCR sidecar
12. both local and public browser-based verification have confirmed `engine = "umi-ocr"` through the real app path

### Highest-Value Next Steps

1. finish OCR candidate selection UX
2. complete notes-area and TOC cleanup
3. make the minimum-required save path more obvious
4. continue module extraction on the current two-pane baseline
5. wire one high-value AI endpoint into the real UI flow

### Operational Baseline After This Session

1. preferred startup command is `docker compose --profile ocr-wechat up -d app umi-ocr`
2. `https://erroranaly.qzz.io` must be treated as a separately verified runtime, not just a mirror of local `127.0.0.1`
3. OCR success is only considered real when the page flow or browser-context upload returns `engine = "umi-ocr"`
