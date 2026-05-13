import { Router } from 'express';
import { isValidDate, clampLimit } from './query-validation.js';
import type { OrderService } from '../domain/order/order.service.js';
import { AppError } from '../lib/errors.js';

/**
 * Builds the orders router bound to the provided OrderService.
 * Keeping the factory pattern makes it straightforward to inject a mock
 * service in tests without touching module-level state.
 */
export function createOrdersRouter(orderService: OrderService): Router {
  const router = Router();

  router.get('/', (req, res, next) => {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to   = typeof req.query.to   === 'string' ? req.query.to   : undefined;

    // Validate date format when supplied
    if (from !== undefined && !isValidDate(from)) {
      res.status(400).json({ error: 'invalid_query', detail: 'from must be a valid date (YYYY-MM-DD)' });
      return;
    }
    if (to !== undefined && !isValidDate(to)) {
      res.status(400).json({ error: 'invalid_query', detail: 'to must be a valid date (YYYY-MM-DD)' });
      return;
    }
    // Reject inverted ranges
    if (from !== undefined && to !== undefined && from > to) {
      res.status(400).json({ error: 'invalid_query', detail: 'from must not be after to' });
      return;
    }

    const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const limit = rawLimit !== undefined ? clampLimit(rawLimit) : undefined;

    try {
      const orders = orderService.listOrders(req.merchantId!, { from, to, limit });
      res.json({ orders });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', (req, res, next) => {
    try {
      const order = orderService.getOrder(req.params.id, req.merchantId!);
      res.json({ order });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.code, detail: err.message });
        return;
      }
      next(err);
    }
  });

  router.post('/', (req, res, next) => {
    try {
      const order = orderService.createOrder(req.merchantId!, req.body as Record<string, unknown>);
      res.status(201).json({ order });
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

/**
 * @deprecated Use createOrdersRouter(orderService) instead.
 * Kept for backwards compatibility — server.ts and tests that import
 * `ordersRouter` directly continue to work until they migrate.
 */
export { ordersRouter } from './orders.legacy.js';
