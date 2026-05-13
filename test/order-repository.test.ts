// Set DB_PATH before importing any module that opens the DB.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

/**
 * Tests for the IOrderRepository contract as satisfied by orderSqliteRepo.
 *
 * These tests verify the concrete implementation against every method defined
 * in IOrderRepository, ensuring the interface and implementation stay in sync.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initSchema, db } from '../src/db.js';
import { orderSqliteRepo } from '../src/infrastructure/sqlite/order.sqlite.repo.js';
import type { IOrderRepository } from '../src/domain/order/order.repository.js';

// Ensure the concrete repo satisfies the interface at compile-time.
// If IOrderRepository changes and orderSqliteRepo is not updated, tsc fails.
const _repo: IOrderRepository = orderSqliteRepo;
void _repo; // suppress unused-variable warning

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
initSchema();
db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_repo', 'Repo Test')`).run();
db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_repo2', 'Repo Test 2')`).run();

// Pre-seed known orders
db.prepare(
  `INSERT OR IGNORE INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
   VALUES ('repo-s1', 'm_repo', 'alice@x.com', 5000, 'sale', 'completed', '2024-03-01T00:00:00.000Z')`,
).run();
db.prepare(
  `INSERT OR IGNORE INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
   VALUES ('repo-r1', 'm_repo', 'alice@x.com', 500, 'refund', 'completed', '2024-03-02T00:00:00.000Z')`,
).run();

// ---------------------------------------------------------------------------
// listByMerchant
// ---------------------------------------------------------------------------
test('repo: listByMerchant returns only own merchant orders', () => {
  const orders = orderSqliteRepo.listByMerchant('m_repo');
  assert.ok(orders.every((o) => o.merchant_id === 'm_repo'));
});

test('repo: listByMerchant respects date range filter', () => {
  const orders = orderSqliteRepo.listByMerchant('m_repo', {
    from: '2024-03-01',
    to: '2024-03-02',
  });
  assert.ok(orders.every((o) => o.created_at >= '2024-03-01'));
});

test('repo: listByMerchant respects limit', () => {
  const orders = orderSqliteRepo.listByMerchant('m_repo', { limit: 1 });
  assert.equal(orders.length, 1);
});

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------
test('repo: getById returns order for correct merchant', () => {
  const order = orderSqliteRepo.getById('repo-s1', 'm_repo');
  assert.equal(order?.id, 'repo-s1');
});

test('repo: getById returns undefined for wrong merchant (IDOR guard)', () => {
  const order = orderSqliteRepo.getById('repo-s1', 'm_repo2');
  assert.equal(order, undefined);
});

test('repo: getById returns undefined for non-existent id', () => {
  const order = orderSqliteRepo.getById('no-such-order', 'm_repo');
  assert.equal(order, undefined);
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------
test('repo: create persists and returns the new order', () => {
  const order = orderSqliteRepo.create({
    id: 'repo-new1',
    merchant_id: 'm_repo',
    customer_email: 'new@x.com',
    total_amount: 2500,
    type: 'sale',
    status: 'completed',
  });
  assert.equal(order.id, 'repo-new1');
  assert.equal(order.total_amount, 2500);
  // Verify it is readable back
  const fetched = orderSqliteRepo.getById('repo-new1', 'm_repo');
  assert.equal(fetched?.total_amount, 2500);
});

// ---------------------------------------------------------------------------
// sumAmountByMerchant
// ---------------------------------------------------------------------------
test('repo: sumAmountByMerchant includes sales and excludes refunds', () => {
  // Only look at the pre-seeded date range where we know the exact values:
  // repo-s1 = 5000 (sale, 2024-03-01), repo-r1 = 500 (refund, excluded)
  const total = orderSqliteRepo.sumAmountByMerchant('m_repo', '2024-03-01', '2024-04-01');
  assert.equal(total, 5000);
});

// ---------------------------------------------------------------------------
// getMetricsSummary
// ---------------------------------------------------------------------------
test('repo: getMetricsSummary returns correct shape', () => {
  const summary = orderSqliteRepo.getMetricsSummary('m_repo');
  assert.equal(typeof summary.total_orders, 'number');
  assert.equal(typeof summary.unique_customers, 'number');
  assert.equal(typeof summary.avg_order_value_cents, 'number');
  assert.ok(summary.total_orders >= 2);
});

test('repo: getMetricsSummary returns zeros for unknown merchant', () => {
  const summary = orderSqliteRepo.getMetricsSummary('m_nobody');
  assert.equal(summary.total_orders, 0);
  assert.equal(summary.unique_customers, 0);
  assert.equal(summary.avg_order_value_cents, 0);
});

// ---------------------------------------------------------------------------
// getTopCustomers
// ---------------------------------------------------------------------------
test('repo: getTopCustomers respects limit', () => {
  const customers = orderSqliteRepo.getTopCustomers('m_repo', 1);
  assert.equal(customers.length, 1);
});

test('repo: getTopCustomers returns customer_email, order_count, total_spent', () => {
  const customers = orderSqliteRepo.getTopCustomers('m_repo', 5);
  assert.ok(customers.length >= 1);
  const first = customers[0]!;
  assert.equal(typeof first.customer_email, 'string');
  assert.equal(typeof first.order_count, 'number');
  assert.equal(typeof first.total_spent, 'number');
});
