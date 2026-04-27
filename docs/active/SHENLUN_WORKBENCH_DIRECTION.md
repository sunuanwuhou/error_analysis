# SHENLUN_WORKBENCH_DIRECTION

## Why this document exists

This file fixes the currently agreed Shenlun module direction into the repository.
It exists so later implementation can follow the same product logic instead of re-deciding the module from scratch.

## Current status

The Shenlun module direction is discussed and partially prototyped, but not yet fully productized.
At this stage, the most important task is not import tooling.
The first task is to clarify the product shape and the core review workflow.

## High-level positioning

The Shenlun module should not be treated as only a generic note library.
It should not be treated as only a question bank either.

The safest current positioning is:

1. a lightweight Shenlun learning workspace
2. centered on material extraction practice
3. centered on answer comparison and review
4. with note storage as a supporting accumulation layer

Compressed product statement:

1. material extraction is the main line
2. notes are the accumulation layer
3. the real value is review, not storage alone

## Two major parts

The module is currently split into two explicit parts:

1. Shenlun note storage
2. Shenlun material extraction comparison

These two parts should stay connected instead of becoming isolated sub-products.

## Part A: Shenlun note storage

### Purpose

This part stores long-lived method knowledge instead of only storing one-off question text.

It should support accumulation of:

1. question-type methods
2. material-processing methods
3. common loss patterns
4. topic notes
5. expression snippets
6. personal summaries after question review

### Suggested interaction shape

```text
Shenlun note storage
|- left: note category tree
|  |- question types
|  |- material handling
|  |- common mistakes
|  |- topics
|  `- expressions
|- center: note list
|  |- title
|  |- linked type
|  |- source
|  `- updated time
`- right: note detail
   |- core method
   |- examples
   |- common traps
   |- my supplement
   `- linked questions
```

### Product role

This part answers:

1. how this type of question should be handled
2. what repeated mistakes the user keeps making
3. what expression or method can be reused later

## Part B: Shenlun material extraction comparison

### Purpose

This is the main working area for Shenlun extraction practice.
It should include:

1. raw question and material intake
2. segment formatting
3. my extraction writing
4. final summary writing
5. standard-answer comparison
6. review
7. later note extraction

### Suggested interaction shape

```text
Shenlun material extraction comparison
|- top: raw input area
|  |- question text
|  `- source material text
|- action: one-click format
|- center: formatted practice template
|  |- question type
|  |- prompt
|  |- material 1
|  |- my extraction 1
|  |- material 2
|  |- my extraction 2
|  |- ...
|  `- final summary
`- review area
   |- my extraction vs reference extraction
   `- my final summary vs reference final summary
```

### Product role

This part is the real practice scene and should be the default Shenlun entry point.

## Current preferred workflow

The current preferred workflow is intentionally simple:

1. the user pastes raw question text and raw material text
2. the system saves a raw practice record immediately after input begins
3. the system performs one-click formatting
4. the system auto-splits the material into visible segments
5. the system produces a structured text template
6. the user fills each `my extraction` block
7. the user fills one `final summary` block
8. the system converts that filled template into JSON for CC
9. CC returns structured JSON
10. the system stores and renders the comparison result

Compressed chain:

1. paste raw content
2. auto-save raw record
3. one-click format
4. fill segment extractions
5. fill final summary
6. generate CC JSON
7. receive CC JSON
8. review and store

## Result-display requirement after CC returns

After CC returns structured JSON, the system must not stop at storage only.
It should provide a dedicated result display page for review.

This page exists because:

1. returned JSON by itself is not a usable study surface
2. the user needs to see CC's evaluation as a readable review page
3. the real value is comparison visibility, not hidden payload storage

## Suggested result page structure

The result page should be a first-class page in the Shenlun module.

Recommended shape:

```text
Shenlun result page
|- top: question and status
|  |- question type
|  |- prompt
|  |- source status
|  `- CC status
|- overall review
|  |- my final summary
|  |- reference final summary
|  |- overall comment
|  `- high-frequency issue tags
`- segment comparison list
   |- segment 1
   |  |- source material
   |  |- my extraction
   |  |- reference extraction
   |  |- matched points
   |  |- missed points
   |  |- wrong points
   |  |- issue tags
   |  `- comment
   |- segment 2
   `- ...
