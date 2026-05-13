// DB_PATH is set before any module that touches the DB is imported.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';

test('config.dbPath reads DB_PATH env var', () => {
  // The test runner sets DB_PATH=:memory: via cross-env in package.json
  assert.equal(config.dbPath, ':memory:');
});

test('config.port defaults to 3000 when PORT is not set', () => {
  // PORT is not set by the test runner, so it falls back to 3000
  assert.equal(config.port, 3000);
});

test('config.port is a number', () => {
  assert.equal(typeof config.port, 'number');
});
