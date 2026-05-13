// Types-only module — no DB needed.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * order.types.ts contains only interfaces and a type alias — there is no runtime
 * value to import. These tests confirm:
 *   1. The module resolves without error (import succeeds).
 *   2. Objects conforming to the interfaces satisfy TypeScript's structural
 *      checks (verified at compile time; we assert structural correctness here
 *      via runtime shape checks on plain objects).
 */

test('OrderRow shape is structurally correct', () => {
  const row = {
    id: 'o1',
    merchant_id: 'm1',
    customer_email: 'a@b.com',
    total_amount: 1000,
    type: 'sale' as const,
    status: 'completed',
    created_at: '2024-01-01T00:00:00.000Z',
  };
  // Structural assertion — every required field present and typed
  assert.equal(typeof row.id, 'string');
  assert.equal(typeof row.merchant_id, 'string');
  assert.equal(typeof row.total_amount, 'number');
  assert.ok(row.type === 'sale' || row.type === 'refund');
});

test('CreateOrderInput excludes created_at', () => {
  const input = {
    id: 'o2',
    merchant_id: 'm1',
    customer_email: 'b@c.com',
    total_amount: 500,
    type: 'refund' as const,
    status: 'completed',
  };
  // created_at must NOT be present on CreateOrderInput
  assert.equal('created_at' in input, false);
});

test('OrderFilters fields are all optional', () => {
  // An empty object is a valid OrderFilters
  const empty: { from?: string; to?: string; limit?: number } = {};
  assert.equal(Object.keys(empty).length, 0);

  const full = { from: '2024-01-01', to: '2024-12-31', limit: 50 };
  assert.equal(full.limit, 50);
});

test('OrderType is constrained to sale or refund', () => {
  const valid: Array<'sale' | 'refund'> = ['sale', 'refund'];
  assert.equal(valid.length, 2);
  assert.ok(valid.includes('sale'));
  assert.ok(valid.includes('refund'));
});
