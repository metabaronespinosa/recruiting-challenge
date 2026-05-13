// Set DB_PATH before importing the db module — the connection is created on import.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initSchema, db } from '../src/db.js';
import { ordersDal } from '../src/dal/orders-dal.js';

test('orders DAL: create + listByMerchant returns the order', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_test', 'Test')`).run();
  const created = ordersDal.create({
    id: 'o1',
    merchant_id: 'm_test',
    customer_email: 'a@b.com',
    total_amount: 5000,
    type: 'sale',
    status: 'completed',
  });
  assert.equal(created.id, 'o1');
  const list = ordersDal.listByMerchant('m_test');
  assert.equal(list.length, 1);
  assert.equal(list[0]!.total_amount, 5000);
});

test('orders DAL: getById returns the order for the correct merchant', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_test', 'Test')`).run();
  ordersDal.create({
    id: 'o2',
    merchant_id: 'm_test',
    customer_email: 'c@d.com',
    total_amount: 1200,
    type: 'sale',
    status: 'completed',
  });
  const got = ordersDal.getById('o2', 'm_test');
  assert.equal(got?.total_amount, 1200);
});

test('C-3: sumAmountByMerchant excludes refund rows from revenue', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_revenue', 'Revenue Test')`).run();

  const from = '2024-01-01T00:00:00.000Z';
  const to   = '2024-12-31T23:59:59.999Z';

  // Insert two sales and one refund
  db.prepare(
    `INSERT OR IGNORE INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
     VALUES (?, 'm_revenue', 'a@b.com', 3000, 'sale',   'completed', '2024-06-01T00:00:00.000Z')`,
  ).run('rev-s1');
  db.prepare(
    `INSERT OR IGNORE INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
     VALUES (?, 'm_revenue', 'a@b.com', 2000, 'sale',   'completed', '2024-06-02T00:00:00.000Z')`,
  ).run('rev-s2');
  db.prepare(
    `INSERT OR IGNORE INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
     VALUES (?, 'm_revenue', 'a@b.com', 1000, 'refund', 'completed', '2024-06-03T00:00:00.000Z')`,
  ).run('rev-r1');

  const total = ordersDal.sumAmountByMerchant('m_revenue', from, to);
  // Only the two sales should be summed (3000 + 2000 = 5000), refund excluded
  assert.equal(total, 5000);
});

test('C-1: getById returns undefined when merchantId does not match (IDOR fix)', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_test', 'Test')`).run();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_other', 'Other')`).run();
  ordersDal.create({
    id: 'o3',
    merchant_id: 'm_test',
    customer_email: 'x@y.com',
    total_amount: 9999,
    type: 'sale',
    status: 'completed',
  });
  // A different merchant must NOT be able to fetch this order
  const stolen = ordersDal.getById('o3', 'm_other');
  assert.equal(stolen, undefined);
  // The owning merchant CAN fetch it
  const owned = ordersDal.getById('o3', 'm_test');
  assert.equal(owned?.total_amount, 9999);
});
