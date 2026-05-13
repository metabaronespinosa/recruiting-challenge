#!/usr/bin/env tsx
/**
 * Dependency-rule enforcement script.
 *
 * Audits every TypeScript file under src/domain/ and asserts that none of
 * them contain imports from:
 *   - 'express'          (HTTP infrastructure)
 *   - 'better-sqlite3'   (SQLite infrastructure)
 *   - 'src/infrastructure'  (concrete adapters — domain must not depend on these)
 *
 * The domain layer is only allowed to import from:
 *   - Node built-ins (node:*)
 *   - Other files within src/domain/ itself
 *   - src/lib/errors.ts  (typed error hierarchy — infrastructure-free)
 *   - src/config.ts      (read-only config values — no I/O)
 *
 * Usage:
 *   npm run check:domain-deps
 *
 * Exit code:
 *   0  — no violations found
 *   1  — at least one violation found (printed to stderr)
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Patterns that are forbidden inside any src/domain/** file. */
const FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "'express' import",
    pattern: /from\s+['"]express['"]/,
  },
  {
    label: "'better-sqlite3' import",
    pattern: /from\s+['"]better-sqlite3['"]/,
  },
  {
    label: "src/infrastructure import",
    // matches relative paths that traverse into infrastructure:
    //   ../../infrastructure/...  or  ../infrastructure/...  etc.
    pattern: /from\s+['"][^'"]*\/infrastructure\//,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectTs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectTs(full));
    } else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const root = fileURLToPath(new URL('../../', import.meta.url));
const domainDir = join(root, 'src', 'domain');

const files = collectTs(domainDir);

let violations = 0;

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const rel = relative(root, file);

  for (const { label, pattern } of FORBIDDEN) {
    const lines = source.split('\n');
    lines.forEach((line, idx) => {
      if (pattern.test(line)) {
        console.error(`VIOLATION  ${rel}:${idx + 1}  — forbidden ${label}`);
        console.error(`           ${line.trim()}`);
        violations++;
      }
    });
  }
}

if (violations === 0) {
  console.log(`✓  domain dependency check passed (${files.length} files scanned)`);
  process.exit(0);
} else {
  console.error(`\n✗  ${violations} violation(s) found in src/domain/ — fix before committing.`);
  process.exit(1);
}
