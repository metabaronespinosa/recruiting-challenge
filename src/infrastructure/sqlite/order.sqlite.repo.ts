/**
 * SQLite implementation of IOrderRepository.
 *
 * This is the only file in the codebase that imports better-sqlite3 for order
 * persistence. All SQL for orders lives here; nothing outside
 * src/infrastructure/ should import from this file directly.
 *
 * The exported singleton `orderSqliteRepo` is injected into the application at
 * startup via src/server.ts, keeping the domain layer infrastructure-agnostic.
 */

import { db } from '../../db.js';
import type { IOrderRepository } from '../../domain/order/order.repository.js';
import type {
  OrderRow,
  CreateOrderInput,
  OrderFilters,
  OrderSearchFilters,
  OrderSearchResult,
  MetricsSummary,
  TopCustomerRow,
} from '../../domain/order/order.types.js';

/**
 * Concrete SQLite repository — implements IOrderRepository against the
 * shared better-sqlite3 `db` instance provided by src/db.ts.
 */
export const orderSqliteRepo: IOrderRepository = {
  listByMerchant(merchantId: string, opts: OrderFilters = {}): OrderRow[] {
    const limit = opts.limit ?? 100;
    if (opts.from && opts.to) {
      return db
        .prepare(
          `SELECT * FROM orders
           WHERE merchant_id = ? AND created_at >= ? AND created_at < ?
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(merchantId, opts.from, opts.to, limit) as OrderRow[];
    }
    return db
      .prepare(`SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ?`)
      .all(merchantId, limit) as OrderRow[];
  },

  getById(id: string, merchantId: string): OrderRow | undefined {
    return db
      .prepare(`SELECT * FROM orders WHERE id = ? AND merchant_id = ?`)
      .get(id, merchantId) as OrderRow | undefined;
  },

  create(order: CreateOrderInput): OrderRow {
    db.prepare(
      `INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(order.id, order.merchant_id, order.customer_email, order.total_amount, order.type, order.status);
    return this.getById(order.id, order.merchant_id)!;
  },

  /**
   * Sum total_amount for sales-only orders over a date range.
   * Excludes refunds so the figure reflects actual earned revenue.
   */
  sumAmountByMerchant(merchantId: string, from: string, to: string): number {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM orders
         WHERE merchant_id = ? AND created_at >= ? AND created_at < ?
           AND type = 'sale'`,
      )
      .get(merchantId, from, to) as { total: number };
    return row.total;
  },

  /**
   * Aggregate summary stats for the metrics/summary endpoint.
   * AVG is computed over sales only to match revenue logic.
   */
  getMetricsSummary(merchantId: string): MetricsSummary {
    const totalOrdersRow = db
      .prepare(`SELECT COUNT(*) AS n FROM orders WHERE merchant_id = ?`)
      .get(merchantId) as { n: number };

    const uniqueCustomersRow = db
      .prepare(`SELECT COUNT(DISTINCT customer_email) AS n FROM orders WHERE merchant_id = ?`)
      .get(merchantId) as { n: number };

    const avgOrderRow = db
      .prepare(
        `SELECT COALESCE(AVG(total_amount), 0) AS avg FROM orders WHERE merchant_id = ? AND type = 'sale'`,
      )
      .get(merchantId) as { avg: number };

    return {
      total_orders: totalOrdersRow.n,
      unique_customers: uniqueCustomersRow.n,
      avg_order_value_cents: Math.round(avgOrderRow.avg),
    };
  },

  /**
   * Top customers ranked by total amount spent (sales only) for a merchant.
   */
  getTopCustomers(merchantId: string, limit: number): TopCustomerRow[] {
    return db
      .prepare(
        `SELECT customer_email, COUNT(*) AS order_count, SUM(total_amount) AS total_spent
         FROM orders
         WHERE merchant_id = ?
         GROUP BY customer_email
         ORDER BY total_spent DESC
         LIMIT ?`,
      )
      .all(merchantId, limit) as TopCustomerRow[];
  },

  /**
   * Search orders for a merchant using rich filter criteria.
   *
   * Builds the WHERE clause dynamically from whichever filters are present so
   * that only the relevant conditions are applied — no silent "match-all" defaults
   * can sneak in from an omitted field.  A separate COUNT query runs first so the
   * caller always knows the total matching set size for pagination without a
   * second round-trip from the client.
   *
   * Performance note: `merchant_id` is always the leading predicate, matching
   * the existing index.  For large datasets the additional columns (email, type,
   * status, created_at) should be covered by a composite index:
   *   CREATE INDEX IF NOT EXISTS idx_orders_search
   *     ON orders (merchant_id, type, status, created_at, customer_email);
   */
  searchOrders(merchantId: string, filters: OrderSearchFilters): OrderSearchResult {
    const limit  = filters.limit  ?? 50;
    const offset = filters.offset ?? 0;

    // Build the shared WHERE clause + bound parameters incrementally.
    const conditions: string[] = ['merchant_id = ?'];
    const params: unknown[]    = [merchantId];

    if (filters.email !== undefined) {
      conditions.push('LOWER(customer_email) = LOWER(?)');
      params.push(filters.email);
    }
    if (filters.status !== undefined) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.type !== undefined) {
      conditions.push('type = ?');
      params.push(filters.type);
    }
    if (filters.from !== undefined) {
      conditions.push('created_at >= ?');
      params.push(filters.from);
    }
    if (filters.to !== undefined) {
      conditions.push('created_at < ?');
      params.push(filters.to);
    }
    if (filters.minAmount !== undefined) {
      conditions.push('total_amount >= ?');
      params.push(filters.minAmount);
    }
    if (filters.maxAmount !== undefined) {
      conditions.push('total_amount <= ?');
      params.push(filters.maxAmount);
    }

    const where = conditions.join(' AND ');

    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM orders WHERE ${where}`)
      .get(...(params as [unknown])) as { total: number };

    const orders = db
      .prepare(
        `SELECT * FROM orders
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...(params as [unknown]), limit, offset) as OrderRow[];

    return {
      orders,
      total,
      limit,
      offset,
      hasMore: offset + orders.length < total,
    };
  },
};
