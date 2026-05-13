import { db } from '../db.js';
import type {
  OrderRow,
  CreateOrderInput,
  OrderFilters,
  MetricsSummary,
  TopCustomerRow,
} from '../domain/order/order.types.js';

// Re-export domain types so existing importers of orders-dal.ts keep working
// without update (backwards-compatible re-export).
export type {
  OrderRow,
  CreateOrderInput,
  OrderFilters,
  MetricsSummary,
  TopCustomerRow,
} from '../domain/order/order.types.js';

/**
 * Data-access layer for orders. All order queries should go through here.
 *
 * - centralized place for query patterns
 * - the place to add auditing, caching, tenancy filters
 * - the seam for swapping the underlying store
 */
export const ordersDal = {
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
   * Sum total_amount for sales-only orders over a date range for a merchant.
   * Excludes refunds so the figure reflects actual earned revenue.
   * Used by the revenue endpoint.
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
   * AVG is computed over sales only (type = 'sale') to match revenue logic.
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
