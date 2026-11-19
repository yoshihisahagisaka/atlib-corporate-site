'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'public', 'recruit');
const preview = fs.readFileSync(path.join(root, 'redesign-preview', 'index.html'), 'utf8');
const existing = fs.readFileSync(path.join(root, 'message', 'index.html'), 'utf8');
const marker = '<!--License20261119vzyRP-->';
const description = '困っている人を、放っておけない。その気持ちを、ITの仕事に。atLIB株式会社の採用サイトです。';

assert.equal(preview.split(marker).length - 1, 1, 'Expected exactly one license marker in approved preview');
assert.match(preview, /<meta name="robots" content="noindex,nofollow">/);
assert.match(preview, /<title>採用サイト リニューアルプレビュー \| atLIB株式会社<\/title>/);

function tracker(name) {
  const startTag = `<!-- ${name} -->`;
  const endTag = `<!-- //${name} -->`;
  const start = existing.indexOf(startTag);
  const end = existing.indexOf(endTag, start);
  assert.ok(start >= 0 && end > start, `Existing ${name} must be preserved`);
  return existing.slice(start, end + endTag.length);
}

const analytics = [tracker('Google tag (gtag.js)'), tracker('Microsoft Clarity')].join('\n');
const social = `  <link rel="icon" type="image/png" sizes="64x64" href="./images/favicon.png?v=20261118">
  <link rel="canonical" href="https://recruit.atlib.jp/">
  <meta property="og:title" content="atLIB株式会社 採用サイト | 困っている人を、放っておけない。">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://recruit.atlib.jp/">
  <meta property="og:image" content="https://recruit.atlib.jp/images/ogp.png">
  <meta property="og:description" content="${description}">
  <meta property="og:site_name" content="atLIB株式会社 採用サイト">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'atLIB株式会社 採用サイト',
    url: 'https://recruit.atlib.jp/',
    description,
    isPartOf: { '@type': 'Organization', name: 'atLIB株式会社', url: 'https://www.atlib.jp/' },
  })}</script>`;

let production = preview
  .replace('  <meta name="robots" content="noindex,nofollow">\n', '')
  .replace('<title>採用サイト リニューアルプレビュー | atLIB株式会社</title>', '<title>採用情報 | atLIB株式会社</title>')
  .replace('  <link rel="preconnect" href="https://fonts.googleapis.com">', `  ${analytics.replaceAll('\n', '\n  ')}\n${social}\n  <link rel="preconnect" href="https://fonts.googleapis.com">`)
  .replaceAll('href="../', 'href="./')
  .replaceAll('./assets/', './redesign-preview/assets/');

assert.equal(production.split(marker).length - 1, 1);
assert.doesNotMatch(production, /noindex|リニューアルプレビュー/);
assert.match(production, /href="\.\/entry\/"/);
assert.match(production, /href="https:\/\/www\.atlib\.jp\/company\/"/);
assert.equal((production.match(/G-1CBDCR2PD0/g) || []).length, 2);
assert.equal((production.match(/xtjmp7ly4g/g) || []).length, 1);

fs.writeFileSync(path.join(root, 'index.html'), production);
console.log('Prepared approved recruitment design for /recruit/index.html');
