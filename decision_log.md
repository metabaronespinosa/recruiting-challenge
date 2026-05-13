# Decision Log

> One page max. Specifics over generalities. See `SUBMISSION.md` for the prompt.

## Issues addressed

- **C-1 — IDOR on `GET /api/orders/:id`**
  - What was wrong or weak: `getById` queried by `id` only — any authenticated merchant could fetch any other merchant's order.
  - Shape of my improvement: Added `merchantId` as a required second parameter; SQL gained `AND merchant_id = ?`. TypeScript enforces the fix at every callsite.
  - Alternatives I considered and rejected: Route-level ownership check after the fetch — rejected because the DAL would still leak data if called from anywhere else.

- **C-2 — Zero authentication**
  - What was wrong or weak: `authMiddleware` only checked header presence; any arbitrary string was trusted as a valid identity.
  - Shape of my improvement: Added a `SELECT id FROM merchants WHERE id = ?` lookup; unknown IDs get 401 before the request proceeds.
  - Alternatives I considered and rejected: JWT validation — correct long-term but out of scope; a DB lookup is the minimal honest fix within the existing pattern.

- **C-3 — Revenue includes refunds**
  - What was wrong or weak: `sumAmountByMerchant` and the AVG query in `metrics.ts` aggregated all rows regardless of `type`, inflating every financial figure.
  - Shape of my improvement: Added `AND type = 'sale'` to both queries so refund rows are excluded at the SQL level.
  - Alternatives I considered and rejected: Filtering in application code after the fetch — rejected because it would still pull refund rows from the DB unnecessarily.

- **C-4 — No input validation on `POST /api/orders`**
  - What was wrong or weak: `total_amount` accepted negative, `NaN`, or `Infinity`; `customer_email` was unchecked; `type` was cast without a membership check.
  - Shape of my improvement: Email regex, `Number.isFinite` + `≥ 0` check, and a `Set<'sale'|'refund'>` guard — all fail fast with a descriptive 400 before the DAL is called.
  - Alternatives I considered and rejected: A schema validation library (e.g. Zod) — cleaner long-term but adds a dependency; explicit checks are sufficient and keep the diff minimal.

- **H-1 — Second DB connection in `metrics.ts`**
  - What was wrong or weak: `metrics.ts` opened its own `better-sqlite3` instance with a duplicated `DB_PATH` read, bypassing the DAL entirely.
  - Shape of my improvement: Deleted `metricsDb`; moved the three raw queries into `getMetricsSummary` and `getTopCustomers` on `ordersDal`. All SQL now lives in one place.
  - Alternatives I considered and rejected: Keeping the queries in the route but importing the shared `db` instance — rejected because it still bypasses the DAL abstraction.

- **H-2 — Seed runs on every boot**
  - What was wrong or weak: `seedIfEmpty()` was called unconditionally in `server.ts`, running a blocking query before the server started. A destructive seed change could wipe production data on restart.
  - Shape of my improvement: Removed the call entirely from `server.ts`; seed is already invokable via `npm run seed`.
  - Alternatives I considered and rejected: Wrapping in a `NODE_ENV !== 'production'` guard — still leaves the call in the boot path; removal is cleaner and safer.

- **H-3 — Unvalidated query parameters**
  - What was wrong or weak: `limit` was unbounded, date strings were not format-checked, and inverted ranges silently returned zero results.
  - Shape of my improvement: Extracted `isValidDate` (YYYY-MM-DD regex) and `clampLimit` (hard max 500) into `src/routes/query-validation.ts`; applied to orders and revenue routes with explicit 400s for bad input.
  - Alternatives I considered and rejected: Inline checks per route — rejected to avoid duplication; a shared module keeps the logic testable and reusable.

## Feature chosen

- **Feature:** Step 1 of the DDD migration plan — fix all critical and high bugs in-place before any restructuring.
- **Why this one and not the others:** Correctness is the prerequisite for safe refactoring. Restructuring broken code moves bugs into new places rather than removing them.
- **What I cut to ship it in budget:** No new libraries, no architectural moves — purely surgical fixes within the existing file structure.

## Things I noticed but did NOT fix

- `top-customers` SUM still includes refunds (scope limited to the AVG and revenue SUM identified in C-3).
- No rate limiting on any endpoint.
- `PORT` and `DB_PATH` env vars are still read inline in multiple files (addressed in Step 3 of the plan).

## Docs / code I left alone deliberately

- `seed.ts` logic and the `npm run seed` script — correct and intentionally separate from the boot path after H-2.
- The global error handler in `server.ts` — functional as-is; typed `AppError` subclasses are Step 2 of the migration plan.

## What I'd do with another 6 hours

- Steps 2–4 of the migration plan: typed `AppError` classes, a single `config.ts` for env vars, and completing the DAL as the only DB seam.
- Add an integration smoke-test that boots the full Express app and hits every endpoint.
