# Entry Flow Optimization Plan

## Goal

Make manual question entry feel fast enough that users will keep using it during daily review instead of postponing input because the modal feels heavy.

## User Journey

### 1. Start entry

What the user wants:

1. open the modal from the current knowledge context
2. know immediately where this question will be attached
3. avoid deciding every field up front

Current friction:

1. too many fields appear at once
2. knowledge-node intent is not obvious enough
3. the modal does not clearly communicate a fastest-safe path

### 2. Capture the question

What the user wants:

1. paste text or image quickly
2. let OCR do a first-pass extraction
3. fix only the few wrong parts

Current friction:

1. OCR result quality still varies by screenshot type
2. fallback candidates need to be easier to switch
3. the question area should remain the primary focus

### 3. Confirm answer and structure

What the user wants:

1. verify options and answer fast
2. avoid losing momentum in secondary metadata

Current friction:

1. answer, difficulty, source, and reason fields compete for attention too early
2. there is not yet a stronger minimum-required-to-save path

### 4. Add analysis only when useful

What the user wants:

1. use AI to accelerate filling, not interrupt entry
2. save first, refine later if needed

Current friction:

1. AI tools are useful but visually compete with first-step capture
2. users may feel they should complete every analysis field before saving

## Optimization Priorities

### P0

1. keep the modal centered on question capture first
2. keep current knowledge context obvious
3. make save actions easy to reach

### P1

1. improve OCR candidate switching
2. reduce cognitive load in the first screen of the modal
3. keep question, options, answer, and knowledge context visually grouped

### P2

1. add a clearer quick-save-refine-later mode
2. add presets for common source metadata
3. later split advanced fields behind progressive disclosure if needed

## What Was Already Applied On 2026-03-26

1. widened the entry modal and made footer actions easier to reach
2. added a user-facing flow banner to explain the fastest entry path
3. surfaced current knowledge path and quick actions around node attachment
4. kept OCR integrated directly inside the question field workflow
5. improved tiny numeric screenshot OCR using real database-backed regression images
6. split the entry UI into primary capture, analysis, and advanced metadata sections
7. made advanced metadata collapsible so first-step entry is less mentally heavy

## Next Recommended Implementation

1. make OCR alternatives one-click visible and easier to compare
2. add a compact minimum-required-fields visual grouping
3. keep graphic reasoning or low-text images on a manual-first path instead of forcing OCR confidence
4. collapse low-priority metadata by default on mobile or small screens

## Additional Notes

1. the entry modal works better when users can finish the core capture path without seeing every metadata field at once
2. advanced metadata should stay available, but it should not compete with question capture on the first screen
3. low-text images such as graphic reasoning should use a manual-first path with better guidance instead of pretending OCR is strong enough
