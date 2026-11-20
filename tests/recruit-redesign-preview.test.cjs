'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'public', 'recruit');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'site.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'assets', 'site.js'), 'utf8');

test('approved recruitment site keeps production metadata and entry links', () => {
  assert.match(html, /<!--License20261119vzyRP-->/);
  assert.match(html, /<link rel="canonical" href="https:\/\/recruit\.atlib\.jp\/">/);
  assert.doesNotMatch(html, /noindex|redesign-preview|採用エントリーはこちら/);
  assert.match(html, /id="recruit"/);
  assert.match(html, /href="#recruit"/);
  assert.match(html, /https:\/\/jp\.indeed\.com\/viewjob\?jk=e7592cdea7a7172f/);
  assert.match(html, /https:\/\/jp\.indeed\.com\/viewjob\?jk=4ad7fa0e5f35888c/);
  assert.match(html, /href="https:\/\/www\.atlib\.jp\/privacy-policy\/"/);
});

test('production asset references exist outside retired preview', () => {
  const refs = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"?]+)/g)].map((m) => m[1]);
  assert.ok(refs.length >= 8);
  for (const asset of refs) {
    const file = path.join(root, 'assets', asset);
    assert.ok(fs.existsSync(file), 'Missing asset: ' + asset);
    assert.ok(fs.statSync(file).size > 500, 'Empty asset: ' + asset);
  }
  assert.match(css, /\.hero .hero-green-plane/);
  assert.match(css, /\.recruit-job-desc/);
  assert.match(js, /event\.key === 'Escape'/);
});

test('obsolete public recruitment pages are removed', () => {
  for (const dir of ['policy', 'requirements', 'redesign-preview']) {
    assert.equal(fs.existsSync(path.join(root, dir)), false, 'Obsolete directory remains: ' + dir);
  }
  assert.ok(fs.existsSync(path.join(root, 'entry', 'index.html')), 'Keep legacy entry redirect until a server-side 301 replaces it');
  const oldEntry = fs.readFileSync(path.join(root, 'entry', 'index.html'), 'utf8');
  assert.match(oldEntry, /\.\.\/#recruit/);
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  assert.doesNotMatch(sitemap, /\/policy\/|\/requirements\/|\/entry\//);
});

test('primary navigation and mobile menu remain present', () => {
  const nav = html.match(/<nav class="desktop-nav"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav);
  for (const label of ['私たちの想い', '会社を知る', '人を知る', '働く環境', '公式note', 'エントリー']) {
    assert.ok(nav[1].includes(label), 'Missing nav: ' + label);
  }
  assert.match(html, /id="mobile-menu"/);
  assert.match(js, /setAttribute\('aria-expanded', String\(open\)\)/);
});
