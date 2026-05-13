import { Router } from 'express';
import { ordersDal } from '../dal/orders-dal.js';
import { randomUUID } from 'node:crypto';
import { isValidDate, clampLimit } from './query-validation.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_TYPES = new Set<string>(['sale', 'refund']);

export const ordersRouter = Router();

ordersRouter.get('/', (req, res) => {
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

  const orders = ordersDal.listByMerchant(req.merchantId!, { from, to, limit });
  res.json({ orders });
});

ordersRouter.get('/:id', (req, res) => {
  const order = ordersDal.getById(req.params.id, req.merchantId!);
  if (!order) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ order });
});

ordersRouter.post('/', (req, res) => {
  const body = req.body as {
    customer_email?: unknown;
    total_amount?: unknown;
    type?: unknown;
  };

  // Validate customer_email
  if (typeof body.customer_email !== 'string' || !EMAIL_RE.test(body.customer_email)) {
    res.status(400).json({ error: 'invalid_body', detail: 'customer_email must be a valid email address' });
    return;
  }

  // Validate total_amount: must be a finite, non-negative number
  if (
    typeof body.total_amount !== 'number' ||
    !Number.isFinite(body.total_amount) ||
    body.total_amount < 0
  ) {
    res.status(400).json({ error: 'invalid_body', detail: 'total_amount must be a non-negative finite number' });
    return;
  }

  // Validate type: must be a known value if supplied
  const type = body.type ?? 'sale';
  if (!VALID_TYPES.has(type as string)) {
    res.status(400).json({ error: 'invalid_body', detail: 'type must be sale or refund' });
    return;
  }

  const order = ordersDal.create({
    id: randomUUID(),
    merchant_id: req.merchantId!,
    customer_email: body.customer_email,
    total_amount: body.total_amount,
    type: type as 'sale' | 'refund',
    status: 'completed',
  });
  res.status(201).json({ order });
});
