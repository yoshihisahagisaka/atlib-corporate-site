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

test('all in-page navigation targets exist and corporate links are retained', () => {
  for (const section of ['values', 'work', 'people', 'note', 'workstyle', 'recruit']) {
    assert.match(html, new RegExp('id="' + section + '"'));
    assert.match(html, new RegExp('href="#' + section + '"'));
  }
  assert.ok((html.match(/https:\/\/www\.atlib\.jp\//g) || []).length >= 3);
  assert.match(html, /href="\.\/" class="brand"/);
  assert.match(html, /href="\.\.\/workstyle\/"/);
  assert.match(html, /href="\.\.\/member\/"/);
  assert.match(html, /href="\.\.\/requirements\/"/);
});

test('official atLIB note is prominent, correctly linked and accessible on mobile', () => {
  assert.match(html, /<section class="note-section section" id="note" aria-labelledby="note-title">/);
  assert.ok(html.indexOf('id="people"') < html.indexOf('id="note"'));
  assert.ok(html.indexOf('id="note"') < html.indexOf('id="workstyle"'));
  assert.match(html, /atLIB公式noteを読む/);
  assert.match(html, /href="#note"><span>＋<\/span> 公式noteで知る/);
  assert.ok((html.match(/href="https:\/\/note\.com\/atlib"/g) || []).length >= 2);
  assert.match(html, /href="https:\/\/note\.com\/atlib" target="_blank" rel="noopener noreferrer" aria-label="atLIB公式noteを読む（新しいタブで開きます）"/);
  assert.match(html, /公式note（記事を読む）/);
  assert.match(css, /\.note-feature\{position:relative;display:grid;/);
  assert.match(css, /@media \(max-width:700px\)[\s\S]*\.note-feature\{display:flex;flex-direction:column;/);
  assert.match(css, /\.note-button\{width:100%;min-height:50px;/);
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

test('external applications are not linked to unverified Indeed URLs', () => {
  assert.doesNotMatch(html, /href="https?:\/\/(?:jp\.)?indeed\.com/);
  assert.match(html, /募集職種・応募条件は募集要項ページでご確認ください。/);
});
