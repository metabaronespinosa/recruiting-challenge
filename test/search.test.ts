/**
 * Tests for Feature C — Order search with filters.
 *
 * Coverage strategy
 * -----------------
 * 1. Repository layer  — verifies the SQL clause-building logic in isolation
 *    (email, type, status, date range, amount range, pagination).
 * 2. Service layer     — verifies input validation rules throw the right errors.
 * 3. Route integration — verifies the HTTP surface (happy paths + bad inputs)
 *    using an in-process Express server, consistent with the existing test style.
 */

// Set DB_PATH before any module import that opens the database.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { initSchema, db } from '../src/db.js';
import { orderSqliteRepo } from '../src/infrastructure/sqlite/order.sqlite.repo.js';
import { createOrderService } from '../src/domain/order/order.service.js';
import { ValidationError } from '../src/lib/errors.js';
import { authMiddleware } from '../src/auth.js';
import { createSearchRouter } from '../src/routes/search.js';

// ---------------------------------------------------------------------------
// One-time schema + fixture setup
// ---------------------------------------------------------------------------
initSchema();

db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_search', 'Search Test')`).run();

// Seed a controlled set of orders that every test can rely on.
const fixtures = [
  { id: 'srch-1', email: 'alice@example.com', amount: 5000, type: 'sale',   status: 'completed', date: '2024-03-01T10:00:00.000Z' },
  { id: 'srch-2', email: 'alice@example.com', amount: 2000, type: 'refund', status: 'completed', date: '2024-03-05T10:00:00.000Z' },
  { id: 'srch-3', email: 'bob@example.com',   amount: 8000, type: 'sale',   status: 'completed', date: '2024-04-10T10:00:00.000Z' },
  { id: 'srch-4', email: 'bob@example.com',   amount: 1500, type: 'sale',   status: 'pending',   date: '2024-05-20T10:00:00.000Z' },
  { id: 'srch-5', email: 'carol@example.com', amount: 3000, type: 'sale',   status: 'completed', date: '2024-06-15T10:00:00.000Z' },
];

for (const f of fixtures) {
  db.prepare(
    `INSERT OR IGNORE INTO orders
       (id, merchant_id, customer_email, total_amount, type, status, created_at)
     VALUES (?, 'm_search', ?, ?, ?, ?, ?)`,
  ).run(f.id, f.email, f.amount, f.type, f.status, f.date);
}

// ---------------------------------------------------------------------------
// Minimal HTTP helper (mirrors the pattern in orders-routes.test.ts)
// ---------------------------------------------------------------------------
type ReqOptions = { headers?: Record<string, string> };

