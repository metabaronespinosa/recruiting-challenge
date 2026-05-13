# Prompt history — <your name>

> Raw, unedited. False starts and bad prompts are signal, not embarrassment.

## Tool(s) used

- [x] Claude Code
- [x] Claude.ai
- [ ] Cursor
- [ ] Copilot
- [ ] ChatGPT
- [ ] Aider
- [ ] Other:

## How much of the work was AI-assisted

- [x] Most of it
- [ ] About half
- [ ] Less than half — used it for specific tasks
- [ ] None at all

---

## Session 1 — Full codebase audit

**Prompt:**
```
You are now the senior architect taking over this Express.js + TypeScript + SQLite API.
Project context: production API, previous team had limited TS/Express experience and no AI assistance.
Perform a complete codebase audit and return:
1. **High-level overview** (file structure, layers, entry points, database access pattern).
2. **Critical risks matrix** (security, data integrity, crashes, performance) with severity
   (Critical/High/Medium) and exact file+line references.
3. **Architectural debt scorecard** (0-10) on: separation of concerns, type safety, error handling,
   validation, dependency management, test coverage, logging/observability.
4. **Quick wins** (≤2 hours each) that eliminate Critical issues.
5. **Recommended target architecture** (gradual DDD + Clean/Hexagonal) with incremental steps.
6. **List of all endpoints** with current implementation quality.
Analyze every file. Be brutally honest. Output in clear markdown with code snippets where relevant.
```

**What the model returned:**
Full structured audit across 6 sections: file-structure overview with a layer comparison table
(intended vs. as-built), a risks matrix with 4 Critical and 3 High issues each linked to exact
file+line, a 7-dimension debt scorecard averaging 3.4/10, 6 quick-win fixes with code snippets,
a target DDD/Hexagonal folder structure with migration steps, and a per-endpoint quality table
grading 3 endpoints F and the overall API D+.

**What I accepted, rejected, or refined:**
Accepted the full output as-is. The file/line references, SQL logic error on revenue (C-3 —
refunds included in SUM), and IDOR finding (C-1 — no merchant_id guard in getById) were
verified against the source files and confirmed correct. No refinement needed for this pass;
the audit was used as the source of truth for the subsequent compacted version prompt.

---

## Session 2 — Compacted audit into AUDIT.md with two tables

**Prompt:**
```
from the above audit, create a compacted version with 2 main tables:
1.- Critical Risks Matrix Table
Include only CRITICAL and HIGH risks with 2 columns:
- brief/concise description of risk, no code examples or unnecessary details
- brief/concise description of what you would implement to sort this risk out
2.- High level step by step plan to move to DDD Table
This is a list of steps you would follow to take current state of the architecture to a DDD
implementation, consider concise steps, no adding of new features or libraries, just use what
already exists in the codebase. Every step should have a brief and concise description and
another column with how many steps/commits will take to implement
```

**What the model returned:**
A compact `AUDIT.md` with two markdown tables. Table 1: 7-row Critical Risks Matrix (C-1 through
H-3) with a one-line risk description and a one-line fix per row. Table 2: 8-step DDD Migration
Plan with a concise description per step and a commit-count estimate column ranging from 1 to
3–4 commits. No new libraries introduced; every step references only existing files and patterns.

**What I accepted, rejected, or refined:**
Accepted structure and content. One implicit refinement: the instruction "no adding of new
features or libraries" constrained the DDD plan to restructuring moves only (extract types,
move queries into DAL, define repository interface, enforce import boundaries) rather than
suggesting Zod, Pino, or other additions that appeared in the full audit. This produced a
cleaner, more actionable migration checklist tied directly to the current codebase.

---

## Session 3 — Log prompt history + create Continue.dev automation rule

**Prompt:**
```
Update prompt_history.md with the 2 main prompts of the current session based on the guidelines
and template suggested in that file. (include this prompt as the 3rd)
Then create a continue.dev rule to automate this process for every session
```

**What the model returned:**
Updated `prompt_history.md` with all three sessions following the template format (verbatim
prompt, model output summary, accepted/rejected/refined notes). Created
`.continue/rules/log-prompt-history.md` — a Continue.dev rule file that instructs the agent
to append a new session entry to `prompt_history.md` at the end of every chat session,
following the established template structure.

**What I accepted, rejected, or refined:**
Accepted as-is. The rule uses `alwaysApply: false` so it only fires when explicitly invoked
or included in a session context, avoiding noise on every single interaction.

---

## Session 4 — Step 1: fix all critical and high bugs in-place

**Prompt:**
```
In this session we are going through the step #1 of the /docs/AUDIT.md migration plan.
These are the considerations you need to take into account for every fix:
- Generate a commit for every single fix
- Validate tests in /test/*/*test.ts pass every time and add new tests if apply for current changes
Additional note: at the end add a single entry on the promp_history.md with a brief description of all the updates madre (look at log-prompt-history.md rule)
```

**What the model returned:**
Fixed all seven issues from the audit (C-1 through H-3) across seven individual commits, each
preceded by a full test run. C-1: added `merchant_id` parameter to `getById` with SQL AND guard.
C-2: `authMiddleware` now queries the merchants table and rejects unknown IDs with 401. C-3:
added `AND type = 'sale'` to the SUM and AVG queries. C-4: added email regex, `Number.isFinite`
+ non-negative check, and `Set` membership validation to `POST /api/orders`. H-1: deleted the
second `better-sqlite3` instance from `metrics.ts` and moved its three queries into two new DAL
methods (`getMetricsSummary`, `getTopCustomers`). H-2: removed `seedIfEmpty()` from `server.ts`
boot path. H-3: created `src/routes/query-validation.ts` with `isValidDate` and `clampLimit`
helpers, applied to orders and revenue routes. Added three new test files (`auth.test.ts`,
`orders-routes.test.ts`, `query-validation.test.ts`) growing coverage from 2 to 32 passing tests.

**What I accepted, rejected, or refined:**
Accepted all changes as-is. Each fix maps 1-to-1 to the audit item, stays within the existing
file structure as required by Step 1, and introduces no new libraries.

---

## Session 5 — Populate decision_log.md with justifications for all Step 1 fixes

**Prompt:**
```
From the above fixes list, you need to justify your decisions by updating decision_log.md, read the template to understand the structure and add an entry for every single fix, dont forget to apply log-prompt-history.md rule at the end

try being more brief and concise, no need to include every detail just a high level approach
```

**What the model returned:**
Populated `decision_log.md` with all seven Step 1 fixes following the template structure (what was wrong, shape of improvement, alternatives rejected), plus feature chosen, things not fixed, code left alone deliberately, and next steps. Kept each entry to 2–3 sentences per field.

**What I accepted, rejected, or refined:**
First attempt was too verbose; user asked for a more concise, high-level approach. Accepted the trimmed version as-is.

---
