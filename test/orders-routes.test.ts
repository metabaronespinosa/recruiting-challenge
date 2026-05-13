// Set DB_PATH before importing any module that opens the DB.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { initSchema, db } from '../src/db.js';
import { authMiddleware } from '../src/auth.js';
import { ordersRouter } from '../src/routes/orders.js';

// ---------------------------------------------------------------------------
// Build a minimal in-process Express app for integration tests
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use('/api/orders', authMiddleware, ordersRouter);

// Seed a merchant used by every test
initSchema();
db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_route_test', 'Route Test')`).run();

// ---------------------------------------------------------------------------
// Lightweight HTTP helper (no external libs)
// ---------------------------------------------------------------------------
import http from 'node:http';

type ReqOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

function request(
  server: http.Server,
  path: string,
  opts: ReqOptions = {},
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const data = opts.body ? JSON.stringify(opts.body) : undefined;
    const req = http.request(
      {
        socketPath: undefined,
        host: '127.0.0.1',
        port: (server.address() as { port: number }).port,
        path,
        method: opts.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data).toString() } : {}),
          ...opts.headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: raw });
          }
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Start/stop the server around the tests
// ---------------------------------------------------------------------------
let server: http.Server;

test('setup', async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
});

const MERCHANT_HEADERS = { 'X-Merchant-Id': 'm_route_test' };

// --- POST /api/orders validation (C-4) ---

test('C-4: POST /api/orders rejects missing body fields', async () => {
  const res = await request(server, '/api/orders', {
    method: 'POST',
    headers: MERCHANT_HEADERS,
    body: {},
  });
  assert.equal(res.status, 400);
});

test('C-4: POST /api/orders rejects invalid email', async () => {
  const res = await request(server, '/api/orders', {
    method: 'POST',
    headers: MERCHANT_HEADERS,
    body: { customer_email: 'not-an-email', total_amount: 1000 },
  });
  assert.equal(res.status, 400);
  assert.match((res.body as { detail: string }).detail, /email/);
});

test('C-4: POST /api/orders rejects negative total_amount', async () => {
  const res = await request(server, '/api/orders', {
    method: 'POST',
    headers: MERCHANT_HEADERS,
    body: { customer_email: 'a@b.com', total_amount: -1 },
  });
  assert.equal(res.status, 400);
  assert.match((res.body as { detail: string }).detail, /non-negative/);
});

test('C-4: POST /api/orders rejects NaN total_amount', async () => {
  // JSON.parse("NaN") is not valid JSON, so we send a string which fails the typeof check
  const res = await request(server, '/api/orders', {
    method: 'POST',
    headers: MERCHANT_HEADERS,
    body: { customer_email: 'a@b.com', total_amount: 'NaN' },
  });
  assert.equal(res.status, 400);
});

test('C-4: POST /api/orders rejects unknown type', async () => {
  const res = await request(server, '/api/orders', {
    method: 'POST',
    headers: MERCHANT_HEADERS,
    body: { customer_email: 'a@b.com', total_amount: 500, type: 'gift' },
  });
  assert.equal(res.status, 400);
  assert.match((res.body as { detail: string }).detail, /type/);
});

test('C-4: POST /api/orders succeeds with valid payload', async () => {
  const res = await request(server, '/api/orders', {
    method: 'POST',
    headers: MERCHANT_HEADERS,
    body: { customer_email: 'valid@example.com', total_amount: 2500, type: 'sale' },
  });
  assert.equal(res.status, 201);
  const order = (res.body as { order: { merchant_id: string; total_amount: number } }).order;
  assert.equal(order.merchant_id, 'm_route_test');
  assert.equal(order.total_amount, 2500);
});

test('teardown', async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});
