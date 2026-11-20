'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const preview = path.join(__dirname, '..', 'public', 'recruit', 'redesign-preview');
const html = fs.readFileSync(path.join(preview, 'index.html'), 'utf8');
const production = fs.readFileSync(path.join(preview, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(preview, 'assets', 'site.css'), 'utf8');
const js = fs.readFileSync(path.join(preview, 'assets', 'site.js'), 'utf8');

test('standalone preview remains noindex independently of approved production homepage', () => {
  assert.ok(fs.existsSync(path.join(preview, '..', 'index.html')));
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  assert.equal((html.match(/<!--License20261119vzyRP-->/g) || []).length, 1);
  assert.match(html, /<html lang="ja">/);
  assert.match(html, /<main id="main">/);
});

test('release homepage has approved content, working asset routes and existing analytics', () => {
  const approvedBody = html.slice(html.indexOf('<body>'))
    .replaceAll('href="../', 'href="./')
    .replaceAll('./assets/', './redesign-preview/assets/');
  assert.equal(production.slice(production.indexOf('<body>')), approvedBody, 'The visible homepage body must match the approved design');
  assert.equal((production.match(/<!--License20261119vzyRP-->/g) || []).length, 1);
  assert.doesNotMatch(production, /noindex|リニューアルプレビュー|<form\b/);
  assert.match(production, /<title>採用情報 \| atLIB株式会社<\/title>/);
  assert.match(production, /<link rel="canonical" href="https:\/\/recruit\.atlib\.jp\/">/);
  assert.match(production, /<meta property="og:url" content="https:\/\/recruit\.atlib\.jp\/">/);
  assert.match(production, /G-1CBDCR2PD0/);
  assert.match(production, /xtjmp7ly4g/);
  assert.match(production, /https:\/\/www\.atlib\.jp\/company\//);
  assert.match(production, /href="\.\/entry\/" class="recruit-entry-link"/);
  assert.match(production, /atLIBの<br class="mobile-narrow-only"><span>「今」<\/span>を知る。/);
  for (const asset of [...production.matchAll(/(?:src|href)="(\.\/(?:redesign-preview\/assets|images)\/[^"?]+)/g)]) {
    const file = path.join(preview, '..', asset[1]);
    assert.ok(fs.existsSync(file), `Missing production asset: ${asset[1]}`);
  }
  for (const link of [...production.matchAll(/href="(\.\/(?:message|member|workstyle|entry|policy)\/?)"/g)]) {
    assert.ok(fs.existsSync(path.resolve(preview, '..', link[1])), `Missing production page: ${link[1]}`);
  }
});

