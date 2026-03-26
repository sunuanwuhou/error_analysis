# OCR WeChat Docker Runbook

## Goal

This runbook is the shortest repeatable path for bringing up the WeChat-style OCR runtime and proving that the app is really using it.

## Runtime Shape

Current production-like OCR path:

1. FastAPI app exposes `/api/ai/ocr-image`
2. app dispatches OCR by env
3. preferred backend is `umi`
4. fallback backend is `tesseract`
5. Umi-OCR runs as Docker sidecar `xingce_v3_umi_ocr`

## Required Env

Use these values:

```env
OCR_BACKEND=umi
OCR_TESSERACT_FALLBACK=true
UMI_OCR_URL=http://umi-ocr:1224/api/ocr
```

## Start

From the repo root:

```powershell
docker compose --profile ocr-wechat up -d app umi-ocr
```

If code under `app/`, `xingce_v3/`, or `scripts/` changed:

```powershell
docker compose --profile ocr-wechat up --build -d app umi-ocr
```

## Mandatory Container Rule

`umi-ocr` must run headless:

```yaml
HEADLESS: "true"
```

If this is missing, the container enters GUI mode and fails with:

```text
Error: $DISPLAY is not set.
```

## Health Checks

Container status:

```powershell
docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}" | Select-String -Pattern "xingce_v3_app|xingce_v3_umi_ocr|xingce_v3_tunnel"
```

Umi-OCR sidecar health:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:1224/api/ocr/get_options
```

Expected result:

1. HTTP `200`
2. JSON options payload

## App-Level OCR Check

The sidecar being up is not enough. The app must return `engine = "umi-ocr"` from its own OCR API.

Practical rule:

1. log in through the app
2. upload an image through `/api/ai/ocr-image`
3. confirm the response engine is `umi-ocr`

Accepted result shape:

```json
{
  "ok": true,
  "result": {
    "engine": "umi-ocr",
    "variant": "remote-http"
  }
}
```

## Public Verification

Do not stop at local verification.

Public runtime:

- [https://erroranaly.qzz.io](https://erroranaly.qzz.io)

Meaningful public acceptance means:

1. public login page opens
2. browser-based smoke passes on the public domain
3. browser-context OCR upload returns `engine = "umi-ocr"`

Important note:

- direct scripted requests to the public domain can hit edge restrictions
- browser-context verification is the reliable acceptance path

## UI Smoke Inside Docker

If Playwright is not ready inside `xingce_v3_app`, install it first:

```powershell
docker exec xingce_v3_app npx playwright install chromium
docker exec xingce_v3_app npx playwright install-deps chromium
```

Then run:

```powershell
docker exec xingce_v3_app node /app/scripts/verify_ui_smoke.mjs
```

For public-domain smoke:

```powershell
docker exec -e XINGCE_BASE_URL=https://erroranaly.qzz.io xingce_v3_app node /app/scripts/verify_ui_smoke.mjs
```

## Common Failure Cases

### `umi-ocr` keeps restarting

Likely cause:

- missing `HEADLESS=true`

Check:

```powershell
docker logs xingce_v3_umi_ocr --tail 80
```

Bad sign:

```text
Use GUI mode.
Error: $DISPLAY is not set.
```

### sidecar is up but app still returns Tesseract

Likely causes:

1. app container still has old env
2. app container was not recreated after env or compose changes
3. backend fell back because Umi-OCR call failed

Checks:

```powershell
docker exec xingce_v3_app printenv OCR_BACKEND
docker exec xingce_v3_app printenv UMI_OCR_URL
docker exec xingce_v3_app printenv OCR_TESSERACT_FALLBACK
```

Expected:

1. `umi`
2. `http://umi-ocr:1224/api/ocr`
3. `true`

### public homepage works but public OCR is still unknown

Meaning:

- you have only proved tunnel reachability
- you have not yet proved OCR path integration

Fix:

1. run public browser smoke
2. run public browser-context OCR upload
3. only then mark OCR public path as done

## Source Of Truth Files

Key files for this OCR path:

- [app/main.py](/E:/IdeaProject/git/xingce_v3_lab/app/main.py)
- [docker-compose.yml](/E:/IdeaProject/git/xingce_v3_lab/docker-compose.yml)
- [.env.example](/E:/IdeaProject/git/xingce_v3_lab/.env.example)
- [scripts/verify_ui_smoke.mjs](/E:/IdeaProject/git/xingce_v3_lab/scripts/verify_ui_smoke.mjs)
- [docs/ops-notes.md](/E:/IdeaProject/git/xingce_v3_lab/docs/ops-notes.md)
