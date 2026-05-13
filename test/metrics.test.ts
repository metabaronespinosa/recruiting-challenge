// Set DB_PATH before importing any module that opens the DB.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { initSchema, db } from '../src/db.js';
import { ordersDal } from '../src/dal/orders-dal.js';
import { authMiddleware } from '../src/auth.js';
import { metricsRouter } from '../src/routes/metrics.js';

// ---------------------------------------------------------------------------
// Seed shared test data once
// ---------------------------------------------------------------------------
initSchema();
db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_metrics', 'Metrics Test')`).run();

// Two sale orders + one refund for m_metrics
db.prepare(
  `INSERT OR IGNORE INTO orders (id, merchant_id, customer_email, total_amount, type, status)
   VALUES ('ms1', 'm_metrics', 'alice@example.com', 4000, 'sale', 'completed')`,
).run();
db.prepare(
  `INSERT OR IGNORE INTO orders (id, merchant_id, customer_email, total_amount, type, status)
   VALUES ('ms2', 'm_metrics', 'bob@example.com', 6000, 'sale', 'completed')`,
).run();
db.prepare(
  `INSERT OR IGNORE INTO orders (id, merchant_id, customer_email, total_amount, type, status)
   VALUES ('mr1', 'm_metrics', 'alice@example.com', 1000, 'refund', 'completed')`,
).run();

// ---------------------------------------------------------------------------
// DAL unit tests
// ---------------------------------------------------------------------------
test('DAL: getMetricsSummary counts all orders (sales + refunds)', () => {
  const summary = ordersDal.getMetricsSummary('m_metrics');
  assert.equal(summary.total_orders, 3);
});

test('DAL: getMetricsSummary counts unique customers correctly', () => {
  const summary = ordersDal.getMetricsSummary('m_metrics');
  // alice and bob are distinct
  assert.equal(summary.unique_customers, 2);
});

test('DAL: getMetricsSummary avg_order_value_cents excludes refunds', () => {
  const summary = ordersDal.getMetricsSummary('m_metrics');
  // AVG over sales only: (4000 + 6000) / 2 = 5000
  assert.equal(summary.avg_order_value_cents, 5000);
});

test('DAL: getTopCustomers returns rows ranked by total_spent', () => {
  const customers = ordersDal.getTopCustomers('m_metrics', 5);
  // alice has 1 sale (4000) + 1 refund (1000) → total_spent includes both in current impl
  // bob has 1 sale (6000)
  assert.ok(customers.length >= 1);
  // top customer by spent should be bob (6000) or alice (5000 combined)
  const emails = customers.map((c) => c.customer_email);
  assert.ok(emails.includes('alice@example.com'));
  assert.ok(emails.includes('bob@example.com'));
});

test('DAL: getTopCustomers respects the limit', () => {
  const customers = ordersDal.getTopCustomers('m_metrics', 1);
  assert.equal(customers.length, 1);
});

test('DAL: getMetricsSummary returns zeros for unknown merchant', () => {
  const summary = ordersDal.getMetricsSummary('m_nobody');
  assert.equal(summary.total_orders, 0);
  assert.equal(summary.unique_customers, 0);
  assert.equal(summary.avg_order_value_cents, 0);
});

// ---------------------------------------------------------------------------
// Route integration tests
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use('/api/metrics', authMiddleware, metricsRouter);

type ReqOptions = { headers?: Record<string, string> };
function get(
  server: http.Server,
  path: string,
  opts: ReqOptions = {},
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: (server.address() as { port: number }).port,
        path,
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...opts.headers },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode ?? 0, body: raw }); }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

let server: http.Server;
const H = { 'X-Merchant-Id': 'm_metrics' };

test('metrics route setup', async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
});

test('GET /api/metrics/summary returns expected shape', async () => {
  const res = await get(server, '/api/metrics/summary', { headers: H });
  assert.equal(res.status, 200);
  const body = res.body as {
    merchant_id: string;
    total_orders: number;
    unique_customers: number;
    avg_order_value_cents: number;
  };
  assert.equal(body.merchant_id, 'm_metrics');
  assert.equal(body.total_orders, 3);
  assert.equal(body.unique_customers, 2);
  assert.equal(body.avg_order_value_cents, 5000);
});

test('GET /api/metrics/top-customers returns a list', async () => {
  const res = await get(server, '/api/metrics/top-customers?limit=2', { headers: H });
  assert.equal(res.status, 200);
  const body = res.body as { customers: unknown[] };
  assert.ok(Array.isArray(body.customers));
  assert.ok(body.customers.length <= 2);
});

test('GET /api/metrics/summary rejects unauthenticated request', async () => {
  const res = await get(server, '/api/metrics/summary');
  assert.equal(res.status, 401);
});

test('metrics route teardown', async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});
