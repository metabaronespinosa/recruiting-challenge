import { Router } from 'express';
import type { OrderService } from '../domain/order/order.service.js';
import { clampLimit } from './query-validation.js';

/**
 * Builds the metrics router bound to the provided OrderService.
 */
export function createMetricsRouter(orderService: OrderService): Router {
  const router = Router();

  /**
   * GET /api/metrics/summary
   *
   * Returns dashboard summary stats for the current merchant.
   */
  router.get('/summary', (req, res, next) => {
    try {
      const merchantId = req.merchantId!;
      const summary = orderService.getMetricsSummary(merchantId);
      res.json({ merchant_id: merchantId, ...summary });
    } catch (err) {
      next(err);
    }
  });

  router.get('/top-customers', (req, res, next) => {
    try {
      const merchantId = req.merchantId!;
      const rawLimit = Number(req.query.limit ?? 5);
      const limit = clampLimit(rawLimit);
      const customers = orderService.getTopCustomers(merchantId, limit);
      res.json({ customers });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/**
 * @deprecated Use createMetricsRouter(orderService) instead.
 * Singleton wired to the concrete SQLite DAL for backwards compatibility.
 */
export { metricsRouter } from './metrics.legacy.js';
