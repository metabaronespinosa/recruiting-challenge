---
name: Update Decision Log
description: After every session that changes code, append new entries to decision_log.md for each issue addressed.
alwaysApply: false
---

After every session that produces code changes, update `decision_log.md` under **Issues addressed**.

## Rules

- Read `decision_log.md` first to understand existing entries and avoid duplicates.
- Add one bullet per issue fixed, following this exact structure:

```
- **<ID> — <short title>**
  - What was wrong or weak: <one sentence>
  - Shape of my improvement: <one sentence>
  - Alternatives I considered and rejected: <one sentence>
```

- Also update the four closing sections if relevant:
  - **Things I noticed but did NOT fix** — add anything spotted but left out of scope.
  - **Docs / code I left alone deliberately** — note intentional non-changes.
  - **What I'd do with another 6 hours** — update if priorities shifted.
  - **Feature chosen** — only if a new feature was introduced.

## Constraints

- Be brief and concrete — one sentence per field, no bullet sub-lists, no code blocks.
- Specifics over generalities: name the file, method, or SQL clause, not just the concept.
- Do not rewrite or reformat existing entries.
- Do not add commentary outside the structured fields.
