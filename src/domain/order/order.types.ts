/**
 * Domain types for the Order aggregate.
 *
 * This file owns the authoritative shape of an order in the system.
 * No infrastructure imports (express, better-sqlite3) are allowed here.
 */

/** The two allowed order types, enforced at the domain boundary. */
export type OrderType = 'sale' | 'refund';

/** Raw order record as stored and retrieved from the database. */
export interface OrderRow {
  id: string;
  merchant_id: string;
  customer_email: string;
  total_amount: number;
  type: OrderType;
  status: string;
  created_at: string;
}

/** Payload required to create a new order (excludes DB-assigned created_at). */
export type CreateOrderInput = Omit<OrderRow, 'created_at'>;

/** Optional filters applied when listing orders for a merchant. */
export interface OrderFilters {
  /** ISO date string lower bound (YYYY-MM-DD), inclusive. */
  from?: string;
  /** ISO date string upper bound (YYYY-MM-DD), exclusive. */
  to?: string;
  /** Maximum number of rows to return; defaults to 100, clamped to 500. */
  limit?: number;
}

/** Summary metrics for the merchant dashboard. */
export interface MetricsSummary {
  total_orders: number;
  unique_customers: number;
  avg_order_value_cents: number;
}

/** A single entry in the top-customers ranking. */
export interface TopCustomerRow {
  customer_email: string;
  order_count: number;
  total_spent: number;
}
