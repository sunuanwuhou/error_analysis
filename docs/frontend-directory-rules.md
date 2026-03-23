# Frontend Directory Rules

## Goal

Freeze the current experience and safety rules around the front-end directory model before any larger sync or module refactor.

In this project, "directory" means the front-end maintained `dirTree` and the related type/subtype/subSubtype selection flow.

## Current Reality

1. `dirTree` is front-end state first, not a backend-owned structured table.
2. `dirTree` is stored in browser-local IndexedDB.
3. `dirTree` is also packed into the per-user cloud full backup.
4. Different origins do not share one local directory cache.
5. A new origin can therefore look like "no directory" until it loads the cloud backup for the same user.

This means directory behavior is currently tied to the full-backup model, not to a dedicated directory-sync model.

## Product Rules

1. The directory is part of the user workspace, not disposable UI decoration.
2. Directory edits must be treated with the same importance as error data and knowledge notes.
3. An empty local directory on a new origin must not be interpreted as proof that the user has no directory data.
4. When the current origin has no local workspace, cloud restore may initialize the directory from backup.
5. When the current origin already has local workspace data, directory restore must require explicit user choice.

## State Ownership Rules

Current source of truth order:

1. current origin IndexedDB for live editing
2. cloud full backup for cross-origin recovery
3. `DEFAULT_DIR_TREE` only as fallback bootstrap

Practical rule:

- `DEFAULT_DIR_TREE` is a bootstrap template, not user truth
- once user directory data exists, do not silently prefer defaults over saved `dirTree`

## Rendering Rules

1. Directory modal always reads from `loadDirTree()`.
2. Directory writes must go through `saveDirTree()`.
3. Any entry form that depends on directory options must read from the same in-memory `dirTree`.
4. If directory data is absent, the UI may fall back to defaults, but must not overwrite a richer cloud copy without explicit save intent.

## Sync Rules

With the current full-backup architecture:

1. `dirTree` must always be included in backup payloads.
2. cloud restore must write `dirTree` back into IndexedDB even when the restored value is `null`
3. local workspace presence checks must count `dirTree`
4. directory data must not be excluded from conflict reasoning just because it is "configuration"

Reason:

- losing directory state changes how all later entries are classified
- a directory overwrite is effectively a data-shape overwrite

## Safety Rules

1. Do not auto-assume a new public origin should overwrite cloud directory state.
2. Do not auto-assume a new public origin should overwrite local directory state from cloud if the user has already edited locally there.
3. Do not hide directory loss behind fallback defaults.
4. Do not treat a tiny backup containing default demo data as equivalent to a real user workspace.

## Debug Rules

When the user says "外网没有目录", check in this order:

1. which exact origin is open
2. whether the user is logged into the expected account
3. whether `/api/backup` for that user actually contains `dirTree`
4. whether current origin restored cloud backup
5. whether local IndexedDB still holds an older or empty `dirTree`

Do not start by changing the directory UI.

## Refactor Rules

Before splitting directory code out of `xingce_v3.html`, preserve these invariants:

1. one loader for directory state
2. one saver for directory state
3. one backup contract for directory state
4. one explicit fallback to defaults

Recommended future extraction:

- `directory-store.js`
- `directory-modal.js`
- `directory-selectors.js`

But the extraction must not change current data semantics in the same step.

## Next Safe Improvements

These are safe follow-up changes after the rules above are frozen:

1. disable auto cloud save for directory edits first
2. show directory counts in cloud diff/conflict prompts
3. add backup history before any stronger sync automation
4. eventually split directory sync from whole-workspace backup
