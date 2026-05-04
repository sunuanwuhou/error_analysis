# xingce_v3_lab Ops Incident Log

## 2026-03-26 OCR note

- `PaddleOCR` was evaluated inside the current `error_manage-ocr` app container.
- App-side upload wiring is straightforward, but the runtime is not stable enough for production yet.
- Current blockers found during real tests:
  - missing system libs (`libGL.so.1`, `libgomp.so.1`) until added in Docker
  - Paddle runtime compatibility errors in this base image (`ConvertPirAttribute2RuntimeAttribute...`)
- Recommendation:
  - keep OCR as a separate worker/container instead of coupling it to the main app
  - use a two-step flow: OCR to text, then feed text into existing AI analysis endpoints

## 2026-03-26 OCR progress update

- The current production OCR path is now `Tesseract`-based, not `PaddleOCR`-based.
- OCR regression is being checked against real screenshots extracted from `user_backups`.
- Current practical result:
  - long numeric options now recover much better than the first Tesseract pass
  - tiny numeric MCQ screenshots gained a dedicated short-option-column recovery path
  - the OCR response now includes alternative candidates so the frontend can expose safer fallback choices
- Current boundary:
  - numeric choice screenshots improved the most
  - mixed Chinese text stems and non-standard layouts still need another pass
- Current priority order:
  1. stabilize OCR candidate selection in the frontend
  2. keep improving OCR for mixed text images
  3. only then revisit whether a separate OCR worker is still necessary

## 2026-03-26 Frontend Safety Notes

- The user-facing shell is no longer a single direct `xingce_v3.html` entry for logged-in `/`.
- Runtime confusion now usually comes from multiple surviving asset paths, not from one inline script only.
- Practical rule after meaningful frontend edits:
  1. extract inline script and run `node --check`
  2. rebuild Docker
  3. verify `/login` or `/` actually renders from the rebuilt runtime
- Do not trust only static HTML inspection when the page appears blank or unresponsive.

## 2026-03-29 Feature Shell Rule

- New user-facing tools should prefer a separate HTML page under `xingce_v3/` plus a small host bridge in `xingce_v3.html`.
- Current examples:
  - `note_editor.html`
  - `note_viewer.html`
  - `process_image_editor.html`
  - `global_search.html`
- The main page should stay responsible for workspace state, routing context, and save hooks.
- Heavy editor, viewer, and search interactions should live in their own HTML + module pair when possible.
- Do not default to adding another large inline feature block into `xingce_v3.html` unless the change is truly tiny.

## 2026-03-26 Notes And Tree Rules

- The knowledge tree should default to collapsed at the first level.
- Expansion should happen only from explicit user action or path-focused navigation.
- Notes should keep only the floating TOC on the right.
- Do not reintroduce duplicate inline TOC blocks above note content.
- When a knowledge node is a directory node rather than a leaf note node, clear the floating TOC so stale headings do not remain visible.

## 2026-03-26 TOC Recovery Rule

- When note TOC behavior regresses, inspect the last known good implementation before adding more local fixes.
- For this repo, the reliable pre-regression reference is the `2026-03-23` TOC line, especially commit `669d35e`.
- The right-side TOC should be sourced from note-body Markdown headings only.
- Do not force knowledge-node titles or note-type labels into the TOC unless the product explicitly wants that behavior.
- Separate two questions during debugging:
  1. where the TOC data comes from
  2. where the TOC is rendered
- If the UI is showing the wrong labels, verify the data-source rule first before changing layout or CSS again.
- If old right-rail code and new floating-TOC code coexist, choose one active runtime path and explicitly disable the other.

## 2026-03-26 OCR Boundary Notes

- Numeric multiple-choice screenshots can justify special handling and aggressive preprocessing.
- Graphic reasoning or image-first questions should not be treated as standard OCR success cases.
- If extracted text is too sparse, the UI should tell the user to keep the image and fill the text manually, rather than pretending OCR is reliable.
- "More like WeChat scan" in practice means:
  1. stronger preprocessing
  2. better candidate ranking
  3. better failure messaging  
  It does not mean generic OCR should be forced onto low-text image questions.

## 2026-03-26 Umi OCR Acceptance Rule

- Do not treat `OCR_BACKEND=umi` or a healthy `umi-ocr` container as proof that the app is already using WeChat OCR.
- The only reliable acceptance check is a real authenticated call to `/api/ai/ocr-image`.
- Success means the live response includes:
  - `result.engine == "umi-ocr"`
  - `result.variant == "remote-http"`
- If the app still returns `tesseract`, inspect the live app code inside the container and look for swallowed fallback errors.
- A concrete failure found in this rollout:
  - `run_umi_ocr_bytes()` raised `NameError`
  - fallback logic then silently returned the Tesseract result
- Practical sequence:
  1. verify `docker-compose.yml` and `.env`
  2. rebuild the app container
  3. verify the live app code and env inside the container
  4. run a real OCR request through the app endpoint
  5. only then declare the OCR switch complete

## 2026-03-26 Legacy HTML Triage Rule

- `xingce_v3.html` is not safe for casual localized patching when mojibake is already present inside quoted strings.
- A single damaged literal near the top of the inline script can break the whole page and make unrelated features such as the question list appear broken.
- Before pushing any HTML change to `main`, extract the inline script and run a syntax check against the served file, not only the source diff.
- If the file shows chained syntax failures, stop layering more local fixes and fall back to one of these paths:
  1. restore the last known good HTML baseline
  2. move the risky logic into an external module before changing behavior
