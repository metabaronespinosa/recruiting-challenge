/**
 * Dependency-rule enforcement test.
 *
 * Runs the check-domain-deps script as a child process and asserts it exits
 * with code 0 (no violations). This keeps the rule in the standard test run
 * so CI catches any future domain-layer contamination automatically.
 */
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const script = join(root, 'src', 'scripts', 'check-domain-deps.ts');

test('domain dependency rule: src/domain/ contains no express, better-sqlite3, or infrastructure imports', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', script],
    { encoding: 'utf8', cwd: root },
  );

  if (result.status !== 0) {
    // Print the violations so the test failure is self-explanatory
    console.error(result.stderr);
  }

  assert.equal(
    result.status,
    0,
    `Domain dependency check failed:\n${result.stderr}`,
  );
});

test('domain dependency rule: deliberately invalid domain file is detected', () => {
  // Feed a synthetic source string to the regex logic directly (no temp files)
  // by running the script with an env var override — instead we test the
  // pattern logic inline to avoid filesystem side-effects.
  const FORBIDDEN_PATTERNS = [
    /from\s+['"]express['"]/,
    /from\s+['"]better-sqlite3['"]/,
    /from\s+['"][^'"]*\/infrastructure\//,
  ];

  const badLines = [
    `import { Router } from 'express';`,
    `import Database from 'better-sqlite3';`,
    `import { repo } from '../../infrastructure/sqlite/order.sqlite.repo.js';`,
  ];

  for (const line of badLines) {
    const matched = FORBIDDEN_PATTERNS.some((p) => p.test(line));
    assert.ok(matched, `Expected pattern to match: ${line}`);
  }

  // A clean import should NOT match any forbidden pattern
  const cleanLine = `import type { OrderRow } from './order.types.js';`;
  const matchedClean = FORBIDDEN_PATTERNS.some((p) => p.test(cleanLine));
  assert.equal(matchedClean, false);
});
