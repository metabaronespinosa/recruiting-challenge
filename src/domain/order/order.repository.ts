/**
 * Repository port for the Order aggregate.
 *
 * This interface is the only thing the domain layer knows about persistence.
 * Concrete implementations (SQLite, in-memory, HTTP, …) live in
 * src/infrastructure/ and are injected at application startup.
 *
 * No infrastructure imports (express, better-sqlite3) are allowed here.
 */

import type {
  OrderRow,
  CreateOrderInput,
  OrderFilters,
  OrderSearchFilters,
  OrderSearchResult,
  MetricsSummary,
  TopCustomerRow,
} from './order.types.js';

export interface IOrderRepository {
  /**
   * Return all orders belonging to a merchant, newest first.
   * Optional filters narrow the result set.
   */
  listByMerchant(merchantId: string, filters?: OrderFilters): OrderRow[];

  /**
   * Return a single order by its ID, scoped to the merchant.
   * Returns undefined if the order does not exist or belongs to a different merchant.
   */
  getById(id: string, merchantId: string): OrderRow | undefined;

  /**
   * Persist a new order and return the saved record.
   */
  create(order: CreateOrderInput): OrderRow;

  /**
   * Sum the total_amount of sale-type orders for a merchant within a date range.
   * Refunds must be excluded so the figure reflects earned revenue.
   */
  sumAmountByMerchant(merchantId: string, from: string, to: string): number;

  /**
   * Return aggregated summary metrics (total orders, unique customers, avg order value)
   * for the merchant dashboard.
   */
  getMetricsSummary(merchantId: string): MetricsSummary;

  /**
   * Return top customers ranked by total amount spent (descending).
   */
  getTopCustomers(merchantId: string, limit: number): TopCustomerRow[];

  /**
   * Search orders for a merchant using rich filter criteria.
   * Returns a paginated result that includes a total count for building
   * pagination UI without a separate count request.
   */
  searchOrders(merchantId: string, filters: OrderSearchFilters): OrderSearchResult;
}
