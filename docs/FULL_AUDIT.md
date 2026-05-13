🔍 Complete Codebase Audit — Merchant Dashboard API
Express.js + TypeScript + SQLite — Senior Architect Review

1. High-Level Overview
File Structure

Apply
src/
├── server.ts          ← Entry point: Express bootstrap, middleware wiring
├── db.ts              ← SQLite connection singleton + DDL (schema init)
├── auth.ts            ← Auth middleware (header-based identity trust)
├── dal/
│   └── orders-dal.ts  ← Data-access layer (only for orders, partial adoption)
├── routes/
│   ├── orders.ts      ← CRUD for orders
│   ├── revenue.ts     ← Revenue aggregation
│   └── metrics.ts     ← Dashboard summary + top-customers
└── scripts/
    └── seed.ts        ← DB seeding (also auto-runs on server boot)

test/
└── orders.test.ts     ← 2 DAL integration tests (Node test runner)

public/
├── index.html         ← Static dashboard UI
└── app.js             ← Vanilla JS frontend (no build step)

docs/
├── api.md             ← Incomplete, self-described as "quick-and-dirty"
└── architecture.md    ← Stale draft with known inaccuracies
Layers (as-intended vs. as-built)
Layer	Intended	Actual
HTTP / Routing	routes/	✅ Present, but leaks business logic
Business Logic	(implicit)	❌ Absent — logic lives inside routes directly
Data Access	dal/orders-dal.ts	⚠️ Partial — metrics.ts bypasses it entirely
Database	db.ts	⚠️ Singleton exported raw; metrics.ts opens a second connection
Entry Points
Server boot: src/server.ts — calls initSchema() and seedIfEmpty() synchronously before mounting the Express app. Both are blocking I/O operations running at module load time.
CLI seed: src/scripts/seed.ts — can run standalone, but is also called on every server boot, inside server.ts.
Database Access Pattern
The project has an unfinished, inconsistent split across three access paths:

db singleton from db.ts — used by orders-dal.ts (correct)
metricsDb — a second better-sqlite3 connection opened directly inside metrics.ts with { readonly: true } (architectural violation)
Direct db reference in seed.ts — bypasses the DAL
2. Critical Risks Matrix
🔴 CRITICAL
C-1 — Broken Multi-Tenant Data Isolation (src/routes/orders.ts:17-22)
Typescript

Apply
// src/routes/orders.ts — GET /api/orders/:id
ordersRouter.get('/:id', (req, res) => {
  const order = ordersDal.getById(req.params.id);  // ← NO merchant filter
  if (!order) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ order });  // ← Returns ANY merchant's order to ANY authenticated caller
});
Impact: Merchant A can fetch any order belonging to Merchant B by guessing or brute-forcing a UUID. This is an IDOR (Insecure Direct Object Reference) — a OWASP Top 10 vulnerability. The DAL's getById takes only an id with no merchant_id guard. Every authenticated call bypasses tenancy isolation on reads.

C-2 — X-Merchant-Id Header is Completely Unauthenticated (src/auth.ts:18-23)
Typescript

Apply
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const merchantId = req.header('X-Merchant-Id');
  if (!merchantId) {         // ← Only checks presence, not validity
    res.status(401).json({ error: 'missing_merchant_id' });
    return;
  }
  req.merchantId = merchantId;  // ← Any string is trusted as identity
  next();
}
Impact: There is zero authentication. Any caller who sends X-Merchant-Id: m_acme is immediately granted full access to Acme's data. No token verification, no signature, no session lookup, no existence check against the merchants table. The comment says "Real auth would be a signed JWT" — that's not a deferral, it's a missing critical control for a production API. Combined with C-1, this means full data exposure to anyone who can make an HTTP request.

C-3 — Revenue Calculation Includes Refunds (src/dal/orders-dal.ts:46-56)
Typescript