```

## Minimum information the result page must show

### A. Header block

1. question type
2. prompt
3. created time
4. updated time
5. raw-record status
6. CC return status

### B. Overall comparison block

1. my final summary
2. reference final summary
3. overall comment
4. overall issue tags if available

### C. Segment comparison block

For each segment:

1. source material text
2. my extraction
3. reference extraction
4. matched points
5. missed points
6. wrong points
7. issue tags
8. CC comment

## Product meaning of the result page

This page should answer:

1. what CC thinks the correct extraction is
2. which segment I handled correctly
3. which segment I missed or misclassified
4. whether my final integration is weaker than my segment extraction

The result page is therefore not optional decoration.
It is a core study surface.

## Relationship to the broader flow

The result page is the downstream half of the Shenlun learning loop:

```text
raw input
-> formatted template
-> my extraction
-> final summary
-> generate CC JSON
-> receive CC JSON
-> result page review
-> later note accumulation
```

Without this page, the loop remains incomplete.

## Future actions from result page

The first version can stay focused on reading and reviewing.
Later it may add actions such as:

1. convert useful comments into markdown notes
2. reopen the same source record for another attempt
3. compare different attempts under the same source record

These are later enhancements, not first blockers.

## Persistence rule: save from the first input

The system should not wait until `generate JSON` to create the first Shenlun record.

The rule should be:

1. once the user starts entering question or material content, the system should create or update a raw record
2. later formatting, extraction writing, summary writing, and CC comparison should all attach to that same record
3. `generate JSON` is a state transition, not the first save point

This exists to prevent:

1. losing early input
2. duplicate records caused by repeated formatting
3. fragmentation between raw material, extraction draft, and CC result

## Deduplication rule: full question-plus-material key

At the current stage, the safest deduplication anchor is the full original input content.

The recommended uniqueness basis is:

1. question prompt full text
2. source material full text

In implementation terms, the system should treat the normalized combination of:

1. full question text
2. full material text

as the unique key for one Shenlun practice source record.

Recommended behavior:

1. if the same question text plus material text is entered again, reuse the existing record instead of creating a new one
2. if the content is changed, update the existing draft when it is clearly the same record being edited
3. if the user intentionally wants a second practice attempt on the same source material, that should be represented as a later attempt or version under the same source record, not as a duplicate raw source row

## Core design decision: segment-level comparison is first-class

This is the most important confirmed requirement from current Shenlun discussion.

The review flow should not stop at:

1. my full answer
2. standard full answer

That level is too coarse.
It often hides where the user actually failed.

The system should support a deeper chain:

1. material segment
2. my extraction from that segment
3. standard extraction from that segment
4. issue tag
5. note or review comment

The reason is simple:

1. Shenlun score loss often starts at material extraction
2. the user needs to know which segment was misunderstood, omitted, over-concretized, or misgrouped
3. whole-answer comparison alone is not enough to expose that

## User-facing input protocol

The user should not be required to write JSON directly.
JSON is an internal protocol between the system and CC.

The user-facing flow should prefer structured text.

### Step 1: raw input

The user may first provide only:

1. question text
2. source material text

The system should then help produce a filled template instead of asking the user to manually split everything from scratch.

### Step 2: formatted template

After one-click formatting, the editable template should look like:

```text
题型：概括题
题目：根据材料概括北溪县农村公路养护中存在的问题，并提出对策。

【材料1】
这里是自动拆出来的第一段材料。

【我的提取1】

【材料2】
这里是自动拆出来的第二段材料。

【我的提取2】

