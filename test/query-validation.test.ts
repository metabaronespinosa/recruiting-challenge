// Set DB_PATH before importing any module that opens the DB.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidDate, clampLimit } from '../src/routes/query-validation.js';
import express from 'express';
import http from 'node:http';
import { initSchema, db } from '../src/db.js';
import { authMiddleware } from '../src/auth.js';
import { ordersRouter } from '../src/routes/orders.js';
import { revenueRouter } from '../src/routes/revenue.js';

// ---------------------------------------------------------------------------
// Unit tests for isValidDate
// ---------------------------------------------------------------------------
test('H-3: isValidDate accepts a valid YYYY-MM-DD date', () => {
  assert.equal(isValidDate('2024-06-15'), true);
});

test('H-3: isValidDate rejects a datetime string', () => {
  assert.equal(isValidDate('2024-06-15T00:00:00.000Z'), false);
});

test('H-3: isValidDate rejects an invalid month', () => {
  assert.equal(isValidDate('2024-13-01'), false);
});

test('H-3: isValidDate rejects an invalid day', () => {
  assert.equal(isValidDate('2024-06-32'), false);
});

test('H-3: isValidDate rejects a free-form string', () => {
  assert.equal(isValidDate('not-a-date'), false);
});

// ---------------------------------------------------------------------------
// Unit tests for clampLimit
// ---------------------------------------------------------------------------
test('H-3: clampLimit clamps to 500 maximum', () => {
  assert.equal(clampLimit(9999999), 500);
});

test('H-3: clampLimit returns the value when within bounds', () => {
  assert.equal(clampLimit(50), 50);
});

test('H-3: clampLimit clamps non-positive values to 1', () => {
  assert.equal(clampLimit(0), 1);
  assert.equal(clampLimit(-5), 1);
});

test('H-3: clampLimit clamps non-finite values to 1', () => {
  assert.equal(clampLimit(Infinity), 1);
  assert.equal(clampLimit(NaN), 1);
});

// ---------------------------------------------------------------------------
// Integration tests via in-process HTTP server
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use('/api/orders', authMiddleware, ordersRouter);
app.use('/api/revenue', authMiddleware, revenueRouter);

initSchema();
db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_qv_test', 'QV Test')`).run();

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
const H = { 'X-Merchant-Id': 'm_qv_test' };

test('H-3 integration setup', async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
});

test('H-3: GET /api/orders rejects invalid from date', async () => {
  const res = await get(server, '/api/orders?from=not-a-date&to=2024-12-31', { headers: H });
  assert.equal(res.status, 400);
  assert.match((res.body as { detail: string }).detail, /from/);
});

test('H-3: GET /api/orders rejects invalid to date', async () => {
  const res = await get(server, '/api/orders?from=2024-01-01&to=bad', { headers: H });
  assert.equal(res.status, 400);
  assert.match((res.body as { detail: string }).detail, /to/);
});

test('H-3: GET /api/orders rejects inverted range', async () => {
  const res = await get(server, '/api/orders?from=2024-12-31&to=2024-01-01', { headers: H });
  assert.equal(res.status, 400);
  assert.match((res.body as { detail: string }).detail, /after/);
});

test('H-3: GET /api/orders clamps limit=9999999 and returns 200', async () => {
  const res = await get(server, '/api/orders?limit=9999999', { headers: H });
  assert.equal(res.status, 200);
});

test('H-3: GET /api/revenue rejects invalid from date', async () => {
  const res = await get(server, '/api/revenue?from=2024-13-01&to=2024-12-31', { headers: H });
  assert.equal(res.status, 400);
  assert.match((res.body as { detail: string }).detail, /from/);
});

test('H-3: GET /api/revenue rejects inverted range', async () => {
  const res = await get(server, '/api/revenue?from=2024-12-31&to=2024-01-01', { headers: H });
  assert.equal(res.status, 400);
  assert.match((res.body as { detail: string }).detail, /after/);
});

test('H-3 integration teardown', async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});
