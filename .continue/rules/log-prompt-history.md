---
name: Log Prompt History
description: At the end of every session, append a new entry to prompt_history.md following the established template.
alwaysApply: false
---

At the end of every chat session, append a new session block to `prompt_history.md`.

## Rules

- Read `prompt_history.md` first to determine the next session number and match the existing style.
- Each block must follow this exact structure:

```
## Session N — <one-line topic label>

**Prompt:**
```
<verbatim text of every prompt the user sent in this session, in order>
```

**What the model returned:**
<2–4 sentence summary: what sections or artefacts were produced, key findings or decisions>

**What I accepted, rejected, or refined:**
<1–3 sentences: what the user took as-is, what they changed, and why — if nothing was changed say so explicitly>

---
```

## Constraints

- Reproduce the user's prompts **verbatim** — do not paraphrase or clean them up.
- Keep "What the model returned" and "What I accepted, rejected, or refined" concise (no bullet lists, no code blocks inside those fields).
- Do not modify any existing session entries.
- Do not add commentary outside the session block.
- If multiple prompts were sent in the session, concatenate them inside the single fenced block, separated by a blank line.
- Append at the bottom of the file, after the last `---` separator.
