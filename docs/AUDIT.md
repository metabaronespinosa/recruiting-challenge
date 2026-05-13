# Codebase Audit — Merchant Dashboard API

## Critical Risks Matrix

| Risk | Fix |
|------|-----|
| **[C-1] IDOR on `GET /api/orders/:id`** — Any authenticated merchant can fetch any other merchant's order by ID. `getById` in the DAL has no `merchant_id` filter. | Add `merchant_id` as a required parameter to `getById` and include `AND merchant_id = ?` in the SQL query. TypeScript will enforce the fix at every callsite. |
| **[C-2] Zero authentication** — `authMiddleware` only checks that `X-Merchant-Id` is present. Any string is trusted as a valid identity; no token, signature, or DB lookup occurs. | At minimum, validate the incoming `merchantId` exists in the `merchants` table inside `authMiddleware`. Reject with 401 if not found. |
| **[C-3] Revenue includes refunds** — `sumAmountByMerchant` and the `AVG` query in `metrics.ts` aggregate all rows regardless of `type`, inflating every financial figure shown. | Add `AND type = 'sale'` to both the `SUM` query in the DAL and the `AVG` query in `metrics.ts`. |
| **[C-4] No input validation on `POST /api/orders`** — `total_amount` can be negative, `NaN`, or `Infinity`. `customer_email` is not format-checked. `type` accepts any string at runtime despite the TypeScript cast. | Add explicit checks: email regex, `Number.isFinite` + non-negative for amount, and a `Set` membership check for `type` before the order is created. |
| **[H-1] Second DB connection in `metrics.ts`** — Opens its own `better-sqlite3` instance, bypassing the DAL entirely and duplicating the `DB_PATH` env-var logic. | Delete the local `metricsDb` instance. Move the three raw queries into `orders-dal.ts` as new DAL methods and call those from the route. |
| **[H-2] Seed runs on every server boot** — `seedIfEmpty()` is called unconditionally in `server.ts`, executing a blocking DB query before the HTTP server starts. A future destructive seed change could wipe production data on restart. | Remove `seedIfEmpty()` from `server.ts`. It is already invokable via `npm run seed`; the boot path should only call `initSchema()`. |
| **[H-3] Query parameters are unvalidated** — `limit` is unbounded (`?limit=9999999` is accepted), date strings are not format-checked, and an inverted range (`from > to`) silently returns zero results. | Validate date strings against a `YYYY-MM-DD` regex, reject inverted ranges with a 400, and clamp `limit` to a hard maximum (e.g. 500) before it reaches the DAL. |

---

## DDD Migration Plan

| Step | Description | Commits |
|------|-------------|---------|
| **1. Fix critical boundary bugs in-place** | Resolve C-1 through H-3 within the existing file structure before any refactoring. Stable, correct behaviour is the prerequisite for safe restructuring. | 3–4 |
| **2. Introduce `src/lib/errors.ts`** | Define typed `AppError` subclasses (`NotFoundError`, `ValidationError`, `AuthError`). Update the existing global error handler in `server.ts` to pattern-match on them instead of catching a generic `Error`. | 1 |
| **3. Extract `src/config.ts`** | Move all `process.env` reads (`DB_PATH`, `PORT`) into a single validated config module. Every other file imports from `config.ts` instead of reading env vars directly — eliminates the duplication already present in `metrics.ts` and `db.ts`. | 1 |
| **4. Complete the DAL as the single DB seam** | Migrate the three raw queries from `metrics.ts` into `orders-dal.ts`. Remove the second DB connection. Every SQL statement in the codebase now lives in `dal/orders-dal.ts` and uses the single `db` instance from `db.ts`. | 1–2 |
| **5. Define domain types in `src/domain/order/order.types.ts`** | Extract `OrderRow`, `CreateOrderInput`, and `OrderFilters` interfaces out of `orders-dal.ts` into a dedicated types file. No logic moves yet — this is purely naming the domain boundary explicitly. | 1 |
| **6. Create `src/domain/order/order.service.ts`** | Move business logic out of routes into a service: revenue calculation, refund-exclusion rules, order creation orchestration. Routes call the service; the service calls the DAL. Routes become thin HTTP adapters. | 2–3 |
| **7. Define the repository port `IOrderRepository`** | Declare an interface in `src/domain/order/order.repository.ts` that the DAL must satisfy. Rename `orders-dal.ts` → `src/infrastructure/sqlite/order.sqlite.repo.ts` and make it explicitly implement the interface. The domain layer now depends on an abstraction, not a concrete SQLite file. | 1–2 |
| **8. Enforce the dependency rule** | Audit imports: nothing inside `src/domain/` may import from `express`, `better-sqlite3`, or `src/infrastructure/`. Add a `paths` rule or a lint check to block future violations. The domain is now infrastructure-agnostic. | 1 |
