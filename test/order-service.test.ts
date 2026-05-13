// Set DB_PATH before importing any module that opens the DB.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initSchema, db } from '../src/db.js';
import { ordersDal } from '../src/dal/orders-dal.js';
import { createOrderService } from '../src/domain/order/order.service.js';
import { NotFoundError, ValidationError } from '../src/lib/errors.js';

// ---------------------------------------------------------------------------
// Seed shared test fixtures
// ---------------------------------------------------------------------------
initSchema();
db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_svc', 'Service Test')`).run();

const service = createOrderService(ordersDal);

// Seed a known sale order for get/list assertions
db.prepare(
  `INSERT OR IGNORE INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
   VALUES ('svc-s1', 'm_svc', 'alice@example.com', 4000, 'sale', 'completed', '2024-06-01T00:00:00.000Z')`,
).run();

// Seed a refund to verify revenue exclusion
db.prepare(
  `INSERT OR IGNORE INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
   VALUES ('svc-r1', 'm_svc', 'alice@example.com', 1000, 'refund', 'completed', '2024-06-02T00:00:00.000Z')`,
).run();

// ---------------------------------------------------------------------------
// listOrders
// ---------------------------------------------------------------------------
test('service.listOrders returns orders for the merchant', () => {
  const orders = service.listOrders('m_svc');
  assert.ok(orders.length >= 1);
  assert.ok(orders.every((o) => o.merchant_id === 'm_svc'));
});

test('service.listOrders returns empty array for unknown merchant', () => {
  const orders = service.listOrders('m_nobody');
  assert.equal(orders.length, 0);
});

// ---------------------------------------------------------------------------
// getOrder
// ---------------------------------------------------------------------------
test('service.getOrder returns the order for the correct merchant', () => {
  const order = service.getOrder('svc-s1', 'm_svc');
  assert.equal(order.id, 'svc-s1');
  assert.equal(order.total_amount, 4000);
});

test('service.getOrder throws NotFoundError for wrong merchant (IDOR guard)', () => {
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_svc_other', 'Other')`).run();
  assert.throws(
    () => service.getOrder('svc-s1', 'm_svc_other'),
    (err) => err instanceof NotFoundError,
  );
});

test('service.getOrder throws NotFoundError for non-existent order', () => {
  assert.throws(
    () => service.getOrder('does-not-exist', 'm_svc'),
    (err) => err instanceof NotFoundError,
  );
});

// ---------------------------------------------------------------------------
// createOrder
// ---------------------------------------------------------------------------
test('service.createOrder creates an order with valid input', () => {
  const order = service.createOrder('m_svc', {
    customer_email: 'new@example.com',
    total_amount: 3000,
    type: 'sale',
  });
  assert.equal(order.merchant_id, 'm_svc');
  assert.equal(order.total_amount, 3000);
  assert.equal(order.type, 'sale');
});

test('service.createOrder defaults type to sale', () => {
  const order = service.createOrder('m_svc', {
    customer_email: 'default@example.com',
    total_amount: 100,
  });
  assert.equal(order.type, 'sale');
});

test('service.createOrder throws ValidationError for invalid email', () => {
  assert.throws(
    () => service.createOrder('m_svc', { customer_email: 'not-an-email', total_amount: 100 }),
    (err) => err instanceof ValidationError,
  );
});

test('service.createOrder throws ValidationError for negative total_amount', () => {
  assert.throws(
    () => service.createOrder('m_svc', { customer_email: 'a@b.com', total_amount: -1 }),
    (err) => err instanceof ValidationError,
  );
});

test('service.createOrder throws ValidationError for non-finite total_amount', () => {
  assert.throws(
    () => service.createOrder('m_svc', { customer_email: 'a@b.com', total_amount: Infinity }),
    (err) => err instanceof ValidationError,
  );
});

test('service.createOrder throws ValidationError for invalid type', () => {
  assert.throws(
    () => service.createOrder('m_svc', { customer_email: 'a@b.com', total_amount: 100, type: 'gift' }),
    (err) => err instanceof ValidationError,
  );
});

// ---------------------------------------------------------------------------
// getRevenue
// ---------------------------------------------------------------------------
test('service.getRevenue returns revenue_cents and revenue fields', () => {
  const result = service.getRevenue('m_svc', '2024-01-01', '2025-01-01');
  assert.equal(result.merchant_id, 'm_svc');
  assert.equal(typeof result.revenue_cents, 'number');
  assert.equal(typeof result.revenue, 'number');
  // revenue is revenue_cents / 100
  assert.equal(result.revenue, result.revenue_cents / 100);
  // svc-s1 sale of 4000 should be included; svc-r1 refund excluded
  assert.ok(result.revenue_cents >= 4000);
});

// ---------------------------------------------------------------------------
// getMetricsSummary
// ---------------------------------------------------------------------------
test('service.getMetricsSummary returns shaped summary', () => {
  const summary = service.getMetricsSummary('m_svc');
  assert.equal(typeof summary.total_orders, 'number');
  assert.equal(typeof summary.unique_customers, 'number');
  assert.equal(typeof summary.avg_order_value_cents, 'number');
});

// ---------------------------------------------------------------------------
// getTopCustomers
// ---------------------------------------------------------------------------
test('service.getTopCustomers respects the limit', () => {
  const customers = service.getTopCustomers('m_svc', 1);
  assert.ok(customers.length <= 1);
});
