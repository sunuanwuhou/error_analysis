# NEXT Button Parity Tasklist

## Goal

Restore old button behavior inside `/next` without changing the current Docker/domain runtime chain.

The migration rule is:

1. keep function the same
2. keep layout the same
3. prefer in-place action or modal behavior when the old product did not leave the current workspace

## Encoding Guardrails

Before continuing button parity work, the repo now uses:

1. `.editorconfig` to keep text files on UTF-8 + LF
2. `.gitattributes` to pin working tree encoding for core text files
3. `python scripts/check_text_encoding.py` to catch common mojibake markers early

## P0: Already corrected

1. workspace `云端载入 / 云端保存` now execute in place again instead of navigating to a separate `/next` route

## P1: High-priority button parity

1. `快速录题`
Current mismatch: routed to full `/next/actions/quickadd` page
Target parity: open the same current-context quick entry flow the old workspace used, especially when a knowledge node is already selected

2. `导出`
Current mismatch: routed to a standalone `/next/tools/export` page
Target parity: restore old current-workspace invocation rhythm; if old behavior was modal/in-place, `/next` should keep the user in the same working context

3. `备注`
Current mismatch: opens embedded route shell instead of old in-place remark modal behavior
Target parity: restore in-place global remark interaction

4. `每日日志`
Current mismatch: opens embedded route shell instead of old in-place daily journal modal behavior
Target parity: restore in-place daily journal interaction

## P2: Knowledge-tree action parity

1. `编辑节点 / 移动节点 / 新建子节点`
Current state: native pages exist and preserve node context
Next parity step: compare against old modal feel and decide which actions should stay in-page versus route-level

2. `改挂载`
Current state: error cards still use a simplified route-based edit flow
Target parity: restore the old knowledge move chooser rhythm as closely as possible

## P3: Backup/tool menu parity

1. local backup entry rhythm
2. more-tools menu behavior
3. print/export shortcuts that used to jump directly into the old export modal state

## Working Rule

For each button group:

1. compare old trigger behavior first
2. keep `/next` visual structure stable
3. only keep route navigation when old behavior truly was a page transition
