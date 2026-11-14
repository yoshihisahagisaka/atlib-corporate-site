import type { Request, Response, NextFunction } from 'express';

// Promotion is an explicit release gate, not NODE_ENV: Staging also runs with
// NODE_ENV=production. Unknown hosts (including run.app) always stay noindex.
const PUBLISHED_HOSTS = new Set([
  'www.atlib.jp',
  'atlib.jp',
  'recruit.atlib.jp',
  'www.recruit.atlib.jp',
]);

function publishedHost(hostname: string, hostHeader: string | undefined): boolean {
  const rawHost = (hostHeader ?? '').toLowerCase().replace(/:\d+$/u, '');
  // Express req.hostname can come from X-Forwarded-Host in a trusted-proxy
  // setup. Require the actual Host header as well to reject spoofed forwarding.
  return PUBLISHED_HOSTS.has(rawHost) && hostname.toLowerCase() === rawHost;
}

export function isPublicRequest(
  hostname: string,
  hostHeader: string | undefined,
  releaseMode: string | undefined,
): boolean {
  return releaseMode === 'public' && publishedHost(hostname, hostHeader);
}

export function siteSecurityHeaders(releaseMode: string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // Match the existing production Apache security canonical. HSTS preload
    // and site-wide X-Frame-Options / CSP remain intentionally out of scope.
    if (publishedHost(req.hostname, req.headers.host)) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    if (!isPublicRequest(req.hostname, req.headers.host, releaseMode)) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }
    next();
  };
}

// Only the five new corporate pages use this preview-to-public transformation.
// The legacy LPs and recruiting pages are never rewritten by this function.
export function renderCorporatePage(template: string, publiclyReleased: boolean): string {
  if (!publiclyReleased) return template;

  return template
    .replace('<meta name="robots" content="noindex,nofollow">', '<meta name="robots" content="index,follow,max-image-preview:large">')
    .replace(/<div class="preview-note" role="status">atLIB コーポレートサイト デザイン検討用プレビュー <span>公開サイトではありません<\/span><\/div>\s*/u, '')
    .replace(/<span class="footer-copy-divider">　｜　<\/span><span class="footer-copy-note">デザイン検討用プレビュー<\/span>/gu, '')
    .replace(/<div class="contact-under-construction" role="status"><strong>Staging検証環境です<\/strong><span>実顧客の個人情報や実際のご相談内容は入力しないでください。<\/span><\/div>\s*/u, '')
    .replace(/<p class="contact-preview-note">※お問い合わせフォームは現在、送信機能を準備中です。<\/p>/u, '')
    .replace(/プライバシーポリシー（現行サイト）/gu, 'プライバシーポリシー');
}
