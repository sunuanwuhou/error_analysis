# CHANGE_PROTOCOL

## Goal

Make every change reproducible, reviewable, and recoverable.
No silent behavior change without matching checks and docs updates.

## Mandatory workflow for every runtime-affecting change

1. implement code change with clear scope
2. run checks and smoke in WSL/docker runtime
3. update active docs with what changed and what was verified
4. rebuild/redeploy app container before claiming anything is live
5. verify served behavior from runtime endpoints or assets

## Commit protocol

1. one commit = one primary intent
2. avoid mixed mega-commit across unrelated frontend/backend/docs/build outputs
3. generated legacy assets should be a dedicated `chore(build)` commit when possible
4. avoid vague commit messages (for example: "sync latest changes")
5. if behavior change requires asset rebuild, commit behavior change first, rebuild commit second

## Documentation protocol

For runtime-affecting changes, update at least one of:

1. `docs/active/DEVLOG.md`
2. `docs/active/SELF_TEST_REPORT.md`
3. `docs/active/RELEASE_CHECKLIST.md`
4. `docs/active/ROUTE_STATUS.md` (required when route intent or entry behavior changes)
5. `docs/active/ROUTE_CALL_MAP.md` (required when frontend API usage changes)

## Verification protocol

Minimum verification set:

1. `python3 scripts/check_repo_layout.py`
2. `python3 scripts/check/check_router_layout.py`
3. smoke test: `powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action smoke`

WSL-first execution example:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action sh -Cmd "python3 scripts/check_repo_layout.py"
powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action sh -Cmd "docker compose exec -T app python scripts/check/check_router_layout.py"
powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action smoke
```

## Guardrail automation

`scripts/check/check_repo_layout.py --changed <base_ref>` enforces:

1. required active docs exist
2. runtime-affecting diffs must include active docs updates
3. legacy path additions stay inside approved boundaries
4. route call mapping doc is required as active baseline
