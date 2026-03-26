# Shenlun Workbench Plan

## Goal

Add a Shenlun module to `xingce_v3_lab` without turning the current project into a generic exam platform first.

The first target is a usable Shenlun workflow:

1. store papers and questions
2. write answers
3. compare answers with AI
4. connect answers with personal notes and source knowledge

## Source Materials

Current in-project source locations:

- [quantity source](E:\IdeaProject\git\xingce_v3_lab\knowledge_sources\shenlun\quantity)
- [ashore source](E:\IdeaProject\git\xingce_v3_lab\knowledge_sources\shenlun\ashore)

Interpretation:

1. `quantity` is closer to practical paper and note material
2. `ashore` is closer to method and framework material

## Phase 1: Data Model

Add Shenlun-specific entities instead of forcing everything into the current error model.

Suggested tables:

1. `shenlun_papers`
   - id
   - user_id
   - title
   - year
   - region
   - source
   - material_text
   - created_at
2. `shenlun_questions`
   - id
   - paper_id
   - question_no
   - question_type
   - prompt
   - requirements
   - word_limit
3. `shenlun_answers`
   - id
   - question_id
   - user_id
   - answer_text
   - version
   - created_at
4. `shenlun_reviews`
   - id
   - answer_id
   - ai_model
   - score_dimensions_json
   - missing_points_json
   - redundant_points_json
   - expression_issues_json
   - rewrite_suggestion
   - next_focus
5. `shenlun_notes`
   - id
   - user_id
   - paper_id
   - question_id
   - knowledge_tag
   - content_md

## Phase 2: Import Layer

Build import tooling for Markdown-based Shenlun material.

First import targets:

1. topic summaries
2. question-type notes
3. paper/question markdown sections
4. user-downloaded Shenlun paper notes

Import output should be structured, not just copied blobs.

## Phase 3: AI Comparison

AI comparison should not be generic free chat first.

It should produce structured review:

1. `score_dimensions`
   - topic comprehension
   - point extraction
   - grouping
   - expression
   - structure
   - word-limit control
2. `missing_points`
3. `redundant_points`
4. `expression_issues`
5. `rewrite_suggestion`
6. `next_focus`

Comparison contexts:

1. user answer vs reference answer
2. user answer vs method rules
3. current answer vs the user's previous answers

## Phase 4: Knowledge Retrieval

After workflow exists, add retrieval over source materials.

Recommended order:

1. markdown chunking
2. source tags
3. keyword and tag search
4. later embedding search if needed

## Important Product Rule

Do not start with a generic “AI knowledge base” product shell.

Start with Shenlun workflow first, then let retrieval support that workflow.

That keeps the system useful:

1. papers and answers have structure
2. AI comparison has grounded context
3. notes have clear attachment points
4. retrieval serves a real task instead of being a standalone demo
