/**
 * Legacy compatibility shim — re-exports the singleton ordersRouter wired
 * to the concrete SQLite DAL. Existing code that does:
 *
 *   import { ordersRouter } from './routes/orders.js'
 *
 * continues to work unchanged. New code should use createOrdersRouter().
 *
 * @deprecated Prefer createOrdersRouter(orderService) for testability.
 */

import { ordersDal } from '../dal/orders-dal.js';
import { createOrderService } from '../domain/order/order.service.js';
import { createOrdersRouter } from './orders.js';

export const ordersRouter = createOrdersRouter(createOrderService(ordersDal));
