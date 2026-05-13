/**
 * Backwards-compatibility shim.
 *
 * src/dal/orders-dal.ts is now a thin re-export of the concrete SQLite
 * repository that lives at src/infrastructure/sqlite/order.sqlite.repo.ts.
 *
 * Existing importers (test files, legacy route shims) that reference
 * `ordersDal` continue to work without any change.
 *
 * @deprecated Import from src/infrastructure/sqlite/order.sqlite.repo.ts or
 * depend on IOrderRepository from src/domain/order/order.repository.ts instead.
 */

// Re-export domain types so existing importers of orders-dal.ts keep working.
export type {
  OrderRow,
  CreateOrderInput,
  OrderFilters,
  MetricsSummary,
  TopCustomerRow,
} from '../domain/order/order.types.js';

export { orderSqliteRepo as ordersDal } from '../infrastructure/sqlite/order.sqlite.repo.js';
