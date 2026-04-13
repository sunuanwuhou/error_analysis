# Mapping

## Workbook assumptions

The workbook mixes three kinds of rows:

1. real wrong questions
2. summary / outline / rule notes
3. blank separators or partially filled draft rows

The converter does not treat every row as a question.

## High-confidence question row

A row is imported into `errors` when it has:

- a non-empty question-like field
- a non-empty answer-like field
- enough category context to infer `type` and `subtype`

## Note row

A row is imported into `notesByType` when it matches at least one:

- title or question contains `大纲` / `概括总结`
- no clear answer, but has summary text
- clearly reads like method / rule / trap notes instead of a single question

## Review candidate row

A row is exported to `review_candidates.json` when:

- question and summary are both ambiguous
- answer is missing but content looks like a possible question
- multiple fields collide and the row cannot be placed safely

## Import principle

Wrong placement is worse than uncategorized placement.

So the converter prefers:

- conservative auto-import
- explicit review bucket
- stable JSON for repeated reruns
