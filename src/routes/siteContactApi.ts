import express, { Router, type ErrorRequestHandler } from 'express';
import type { Config } from '../config';
import type { ContactFormData, Mailer } from '../services/mailer';
import { createIpRateLimiter } from '../middleware/rateLimit';

const MAX_BODY_BYTES = '32kb';
const INQUIRY_TYPES: Readonly<Record<string, string>> = {
  services: 'サービスについてのご相談',
  partnership: '協業に関するお問い合わせ',
  other: 'その他のお問い合わせ',
};

type SiteContactConfig = Config['siteContact'];
type VerifyInput = { token: string; secret: string; hostnames: string[]; remoteIp?: string };
type TurnstileVerification = (input: VerifyInput) => Promise<boolean>;

/** Verify every token server-side; a browser widget's completion is not authorization. */
export async function verifySiteContactTurnstile(
  { token, secret, hostnames, remoteIp }: VerifyInput,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<boolean> {
  if (!token || !secret || !hostnames.length || token.length > 2048) return false;

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) params.set('remoteip', remoteIp);
    const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: params,
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return false;
    const outcome = await response.json() as { success?: boolean; hostname?: string; action?: string };
    return outcome.success === true && outcome.action === 'contact' &&
      typeof outcome.hostname === 'string' && hostnames.includes(outcome.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function field(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function validatePayload(body: unknown): { fields: ContactFormData; token: string } | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const data = body as Record<string, unknown>;
  if (data.privacyConsent !== true || (data.website !== undefined && data.website !== '')) return null;
  if (typeof data.inquiryType !== 'string' || !Object.prototype.hasOwnProperty.call(INQUIRY_TYPES, data.inquiryType)) return null;

  const company = field(data.company, 150);
  const name = field(data.name, 100);
  const email = field(data.email, 254);
  const message = field(data.message, 5000);
  const phone = data.phone === undefined || data.phone === '' ? '' : field(data.phone, 30);
  const token = field(data.turnstileToken, 2048);
  if (!company || !name || !email || !message || phone === null || !token) return null;
  if (!/^[^\s@<>"\x00-\x1f\x7f]+@[^\s@<>"\x00-\x1f\x7f]+\.[^\s@<>"\x00-\x1f\x7f]+$/u.test(email)) return null;

  return {
    fields: { inquiry_type: INQUIRY_TYPES[data.inquiryType]!, company, name, email, phone, message },
    token,
  };
}

function jsonFailure(res: express.Response, status: number, code: string): void {
  res.status(status).json({ ok: false, code });
}

/**
 * New static Site's JSON inquiry route. The existing mailer/SMTP/Secret
 * Manager setup is reused; no duplicate Gmail API or mail credentials.
 * The legacy /confirm.php and /send.php routes are deliberately untouched.
 */
export function createSiteContactApiRouter(
  mailer: Pick<Mailer, 'sendContactNotification'>,
  config: SiteContactConfig,
  verify: TurnstileVerification = verifySiteContactTurnstile,
): Router {
  const router = Router();
  const rateLimit = createIpRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 5 });
  const ready = Boolean(config.turnstileSecret && config.allowedOrigins.length && config.allowedTurnstileHostnames.length);

  router.use('/api/contact', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    if (!ready) return jsonFailure(res, 503, 'not_ready');

    const origin = req.get('origin');
    if (!origin || !config.allowedOrigins.includes(origin)) return jsonFailure(res, 403, 'forbidden');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  router.post('/api/contact', rateLimit, express.json({ limit: MAX_BODY_BYTES }), async (req, res) => {
    if (!req.is('application/json')) return jsonFailure(res, 415, 'unsupported_media_type');
    const validated = validatePayload(req.body);
    if (!validated) return jsonFailure(res, 400, 'invalid_fields');

    let validChallenge = false;
    try {
      validChallenge = await verify({
        token: validated.token,
        secret: config.turnstileSecret,
        hostnames: config.allowedTurnstileHostnames,
        remoteIp: req.ip,
      });
    } catch {
      // Verification outages must not become successful mail submissions.
    }
    if (!validChallenge) return jsonFailure(res, 403, 'bot_verification_failed');

    try {
      // ML destination is fixed by the owner. Do not inherit the legacy
      // `database@atlib.jp` secondary recipient or customer auto-reply.
      await mailer.sendContactNotification('contact@atlib.jp', validated.fields);
    } catch {
      // No customer message, email, or SMTP diagnostic in HTTP or app logs.
      return jsonFailure(res, 502, 'notification_failed');
    }
    res.status(200).json({ ok: true, code: 'accepted' });
  });

  router.all('/api/contact', (_req, res) => jsonFailure(res, 405, 'method_not_allowed'));

  const jsonErrors: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    const typed = error as { type?: string; status?: number };
    if (typed.type === 'entity.too.large') return jsonFailure(res, 413, 'payload_too_large');
    if (typed instanceof SyntaxError && typed.status === 400) return jsonFailure(res, 400, 'invalid_payload');
    next(error);
  };
  router.use('/api/contact', jsonErrors);
  return router;
}
