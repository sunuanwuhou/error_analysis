# UI Optimization Checklist

Updated: 2026-04-06

## Goal

Reduce visual noise, remove stale surfaces, and make the core learning flow feel closer to a focused exam product rather than a toolbox shell.

## Product Experience Rule

One question should be treated as one surface.

- text question: stem + options stay inside the same framed area
- image question: image as question content + options still stay inside the same framed area
- canvas should attach to that whole question surface
- analysis belongs below that surface as the next layer, not mixed into the answering area
- the same rule should extend to expanded error cards in the workspace list

## Encoding Safety Rule

Chinese-heavy partials must be edited incrementally.

- Do not rewrite full `v51_frontend/partials/*.html` files from terminal-copied content.
- Prefer small in-place patches for text-heavy partials.
- After partial edits, rebuild bundles and verify visible text in the browser before continuing.
- If shell output or screenshots show mojibake, stop the whole-file rewrite path and restore from a known-good version first.

## Optimization Checklist

### 1. Quiz Mode and Canvas Cleanup

Priority: Highest

Problems:
- The quiz page mixes question content, canvas tools, metrics, and review actions on the same visual plane.
- The canvas feels like a floating tool layer instead of a bounded workspace.
- The right-side tool rail is too loud and distracts from the actual question.
- The analysis section does not feel like a clearly separated region.

Target:
- Make quiz mode feel closer to a focused exam flow.
- Keep the question body as the main visual center.
- Turn canvas into an optional secondary workspace, not a permanent intrusion.

Actions:
- Rebuild quiz layout into clear zones:
  - question header
  - question body
  - answer area
  - bottom action bar
  - foldable analysis panel
- Hide canvas tools by default.
- Replace the current floating tool rail with a smaller entry point.
- Give the canvas a framed container when opened.
- Reduce the weight of performance stats during active answering.

### 2. Navigation and Entry Cleanup

Priority: High

Problems:
- Too many first-level entry points compete for attention.
- Some flows still feel like historical leftovers rather than core product routes.

Actions:
- Keep first-level navigation to:
  - 学习首页
  - 错题工作台
  - 知识点
  - 更多
- Move secondary tools into 更多.
- Remove or hide stale one-off entry buttons from the primary flow.

### 3. Modal and Legacy Surface Cleanup

Priority: High

Problems:
- Too many modal surfaces exist at the same product level.
- Some are utility-only or legacy-only and should not remain prominent.

Cleanup candidates:
- AI tools modal
- type rules modal
- directory modal
- Claude bank modal
- any legacy helper surfaces not used in the main workflow

Actions:
- Demote utility tools into secondary menus.
- Keep only frequently used, task-critical modals in the main flow.

### 4. Layout Language Unification

Priority: Medium

Problems:
- Home, workspace, quiz, and knowledge pages feel like different products.
- Multiple style layers still overlap.

Actions:
- Define separate but consistent layout languages for:
  - home dashboard
  - workspace list/detail
  - quiz mode
  - knowledge reading
- Reduce overlapping override styles and consolidate into one main shell direction.

### 5. Performance-Sensitive Visual Cleanup

Priority: Medium

Problems:
- Heavy surfaces make slow pages feel worse than they are.
- Some non-critical UI loads too early.

Actions:
- Keep active view only.
- Defer non-essential panels and modal content.
- Avoid rendering large helper surfaces before user intent.

## Item 1 Design Plan

### Design Direction

Quiz mode should feel like a focused test sheet with a controlled scratch space.

Core principles:
- Question first
- Answer second
- Tools third
- Analysis after submission

The visual hierarchy should be:
- question stem
- options
- answer action
- only then canvas / stats / review helpers

### Proposed Layout

#### A. Header Strip

Top row should contain only:
- question index
- session label
- progress
- close button

Secondary metrics should not dominate the top zone.

#### B. Question Panel

Main central card:
- large readable stem
- attached image below stem if present
- options below content

This panel should occupy the strongest visual area and be framed as one single block.
Question stem and options should stay inside the same outer frame.
Do not split them into separate floating cards.
Canvas should cover that same framed question surface.

#### C. Action Bar

Bottom of question panel:
- 下一题 / 查看结果
- 跳过
- 画布

Order:
- primary action on the right
- secondary actions on the left

#### D. Canvas Drawer

Canvas should not float permanently on the right side.

Instead:
- clicking 画布 opens a bounded side drawer or bottom drawer
- drawer contains:
  - undo
  - clear
  - exit canvas
- canvas area is visually separated from the question

Desktop:
- right-side drawer

Mobile:
- bottom sheet

#### E. Analysis Panel

After answering:
- show a full-width framed analysis panel
- not just a loose row under the page

Sections:
- correct answer
- your answer
- duration
- analysis
- next reminder

## Item 1 Interaction Plan

### Entering Quiz

User enters from:
- 直接开做
- 限时复训
- 日常练习

Behavior:
- open directly into question view
- do not auto-open canvas
- do not auto-expand analysis

### During Answering

Default state:
- only question and options are emphasized
- the answer options should visually belong to the same main question sheet

If the user clicks 画布:
- open the canvas drawer
- dim the background slightly
- keep the question still visible

If the user closes 画布:
- return to the exact question state

### Answer Submission

After selecting an answer:
- lock options
- highlight correct / wrong
- replace the main CTA with 下一题 or 查看结果
- keep analysis collapsed by default for fast practice

### Timed Retraining

Before answering:
- show one compact timing chip:
  - 目标 60s
- if recent duration exists, show:
  - 上次 122s

After answering:
- show actual duration in the result summary
- use color meaning:
  - on-time: green
  - slightly slow: amber
  - very slow: red

### Direct Do

Before answering:
- show only one short reminder chip or banner

After wrong answer:
- analysis panel should include a stronger next-step hint
- future rule can route the item back to note-first

### Note-First Entry

For note-first tasks:
- note recommendation is handled before quiz entry
- once the quiz opens, it should look identical to direct-do mode
- avoid adding a second heavy note panel inside the same question page

## Implementation Boundaries

Item 1 should not yet include:
- note coverage algorithm
- recommendation reliability scoring
- full automatic workflow routing after each answer

Item 1 should include only:
- quiz visual restructuring
- canvas containment
- clearer analysis framing
- cleaner answer-state interaction
