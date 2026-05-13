/**
 * GET /api/orders/search
 *
 * Order search endpoint (Feature C).
 *
 * Accepts any combination of the following query parameters:
 *   email      — exact customer email match (case-insensitive)
 *   status     — order status (e.g. 'completed', 'pending')
 *   type       — 'sale' | 'refund'
 *   from       — YYYY-MM-DD lower bound on created_at (inclusive)
 *   to         — YYYY-MM-DD upper bound on created_at (exclusive)
 *   minAmount  — minimum total_amount in cents (inclusive)
 *   maxAmount  — maximum total_amount in cents (inclusive)
 *   limit      — page size (default 50, max 500)
 *   offset     — number of rows to skip for pagination (default 0)
 *
 * All validation is delegated to the service layer so the route stays a thin
 * HTTP adapter.  AppErrors bubble up and are serialised by the handler below;
 * unexpected errors are forwarded to the global error handler via next().
 */

import { Router } from 'express';
import { isValidDate } from './query-validation.js';
import type { OrderService } from '../domain/order/order.service.js';
import { AppError } from '../lib/errors.js';

export function createSearchRouter(orderService: OrderService): Router {
  const router = Router();

  router.get('/', (req, res, next) => {
    // Date format is validated at the route layer (consistent with the orders
    // and revenue routes) before the values reach the service.
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to   = typeof req.query.to   === 'string' ? req.query.to   : undefined;

    if (from !== undefined && !isValidDate(from)) {
      res.status(400).json({ error: 'invalid_query', detail: 'from must be a valid date (YYYY-MM-DD)' });
      return;
    }
    if (to !== undefined && !isValidDate(to)) {
      res.status(400).json({ error: 'invalid_query', detail: 'to must be a valid date (YYYY-MM-DD)' });
      return;
    }

    try {
      const result = orderService.searchOrders(req.merchantId!, {
        email:     typeof req.query.email     === 'string' ? req.query.email     : undefined,
        status:    typeof req.query.status    === 'string' ? req.query.status    : undefined,
        type:      typeof req.query.type      === 'string' ? req.query.type      : undefined,
        from,
        to,
        minAmount: typeof req.query.minAmount === 'string' ? req.query.minAmount : undefined,
        maxAmount: typeof req.query.maxAmount === 'string' ? req.query.maxAmount : undefined,
        limit:     typeof req.query.limit     === 'string' ? req.query.limit     : undefined,
        offset:    typeof req.query.offset    === 'string' ? req.query.offset    : undefined,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.code, detail: err.message });
        return;
      }
      next(err);
    }
  });

  return router;
}
