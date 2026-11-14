const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {
  isPublicRequest,
  renderCorporatePage,
  siteSecurityHeaders,
} = require('../dist/middleware/sitePublication');

const publicDir = path.join(__dirname, '..', 'public');
const pages = new Map([
  ['/', 'index.html'],
  ['/company/', 'company/index.html'],
  ['/services/', 'services/index.html'],
  ['/works/', 'works/index.html'],
  ['/contact/', 'contact/index.html'],
]);

test('indexability is explicitly gated on release mode AND an approved hostname', () => {
  assert.equal(isPublicRequest('www.atlib.jp', 'www.atlib.jp', undefined), false);
  assert.equal(isPublicRequest('www.atlib.jp', 'www.atlib.jp', 'staging'), false);
  assert.equal(isPublicRequest('corporate-site-staging-123.run.app', 'corporate-site-staging-123.run.app', 'public'), false);
  assert.equal(isPublicRequest('www.atlib.jp.evil.example', 'www.atlib.jp.evil.example', 'public'), false);
  assert.equal(isPublicRequest('www.atlib.jp', 'corporate-site-staging-123.run.app', 'public'), false);
  assert.equal(isPublicRequest('www.atlib.jp', 'www.atlib.jp', 'public'), true);
  assert.equal(isPublicRequest('atlib.jp', 'atlib.jp', 'public'), true);
  assert.equal(isPublicRequest('recruit.atlib.jp', 'recruit.atlib.jp', 'public'), true);
});

test('security headers keep Apache canonical and Staging noindex by default', () => {
  for (const [mode, hostname, expectedNoindex, expectedHsts] of [
    [undefined, 'corporate-site-staging-123.run.app', true, false],
    ['public', 'corporate-site-staging-123.run.app', true, false],
    [undefined, 'www.atlib.jp', true, true],
    ['public', 'www.atlib.jp', false, true],
    ['public', 'recruit.atlib.jp', false, true],
  ]) {
    const headers = {};
    siteSecurityHeaders(mode)(
      { hostname, headers: { host: hostname } },
      { setHeader: (key, value) => { headers[key] = value; } },
      () => {},
    );
    assert.equal(Boolean(headers['X-Robots-Tag']), expectedNoindex);
    assert.equal(Boolean(headers['Strict-Transport-Security']), expectedHsts);
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
    assert.equal(headers['Permissions-Policy'], 'camera=(), microphone=(), geolocation=()');
    assert.equal(headers['X-Frame-Options'], undefined);
    assert.equal(headers['Content-Security-Policy'], undefined);
  }
});

test('five canonical pages expose SEO metadata, with private preview text only off Production', () => {
  for (const [urlPath, sourcePath] of pages) {
    const template = fs.readFileSync(path.join(publicDir, sourcePath), 'utf8');
    const stage = renderCorporatePage(template, false);
    const prod = renderCorporatePage(template, true);
    assert.equal(stage, template);
    assert.match(stage, /noindex,nofollow/u);
    assert.match(stage, /公開サイトではありません/u);
    assert.match(prod, /index,follow,max-image-preview:large/u);
    assert.doesNotMatch(prod, /noindex,nofollow|デザイン検討用プレビュー|公開サイトではありません|Staging検証環境|送信機能を準備中|現行サイト/u);
    assert.match(prod, new RegExp(`<link rel="canonical" href="https://www\\.atlib\\.jp${urlPath}"`));
    assert.match(prod, /<meta property="og:title"/u);
    assert.match(prod, /<meta property="og:image"/u);
    assert.match(prod, /<meta name="twitter:card"/u);
    assert.match(prod, /プライバシーポリシー/u);
  }
});

test('AIO Organization/WebSite structured data is parseable and uses existing identities', () => {
  const home = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const match = home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/u);
  assert.ok(match);
  const schema = JSON.parse(match[1]);
  const organization = schema['@graph'].find((item) => item['@type'] === 'Organization');
  const website = schema['@graph'].find((item) => item['@type'] === 'WebSite');
  assert.equal(organization['@id'], 'https://www.atlib.jp/#organization');
  assert.equal(organization.name, 'atLIB株式会社');
  assert.equal(website.publisher['@id'], organization['@id']);
});

test('sitemap enumerates real files and includes all five corporate pages', () => {
  const sitemap = fs.readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>(https:\/\/www\.atlib\.jp\/[^<]*)<\/loc>/gu)].map((match) => match[1]);
  assert.equal(new Set(urls).size, urls.length);
  for (const urlPath of pages.keys()) assert.ok(urls.includes(`https://www.atlib.jp${urlPath}`));
  for (const url of urls) {
    const pathPart = new URL(url).pathname;
    assert.equal(fs.existsSync(path.join(publicDir, pathPart, 'index.html')), true, `missing page: ${url}`);
  }
  assert.match(fs.readFileSync(path.join(publicDir, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/www\.atlib\.jp\/sitemap\.xml/u);
  const llms = fs.readFileSync(path.join(publicDir, 'llms.txt'), 'utf8');
  assert.match(llms, /https:\/\/www\.atlib\.jp\/services\//u);
  assert.doesNotMatch(llms, /Staging|プレビュー/u);
});
