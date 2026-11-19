'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const preview = path.join(__dirname, '..', 'public', 'recruit', 'redesign-preview');
const html = fs.readFileSync(path.join(preview, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(preview, 'assets', 'site.css'), 'utf8');
const js = fs.readFileSync(path.join(preview, 'assets', 'site.js'), 'utf8');

test('standalone preview does not replace existing recruit homepage', () => {
  assert.ok(fs.existsSync(path.join(preview, '..', 'index.html')));
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(html, /<html lang="ja">/);
  assert.match(html, /<main id="main">/);
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
  assert.match(css, /@media\(max-width:700px\)[\s\S]*\.note-feature\{display:flex;flex-direction:column;/);
  assert.match(css, /\.note-button\{min-height:49px;width:100%;/);
  assert.match(html, /atLIBの<br class="mobile-narrow-only"><span>「今」<\/span>を知る。/);
  assert.match(css, /@media\(max-width:380px\)[\s\S]*\.mobile-narrow-only\{display:initial\}/);
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
  assert.match(html, /class="hero-green-plane"/);
  assert.match(html, /class="hero-lines hero-lines-top"/);
  assert.match(html, /class="hero-photo-secondary"/);
  assert.match(css, /\.hero-green-plane\{[^}]*clip-path:polygon\(/);
  assert.match(css, /\.hero-photo-secondary\{[^}]*clip-path:polygon\(/);
  assert.match(css, /\.note-feature\{position:relative;display:grid;/);
  assert.match(html, /採用エントリーはこちら/);
});

test('reachable legacy subpages no longer advertise old requirements or English kickers', () => {
  const pages = ['message/index.html', 'company/index.html', 'member/index.html', 'member/ia/index.html', 'member/mm/index.html', 'member/sy/index.html', 'member/yt/index.html', 'workstyle/index.html', 'policy/index.html', 'entry/index.html', 'entry/thanks.html'];
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
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /\.hero\{height:auto;min-height:0;/);
  assert.match(css, /\.hero-photo-secondary\{display:none\}/);
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

test('external applications are not linked to unverified Indeed URLs', () => {
  assert.doesNotMatch(html, /href="https?:\/\/(?:jp\.)?indeed\.com/);
  assert.match(html, /href="\.\.\/entry\/" class="recruit-entry-link"/);
});
