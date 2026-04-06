# Pending Execution

Updated: 2026-04-06

## Planned Import Shape

The following error-entry JSON shape is supported as the current recommended import format for planned execution batches:

```json
[
  {
    "type": "言语理解与表达",
    "subtype": "逻辑填空",
    "subSubtype": "语境分析",
    "question": "...",
    "options": "A...|B...|C...|D...",
    "answer": "A",
    "myAnswer": "D",
    "actualDurationSec": 34,
    "targetDurationSec": 45,
    "problemType": "cognition",
    "confidence": 1,
    "rootReason": "...",
    "errorReason": "...",
    "analysis": "...",
    "tip": "...",
    "difficulty": 2,
    "status": "focus"
  }
]
```

## Current Support Status

- Supported in import/preserve/export:
  - `type`
  - `subtype`
  - `subSubtype`
  - `question`
  - `options`
  - `answer`
  - `myAnswer`
  - `actualDurationSec`
  - `targetDurationSec`
  - `problemType`
  - `confidence`
  - `rootReason`
  - `errorReason`
  - `analysis`
  - `tip`
  - `difficulty`
  - `status`
- Timestamp compatibility is already in place for "发给 CC" style records:
  - `createdAt`
  - `sentAt`
  - `sharedAt`
  - legacy aliases such as `ccSentAt`, `claudeSentAt`, `codexSentAt`
- Optional but recommended for later workflow automation:
  - `workflowStage`
  - `nextActionType`
  - `masteryLevel`
  - `addDate`
  - `updatedAt`

## Current Conclusion

- This structure is already importable now.
- Core analysis fields will not be dropped during import/export.
- `type/subtype/subSubtype` can drive branch creation and node targeting during import.
- "发给 CC" related send-time fields are already normalized and should remain import-compatible.
- Remaining gap is mainly presentation consistency, not storage compatibility:
  - some fields are stored and exported correctly,
  - but not every field is surfaced everywhere in the UI yet.

## Follow-up Tasks

- Verify the planned batch import path with a real sample file using this exact schema.
- Confirm `actualDurationSec` and `targetDurationSec` are visible in all intended UI surfaces.
- Confirm `tip` is shown consistently in card/detail/dashboard views, not only preserved in data.
- Decide whether `problemType` should be enum-validated or continue as free text.
- Decide whether future planned imports should require `workflowStage` and `nextActionType`.

## Planned Export/Import Simplification

The current export/import UI exposes too many internal data-mode concepts at once. A later cleanup should switch both flows from "format-oriented" choices to "purpose-oriented" choices.

### Export: Proposed Simplified Modes

- `发给 CC`
  - Fixed payload goal: `questions_notes`
  - Intended for question + note handoff to CC / external整理
  - Keep only scope selection:
    - all errors
    - current filter
    - current module / knowledge node
- `打印 / PDF`
  - Keep only print-oriented content choices:
    - questions only
    - questions + answers + analysis
    - notes only
- `完整备份`
  - Full-site backup for migration / disaster recovery
  - Should be visually separated and explicitly marked as dangerous / advanced

### Export: What To Hide From Primary UI

- Do not expose these internal-facing concepts in the main modal:
  - `仅题目`
  - `模块备份`
  - "导出格式 / 导出内容 / 导出范围" as three stacked technical layers
- If `module_backup` still needs to exist, move it behind an advanced or maintenance-only path instead of the default export dialog.

### Import: Proposed Simplified Modes

- `回填 CC 整理结果`
  - Intended pair for `发给 CC`
  - Update only content fields such as:
    - `rootReason`
    - `errorReason`
    - `analysis`
    - `tip`
    - `note`
    - optional images / process-canvas related fields
  - Must not overwrite by default:
    - `knowledgeTree`
    - `knowledgeNotes`
    - `noteNodeId`
- `安全合并`
  - Used for ordinary question merges
  - Preserve current structure and existing挂载
  - Avoid overriding local core notes/tree state
- `完整恢复`
  - Used only for full backup restoration
  - Requires explicit danger confirmation

### Product Goal

Export and import should map cleanly by user intent:

- `发给 CC` -> `回填 CC 整理结果`
- `打印 / PDF` -> no import path needed
- `完整备份` -> `完整恢复`

This later cleanup should reduce user confusion around:

- whether a file will change structure
- whether notes will overwrite
- whether a file is for handoff vs restore

The UI should communicate purpose first, not internal storage mode names.

## Execution Note

When executing later, use this schema as the preferred baseline. If a planned batch contains only the fields above, it should still be accepted without needing legacy fields.