test('main menu goes directly to its destination pages and corporate links are retained', () => {
  for (const section of ['values', 'people', 'note', 'workstyle', 'recruit']) {
    assert.match(html, new RegExp('id="' + section + '"'));
  }
  assert.ok((html.match(/https:\/\/www\.atlib\.jp\//g) || []).length >= 3);
  assert.match(html, /href="\.\/" class="brand"/);
  assert.match(html, /href="\.\.\/message\/"/);
  assert.match(html, /href="\.\.\/workstyle\/"/);
  assert.match(html, /href="\.\.\/member\/"/);
  assert.match(html, /href="\.\.\/entry\/"/);
  assert.ok((html.match(/href="https:\/\/www\.atlib\.jp\/company\/"/g) || []).length === 2);
  assert.doesNotMatch(html, /href="\.\.\/requirements\/"|href="#work"|id="work"/);
  assert.doesNotMatch(html, /仕事を知る|募集要項/);
});

test('official atLIB note is prominent, correctly linked and accessible on mobile', () => {
  assert.match(html, /<section class="note-section section" id="note" aria-labelledby="note-title">/);
  assert.ok(html.indexOf('id="people"') < html.indexOf('id="note"'));
  assert.ok(html.indexOf('id="note"') < html.indexOf('id="workstyle"'));
  assert.match(html, /atLIB公式noteを読む/);
  assert.ok((html.match(/href="https:\/\/note\.com\/atlib"/g) || []).length >= 3);
  assert.match(html, /href="https:\/\/note\.com\/atlib" target="_blank" rel="noopener noreferrer" aria-label="atLIB公式noteを読む（新しいタブで開きます）"/);
  assert.match(html, /公式note（記事を読む）/);
  assert.match(css, /\.note-feature\{position:relative;display:grid;/);
  assert.match(css, /@media \(max-width:700px\)[\s\S]*\.note-feature\{display:flex;flex-direction:column;/);
  assert.match(css, /\.note-button\{width:100%;min-height:50px;/);
  assert.match(html, /atLIBの<br class="mobile-narrow-only"><span>「今」<\/span>を知る。/);
  assert.match(css, /@media \(max-width:359px\)[^\n]*\.mobile-narrow-only\{display:initial\}/);
});

test('every local preview image is present and non-empty', () => {
  const imagePaths = [...html.matchAll(/<img[^>]*src="(\.\/assets\/[^\"]+)"/g)].map((match) => match[1]);
  assert.ok(imagePaths.length >= 5);
  for (const asset of imagePaths) {
    const file = path.join(preview, asset);
    assert.ok(fs.existsSync(file), asset);
    assert.ok(fs.statSync(file).size > 1000, asset);
  }
});

test('provided official atLIB logo replaces text imitation in header and footer', () => {
  assert.ok((html.match(/src="\.\/assets\/atlib-logo\.png"/g) || []).length === 2);
  assert.doesNotMatch(html, /brand-word|brand-caption|RECRUIT \/ atLIB/);
  const logo = fs.readFileSync(path.join(preview, 'assets', 'atlib-logo.png'));
  assert.equal(logo.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  for (const sharedImage of ['h-logo.png', 'logo_ft.png']) {
    assert.ok(fs.readFileSync(path.join(preview, '..', 'images', 'common', sharedImage)).equals(logo));
  }
});

test('decorative English subtitles are removed and geometric layout remains', () => {
  assert.doesNotMatch(html, /OUR PROMISE|OUR VALUES|OUR PEOPLE|OUR WORK|WORK STYLE|STORIES FROM|atLIB JOURNAL|SCROLL TO EXPLORE|JOB 01|JOB 02/);
  assert.match(css, /\.hero-photo-primary\{border-radius:0 155px 0 0;transform:none\}/);
  assert.match(css, /\.note-feature\{border-radius:0 90px 0 0\}/);
  assert.match(html, /採用エントリーはこちら/);
});

test('reachable legacy subpages no longer advertise old requirements or English kickers', () => {
  const pages = ['message/index.html', 'company/index.html', 'member/index.html', 'member/ia/index.html', 'member/mm/index.html', 'member/sy/index.html', 'member/yt/index.html', 'workstyle/index.html', 'entry/index.html', 'entry/thanks.html'];
  for (const page of pages) {
    const content = fs.readFileSync(path.join(preview, '..', page), 'utf8');
    assert.doesNotMatch(content, /href="(?:\.\.\/)+requirements\/?"/, page);
    assert.doesNotMatch(content, /<p>[A-Z][A-Z ]+<\/p>/, page);
  }
});

test('all relative navigation links resolve to existing content', () => {
  const paths = [...html.matchAll(/\bhref="(\.\.?\/[^"#]+)"/g)].map((match) => match[1]);
  assert.ok(paths.length >= 8);
  for (const href of paths) {
    const target = path.resolve(preview, href.split('?')[0]);
    assert.ok(fs.existsSync(target), 'Missing local link: ' + href);
  }
});

test('mobile layout hides secondary hero photo and keeps the FV content-sized', () => {
  assert.match(css, /@media \(max-width:700px\)/);
  assert.match(css, /\.hero-grid\{display:flex;flex-direction:column;[^}]*min-height:0/);
  assert.match(css, /\.hero-photo-secondary,\.hero-ring,\.hero-side-label\{display:none\}/);
  assert.doesNotMatch(css, /height:100vh|height:100svh|min-height:100vh|min-height:100svh/);
  assert.match(css, /\.menu-toggle\{width:44px;height:44px/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('mobile menu has keyboard escape behavior and accurate state', () => {
  assert.match(html, /aria-expanded="false" aria-controls="mobile-menu"/);
  assert.match(html, /id="mobile-menu"[^>]*hidden/);
  assert.match(js, /event\.key === 'Escape'/);
  assert.match(js, /setAttribute\('aria-expanded', String\(open\)\)/);
  assert.match(js, /returnFocus\) toggle\.focus\(\)/);
  assert.match(html, /class="back-to-top"[^>]*hidden/);
});

test('mobile navigation opens, closes and restores focus on Escape', () => {
  const handlers = {};
  const toggle = {
    attributes: { 'aria-expanded': 'false' },
    addEventListener(type, handler) { this[type] = handler; },
    getAttribute(key) { return this.attributes[key]; },
    setAttribute(key, value) { this.attributes[key] = value; },
    focus() { this.wasFocused = true; },
  };
  const navLink = { addEventListener(type, handler) { this[type] = handler; } };
  const menu = { hidden: true, querySelectorAll() { return [navLink]; } };
  const backToTop = { hidden: true };
  const header = { contains(target) { return target === this; } };
  const document = {
    querySelector(selector) {
      return { '.site-header': header, '.menu-toggle': toggle, '.back-to-top': backToTop }[selector];
    },
    getElementById(id) { return id === 'mobile-menu' ? menu : null; },
    addEventListener(type, handler) { handlers[type] = handler; },
  };
  const window = {
    scrollY: 0,
    matchMedia() { return { addEventListener() {} }; },
    addEventListener(type, handler) { handlers[type] = handler; },
    requestAnimationFrame(handler) { handler(); },
  };
  vm.runInNewContext(js, { document, window });
  toggle.click();
  assert.equal(menu.hidden, false);
  assert.equal(toggle.attributes['aria-expanded'], 'true');
  handlers.keydown({ key: 'Escape' });
  assert.equal(menu.hidden, true);
  assert.equal(toggle.wasFocused, true);
  toggle.click();
  navLink.click();
  assert.equal(menu.hidden, true);
  window.scrollY = 500;
  handlers.scroll();
  assert.equal(backToTop.hidden, false);
});

test('all applications go to verified Indeed job listings with no site entry form', () => {
  const entry = fs.readFileSync(path.join(preview, '..', 'entry', 'index.html'), 'utf8');
  assert.doesNotMatch(entry, /<form\b|id="entryForm"|action="confirm\.php"/);
  assert.match(entry, /href="https:\/\/jp\.indeed\.com\/viewjob\?jk=e7592cdea7a7172f"/);
  assert.match(entry, /href="https:\/\/jp\.indeed\.com\/viewjob\?jk=4ad7fa0e5f35888c"/);
  assert.match(html, /href="\.\.\/entry\/" class="recruit-entry-link"/);
});

test('new top and legacy detail pages share the same primary navigation', () => {
  const navLabels = (content, className) => {
    const nav = content.match(new RegExp('<nav class="' + className + '"[^>]*>([\\s\\S]*?)<\\/nav>'));
    assert.ok(nav, className);
    return [...nav[1].matchAll(/<a\b[^>]*>([^<]+)<\/a>/g)].map((match) => match[1]);
  };
  const expected = ['私たちの想い', '会社を知る', '人を知る', '働く環境', '公式note', 'エントリー'];
  assert.deepEqual(navLabels(html, 'desktop-nav'), expected);
  assert.deepEqual(navLabels(html, 'mobile-nav'), [...expected, 'コーポレートサイトへ']);
  for (const page of ['message/index.html', 'member/index.html', 'member/ia/index.html', 'member/mm/index.html', 'member/sy/index.html', 'member/yt/index.html', 'workstyle/index.html', 'company/index.html', 'requirements/index.html', 'entry/index.html', 'entry/thanks.html']) {
    const content = fs.readFileSync(path.join(preview, '..', page), 'utf8');
    assert.deepEqual(navLabels(content, 'recruit-nav-desktop'), expected, page);
    assert.deepEqual(navLabels(content, 'recruit-nav-mobile'), [...expected, 'コーポレートサイトへ'], page);
    assert.doesNotMatch(content, /href="(?:\.\.\/)+company\/?"/, page);
  }
  assert.ok(fs.existsSync(path.join(preview, '..', 'css/recruit-nav.css')));
  assert.ok(fs.existsSync(path.join(preview, '..', 'js/recruit-nav.js')));
});
