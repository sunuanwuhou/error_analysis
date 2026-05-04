# Agent Execution Rules (WSL-First, Mandatory)

This repository is WSL-first on Windows.

## Mandatory

1. All build/test/docker/runtime commands MUST run through WSL.
2. Preferred entry on Windows PowerShell:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action <...>`
3. Alternative allowed form:
   - `wsl -e bash -lc "cd /mnt/e/IdeaProject/git/xingce_v3_lab && <command>"`

## Disallowed (unless user explicitly asks)

1. Direct Windows-native docker/python/node command execution in project root.
2. Mixed Windows+WSL command chains for one task.

## Standard Operations

- Start/rebuild app:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action up`
- Check containers:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action ps`
- View logs:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action logs -Service app -Tail 200`
- Run custom command:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action sh -Cmd "<command>"`

## Deployment Rule (Mandatory)

1. After any code change that can affect runtime behavior, you MUST rebuild/redeploy the app container before claiming the change is live.
2. This is especially mandatory for:
   - frontend CSS/JS/HTML changes under `xingce_v3/`
   - bundle or manifest changes
   - FastAPI static asset serving changes
   - Python backend code changes
3. Required default command:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action up -Service app`
4. After rebuild, verify the running service response instead of trusting local files alone. Prefer checking:
   - `http://127.0.0.1:8080/assets/...`
   - container logs
   - live page behavior
5. Do not treat "local file modified" as equivalent to "container already serving new code".

## Full Sync Build Rule (Mandatory)

1. For any frontend runtime behavior change (especially knowledge tree, persistence, sync, and sidebar rendering), you MUST perform a full legacy asset rebuild before redeploy:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action sh -Cmd "cd /mnt/e/IdeaProject/git/xingce_v3_lab && python3 scripts/release/build_legacy_assets.py"`
2. After rebuild, you MUST redeploy the app container:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action up -Service app`
3. After redeploy, you MUST verify served assets contain expected markers from the fix (not just file timestamps), at least on:
   - `http://127.0.0.1:8080/assets/modules/legacy-app.home.bundle.js`
4. If a public domain verification URL is provided and accessible, verify that domain asset too before claiming "domain is updated".
5. If domain verification is blocked (e.g., 403/CDN restriction), explicitly report that domain deployment cannot be confirmed yet and do not claim remote is live.

## Goal

Keep environment behavior consistent, avoid Windows path/permission differences, and reduce flaky build/runtime issues.
