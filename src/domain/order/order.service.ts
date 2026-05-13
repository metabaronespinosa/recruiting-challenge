/**
 * Order service — the domain use-case layer.
 *
 * All business logic (revenue calculation, order creation orchestration,
 * metrics aggregation) lives here. The service depends only on the
 * IOrderRepository abstraction; no Express or SQLite imports are allowed.
 *
 * Routes call the service; the service calls the repository.
 */

import { randomUUID } from 'node:crypto';
import type { IOrderRepository } from './order.repository.js';
import type {
  OrderRow,
  CreateOrderInput,
  OrderFilters,
  OrderSearchFilters,
  OrderSearchResult,
  MetricsSummary,
  TopCustomerRow,
  OrderType,
} from './order.types.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';

// ---------------------------------------------------------------------------
// Validation constants — domain rules, not HTTP rules
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_TYPES = new Set<OrderType>(['sale', 'refund']);

// ---------------------------------------------------------------------------
// Input shapes consumed by service methods
// ---------------------------------------------------------------------------

/** Raw fields from the HTTP body for creating an order. */
export interface CreateOrderBody {
  customer_email?: unknown;
  total_amount?: unknown;
  type?: unknown;
}

/** Raw query-string fields received by the search endpoint. */
export interface SearchOrdersQuery {
  email?: unknown;
  status?: unknown;
  type?: unknown;
  from?: unknown;
  to?: unknown;
  minAmount?: unknown;
  maxAmount?: unknown;
  limit?: unknown;
  offset?: unknown;
}

/** Result returned by the revenue query use-case. */
export interface RevenueResult {
  merchant_id: string;
  from: string;
  to: string;
  revenue_cents: number;
  revenue: number;
}

// ---------------------------------------------------------------------------
// Service factory — depends on the repository abstraction
// ---------------------------------------------------------------------------

/**
 * Creates an OrderService bound to the provided repository.
 * Using a factory (rather than a class) keeps the API functional and avoids
 * unnecessary `this` binding issues in tests.
 */
