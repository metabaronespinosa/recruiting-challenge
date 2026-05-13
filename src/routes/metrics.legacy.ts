/**
 * Legacy compatibility shim — re-exports the singleton metricsRouter wired
 * to the concrete SQLite DAL. Existing imports of `metricsRouter` continue
 * to work unchanged.
 *
 * @deprecated Prefer createMetricsRouter(orderService) for testability.
 */

import { orderSqliteRepo } from '../infrastructure/sqlite/order.sqlite.repo.js';
import { createOrderService } from '../domain/order/order.service.js';
import { createMetricsRouter } from './metrics.js';

export const metricsRouter = createMetricsRouter(createOrderService(orderSqliteRepo));
