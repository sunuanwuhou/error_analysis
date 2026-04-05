# Pending Execution

Updated: 2026-04-05

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

## Execution Note

When executing later, use this schema as the preferred baseline. If a planned batch contains only the fields above, it should still be accepted without needing legacy fields.
