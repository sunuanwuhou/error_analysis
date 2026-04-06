# Pending Execution

Updated: 2026-04-06

## Current Mainline

The product mainline is now the workflow loop itself, not richer import fields:

1. Decide whether the user should read notes first.
2. Decide whether the user should directly do questions.
3. Decide whether the user should run timed retraining.
4. Let the homepage dispatch those three task types clearly.

## Core User Model

The current error pool should be treated as three practical situations:

- `不会做`
  - The user lacks method, pattern recognition, or concept recall.
  - Default action: read note first, then do a small matching question set.
- `做得慢`
  - The user can solve but is too slow or hesitates too long.
  - Default action: do the question first under time pressure, then show note summary only if still slow.
- `会做但做错`
  - The user basically knows it but misses conditions, compares options poorly, or makes execution mistakes.
  - Default action: show one short reminder first, then do the question directly.

## Homepage Dispatch Model

The homepage should remain a task dispatcher with three visible zones:

- `先看笔记`
  - For "不会做" questions
  - Show note title, tip, and short note summary before entering practice
- `直接开做`
  - For "会做但做错" questions
  - Show one short reminder only
- `限时复训`
  - For "做得慢" questions
  - Show target duration and a short method reminder

The homepage should answer:

- what to do now
- whether to read notes first
- which note the task belongs to

It should not become a large all-in-one statistics page.

## Current Product Rules

The first implementation pass should use existing fields instead of adding new schema:

- `problemType`
- `confidence`
- `rootReason`
- `errorReason`
- `analysis`
- `tip`
- `noteNodeId`
- `actualDurationSec`
- `targetDurationSec`
- recent practice attempts

### Queue Heuristics

- `先看笔记`
  - Prefer `problemType = cognition`
  - Or text signals such as `不会`, `没想到`, `题型识别`, `概念`, `公式`, `方法`
- `直接开做`
  - Prefer `problemType = execution`
  - Or text signals such as `粗心`, `看漏`, `顺序`, `比较`, `审题`
- `限时复训`
  - Prefer `actualDurationSec > targetDurationSec`
  - Or recent practice duration significantly above target
  - Or text signals such as `耗时`, `拖慢`, `犹豫`, `时间不够`

## Development Order

### Phase 1: Queue + Homepage

- Replace old homepage queue language with:
  - `先看笔记`
  - `直接开做`
  - `限时复训`
- Keep old internal queue compatibility during transition
- Let local fallback and backend workbench return the same three queue types

### Phase 2: Entry Behavior

- Before entering a `先看笔记` task:
  - show tip + note summary
- Before entering a `直接开做` task:
  - show one short reminder only
  - open immediately from the local queue instead of waiting on remote fetch
- Before entering a `限时复训` task:
  - show target duration + short reminder
  - display the target time clearly on the question card

### Phase 3: Result Flow

- After completing a timed drill:
  - if on time and correct, reduce urgency
  - if slow or wrong, send back to note summary / retry queue
- After direct-do failure:
  - promote to note-first
- Persist per-question duration for every practice attempt

### Phase 4: Note Recommendation Reliability

- A note recommendation must not appear just because a node exists.
- A note recommendation should first pass three checks:
  - the related error is still not mastered
  - the note has not already been viewed through the recommendation flow today
  - the note content actually covers the current mistake signals

#### 4.1 Mastered-item filter

- Do not recommend note-first tasks for items already considered mastered.
- Filtering should not rely only on `status !== mastered`.
- It should also consider:
  - `masteryLevel`
  - latest practice result
  - recent wrong count
  - whether the item is still entering any active queue

#### 4.2 Note coverage comparison

- Add a comparison algorithm between current error signals and note content.
- Current problem:
  - the system only knows whether a question has a `noteNodeId`
  - it does not yet know whether the note text really covers the current reason
- Desired behavior:
  - if the current error reason contains concepts such as `成语`, `语境分析`, `主语视角`, etc.
  - and the mapped note content does not cover those concepts
  - the system should warn that the note still needs supplementing

#### 4.3 Proposed comparison signals

- Build a note-match score from:
  - `rootReason`
  - `errorReason`
  - `analysis`
  - `tip`
  - type/subtype/subSubtype keywords
- Compare those signals against:
  - note title
  - note path
  - note markdown content

#### 4.4 Missing / weak note warnings

- Distinguish:
  - no note node
  - note node exists but content is empty
  - note content exists but does not cover the current error reason
- Homepage should warn separately for these cases.

#### 4.5 Reminder persistence

- If a recommended note was opened today:
  - do not keep showing it again in the same day
- If it was not actually consumed into follow-up work:
  - recommend it again the next day
- If similar mistakes continue to reappear:
  - increase warning level and copy tone

## Secondary Backlog

These remain valid, but are not the current mainline:

- Export/import simplification by user intent:
  - `发给 CC`
  - `打印 / PDF`
  - `完整备份`
  - paired import modes:
    - `回填 CC 整理结果`
    - `安全合并`
    - `完整恢复`
- Local snapshot backup / restore polish
- Presentation consistency for advanced fields across all surfaces

## Notes

- Do not add more workflow branches before the three-task dispatch model is stable.
- Do not move the product back toward "fill more fields first."
- The current bottleneck is task scheduling and note/question linkage, not import richness.
- Current known gaps still pending:
  - mastered questions can still leak into recommendation logic in some edge cases
  - note recommendation currently tracks "opened from recommendation" but not deeper reading quality
  - note coverage vs. current mistake reason still lacks a real matching algorithm
