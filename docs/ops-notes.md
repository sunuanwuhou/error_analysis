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
3. `docker compose up --build -d app`
4. verify local `http://127.0.0.1:8000`
5. verify public `https://erroranaly.qzz.io/login`

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
