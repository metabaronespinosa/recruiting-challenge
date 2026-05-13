import express from 'express';
import { initSchema } from './db.js';
import { authMiddleware } from './auth.js';
import { orderSqliteRepo } from './infrastructure/sqlite/order.sqlite.repo.js';
import { createOrderService } from './domain/order/order.service.js';
import { createOrdersRouter } from './routes/orders.js';
import { createRevenueRouter } from './routes/revenue.js';
import { createMetricsRouter } from './routes/metrics.js';
import { createSearchRouter } from './routes/search.js';
import { AppError } from './lib/errors.js';
import { config } from './config.js';

// Only initialise the schema on boot; seeding is handled by `npm run seed`.
initSchema();

const app = express();
const { port } = config;

// Wire the service once at application startup and inject into every router.
const orderService = createOrderService(orderSqliteRepo);

app.use(express.json());
app.use(express.static('public'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/orders/search', authMiddleware, createSearchRouter(orderService));
app.use('/api/orders', authMiddleware, createOrdersRouter(orderService));
app.use('/api/revenue', authMiddleware, createRevenueRouter(orderService));
app.use('/api/metrics', authMiddleware, createMetricsRouter(orderService));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof AppError) {
    // Known, typed errors — surface the status code and structured body
    res
      .status(err.statusCode)
      .json({ error: err.code, detail: err.message });
    return;
  }
  // Unknown errors — log and hide internals
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(port, () => {
  console.log(`dashboard server listening on http://localhost:${port}`);
});
