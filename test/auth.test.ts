// Set DB_PATH before importing any module that opens the DB.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initSchema, db } from '../src/db.js';
import { authMiddleware } from '../src/auth.js';
import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Helpers to build minimal mock req / res objects
// ---------------------------------------------------------------------------
function makeReq(merchantId?: string): Partial<Request> {
  return {
    header: (name: string) => (name === 'X-Merchant-Id' ? merchantId : undefined),
  } as unknown as Partial<Request>;
}

function makeRes() {
  const res = {
    _status: 0,
    _body: {} as unknown,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
  };
  return res;
}

// ---------------------------------------------------------------------------
// Seed a known merchant once
// ---------------------------------------------------------------------------
initSchema();
db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_auth_test', 'Auth Test')`).run();

test('C-2: authMiddleware rejects request with no X-Merchant-Id header', () => {
  const req = makeReq(undefined);
  const res = makeRes();
  let called = false;
  const next: NextFunction = () => { called = true; };

  authMiddleware(req as Request, res as unknown as Response, next);

  assert.equal(res._status, 401);
  assert.deepEqual(res._body, { error: 'missing_merchant_id' });
  assert.equal(called, false);
});

test('C-2: authMiddleware rejects request with an unknown merchantId', () => {
  const req = makeReq('m_does_not_exist');
  const res = makeRes();
  let called = false;
  const next: NextFunction = () => { called = true; };

  authMiddleware(req as Request, res as unknown as Response, next);

  assert.equal(res._status, 401);
  assert.deepEqual(res._body, { error: 'unknown_merchant' });
  assert.equal(called, false);
});

test('C-2: authMiddleware passes through for a valid merchantId', () => {
  const req = makeReq('m_auth_test') as Request;
  const res = makeRes();
  let called = false;
  const next: NextFunction = () => { called = true; };

  authMiddleware(req, res as unknown as Response, next);

  assert.equal(called, true);
  assert.equal(req.merchantId, 'm_auth_test');
});