【最后总结】
```

This keeps the user-facing side simple:

1. the system is responsible for first-pass segmentation
2. the user is responsible for extraction writing
3. the user is responsible for the final integrated summary

### Why the final summary is required

Segment extraction alone is not enough.
Even if each segment is roughly correct, the final integrated summary may still be weak.

So the system should evaluate both:

1. segment extraction ability
2. final integration ability

## Internal protocol boundary

The protocol boundary should be explicit:

1. user to system: formatted text
2. system to CC: JSON
3. CC to system: JSON
4. system to user after CC: result display page

The user should not need to understand the JSON shape in order to practice.

## Segment-level review structure

For each material segment, the target review block should include:

1. original material segment
2. my extraction
3. reference extraction
4. issue tags
5. review note

Suggested issue tags:

1. missed point
2. over-concrete summary
3. over-empty summary
4. wrong grouping
5. copied material without transformation
6. misunderstood segment meaning

This review model is more important than import at the current stage.

## Full review chain

The intended learning chain is:

1. paste raw question and material
2. let the system one-click format the material into segments
3. write my extraction for each segment
4. write my final summary
5. generate JSON for CC
6. compare with returned standard result
7. review segment by segment
8. review final summary integration
9. identify stable mistake patterns
10. extract reusable methods into note storage

Compressed chain:

1. format
2. extract
3. compare
4. review
5. accumulate

## Relationship between the two parts

The two parts should form a loop:

```text
question practice
-> answer comparison
-> segment review
-> method summary
-> note accumulation
-> later reuse in the next question
```

This means:

1. the extraction comparison area is the front-stage work area
2. the note storage is the long-term accumulation area

The module should not treat notes as detached static content.

## Current product recommendation

If the module needs one explicit current positioning, use this:

The Shenlun module is a workbench for:

1. formatting raw Shenlun material into segment practice blocks
2. comparing my extraction with reference extraction
3. comparing my final summary with reference final summary
4. accumulating reusable methods and mistake patterns

This is intentionally not framed as:

1. only a generic AI knowledge base
2. only a spreadsheet replacement
3. only a note system
4. only a practice paper archive

## Current non-goal

The following should not define the module first:

1. full import automation
2. broad generic knowledge-base shell
3. pure note-taking without material comparison linkage
4. polished visual design before workflow clarity

Import is useful, but current discussion says it should come later than the core review workflow.

## MVP implication

If implementation must be narrowed into a first useful Shenlun MVP, the recommended order is:

1. make raw question/material input the main entry
2. save raw records immediately from first input
3. deduplicate by full question-plus-material key
4. add one-click formatting into segment template
5. make segment-level material review the core capability
6. add final-summary comparison
7. add a dedicated CC result display page
8. keep note storage available through the mature markdown path
9. delay import-heavy work until the workflow is proven

## Relation to existing repo state

The repo already contains a lightweight Shenlun prototype page and module logic.
That prototype should be treated as a base to evolve from, not proof that the product direction is already complete.

The important gap is:

1. current prototype is still lightweight
2. current discussion now fixes one-click formatting plus segment-level review as the first-class direction
3. later implementation should move the prototype toward this review-centered model

---

## Implementation Notes / MVP Contract

This section turns the agreed product direction into implementation constraints,
so frontend/backend/CC integration can execute with one contract.

### 1) State machine (mandatory)

Recommended practice states:

1. `raw_draft`: user started input, raw source record exists
2. `formatted`: one-click formatting finished and segment template generated
3. `extracted`: user has written segment extraction and/or final summary draft
4. `cc_pending`: JSON generated and sent to CC, waiting for return
5. `cc_done`: CC returned valid structured result
6. `reviewed`: user completed at least one review action (tag/comment/note extraction)

Allowed key transitions:

1. `raw_draft -> formatted`
2. `formatted -> extracted`
3. `extracted -> cc_pending`
4. `cc_pending -> cc_done`
5. `cc_done -> reviewed`
6. `formatted/extracted -> raw_draft` (when user edits raw content and regenerates)

### 2) Core data model (minimum)

#### A. `shenlun_source_record` (source-level anchor)

Minimum fields:

1. `id`
2. `question_text_raw`
3. `material_text_raw`
4. `source_key_normalized` (dedup key input)
5. `question_type` (optional in raw stage)
6. `status` (current source status)
7. `created_at`
8. `updated_at`

#### B. `shenlun_attempt` (practice version under same source)

Minimum fields:

1. `id`
2. `source_id`
3. `attempt_no`
4. `formatted_template_text`
5. `segment_count`
6. `my_final_summary`
7. `cc_request_json`
8. `cc_result_json`
9. `cc_status` (`none/pending/success/failed`)
10. `created_at`
11. `updated_at`

#### C. `shenlun_segment_review` (segment-level review unit)

Minimum fields:

1. `id`
2. `attempt_id`
3. `segment_index`
4. `source_segment_text`
5. `my_extraction`
6. `reference_extraction`
7. `matched_points`
8. `missed_points`
9. `wrong_points`
10. `issue_tags`
11. `cc_comment`

### 3) Dedup + new-attempt decision rule

1. dedup anchor: normalized full `question_text_raw + material_text_raw`
2. same source with active editing: update latest draft under same source record
3. same source but user clicks `new attempt`: create new `shenlun_attempt` row under existing source
4. if content changes beyond threshold, ask user:
   1. update current source draft
   2. create new source
5. never create duplicate source rows silently for identical normalized source key

### 4) CC protocol minimum contract

Request contract (`system -> CC`) should include:

1. `protocol_version`
2. `source_id`
3. `attempt_id`
4. `question_type`
5. `prompt`
6. segment list (`source_segment`, `my_extraction`)
7. `my_final_summary`

Response contract (`CC -> system`) should include:

1. `protocol_version`
2. `attempt_id`
3. overall review block (`reference_final_summary`, `overall_comment`, `overall_issue_tags`)
4. segment comparison list (`reference_extraction`, `matched`, `missed`, `wrong`, `tags`, `comment`)
5. `cc_trace_id` (for diagnostics)
6. `error` object when failed (`code`, `message`, `retryable`)

### 5) Failure handling and recovery

1. format failed: keep raw draft, allow retry after raw text edit
2. CC timeout: mark `cc_pending_timeout`, show retry CTA
3. CC hard failure: keep user attempt immutable, allow resend
4. partial CC payload: store raw payload, render fallback with missing-field hints
5. user leaves page mid-edit: restore from autosaved draft on re-open

### 6) MVP acceptance criteria (measurable)

1. raw autosave success rate >= 99%
2. duplicate source prevention for identical source key >= 99%
3. from first input to `formatted` median time <= 3s (excluding very long materials)
4. CC success return to render result page median <= 5s (network-dependent)
5. result page first paint contains header + overall block + segment list >= 95% of successful attempts

### 7) Event tracking (minimum)

Required events:

1. `shenlun_raw_input_started`
2. `shenlun_raw_autosave_succeeded`
3. `shenlun_format_clicked`
4. `shenlun_format_succeeded`
5. `shenlun_cc_submit_clicked`
6. `shenlun_cc_result_received`
7. `shenlun_result_viewed`
8. `shenlun_issue_tag_added`
9. `shenlun_note_extracted_from_result`

### 8) MVP test checklist (minimum)

1. long material (multi-segment) formatting
2. empty segment edge case
3. repeated identical input dedup
4. same source multi-attempt creation
5. user edits source text after formatting
6. CC timeout + retry
7. CC missing optional fields
8. CC failed with retryable error
9. result page refresh consistency
10. segment order consistency after reload
11. autosave restore after browser refresh
12. knowledge-tree markdown note open/save consistency

---

## Vue Page List (confirmed)

This is the confirmed first-batch Vue page map for Shenlun workbench.

### A. Required pages for MVP

1. `ShenlunWorkbenchPage`
   1. route: `/shenlun/workbench`
   2. purpose: default entry, raw input + format + extraction editing
   3. core modules:
      1. `RawInputPanel`
      2. `FormatActionBar`
      3. `SegmentTemplateEditor`
      4. `FinalSummaryEditor`
      5. `CCSubmitBar`
   4. main state:
      1. current `source_record`
      2. current `attempt`
      3. autosave status
      4. format status
      5. cc submit status

2. `ShenlunResultPage`
   1. route: `/shenlun/result/:attemptId`
   2. purpose: first-class review surface after CC return
   3. core modules:
      1. `ResultHeaderBlock`
      2. `MaterialAnswerCompareTable`
      3. `ReviewCommentBlock`
   4. main state:
      1. cc result payload
      2. row-level comparison items
      3. overall review comment

3. `ShenlunNoteLibraryPage`
   1. route: `/shenlun/notes`
   2. purpose: Shenlun knowledge tree with markdown content (same pattern as Xingce)
   3. core modules:
      1. `KnowledgeTree`
      2. `MarkdownEditorPane`
      3. `MarkdownPreviewPane`
      4. `NodeMetaBar`

### B. Optional but recommended support pages

1. `ShenlunPracticeListPage`
   1. route: `/shenlun/practices`
   2. purpose: query/filter all source records, quick continue

2. `ShenlunReviewDashboardPage`
   1. route: `/shenlun/review/dashboard`
   2. purpose: high-frequency issue tags and trend view

### C. Route-level flow

```text
/shenlun/workbench
  -> (submit CC)
  -> /shenlun/result/:attemptId
  -> (manual navigation)
  -> /shenlun/notes
