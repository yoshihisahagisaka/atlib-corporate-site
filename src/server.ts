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
import { corporatePageSecurityHeaders, isPublicRequest, renderCorporatePage, siteSecurityHeaders } from './middleware/sitePublication';

const RECRUIT_HOST = /^(www\.)?recruit\.atlib\.jp$/i;
const BUSINESS_WEB_PATH = /^\/business-web(?:\/|$)/;
const ITMGMT_PATH = /^\/it-management-kaizen(?:\/|$)/;
// The service hostname exposes only the public LP and its versioned, static assets.
const ITMGMT_PUBLIC_PATH = /^\/it-management-kaizen(?:\/(?:index\.html|assets\/[A-Za-z0-9][A-Za-z0-9._-]*)?)?$/;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ITMGMT_SERVICE_DIR = path.join(__dirname, 'service-content', 'it-management-kaizen');

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
  const releaseMode = process.env.SITE_PUBLIC_MODE;
  app.use(siteSecurityHeaders(releaseMode));
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

  // The service host exposes only Business KAIZEN and IT Management KAIZEN.
  // Retiring each old www URL is an independent, post-release operation.
  const businessWebRedirects = process.env.BUSINESS_WEB_REDIRECTS_ENABLED === 'true';
  const retireItManagementWww = process.env.ITMGMT_WWW_RETIRE_ENABLED === 'true';
  app.use((req, res, next) => {
    // Trust the actual Host and require it to match the proxy-derived hostname.
    // An X-Forwarded-Host mismatch must never bypass service-host isolation.
    const host = (req.headers.host ?? '').toLowerCase().replace(/:\d+$/u, '');
    const forwardedHost = req.hostname.toLowerCase();
    if (host === 'service.atlib.jp') {
      if (forwardedHost !== host) { res.status(404).send('Not Found'); return; }
      if (req.path === '/') { res.redirect(302, '/business-web/'); return; }
      if (req.path === '/robots.txt') {
        res.type('text/plain').send('User-agent: *\nAllow: /business-web/\nAllow: /it-management-kaizen/\nSitemap: https://service.atlib.jp/sitemap.xml\n');
        return;
      }
      if (req.path === '/sitemap.xml') {
        res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://service.atlib.jp/business-web/</loc></url><url><loc>https://service.atlib.jp/it-management-kaizen/</loc></url></urlset>');
        return;
      }
      if (req.path === '/privacy-policy' || req.path === '/privacy-policy/') {
        res.redirect(302, 'https://www.atlib.jp/privacy-policy/'); return;
      }
      if (!BUSINESS_WEB_PATH.test(req.path) && !ITMGMT_PUBLIC_PATH.test(req.path)) { res.status(404).send('Not Found'); return; }
    } else if (retireItManagementWww && host === 'www.atlib.jp' && ITMGMT_PATH.test(req.path)) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(410).type('text/plain').send('Gone'); return;
    } else if (businessWebRedirects && forwardedHost === host && (host === 'www.atlib.jp' || host === 'atlib.jp') && BUSINESS_WEB_PATH.test(req.path)) {
      res.redirect(301, `https://service.atlib.jp${req.originalUrl}`); return;
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
  app.use(createSiteContactApiRouter(mailer, config.siteContact, undefined, logger));

  // Serve approved corporate templates on both Staging and Production. A
  // public release removes preview-only wording and meta noindex at response
  // time; a Staging request remains visibly marked and unindexable.
  const corporateRoutes: Array<[string, string]> = [
    ['/', 'index.html'],
    ['/company/', 'company/index.html'],
    ['/services/', 'services/index.html'],
    ['/works/', 'works/index.html'],
  ];
  for (const [route, htmlPath] of corporateRoutes) {
    app.get([route, route === '/' ? '/index.html' : `${route}index.html`], async (req, res, next) => {
      try {
        const publiclyReleased = isPublicRequest(req.hostname, req.headers.host, releaseMode);
        if (publiclyReleased && req.path !== route) {
          res.redirect(301, `${route}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`);
          return;
        }
        const template = await readFile(path.join(PUBLIC_DIR, htmlPath), 'utf8');
        corporatePageSecurityHeaders(res);
        res.setHeader('Cache-Control', 'no-cache');
        res.type('html').send(renderCorporatePage(template, publiclyReleased));
      } catch (error) {
        next(error);
      }
    });
  }

  // The Turnstile site key is public configuration, but differs by
  // environment. Inject it at response time so the same image can be promoted
  // to Production without rebuilding the accepted static site.
  app.get(['/contact', '/contact/', '/contact/index.html'], async (req, res, next) => {
    try {
      const publiclyReleased = isPublicRequest(req.hostname, req.headers.host, releaseMode);
      if (publiclyReleased && req.path !== '/contact/') {
        res.redirect(301, `/contact/${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`);
        return;
      }
      corporatePageSecurityHeaders(res);
      const siteKey = config.siteContact.turnstileSiteKey;
      if (!/^[A-Za-z0-9_-]{10,100}$/u.test(siteKey)) {
        res.status(503).send('Contact form is not configured.');
        return;
      }
      const template = await readFile(path.join(PUBLIC_DIR, 'contact', 'index.html'), 'utf8');
      res.setHeader('Cache-Control', 'no-store');
      res.type('html').send(renderCorporatePage(template, publiclyReleased).replace('__TURNSTILE_SITE_KEY__', siteKey));
    } catch (error) {
      next(error);
    }
  });

  // service.atlib.jp serves the new LP from a private directory, not WWW's
  // legacy public/it-management-kaizen tree. Never fall back to WWW on a miss.
  const itManagementServiceStatic = express.static(ITMGMT_SERVICE_DIR, {
    fallthrough: false,
    setHeaders: (res, filePath) => {
      if (/\.html?$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
      else if (/\.(css|js)$/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=3600');
      else res.setHeader('Cache-Control', 'public, max-age=86400');
    },
  });
  app.use('/it-management-kaizen', (req, res, next) => {
    const host = (req.headers.host ?? '').toLowerCase().replace(/:\d+$/u, '');
    if (host === 'service.atlib.jp' && req.hostname.toLowerCase() === host) {
      itManagementServiceStatic(req, res, next);
      return;
    }
    next();
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
