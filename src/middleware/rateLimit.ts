import type { NextFunction, Request, Response } from 'express';

export function rateLimitClientIp(req: Request): string {
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) {
    // Google front ends append the connection path. Use the right-most value,
    // never the caller-controlled left-most value accepted by trust proxy=true.
    const closestForwardedAddress = forwarded.split(',').map((part) => part.trim()).filter(Boolean).at(-1);
    if (closestForwardedAddress) return closestForwardedAddress;
  }
  return req.socket.remoteAddress ?? req.ip ?? 'unknown';
}

/**
 * IPアドレスキーの固定ウィンドウ・レート制限ミドルウェアを生成する汎用ファクトリ。
 * インメモリMap方式のため、Cloud Runが複数インスタンスにスケールした場合はインスタンスごとに
 * 独立してカウントされる（低トラフィックのコーポレートサイトを前提とした割り切り。
 * msp-customer-portal/src/middleware/rateLimit.ts と同じ割り切り）。
 * X-Forwarded-Forは左端の申告値を信用せず、Cloud Runが付加する接続元側の値を使用する。
 */
export function createIpRateLimiter(opts: {
  windowMs: number;
  maxRequests: number;
}): (req: Request, res: Response, next: NextFunction) => void {
  const hits = new Map<string, { count: number; windowStart: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = rateLimitClientIp(req);
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
