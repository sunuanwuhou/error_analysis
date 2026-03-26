# xingce_v3_lab Ops Notes

## Runtime Rule

This project now has one stable production entry and one preferred local debug entry:

- local debug: `http://127.0.0.1:8000`
- production/public: `https://erroranaly.qzz.io`

Do not assume `localhost`, `127.0.0.1`, Docker port mappings, and the public domain share one browser-local state.

## Product Boundary

Current boundary:

1. authenticated study workbench
2. manual error entry and note editing
3. hybrid sync
4. AI-assisted review and practice support

Not yet:

1. full exam delivery platform
2. OCR-first ingestion system
3. fully normalized study database for every content type

## Storage Rule

The system is intentionally hybrid:

1. `user_backups`
   - compatibility
   - restore
   - rollback safety net
2. `operations`
   - per-error incremental sync
3. `user_images`
   - file-backed uploaded images

Practical caution:

- note bodies and knowledge content are still mainly protected by full-backup flow
- error records are the main fine-grained sync target

## Auth Rule

Current rule is fixed:

- unauthenticated user -> `/login`
- authenticated user -> `/`

The login page is intentionally simplified and no longer shows the current domain or tunnel URL.

## Docker Rule

When running with Docker, changes under these paths require rebuilding the app container:

- `app/`
- `xingce_v3/`
- `scripts/`

Command:

```bash
docker compose up --build -d app
```

## OCR Docker Rule

The current preferred OCR runtime is now a sidecar Umi-OCR service instead of a direct in-process engine swap inside the app container.

Current rule:

1. the app keeps `/api/ai/ocr-image` as the only product-facing OCR entry
2. OCR backend selection is env-driven
3. `umi` is the preferred runtime path
4. Tesseract stays in place as fallback safety

Required envs:

- `OCR_BACKEND=umi`
- `OCR_TESSERACT_FALLBACK=true`
- `UMI_OCR_URL=http://umi-ocr:1224/api/ocr`

Start command:

```powershell
docker compose --profile ocr-wechat up -d app umi-ocr
```

Important runtime note:

- the `umi-ocr` container must run with `HEADLESS=true`
- without it, the container falls into GUI mode and fails with `$DISPLAY is not set`

Success criteria:

1. `xingce_v3_umi_ocr` is `Up`
2. `http://127.0.0.1:1224/api/ocr/get_options` returns `200`
3. `/api/ai/ocr-image` from the main app returns `engine = "umi-ocr"`

## Cloudflare Rule

Production public access should use the named tunnel and fixed domain:

- `https://erroranaly.qzz.io`

Bootstrap or repair:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bind-cloudflare-domain.ps1
```

Quick-tunnel fallback:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-quick-tunnel-docker.ps1
```

Do not treat “tunnel started” as success until the public login page returns `200`.

## Verification Rule

Recommended verification sequence after meaningful backend or frontend changes:

1. `python -m py_compile app/main.py`
2. `python .\scripts\verify_v31_smoke.py`
3. `docker compose --profile ocr-wechat up --build -d app umi-ocr`
4. verify local `http://127.0.0.1:8000`
5. verify OCR sidecar `http://127.0.0.1:1224/api/ocr/get_options`
6. verify public `https://erroranaly.qzz.io/login`
7. verify public OCR path through the real page/runtime, not only direct local API calls

If browser-based UI smoke is needed inside the app container:

1. `docker exec xingce_v3_app npx playwright install chromium`
2. `docker exec xingce_v3_app npx playwright install-deps chromium`
3. `docker exec xingce_v3_app node /app/scripts/verify_ui_smoke.mjs`

## Frontend Runtime Rule

For UI bugs, verify runtime path before changing code again:

1. confirm which URL the user opened
2. confirm which runtime serves that URL
3. confirm Docker container was rebuilt if needed
4. then debug HTML/CSS/JS behavior

## Windows Encoding Rule

This repo is edited on Windows and terminal output can show mojibake.

Practical rule:

1. prefer `apply_patch` for targeted text edits
2. do not trust PowerShell console rendering alone
3. verify file content carefully before broad replacements

## Shenlun Source Rule

Imported Shenlun source files inside this repo are treated as read-only source material for the next module buildout.

Current locations:

- [knowledge_sources/shenlun/quantity](E:\IdeaProject\git\xingce_v3_lab\knowledge_sources\shenlun\quantity)
- [knowledge_sources/shenlun/ashore](E:\IdeaProject\git\xingce_v3_lab\knowledge_sources\shenlun\ashore)

Do not manually rewrite these copies as product content. Product-facing structured data should be generated from them in a later phase.
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

- The main page still ships as one large inline script inside `xingce_v3.html`.
- A single malformed regex or template string can break the whole workbench at load time.
- Practical rule after meaningful frontend edits:
  1. extract inline script and run `node --check`
  2. rebuild Docker
  3. verify `/login` or `/` actually renders from the rebuilt runtime
- Do not trust only static HTML inspection when the page appears blank or unresponsive.

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
- “More like WeChat scan” in practice means:
  1. stronger preprocessing
  2. better candidate ranking
  3. better failure messaging
  It does not mean generic OCR should be forced onto low-text image questions.

## 2026-03-26 OCR WeChat Docker Decision

- The earlier assumption that OCR had already been moved to a WeChat-like Docker path was false.
- Before the final integration pass, the repo was still running a Tesseract-only OCR runtime.
- The chosen implementation for this phase is:
  1. keep the frontend OCR contract unchanged
  2. keep the FastAPI OCR endpoint unchanged
  3. add backend dispatch between `umi` and `tesseract`
  4. keep Tesseract as fallback instead of deleting it
- This gives the product a more WeChat-like OCR runtime without forcing a risky all-at-once rewrite.

## 2026-03-26 Public Verification Rule

- Public homepage `200` is necessary but not sufficient.
- For this project, meaningful public verification now means:
  1. the public login page opens
  2. a browser-based smoke flow passes on `https://erroranaly.qzz.io`
  3. a real browser-context upload to `/api/ai/ocr-image` returns `engine = "umi-ocr"`
- Direct script requests to the public domain can still hit edge-layer restrictions and should not be the only acceptance signal.

## 2026-03-26 Backend Safety Note

- `app/main.py` carried duplicate `run_ocr_bytes` definitions during this phase.
- Practical rule:
  1. when touching OCR again, verify which definition wins at runtime
  2. prefer one final dispatch entry and explicit backend-specific helpers
  3. do not add another OCR path without checking the final active function order first