function request(
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

// ---------------------------------------------------------------------------
// 1. Repository — searchOrders
// ---------------------------------------------------------------------------

test('repo.searchOrders returns all merchant orders with no filters', () => {
  const result = orderSqliteRepo.searchOrders('m_search', {});
  assert.ok(result.orders.length >= fixtures.length);
  assert.ok(result.orders.every((o) => o.merchant_id === 'm_search'));
  assert.equal(result.total, result.orders.length);
  assert.equal(result.offset, 0);
});

test('repo.searchOrders filters by email (case-insensitive)', () => {
  const result = orderSqliteRepo.searchOrders('m_search', { email: 'ALICE@EXAMPLE.COM' });
  assert.ok(result.orders.length >= 2);
  assert.ok(result.orders.every((o) => o.customer_email.toLowerCase() === 'alice@example.com'));
});

test('repo.searchOrders filters by type=refund', () => {
  const result = orderSqliteRepo.searchOrders('m_search', { type: 'refund' });
  assert.ok(result.orders.length >= 1);
  assert.ok(result.orders.every((o) => o.type === 'refund'));
});

test('repo.searchOrders filters by type=sale', () => {
  const result = orderSqliteRepo.searchOrders('m_search', { type: 'sale' });
  assert.ok(result.orders.every((o) => o.type === 'sale'));
});

test('repo.searchOrders filters by status=pending', () => {
  const result = orderSqliteRepo.searchOrders('m_search', { status: 'pending' });
  assert.ok(result.orders.length >= 1);
  assert.ok(result.orders.every((o) => o.status === 'pending'));
});

test('repo.searchOrders filters by date range', () => {
  // Only srch-3 and srch-4 fall within April–May 2024
  const result = orderSqliteRepo.searchOrders('m_search', {
    from: '2024-04-01',
    to:   '2024-06-01',
  });
  assert.ok(result.orders.length >= 2);
  const ids = result.orders.map((o) => o.id);
  assert.ok(ids.includes('srch-3'));
  assert.ok(ids.includes('srch-4'));
  assert.ok(!ids.includes('srch-1'));
  assert.ok(!ids.includes('srch-5'));
});

test('repo.searchOrders filters by minAmount', () => {
  const result = orderSqliteRepo.searchOrders('m_search', { minAmount: 5000 });
  assert.ok(result.orders.every((o) => o.total_amount >= 5000));
});

test('repo.searchOrders filters by maxAmount', () => {
  const result = orderSqliteRepo.searchOrders('m_search', { maxAmount: 2000 });
  assert.ok(result.orders.every((o) => o.total_amount <= 2000));
});

test('repo.searchOrders paginates: limit + offset', () => {
  const page1 = orderSqliteRepo.searchOrders('m_search', { limit: 2, offset: 0 });
  const page2 = orderSqliteRepo.searchOrders('m_search', { limit: 2, offset: 2 });

  assert.equal(page1.limit, 2);
  assert.equal(page1.offset, 0);
  assert.equal(page1.orders.length, 2);
  assert.equal(page2.offset, 2);

  // IDs on the two pages must not overlap
  const ids1 = new Set(page1.orders.map((o) => o.id));
  const ids2 = new Set(page2.orders.map((o) => o.id));
  for (const id of ids2) assert.ok(!ids1.has(id));

  // hasMore is true when there are more results beyond offset + page size
  if (page1.total > 2) assert.equal(page1.hasMore, true);
});

test('repo.searchOrders hasMore is false on the last page', () => {
  const total = orderSqliteRepo.searchOrders('m_search', {}).total;
  const result = orderSqliteRepo.searchOrders('m_search', { limit: total, offset: 0 });
  assert.equal(result.hasMore, false);
});

test('repo.searchOrders returns empty result for unknown merchant', () => {
  const result = orderSqliteRepo.searchOrders('m_nobody', {});
  assert.equal(result.orders.length, 0);
  assert.equal(result.total, 0);
  assert.equal(result.hasMore, false);
});

// ---------------------------------------------------------------------------
// 2. Service — searchOrders validation
// ---------------------------------------------------------------------------

const service = createOrderService(orderSqliteRepo);

test('service.searchOrders returns shaped result with no filters', () => {
  const result = service.searchOrders('m_search', {});
  assert.ok(Array.isArray(result.orders));
  assert.equal(typeof result.total, 'number');
  assert.equal(typeof result.hasMore, 'boolean');
});

test('service.searchOrders throws ValidationError for invalid email', () => {
  assert.throws(
    () => service.searchOrders('m_search', { email: 'not-an-email' }),
    (err) => err instanceof ValidationError,
  );
});

test('service.searchOrders throws ValidationError for invalid type', () => {
  assert.throws(
    () => service.searchOrders('m_search', { type: 'gift' }),
    (err) => err instanceof ValidationError,
  );
});

test('service.searchOrders throws ValidationError for inverted date range', () => {
  assert.throws(
    () => service.searchOrders('m_search', { from: '2024-06-01', to: '2024-01-01' }),
    (err) => err instanceof ValidationError,
  );
});

test('service.searchOrders throws ValidationError for negative minAmount', () => {
  assert.throws(
    () => service.searchOrders('m_search', { minAmount: '-100' }),
    (err) => err instanceof ValidationError,
  );
});

test('service.searchOrders throws ValidationError when minAmount > maxAmount', () => {
  assert.throws(
    () => service.searchOrders('m_search', { minAmount: '9000', maxAmount: '1000' }),
    (err) => err instanceof ValidationError,
  );
});

test('service.searchOrders throws ValidationError for invalid limit', () => {
  assert.throws(
    () => service.searchOrders('m_search', { limit: '-1' }),
    (err) => err instanceof ValidationError,
  );
});

test('service.searchOrders clamps limit to 500', () => {
  const result = service.searchOrders('m_search', { limit: '99999' });
  assert.equal(result.limit, 500);
});

test('service.searchOrders throws ValidationError for negative offset', () => {
  assert.throws(
    () => service.searchOrders('m_search', { offset: '-5' }),
    (err) => err instanceof ValidationError,
  );
});

// ---------------------------------------------------------------------------
// 3. Route integration — GET /api/orders/search
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use('/api/orders/search', authMiddleware, createSearchRouter(service));

let server: http.Server;

test('route setup', async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
});

