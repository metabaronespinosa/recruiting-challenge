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

- **Step 2 — Typed AppError hierarchy**
  - What was wrong or weak: The global error handler in `server.ts` caught a generic `Error` and always returned 500, hiding the actual error type from callers.
  - Shape of my improvement: Added `src/lib/errors.ts` with `AppError`, `NotFoundError`, `ValidationError`, and `AuthError`; the handler now pattern-matches on `AppError` and returns the typed `statusCode` and `code`.
  - Alternatives I considered and rejected: Attaching status codes directly to `Error` via duck-typing — rejected because subclasses make the hierarchy explicit and TypeScript-enforced.

- **Step 3 — Centralised env-var config**
  - What was wrong or weak: `DB_PATH` was read independently in `db.ts` and previously in `metrics.ts`; `PORT` was read inline in `server.ts` with no central ownership.
  - Shape of my improvement: Added `src/config.ts` exporting `config.dbPath` and `config.port`; `db.ts` and `server.ts` now import from it; the `mkdir` guard skips when `dbPath === ':memory:'`.
  - Alternatives I considered and rejected: Dotenv with a `.env` file — adds a dependency and file; `process.env` reads through one module are sufficient for this scale.

- **Step 4 — Single DB seam confirmed and tested**
  - What was wrong or weak: `getMetricsSummary` and `getTopCustomers` were migrated to the DAL in Step 1 but had no direct unit or route-integration tests.
  - Shape of my improvement: Added `test/metrics.test.ts` covering both DAL methods at the unit level and the `/api/metrics` route at the integration level (6 DAL + 4 route tests).
  - Alternatives I considered and rejected: Embedding metric assertions in the existing `orders.test.ts` — rejected to keep test files scoped to a single concern.

- **Step 5 — Domain types in `src/domain/order/order.types.ts`**
  - What was wrong or weak: `OrderRow`, `MetricsSummary`, and `TopCustomerRow` were declared inline in `orders-dal.ts`, mixing infrastructure and domain concerns in one file.
  - Shape of my improvement: Extracted all order interfaces into `src/domain/order/order.types.ts` (no infrastructure imports); the DAL imports and re-exports them for backwards compatibility; `listByMerchant` and `create` now use `OrderFilters` and `CreateOrderInput`.
  - Alternatives I considered and rejected: Keeping types in the DAL and importing into domain later — rejected because the point of Step 5 is to name the boundary explicitly before logic moves.

## Feature chosen

- **Feature:** Steps 2–5 of the DDD migration plan — typed errors, centralised config, single DB seam validation, and explicit domain types.
- **Why this one and not the others:** These are pure structural improvements with no behaviour change, safe to apply immediately on top of the Step 1 correctness fixes.
- **What I cut to ship it in budget:** No logic moved to a service layer yet (Step 6); no repository interface defined yet (Step 7).

- **Step 6 — OrderService use-case layer**
  - What was wrong or weak: Routes contained all business logic (validation, revenue calculation, IDOR guard), making them untestable without an HTTP layer.
  - Shape of my improvement: Created `src/domain/order/order.service.ts` with a `createOrderService(repo)` factory; each route file refactored to a `create*Router(service)` factory; legacy singleton shims preserve backwards-compatible imports; `server.ts` wires one service instance at startup.
  - Alternatives I considered and rejected: Class-based service — rejected in favour of a factory function to avoid `this` binding issues and keep the interface purely structural.

- **Step 7 — IOrderRepository port + infrastructure relocation**
  - What was wrong or weak: The service depended directly on a concrete DAL object rather than an abstraction, making it impossible to swap the storage backend without touching domain code.
  - Shape of my improvement: Declared `IOrderRepository` in `src/domain/order/order.repository.ts`; moved all SQL into `src/infrastructure/sqlite/order.sqlite.repo.ts` which explicitly implements the interface; reduced `orders-dal.ts` to a one-line re-export shim for backwards compatibility.
  - Alternatives I considered and rejected: Deleting `orders-dal.ts` immediately — rejected to avoid breaking the existing test files in one large jump; shim keeps the migration incremental.

- **Step 8 — Domain dependency rule enforcement**
  - What was wrong or weak: Nothing prevented a future developer from accidentally importing `express` or `better-sqlite3` inside `src/domain/`, silently violating the clean-architecture boundary.
  - Shape of my improvement: Created `src/scripts/check-domain-deps.ts` — a zero-dependency Node.js script that recursively scans `src/domain/` for forbidden import patterns and exits 1 on any match; wired as `npm run check:domain-deps`; added `test/domain-deps.test.ts` (2 tests) so CI catches violations automatically.
  - Alternatives I considered and rejected: An ESLint `no-restricted-imports` rule — correct long-term but requires adding ESLint as a dependency; the custom script enforces the same rule with no new packages.

## Things I noticed but did NOT fix

- `top-customers` SUM still includes refunds (scope limited to the AVG and revenue SUM identified in C-3).
- No rate limiting on any endpoint.
- `orders-dal.ts` shim and legacy route shims could be cleaned up once all callers are migrated.

## Docs / code I left alone deliberately

- `seed.ts` logic and the `npm run seed` script — correct and intentionally separate from the boot path after H-2.
- Re-exports in `orders-dal.ts` — intentional backwards-compatibility shim; removal is a clean-up task, not a correctness issue.

## What I'd do with another 6 hours

- Delete the DAL shim and legacy route shims once all direct callers migrate to `orderSqliteRepo` / factory routers.
- Integrate `check:domain-deps` into a pre-commit hook (Husky) or CI step.
- Add an in-memory `IOrderRepository` stub for pure unit-testing the service without a SQLite DB.
