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

/**
 * Rich filter bag for the order-search use-case (Feature C).
 * Every field is optional; omitted fields are not applied as filters.
 */
export interface OrderSearchFilters {
  /** Match orders whose customer_email equals this value (case-insensitive). */
  email?: string;
  /** Match orders with this status (e.g. 'completed', 'pending'). */
  status?: string;
  /** Match orders of this type ('sale' or 'refund'). */
  type?: OrderType;
  /** ISO date string lower bound (YYYY-MM-DD), inclusive. */
  from?: string;
  /** ISO date string upper bound (YYYY-MM-DD), exclusive. */
  to?: string;
  /** Minimum total_amount (inclusive), in cents. */
  minAmount?: number;
  /** Maximum total_amount (inclusive), in cents. */
  maxAmount?: number;
  /** Maximum number of rows to return; defaults to 50, clamped to 500. */
  limit?: number;
  /** Offset for pagination; defaults to 0. */
  offset?: number;
}

/** Paginated result wrapper for the search use-case. */
export interface OrderSearchResult {
  orders: OrderRow[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
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
