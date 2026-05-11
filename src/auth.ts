import type { Request, Response, NextFunction } from 'express';

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
 * This is intentionally simple — not a JWT.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const merchantId = req.header('X-Merchant-Id');
  if (!merchantId) {
    res.status(401).json({ error: 'missing_merchant_id' });
    return;
  }
  req.merchantId = merchantId;
  next();
}
