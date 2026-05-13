/**
 * Single validated config module.
 *
 * All process.env reads are centralised here. Every other file imports
 * from this module instead of touching process.env directly, which
 * eliminates duplication and provides one place to add validation.
 */

export const config = {
  /**
   * Absolute or relative path to the SQLite database file.
   * Defaults to 'data/dashboard.db'. Use ':memory:' in tests.
   */
  dbPath: process.env.DB_PATH ?? 'data/dashboard.db',

  /**
   * Port the HTTP server listens on. Defaults to 3000.
   */
  port: Number(process.env.PORT ?? 3000),
} as const;