```

### D. Suggested frontend store split (Pinia)

1. `useShenlunSourceStore`
   1. source CRUD
   2. source dedup check
2. `useShenlunAttemptStore`
   1. attempt draft/autosave
   2. format output state
   3. cc submit/receive state
3. `useShenlunResultStore`
   1. result page payload
   2. current segment index state
   3. review comment state
4. `useShenlunNoteStore`
   1. tree node CRUD
   2. markdown content load/save
   3. node ordering and move

### E. Result page interaction layout (confirmed)

The result page should use segment switching instead of full-width table expansion.
Keep comparison stable while only one material segment is active at a time.

```text
[Segment Navigator]
segment 1 / segment 2 / segment 3 / ...

[Material Pane (active segment)]
full segment text ...

[Compare Pane]
my answer ...
standard answer ...

[Review Pane]
segment comment ...
overall comment (separate tab)
```

Recommended interaction:

1. left `SegmentNavigator` for quick segment switching
2. center `MaterialPane` shows full text of active segment
3. right `ComparePane` keeps `my_answer` and `standard_answer` fixed and readable
4. bottom `ReviewPane` shows current segment点评
5. overall点评 is kept in a separate `Overall` tab

Optional enhancements (phase 2):

1. keyboard navigation for segment switch (`J/K` or arrow keys)
2. keyword-based highlight sync between material and compare panes

### F. Confirmed scope decisions

1. source history page is deferred (not in MVP)
2. no extract-to-note action on result page
3. notes module is knowledge-tree + markdown content, aligned with Xingce note pattern
