import type { NextFunction, Request, Response } from 'express';

/**
 * IPアドレスキーの固定ウィンドウ・レート制限ミドルウェアを生成する汎用ファクトリ。
 * インメモリMap方式のため、Cloud Runが複数インスタンスにスケールした場合はインスタンスごとに
 * 独立してカウントされる（低トラフィックのコーポレートサイトを前提とした割り切り。
 * msp-customer-portal/src/middleware/rateLimit.ts と同じ割り切り）。
 * req.ip の値が正しくクライアントIPを指すには app.set('trust proxy', true) が設定されている必要がある。
 */
export function createIpRateLimiter(opts: {
  windowMs: number;
  maxRequests: number;
}): (req: Request, res: Response, next: NextFunction) => void {
  const hits = new Map<string, { count: number; windowStart: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const record = hits.get(key);

    if (!record || now - record.windowStart >= opts.windowMs) {
      hits.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    if (record.count >= opts.maxRequests) {
      res.status(429).send('Too many requests. Please try again later.');
      return;
    }

    record.count += 1;
    next();
  };
}