const HEADERS = { 'X-Merchant-Id': 'm_search' };

test('GET /api/orders/search returns results with no filters', async () => {
  const res = await request(server, '/api/orders/search', { headers: HEADERS });
  assert.equal(res.status, 200);
  const body = res.body as { orders: unknown[]; total: number; hasMore: boolean };
  assert.ok(Array.isArray(body.orders));
  assert.equal(typeof body.total, 'number');
  assert.equal(typeof body.hasMore, 'boolean');
});

test('GET /api/orders/search filters by email', async () => {
  const res = await request(
    server,
    '/api/orders/search?email=alice@example.com',
    { headers: HEADERS },
  );
  assert.equal(res.status, 200);
  const body = res.body as { orders: Array<{ customer_email: string }> };
  assert.ok(body.orders.every((o) => o.customer_email === 'alice@example.com'));
});

test('GET /api/orders/search filters by type=refund', async () => {
  const res = await request(server, '/api/orders/search?type=refund', { headers: HEADERS });
  assert.equal(res.status, 200);
  const body = res.body as { orders: Array<{ type: string }> };
  assert.ok(body.orders.every((o) => o.type === 'refund'));
});

test('GET /api/orders/search filters by status=pending', async () => {
  const res = await request(server, '/api/orders/search?status=pending', { headers: HEADERS });
  assert.equal(res.status, 200);
  const body = res.body as { orders: Array<{ status: string }> };
  assert.ok(body.orders.every((o) => o.status === 'pending'));
});

test('GET /api/orders/search filters by amount range', async () => {
  const res = await request(
    server,
    '/api/orders/search?minAmount=3000&maxAmount=6000',
    { headers: HEADERS },
  );
  assert.equal(res.status, 200);
  const body = res.body as { orders: Array<{ total_amount: number }> };
  assert.ok(body.orders.every((o) => o.total_amount >= 3000 && o.total_amount <= 6000));
});

test('GET /api/orders/search respects limit and offset', async () => {
  const page1 = await request(server, '/api/orders/search?limit=2&offset=0', { headers: HEADERS });
  const page2 = await request(server, '/api/orders/search?limit=2&offset=2', { headers: HEADERS });

  assert.equal(page1.status, 200);
  assert.equal(page2.status, 200);

  const b1 = page1.body as { orders: Array<{ id: string }>; offset: number };
  const b2 = page2.body as { orders: Array<{ id: string }>; offset: number };
  assert.equal(b1.offset, 0);
  assert.equal(b2.offset, 2);

  const ids1 = new Set(b1.orders.map((o) => o.id));
  for (const o of b2.orders) assert.ok(!ids1.has(o.id));
});

test('GET /api/orders/search returns 401 without merchant header', async () => {
  const res = await request(server, '/api/orders/search');
  assert.equal(res.status, 401);
});

test('GET /api/orders/search returns 400 for invalid type', async () => {
  const res = await request(server, '/api/orders/search?type=gift', { headers: HEADERS });
  assert.equal(res.status, 400);
});

test('GET /api/orders/search returns 400 for invalid date format', async () => {
  const res = await request(server, '/api/orders/search?from=not-a-date', { headers: HEADERS });
  assert.equal(res.status, 400);
});

test('GET /api/orders/search returns 400 for inverted date range', async () => {
  const res = await request(
    server,
    '/api/orders/search?from=2024-12-01&to=2024-01-01',
    { headers: HEADERS },
  );
  assert.equal(res.status, 400);
});

test('GET /api/orders/search returns 400 for inverted amount range', async () => {
  const res = await request(
    server,
    '/api/orders/search?minAmount=9000&maxAmount=100',
    { headers: HEADERS },
  );
  assert.equal(res.status, 400);
});

test('route teardown', async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});
