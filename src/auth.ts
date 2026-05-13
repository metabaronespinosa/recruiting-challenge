import type { Request, Response, NextFunction } from 'express';
import { db } from './db.js';

declare global {
  namespace Express {
    interface Request {
      merchantId?: string;
    }
  }
}

/**
 * Simplified auth middleware. Real auth would be a signed JWT.
 * For the challenge: clients send X-Merchant-Id as a header to identify the merchant.
 * The header value is validated against the merchants table — an unrecognised ID is rejected.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const merchantId = req.header('X-Merchant-Id');
  if (!merchantId) {
    res.status(401).json({ error: 'missing_merchant_id' });
    return;
  }

  const merchant = db
    .prepare(`SELECT id FROM merchants WHERE id = ?`)
    .get(merchantId) as { id: string } | undefined;

  if (!merchant) {
    res.status(401).json({ error: 'unknown_merchant' });
    return;
  }

  req.merchantId = merchantId;
  next();
}
