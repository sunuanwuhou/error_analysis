# Project docs index

## Read this first

1. `docs/PROJECT_RULES.md`
2. `docs/CURRENT_SCOPE.md`
3. `docs/HANDOFF_CONTEXT.md`
4. `docs/DEVLOG.md`
5. `docs/RELEASE_CHECKLIST.md`
6. `docs/SELF_TEST_REPORT.md`

## Source of truth

For this project, chat is only for communication.
The repository docs are the source of truth.

- long-term rules: `docs/PROJECT_RULES.md`
- current delivery boundary: `docs/CURRENT_SCOPE.md`
- full project handoff context: `docs/HANDOFF_CONTEXT.md`
- versioned changes: `docs/DEVLOG.md`
- delivery gate: `docs/RELEASE_CHECKLIST.md`
- self-test evidence: `docs/SELF_TEST_REPORT.md`

## Structure

- active docs stay in `docs/` root
- historical/closed milestone docs live under `docs/archive/`
- when referencing older plans, link `docs/archive/...` explicitly

## How to use these docs in future sessions

1. read `PROJECT_RULES.md` before changing code
2. confirm the current version target in `CURRENT_SCOPE.md`
3. check `HANDOFF_CONTEXT.md` for background, progress, and constraints
4. after each code change, append to `DEVLOG.md`
5. before packaging, complete `RELEASE_CHECKLIST.md`
6. write the executed checks into `SELF_TEST_REPORT.md`
