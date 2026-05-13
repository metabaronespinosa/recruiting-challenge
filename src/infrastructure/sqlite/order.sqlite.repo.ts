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
};
