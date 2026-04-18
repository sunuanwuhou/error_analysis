# Architecture Boundaries

This repository keeps one active product path and a small set of legacy/runtime areas. New work should keep these boundaries intact.

## Directory Responsibility Table

| Path | Status | Responsibility | Change Rule |
| --- | --- | --- | --- |
| `frontend/` | Target primary (migration in progress) | Main Vue frontend target for new user-facing product work. | New frontend features, routes, state, and UI modules go here; production root routing is still legacy until migration cutover. |
| `app/routers/` | Active backend protocol layer | FastAPI route definitions, request/response validation, auth dependencies, and exception mapping. | Keep thin. Business logic should move into `app/services/`. |
| `app/services/` | Active backend business layer | Reusable backend workflows and domain logic called by routers. | Add or extend services when router logic grows beyond protocol handling. |
| `app/database.py`, `app/schemas.py`, `app/security.py`, `app/config.py` | Active backend support | Database access, schemas, security helpers, and runtime configuration. | Keep shared behavior here when it is not route-specific business logic. |
| `xingce_v3/` | Legacy | Existing legacy frontend and compatibility surface. | Bug fixes and migration adapters only. No new product modules. |
| `v51_frontend/` | Legacy | Older frontend implementation/reference. | Bug fixes and migration references only. No new product modules. |
| `converter/src/`, `converter/tools/` | Tooling | Source conversion scripts and helper tools. | Keep generated output outside source history. |
| `converter/output/` | Generated | Conversion results, previews, samples, and local artifacts. | Do not add new generated files to Git. |
| `docs/` | Active documentation | Current project rules, scope, release gate, handoff, runbook, and roadmap docs. | Keep docs grouped by `docs/active/`, `docs/ops/`, `docs/roadmap/`, `docs/archive/`; update `docs/INDEX.md` after major doc changes. |
| `docs/archive/` | Historical documentation | Phase plans, completed rollout notes, old optimization writeups, and frozen delivery records. | Read-only by default; append only when archiving closed milestones. |
| `scripts/check/`, `scripts/release/`, `scripts/migration/` | Script domains | Quality checks, release packaging helpers, and migration utilities grouped by responsibility. | Keep compatibility wrappers under `scripts/*.py`; new scripts should land in a domain folder first. |
| `data/`, `runtime/`, `cloudflared/` | Local runtime | Local databases, runtime state, and tunnel files. | Ignored; do not commit runtime state. |
| `.idea/`, `.vscode/` | Local editor state | Developer machine/editor configuration. | Ignore workspace state. Commit only intentionally shared editor recommendations. |

## Entry Contract

`frontend/` is the target main frontend entry, but the current `/` production route still serves the legacy shell during migration. Legacy directories exist so the current product remains recoverable while migration continues, but they are not expansion points for new functionality.

When frontend work is ambiguous, prefer moving the active path forward in `frontend/` and add only the smallest compatibility layer needed in legacy code.

## Router Contract

Routers should handle:

- request parsing and validation
- auth/user dependency wiring
- calling a service function
- translating known service errors into HTTP responses

Services should handle:

- business decisions
- database workflows
- rollback-safe multi-step operations
- reusable domain transformations

This keeps route files easier to review and makes backend behavior testable without HTTP plumbing.

## Repository Hygiene Contract

Generated files, build output, IDE workspace files, local databases, logs, and temporary runtime state should stay out of source history. If a build or conversion result is needed for delivery, publish it as a CI artifact or regenerate it from tracked source.
