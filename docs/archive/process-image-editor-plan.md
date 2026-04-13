# Process Image Editor Plan

Status: pending

## MVP Shortcut

Before the full editor route, there is a faster MVP path.

MVP interaction:

1. the user clicks `过程图`
2. an isolated HTML opens as a lightweight process-image panel
3. the panel supports paste from clipboard
4. the panel supports local upload
5. the user saves one image to the current question
6. the main page renders that saved image under the question for preview

This MVP does not depend on:

1. DOM auto-capture
2. drawing tools
3. annotation JSON restore

It is mainly a question-linked image attach flow.

## Recommended Delivery Order

Phase 0:

1. independent HTML for process-image upload
2. paste support
3. upload support
4. save latest image to the question
5. render preview under the question

Phase 1:

1. add auto-targeted question capture
2. add drawing tools
3. add annotation JSON persistence
4. support reopen-and-continue editing

## Goal

Add a process-image workflow for question solving without coupling it to one specific page only.

The target interaction is:

1. the user clicks `过程图` on a question
2. the system auto-targets the current rendered question area
3. an isolated editor opens over the current workspace
4. the user draws on top of the captured question image
5. `保存` persists the current process image for that question
6. `清空` removes only the annotation layer, not the base question image

## Product Position

This feature is not a generic note-image tool.

It is a question-solving aid for:

1. quantity
2. data analysis
3. figure reasoning
4. later Shenlun material work if needed

The first scope is only `过程图`.

It does not include:

1. separate original-question image management
2. analysis image management
3. multi-version history
4. team annotation or shared review

The Phase 0 MVP is even narrower:

1. one attached process image only
2. no drawing
3. no versioning
4. no multi-image gallery

## Core Decision

Store one shared process image per question, not one per page entry.

That means:

1. the same question in wrong-question view uses the same process image
2. the same question in daily review uses the same process image
3. the same question in full practice uses the same process image

The feature is attached to the question identity, not to the current tab.

## Entry Design

Planned entry points:

1. wrong-question cards
2. inline practice inside a card
3. quiz modal for daily review / full practice

All entry points should call one unified opener such as:

`openProcessImageEditor(errorId, source)`

`source` only helps locate the current DOM snapshot source.
It should not create a separate saved process image.

For the MVP shortcut, `source` is still useful for opening from different contexts,
but the saved result remains question-scoped.

## DOM Targeting Rule

The user should not manually screenshot the question.

The system should auto-target the current rendered question block.

This section applies to the full editor route.

For the MVP shortcut, DOM targeting is not required because the user supplies the process image by paste or upload.

Recommended rule:

1. if the source is a normal question card, locate `#card-${errorId}`
2. if the source is the quiz modal, locate `#quizContent`
3. clone only the question-facing content area before capture
4. exclude action buttons, status controls, and unrelated UI chrome

The capture target should focus on:

1. question stem
2. question image if present
3. options / visible question body

Not:

1. card action buttons
2. status badges
3. delete / edit controls
4. surrounding navigation

## Editor Boundary

The editor should be isolated from the main HTML instead of being mixed directly into `xingce_v3.html`.

Recommended file split:

1. `xingce_v3/process_image_editor.html`
2. `xingce_v3/modules/process-image-editor.js`
3. `xingce_v3/modules/process-image-editor.css`

Recommended host pattern:

1. main page opens a modal
2. modal hosts the editor in an isolated container
3. iframe embedding is preferred if CSS / shortcut isolation becomes important

Main page responsibility:

1. resolve current question DOM
2. generate the base image
3. open the editor
4. receive save result
5. persist question-linked process-image data

Editor responsibility:

1. brush / eraser interaction
2. undo
3. clear annotations
4. export image
5. export and restore annotation JSON

## Technical Route

Current preferred route:

1. `html2canvas` for question-area capture
2. `Fabric.js` for drawing and serialization

Reasoning:

1. current project still has a large fixed HTML surface
2. the feature needs auto-targeted capture rather than user-defined crop first
3. the feature needs mature free-draw, clear, save, and restore behavior

This route is still pending implementation confirmation, but it is the current best-fit option.

For the MVP shortcut, the technical route is simpler:

1. independent HTML for process-image intake
2. clipboard paste handling
3. local file upload handling
4. reuse existing backend image upload API
5. render the saved image under the question

## Persistence Model

First version should stay minimal.

Per question, store only the latest process-image payload:

1. rendered process image
2. annotation JSON
3. updated timestamp

Suggested shape inside the question record:

```json
{
  "processImage": {
    "imageUrl": "/api/images/<hash>",
    "annotationJson": {},
    "updatedAt": "2026-03-29T00:00:00.000Z"
  }
}
```

For the MVP shortcut, `annotationJson` can stay absent or `null`.

Why this shape:

1. current project already has backend image storage
2. current backup flow already serializes the `errors` payload
3. the first release should avoid a heavy new asset graph

Not planned in the first version:

1. version history
2. multiple process images per question
3. per-entry duplicated copies

## Save Strategy

Do not store only JSON.

Recommended save payload:

1. PNG for direct display
2. annotation JSON for future re-edit

Reason:

1. PNG is stable for display
2. JSON enables reopening and continuing edits
3. JSON alone is fragile if the base layout changes

For the MVP shortcut, save only the image first.

That means:

1. image persistence is enough for Phase 0
2. JSON becomes relevant only after drawing/edit support exists

## Clear Strategy

`清空` should remove only the annotation layer.

It should not:

1. delete the base captured question image immediately
2. close the editor
3. remove the saved process image unless the user explicitly saves the cleared state

## Feasibility Assessment

### High-confidence parts

1. unified question-keyed storage
2. entry placement on wrong-question cards and quiz modal
3. reuse of existing backend image upload API
4. separate editor page/module boundary
5. save as PNG plus annotation JSON

Additional high-confidence MVP parts:

1. clipboard image paste
2. local image upload
3. image preview under the question

### Medium-risk parts

1. DOM capture fidelity
2. restoring annotation JSON across different layouts for the same question

These medium-risk items mostly belong to the full editor route, not the MVP shortcut.

Why medium risk:

1. DOM capture is not a native OS screenshot
2. different views may render the same question with different spacing

Mitigation:

1. capture only a normalized question-content clone
2. keep PNG as the primary display artifact
3. use JSON for re-edit when the layout is close enough
4. fall back to displaying the saved PNG if restore alignment is poor

## Current Recommendation

Proceed only as a scoped first version:

1. Phase 0 MVP first: one shared process image per question
2. one editor entry on cards
3. one editor entry in quiz modal
4. isolated editor HTML/module
5. latest-only image persistence for the MVP
6. add PNG plus JSON only when drawing/editing is introduced

This is intentionally narrower than a full image-asset system.

## Open Questions

Still pending final decision:

1. should the editor be hosted via iframe or via an isolated modal shell without iframe
2. should process-image JSON live directly inside `errors` or in a separate key/value map
3. should the first version allow undo stack persistence or only canvas-state persistence
4. should opening the editor always regenerate the base snapshot or prefer the previously saved PNG first
