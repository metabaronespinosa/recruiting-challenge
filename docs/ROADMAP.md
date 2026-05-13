# Engineering Roadmap — Merchant Dashboard API

> **Status:** All critical and high-severity issues from the Audit are resolved.
> The platform is stable and secure. This roadmap defines the next five engineering
> investments, ordered by impact and logical dependency.

---

## Next Steps

| # | Initiative | Description | Est. Commits |
|---|------------|-------------|:------------:|
| **1** | **OpenAPI Specification & Living Docs** | Introduce `openapi.yaml` (OAS 3.1) as the single source of truth for every endpoint. Generate the existing `docs/api.md` from the spec rather than maintaining it by hand — the file is already self-described as "quick-and-dirty" and incomplete. Host interactive docs via a lightweight `swagger-ui-express` middleware on `GET /docs` in non-production environments. Contract tests (`openapi-fetch` or `zod-openapi`) should validate that the running server never drifts from the spec. This makes the API self-documenting for any partner or consumer integration without any manual effort. | **4–6** |
| **2** | **Structured Logging, Request Tracing & Observability** | Replace all `console.log` / `console.error` calls with a structured logger (`pino` is the idiomatic choice for Express). Attach a unique `requestId` (`uuid v4`) to every inbound request via middleware and propagate it through the service and DAL layers so every log line for a given request is correlated. Add request-duration timing and emit log fields for `merchantId`, `endpoint`, `statusCode`, and `durationMs`. This is the minimum viable observability surface needed before the API handles real traffic — financial APIs especially require an audit trail that can reconstruct what happened for any given merchant request. | **3–5** |
| **3** | **Route-Level Integration Test Suite** | Expand the current test coverage from the 2 existing DAL tests to full route-level integration tests using Node's built-in test runner and `supertest`. Each endpoint needs a minimum of: happy-path, missing-auth, invalid-input, and tenant-isolation assertions. Priority order: `POST /api/orders` (validation matrix), `GET /api/orders/:id` (IDOR regression guard), `GET /api/revenue` (refund-exclusion correctness), auth middleware. Target ≥ 80% branch coverage measured by `c8`. Add a `test:coverage` script to `package.json` and gate merges on it in CI so the audit regressions can never silently re-appear. | **5–7** |
| **4** | **Terraform Infrastructure & CI/CD Pipeline** | Define all cloud infrastructure as code using Terraform (compute, managed SQLite-compatible DB or a migration to PostgreSQL, secrets manager, load balancer). Provision separate `dev`, `staging`, and `production` workspaces from day one so environment drift is structurally impossible. Pair with a GitHub Actions pipeline: `lint → tsc → test:coverage → terraform plan` on every pull request, and `terraform apply → deploy` on merge to `main`. This converts deployments from a manual, error-prone step into a repeatable, auditable, one-click operation and is a hard prerequisite before onboarding a second engineer to the infrastructure. | **6–9** |
| **5** | **Multi-Tier Merchant Plans, Usage Metering & Billing Webhooks** | Introduce a `plan` field on the `merchants` table (`free`, `growth`, `enterprise`) and enforce per-plan rate limits and feature flags in middleware. Instrument every API call with a lightweight usage-metering event (order count, revenue processed, API calls consumed) stored in a dedicated `usage_events` table. Expose a `GET /api/billing/usage` endpoint so merchants can self-serve their consumption data. Wire Stripe webhooks for subscription lifecycle events (`customer.subscription.updated`, `invoice.paid`, `invoice.payment_failed`) so the platform can automatically gate or restore access without manual intervention. This is the foundational layer that converts the dashboard from an internal tool into a monetisable, self-serve SaaS product with a direct revenue feedback loop. | **8–12** |

---

> **Reading the estimate column:** commit counts reflect atomic, reviewable units of work
> (one logical change per commit). They assume the DDD migration described in `AUDIT.md`
> is already underway, so the service / repository boundaries exist to attach new
> behaviour to. Actual calendar time will vary with team size.
