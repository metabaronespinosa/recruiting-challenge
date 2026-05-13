/**
 * Shared query-parameter validation helpers used by orders and revenue routes.
 */

const DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/** Returns true only for strings matching YYYY-MM-DD with a plausible month/day. */
export function isValidDate(value: string): boolean {
  return DATE_RE.test(value);
}

const LIMIT_MAX = 500;

/**
 * Clamps a raw limit value to [1, LIMIT_MAX].
 * Non-positive or non-finite values are clamped to 1.
 */
export function clampLimit(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(value, LIMIT_MAX);
}
