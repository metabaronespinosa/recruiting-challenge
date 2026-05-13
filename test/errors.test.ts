if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError, NotFoundError, ValidationError, AuthError } from '../src/lib/errors.js';

test('NotFoundError has correct statusCode and code', () => {
  const err = new NotFoundError();
  assert.equal(err.statusCode, 404);
  assert.equal(err.code, 'not_found');
  assert.ok(err instanceof AppError);
});

test('ValidationError carries detail and correct statusCode', () => {
  const err = new ValidationError('bad input', 'field x is wrong');
  assert.equal(err.statusCode, 400);
  assert.equal(err.code, 'validation_error');
  assert.equal(err.detail, 'field x is wrong');
  assert.ok(err instanceof AppError);
});

test('AuthError carries authCode as error code', () => {
  const err = new AuthError('not allowed', 'unknown_merchant');
  assert.equal(err.statusCode, 401);
  assert.equal(err.code, 'unknown_merchant');
  assert.ok(err instanceof AppError);
});

test('global error handler surfaces AppError status and code', async () => {
  // Simulate what the Express error handler does
  const err = new NotFoundError('order not found');
  const response = err instanceof AppError
    ? { status: err.statusCode, body: { error: err.code, detail: err.message } }
    : { status: 500, body: { error: 'internal_error' } };
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: 'not_found', detail: 'order not found' });
});