Apply
sumAmountByMerchant(merchantId: string, from: string, to: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(total_amount), 0) AS total
       FROM orders
       WHERE merchant_id = ? AND created_at >= ? AND created_at < ?`,
      // ← No filter on type = 'sale'. Refunds counted as positive revenue.
    )
    .get(merchantId, from, to) as { total: number };
  return row.total;
},
Impact: The orders table uses type: 'sale' | 'refund' where refunds are separate rows (as stated in architecture.md). The revenue sum includes all rows regardless of type, inflating every revenue figure. The metrics/summary avg_order_value_cents has the same flaw — it averages refund amounts in too. This is a silent data correctness bug that produces wrong numbers in the dashboard without any error. Financial reporting is incorrect.

C-4 — No Input Validation on Financial Fields (src/routes/orders.ts:27-42)
Typescript

Apply
ordersRouter.post('/', (req, res) => {
  const body = req.body as { ... };
  if (!body.customer_email || typeof body.total_amount !== 'number') {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  // ← No: email format check, amount negativity check, amount bounds, type enum check
  const order = ordersDal.create({
    ...
    total_amount: body.total_amount,  // Can be -99999999, 0, Infinity, NaN
    type: body.type ?? 'sale',        // body.type can be ANY string, cast overridden
  });
Impact: A caller can create orders with total_amount: -99999999, total_amount: NaN, invalid customer_email strings, or type: "hack" (the TypeScript cast is a lie at runtime — JS doesn't enforce it). Negative amounts corrupt revenue figures. NaN/Infinity cause SQLite type coercion surprises. There is no email format validation at all.

🟠 HIGH
H-1 — metrics.ts Opens a Second Database Connection, Bypassing the DAL (src/routes/metrics.ts:4-5)
Typescript

Apply
const DB_PATH = process.env.DB_PATH ?? 'data/dashboard.db';
const metricsDb = new Database(DB_PATH, { readonly: true });
Impact: The DAL pattern is explicitly designed as the single seam for auditing, caching, and tenancy. metrics.ts circumvents this entirely with raw SQL, re-duplicates the DB_PATH env-var logic (now in 2 files — will drift), and makes it impossible to add cross-cutting concerns (logging, rate-limiting by query type) without touching two independent code paths. In WAL mode, a second readonly connection is safe for SQLite, but the architectural violation is the risk.

H-2 — Seed Runs on Every Server Boot (src/server.ts:9)
Typescript

Apply
initSchema();
seedIfEmpty();   // ← Called unconditionally at module load time
Impact: seedIfEmpty() runs a SELECT COUNT(*) on every boot, which is a blocking synchronous DB call before the HTTP server starts. More critically, it runs initSchema() again (it's also called inside seedIfEmpty()), so the schema migration runs twice per boot. If the seed script is ever changed to be destructive (a common developer mistake — DELETE FROM orders before re-seeding), production data could be wiped on restart. Seed scripts have no place in the production boot path.

H-3 — Unvalidated / Unsanitized Date Range Inputs Used in SQL (src/routes/revenue.ts:13-15, src/dal/orders-dal.ts:17-21)
Typescript

Apply
// revenue.ts — only checks presence, not format
const from = typeof req.query.from === 'string' ? req.query.from : undefined;
const to   = typeof req.query.to   === 'string' ? req.query.to   : undefined;

// Then passed directly to SQL BETWEEN comparison:
`WHERE merchant_id = ? AND created_at >= ? AND created_at < ?`
Impact: While parameterized queries prevent SQL injection here, the values are trusted implicitly for semantic correctness. from=not-a-date and to=not-a-date will silently return zero results. from=2099-01-01&to=1999-01-01 (inverted range) silently returns zero. The limit parameter in GET /api/orders is even more dangerous: ?limit=0 passes through as 0, ?limit=9999999 allows unbounded result sets causing potential OOM, and ?limit=abc becomes NaN which SQLite interprets as 0.

Typescript

Apply
// orders.ts line 11: Number(req.query.limit) with no bounds check
limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
H-4 — No GET /api/orders/:id Merchant Ownership Check in DAL (src/dal/orders-dal.ts:32-34)
Typescript

Apply
getById(id: string): OrderRow | undefined {
  return db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as OrderRow | undefined;
}
Impact: This is the DAL-level root cause of C-1. The DAL signature has no merchantId parameter. Fixing the route without fixing the DAL signature leaves a landmine for every future caller of getById.

🟡 MEDIUM
M-1 — status Field Has No Schema Enforcement
The schema defines status TEXT NOT NULL DEFAULT 'completed' with no CHECK constraint. POST /api/orders hardcodes status: 'completed', but there's no DB-level guard. Any direct DB write or future endpoint could insert arbitrary status strings with no validation error.

M-2 — type Field Has No Schema Enforcement
Same as M-1. The schema has no CHECK (type IN ('sale', 'refund')) constraint. TypeScript's type system only guards this at compile time; it does not protect the database.

M-3 — No Pagination on GET /api/metrics/top-customers Except limit
?limit=9999999 fetches the entire customer table aggregated in one query with no upper-bound guard, returned in a single JSON response.

M-4 — initSchema() Called Twice Per Boot
server.ts calls initSchema() on line 8, then seedIfEmpty() on line 9, which calls initSchema() again internally. Harmless now (CREATE TABLE IF NOT EXISTS) but creates confusion and makes the boot sequence non-obvious.

M-5 — tsconfig.json Excludes test/ — Tests Run Without Type Checking
Json

Apply
"include": ["src/**/*"],
"exclude": ["node_modules", "dist"]
The test/ directory is excluded from TypeScript compilation. Tests are run with tsx which transpiles without type-checking. Type errors in tests will never be caught by tsc or CI.

M-6 — Global Error Handler Only Catches Synchronous Errors (src/server.ts:25-29)
Typescript

Apply
app.use((err: Error, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});
None of the route handlers use try/catch or next(err). Since all SQLite operations in better-sqlite3 are synchronous, this is currently safe — but any future async handler (external API call, file I/O, etc.) that throws will produce an unhandled promise rejection that crashes Node, not a 500 response. There is no process.on('unhandledRejection') handler.

M-7 — public/app.js Has No Error Handling
Every api() call in the frontend silently swallows network errors and non-2xx responses. r.json() is called unconditionally even on 4xx/5xx. If the API returns an error body, the UI silently renders undefined values or throws a JS error with no user feedback.

M-8 — Merchants Are Never Validated to Exist
authMiddleware sets req.merchantId to any non-empty string. No middleware or route checks that the merchantId actually exists in the merchants table. A request with X-Merchant-Id: nonexistent will successfully return empty arrays rather than a 404/403.

3. Architectural Debt Scorecard
Dimension	Score (0–10)	Verdict
Separation of Concerns	4/10	Routes contain business logic. metrics.ts is both a router and a raw DB client. DAL exists but is bypassed. No service layer.
Type Safety	5/10	strict: true and noUncheckedIndexedAccess are good. But runtime casts (as OrderRow, as { n: number }) are pervasive — TypeScript is used as documentation, not enforcement. req.body is cast, not parsed.
Error Handling	3/10	No try/catch in any route. Global handler catches sync throws only. No typed error classes. Async safety is accidental (everything happens to be sync). Frontend swallows all errors silently.
Validation	2/10	POST /api/orders checks presence of two fields only. No format validation, no bounds, no enum enforcement. Date inputs not validated. limit not clamped. No runtime schema validator (Zod, Valibot, etc.) present.
Dependency Management	7/10	Minimal, intentional dependencies. better-sqlite3, express, tsx, typescript — no bloat. Missing: a validation library, a logging library. @types/express@^5 while express@^4 is installed is a version mismatch in devDeps.
Test Coverage	1/10	2 tests covering create and getById on the DAL only. 0 route tests. 0 auth tests. 0 validation tests. 0 revenue/metrics tests. The bugs in C-1, C-3, C-4 are all untested.
Logging / Observability	2/10	console.log on startup and console.error in the global handler. No structured logging, no request IDs, no log levels, no timing, no audit trail for financial operations, no way to correlate a merchant's request across log lines.
Overall Debt Score: 3.4/10 — Functional skeleton with critical correctness and security gaps. The DAL intent is right but only 50% implemented.

4. Quick Wins (≤2 hours each) — Critical Issue Elimination
QW-1: Fix IDOR — Add Merchant Ownership Check to getById (30 min)
This fixes C-1 and H-4 simultaneously.

Typescript

Apply
// src/dal/orders-dal.ts
getById(id: string, merchantId: string): OrderRow | undefined {
  return db
    .prepare(`SELECT * FROM orders WHERE id = ? AND merchant_id = ?`)
    .get(id, merchantId) as OrderRow | undefined;
}

// src/routes/orders.ts
ordersRouter.get('/:id', (req, res) => {
  const order = ordersDal.getById(req.params.id, req.merchantId!);
  if (!order) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ order });
});
The DAL signature change propagates the fix as a compile error to all callers — TypeScript enforces the fix.

QW-2: Fix Revenue Calculation to Exclude Refunds (20 min)
This fixes C-3. Same fix needed in sumAmountByMerchant and the AVG in metrics.ts.

Typescript

Apply
// src/dal/orders-dal.ts
`SELECT COALESCE(SUM(total_amount), 0) AS total
 FROM orders
 WHERE merchant_id = ? AND type = 'sale'
   AND created_at >= ? AND created_at < ?`

// src/routes/metrics.ts — avgOrderRow query
`SELECT COALESCE(AVG(total_amount), 0) AS avg
 FROM orders
 WHERE merchant_id = ? AND type = 'sale'`
QW-3: Add Runtime Input Validation to POST /api/orders (45 min)
This fixes C-4. Install zod (or use a hand-rolled validator to avoid new deps):

Typescript

Apply
// src/routes/orders.ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_TYPES = new Set(['sale', 'refund']);

ordersRouter.post('/', (req, res) => {
  const body = req.body;
  const errors: string[] = [];

  if (typeof body.customer_email !== 'string' || !EMAIL_RE.test(body.customer_email))
    errors.push('customer_email must be a valid email');
  if (typeof body.total_amount !== 'number' || !Number.isFinite(body.total_amount) || body.total_amount < 0)
    errors.push('total_amount must be a non-negative finite number');
  if (body.type !== undefined && !VALID_TYPES.has(body.type))
    errors.push('type must be "sale" or "refund"');

  if (errors.length) {
    res.status(400).json({ error: 'validation_failed', details: errors });
    return;
  }
  // ... rest of handler
});
QW-4: Validate and Clamp Query Parameters (30 min)
This fixes H-3 for limit, from, and to:

Typescript

Apply
// Shared utility — src/lib/query-params.ts
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseListParams(query: Record<string, unknown>) {
  const from = typeof query.from === 'string' && DATE_RE.test(query.from) ? query.from : undefined;
  const to   = typeof query.to   === 'string' && DATE_RE.test(query.to)   ? query.to   : undefined;
  const rawLimit = Number(query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), 500)  // hard cap at 500
    : 100;
  if (from && to && from > to) return { error: 'from must be before to' as const };
  return { from, to, limit };
}
QW-5: Remove Seed from Production Boot Path (15 min)
This fixes H-2:

Typescript

Apply
// src/server.ts — REMOVE seedIfEmpty() entirely
initSchema();
// seedIfEmpty();  ← deleted

// Seed is only run via: npm run seed
seedIfEmpty() already exists in scripts/seed.ts and is invoked by npm run seed. It has no place in the server boot path.

QW-6: Add CHECK Constraints to Schema (20 min)
Fixes M-1 and M-2 at the database level:

Sql

Apply
-- In db.ts initSchema(), update the orders table DDL:
type TEXT NOT NULL DEFAULT 'sale' CHECK (type IN ('sale', 'refund')),
status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'cancelled')),
5. Recommended Target Architecture
Guiding Principle
This codebase has the shape of a layered architecture but not the discipline. The path forward is not a rewrite — it's completing the layers that were already intended, adding a thin service layer, and making the seams explicit. The goal is gradual DDD-lite + Hexagonal ports-and-adapters.

Incremental Migration (6 steps, no big-bang rewrites)

Apply
Step 1 (Week 1): Fix all Critical/High issues in-place (QW-1 through QW-5)
Step 2 (Week 2): Introduce a Service Layer + Validation boundary
Step 3 (Week 3): Consolidate DB access — remove the second connection in metrics.ts
Step 4 (Month 2): Add structured logging + request context
Step 5 (Month 2): Expand test coverage with route-level integration tests
Step 6 (Month 3): Introduce real authentication (JWT / API key with DB lookup)
Target Structure

Apply
src/
├── server.ts                    ← Thin: only Express setup + middleware wiring
├── config.ts                    ← All env-var reads in one place, validated at boot
├── db.ts                        ← Single DB connection, no second instance anywhere
│
├── lib/
│   ├── errors.ts                ← Typed AppError classes (NotFoundError, AuthError…)
│   ├── validation.ts            ← Shared validators / Zod schemas
│   └── logger.ts                ← Structured logger (pino recommended)
│
├── middleware/
│   ├── auth.ts                  ← Auth middleware (currently: header; future: JWT)
│   ├── error-handler.ts         ← Global error handler, handles AppError types
│   └── request-logger.ts        ← Per-request structured logging with req ID
│
├── domain/                      ← Business rules — NO imports from express or better-sqlite3
│   ├── order/
│   │   ├── order.types.ts       ← OrderRow, CreateOrderInput, OrderFilters interfaces
│   │   ├── order.service.ts     ← Revenue calc, validation, business invariants
│   │   └── order.repository.ts  ← Interface (port): IOrderRepository
│   └── merchant/
│       └── merchant.types.ts
│
├── infrastructure/              ← Adapters: concrete implementations of ports
│   └── sqlite/
│       ├── order.sqlite.repo.ts ← Implements IOrderRepository using better-sqlite3
│       └── metrics.sqlite.repo.ts
│
└── routes/                      ← HTTP adapter: thin, delegates to services
    ├── orders.ts                ← Parses HTTP → calls OrderService → serializes response
    ├── revenue.ts
    └── metrics.ts
Key Architectural Rules to Enforce
domain/ has zero infrastructure imports — no better-sqlite3, no express. Pure TypeScript business logic, trivially unit-testable.
Routes own no business logic — they parse input, call a service, serialize output. If a route file exceeds ~40 lines, it probably contains business logic.
One DB connection — db.ts exports one instance. All repositories consume it via constructor injection (enables test doubles).
Validation at the boundary — every public endpoint validates its input before it touches the service layer. Use Zod schemas colocated with route handlers.
Typed errors flow through next(err) — services throw AppError subclasses; the global handler pattern-matches on them.
6. Endpoint Quality Matrix
Endpoint	Auth	Input Validation	Business Logic Correctness	Tenancy Safety	Test Coverage	Quality
GET /api/health	❌ None (correct)	N/A	✅	N/A	❌ None	B — trivial, acceptable
GET /api/orders	⚠️ Header-only, unauthenticated	⚠️ limit unbounded, dates unvalidated	✅ Correct listing	✅ Filtered by merchantId	❌ None	D
GET /api/orders/:id	⚠️ Header-only, unauthenticated	✅ Param is passed through	✅ Logic correct	🔴 NO merchant filter — IDOR	❌ None	F
POST /api/orders	⚠️ Header-only, unauthenticated	🔴 No email format, no amount bounds, no type enum	⚠️ Assigns merchantId from (untrusted) header	✅ merchantId from auth context	❌ None	F
GET /api/revenue	⚠️ Header-only, unauthenticated	⚠️ Presence-only, no date format check, no range validation	🔴 Includes refunds in revenue total	✅ Filtered by merchantId	❌ None	F
GET /api/metrics/summary	⚠️ Header-only, unauthenticated	N/A (no params)	🔴 avg_order_value includes refunds	✅ Filtered by merchantId	❌ None	D
GET /api/metrics/top-customers	⚠️ Header-only, unauthenticated	⚠️ limit unbounded, no cap	✅ Logic correct	✅ Filtered by merchantId	❌ None	D
Overall API Grade: D+ — Endpoints return correct data for the happy path only. Security, validation, and data correctness failures exist on 4 of 7 endpoints.

Summary: Priority Action List

Apply
IMMEDIATE (before any traffic):
  [C-1] Fix IDOR on GET /api/orders/:id — add merchant_id to getById query
  [C-2] Implement real auth — at minimum validate merchantId against merchants table
  [C-3] Fix revenue query — exclude type='refund' rows from SUM and AVG
  [C-4] Add input validation to POST /api/orders — email, amount bounds, type enum

THIS SPRINT:
  [H-1] Move metrics queries into the DAL / service layer, remove second DB connection
  [H-2] Remove seedIfEmpty() from server.ts boot path
  [H-3] Validate and clamp all query parameters (dates, limit)
  [M-5] Add test/ to tsconfig include, write route-level integration tests
  [M-6] Add try/catch to async handlers, add unhandledRejection handler

NEXT SPRINT:
  [M-1/2] Add CHECK constraints to SQLite schema
  [M-7] Add error handling to frontend app.js
  [M-8] Validate merchantId existence on every authenticated request
  Introduce structured logging (pino), add request IDs
  Begin domain/ service layer extraction
The bones here are not bad — the DAL intent, WAL mode, parameterized queries, and strict TypeScript config are all solid foundations. The critical failures are all at the boundary (auth, validation, tenancy) which is the exact place a production API cannot afford to cut corners.