export function createOrderService(repo: IOrderRepository) {
  return {
    /**
     * List orders for a merchant, applying optional filters.
     * Pure delegation — filtering rules live in the repository.
     */
    listOrders(merchantId: string, filters: OrderFilters = {}): OrderRow[] {
      return repo.listByMerchant(merchantId, filters);
    },

    /**
     * Fetch a single order by ID, scoped to the merchant.
     * Throws NotFoundError if the order does not exist or belongs to another merchant.
     */
    getOrder(id: string, merchantId: string): OrderRow {
      const order = repo.getById(id, merchantId);
      if (!order) {
        throw new NotFoundError(`Order ${id} not found`);
      }
      return order;
    },

    /**
     * Validate and create an order for the merchant.
     * Business rules validated here:
     *   - customer_email must be a valid email address
     *   - total_amount must be a finite, non-negative number
     *   - type must be 'sale' or 'refund' (defaults to 'sale')
     */
    createOrder(merchantId: string, body: CreateOrderBody): OrderRow {
      if (typeof body.customer_email !== 'string' || !EMAIL_RE.test(body.customer_email)) {
        throw new ValidationError(
          'customer_email must be a valid email address',
          'invalid_body',
        );
      }

      if (
        typeof body.total_amount !== 'number' ||
        !Number.isFinite(body.total_amount) ||
        body.total_amount < 0
      ) {
        throw new ValidationError(
          'total_amount must be a non-negative finite number',
          'invalid_body',
        );
      }

      const rawType = body.type ?? 'sale';
      if (!VALID_TYPES.has(rawType as OrderType)) {
        throw new ValidationError('type must be sale or refund', 'invalid_body');
      }

      const input: CreateOrderInput = {
        id: randomUUID(),
        merchant_id: merchantId,
        customer_email: body.customer_email,
        total_amount: body.total_amount,
        type: rawType as OrderType,
        status: 'completed',
      };

      return repo.create(input);
    },

    /**
     * Calculate total revenue (sales only) for the merchant in the given range.
     * Revenue excludes refunds — that rule is enforced at the repository layer
     * and documented here at the service boundary.
     */
    getRevenue(merchantId: string, from: string, to: string): RevenueResult {
      const revenue_cents = repo.sumAmountByMerchant(merchantId, from, to);
      return {
        merchant_id: merchantId,
        from,
        to,
        revenue_cents,
        revenue: revenue_cents / 100,
      };
    },

    /**
     * Return aggregated dashboard metrics for the merchant.
     */
    getMetricsSummary(merchantId: string): MetricsSummary {
      return repo.getMetricsSummary(merchantId);
    },

    /**
     * Return top customers ranked by total spend for the merchant.
     */
    getTopCustomers(merchantId: string, limit: number): TopCustomerRow[] {
      return repo.getTopCustomers(merchantId, limit);
    },

    /**
     * Search orders for the merchant using rich filter criteria.
     *
     * Validates every parameter before delegating to the repository so the
     * persistence layer never receives malformed input.
     */
    searchOrders(merchantId: string, query: SearchOrdersQuery): OrderSearchResult {
      const filters: OrderSearchFilters = {};

      if (query.email !== undefined) {
        if (typeof query.email !== 'string' || !EMAIL_RE.test(query.email)) {
          throw new ValidationError('email must be a valid email address', 'invalid_query');
        }
        filters.email = query.email;
      }

      if (query.status !== undefined) {
        if (typeof query.status !== 'string' || query.status.trim() === '') {
          throw new ValidationError('status must be a non-empty string', 'invalid_query');
        }
        filters.status = query.status.trim();
      }

      if (query.type !== undefined) {
        if (!VALID_TYPES.has(query.type as OrderType)) {
          throw new ValidationError('type must be sale or refund', 'invalid_query');
        }
        filters.type = query.type as OrderType;
      }

      if (query.from !== undefined) {
        if (typeof query.from !== 'string') {
          throw new ValidationError('from must be a date string (YYYY-MM-DD)', 'invalid_query');
        }
        filters.from = query.from;
      }

      if (query.to !== undefined) {
        if (typeof query.to !== 'string') {
          throw new ValidationError('to must be a date string (YYYY-MM-DD)', 'invalid_query');
        }
        filters.to = query.to;
      }

      if (filters.from !== undefined && filters.to !== undefined && filters.from > filters.to) {
        throw new ValidationError('from must not be after to', 'invalid_query');
      }

      if (query.minAmount !== undefined) {
        const n = Number(query.minAmount);
        if (!Number.isFinite(n) || n < 0) {
          throw new ValidationError('minAmount must be a non-negative number', 'invalid_query');
        }
        filters.minAmount = n;
      }

      if (query.maxAmount !== undefined) {
        const n = Number(query.maxAmount);
        if (!Number.isFinite(n) || n < 0) {
          throw new ValidationError('maxAmount must be a non-negative number', 'invalid_query');
        }
        filters.maxAmount = n;
      }

      if (filters.minAmount !== undefined && filters.maxAmount !== undefined &&
          filters.minAmount > filters.maxAmount) {
        throw new ValidationError('minAmount must not be greater than maxAmount', 'invalid_query');
      }

      if (query.limit !== undefined) {
        const n = Number(query.limit);
        if (!Number.isFinite(n) || n < 1) {
          throw new ValidationError('limit must be a positive integer', 'invalid_query');
        }
        filters.limit = Math.min(Math.floor(n), 500);
      }

      if (query.offset !== undefined) {
        const n = Number(query.offset);
        if (!Number.isFinite(n) || n < 0) {
          throw new ValidationError('offset must be a non-negative integer', 'invalid_query');
        }
        filters.offset = Math.floor(n);
      }

      return repo.searchOrders(merchantId, filters);
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
