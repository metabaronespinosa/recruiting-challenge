import { Router } from 'express';
import { isValidDate } from './query-validation.js';
import type { OrderService } from '../domain/order/order.service.js';

/**
 * Builds the revenue router bound to the provided OrderService.
 */
export function createRevenueRouter(orderService: OrderService): Router {
  const router = Router();

  /**
   * GET /api/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD
   *
   * Returns total revenue for the authenticated merchant in the given date range.
   */
  router.get('/', (req, res, next) => {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to   = typeof req.query.to   === 'string' ? req.query.to   : undefined;

    if (!from || !to) {
      res.status(400).json({ error: 'missing_date_range', detail: 'from and to are required (YYYY-MM-DD)' });
      return;
    }
    if (!isValidDate(from)) {
      res.status(400).json({ error: 'invalid_query', detail: 'from must be a valid date (YYYY-MM-DD)' });
      return;
    }
    if (!isValidDate(to)) {
      res.status(400).json({ error: 'invalid_query', detail: 'to must be a valid date (YYYY-MM-DD)' });
      return;
    }
    if (from > to) {
      res.status(400).json({ error: 'invalid_query', detail: 'from must not be after to' });
      return;
    }

    try {
      const result = orderService.getRevenue(req.merchantId!, from, to);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/**
 * @deprecated Use createRevenueRouter(orderService) instead.
 * Singleton wired to the concrete SQLite DAL for backwards compatibility.
 */
export { revenueRouter } from './revenue.legacy.js';
