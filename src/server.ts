import path from 'path';
import express from 'express';
import pinoHttp from 'pino-http';
import pino from 'pino';
import { loadConfig } from './config';
import { Mailer } from './services/mailer';
import { createContactFormRouter } from './routes/contactForm';
import { createEntryFormRouter } from './routes/entryForm';
import { createIpRateLimiter } from './middleware/rateLimit';

const RECRUIT_HOST = /^(www\.)?recruit\.atlib\.jp$/i;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

async function main(): Promise<void> {
  const config = await loadConfig();
  const logger = pino({ level: config.nodeEnv === 'production' ? 'info' : 'debug' });
  const mailer = new Mailer(config.smtp);

  const app = express();
  // Cloud Run本番ではLBが1ホップ手前でTLS終端しX-Forwarded-Forを付与するため、
  // req.ip/req.hostnameが正しい値を指すようにtrust proxyを有効化する（IPレート制限・ホスト判定で使用）。
  app.set('trust proxy', true);
  app.use(pinoHttp({ logger }));
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
