import path from 'path';
import { readFile } from 'fs/promises';
import express from 'express';
import pinoHttp from 'pino-http';
import pino from 'pino';
import { loadConfig } from './config';
import { Mailer } from './services/mailer';
import { createContactFormRouter } from './routes/contactForm';
import { createEntryFormRouter } from './routes/entryForm';
import { createSiteContactApiRouter } from './routes/siteContactApi';
import { createIpRateLimiter } from './middleware/rateLimit';

const RECRUIT_HOST = /^(www\.)?recruit\.atlib\.jp$/i;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

async function main(): Promise<void> {
  const config = await loadConfig();
  const logger = pino({ level: config.nodeEnv === 'production' ? 'info' : 'debug' });
  const mailer = new Mailer(config.smtp);

  const app = express();
  app.disable('x-powered-by');
  // Cloud Run本番ではLBが1ホップ手前でTLS終端しX-Forwarded-Forを付与するため、
  // req.ip/req.hostnameが正しい値を指すようにtrust proxyを有効化する（IPレート制限・ホスト判定で使用）。
  // Cloud Run has one managed proxy hop in front of the container. Limiting
  // trust to that hop prevents a caller-supplied left-most X-Forwarded-For
  // value from becoming req.ip.
  app.set('trust proxy', 1);
  app.use(pinoHttp({ logger }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  app.use(express.urlencoded({ extended: true }));

  app.get('/healthz', (_req, res) => res.status(200).send('ok'));

  // apex(atlib.jp) は www.atlib.jp へ301リダイレクト（元の.htaccessのルールを踏襲。recruitホストは対象外）
  app.use((req, res, next) => {
    if (req.hostname === 'atlib.jp') {
      res.redirect(301, `https://www.atlib.jp${req.originalUrl}`);
      return;
    }
    next();
  });

  // recruit.atlib.jp / www.recruit.atlib.jp は public/recruit/ をドキュメントルートとして扱う。
  // フォームのaction="confirm.php"等の相対パス解決はクライアント側のURL基準のままなので、
  // ここでのURL書き換えはサーバー内部だけの処理（クライアントには見えない）。
  app.use((req, _res, next) => {
    if (RECRUIT_HOST.test(req.hostname) && !req.url.startsWith('/recruit')) {
      req.url = `/recruit${req.url}`;
    }
    next();
  });

  const formRateLimiter = createIpRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 20 });
  app.use(['/confirm.php', '/send.php', '/recruit/entry/confirm.php', '/recruit/entry/send.php'], formRateLimiter);

  app.use(createContactFormRouter(mailer, config));
  app.use(createEntryFormRouter(mailer, config));
  app.use(createSiteContactApiRouter(mailer, config.siteContact));

  // The Turnstile site key is public configuration, but differs by
  // environment. Inject it at response time so the same image can be promoted
  // to Production without rebuilding the accepted static site.
  app.get(['/contact', '/contact/'], async (_req, res, next) => {
    try {
      const siteKey = config.siteContact.turnstileSiteKey;
      if (!/^[A-Za-z0-9_-]{10,100}$/u.test(siteKey)) {
        res.status(503).send('Contact form is not configured.');
        return;
      }
      const template = await readFile(path.join(PUBLIC_DIR, 'contact', 'index.html'), 'utf8');
      res.setHeader('Cache-Control', 'no-store');
      res.type('html').send(template.replace('__TURNSTILE_SITE_KEY__', siteKey));
    } catch (error) {
      next(error);
    }
  });

  app.use(
    express.static(PUBLIC_DIR, {
      setHeaders: (res, filePath) => {
        if (/\.html?$/.test(filePath)) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (/\.(css|js)$/.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      },
    }),
  );

  app.listen(config.port, () => {
    logger.info(`corporate-site listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error('failed to start corporate-site', err);
  process.exit(1);
});
