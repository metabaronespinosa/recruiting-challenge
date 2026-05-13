/**
 * Legacy compatibility shim — re-exports the singleton revenueRouter wired
 * to the concrete SQLite DAL. Existing imports of `revenueRouter` continue
 * to work unchanged.
 *
 * @deprecated Prefer createRevenueRouter(orderService) for testability.
 */

import { ordersDal } from '../dal/orders-dal.js';
import { createOrderService } from '../domain/order/order.service.js';
import { createRevenueRouter } from './revenue.js';

export const revenueRouter = createRevenueRouter(createOrderService(ordersDal));
