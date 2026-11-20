'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const read = (p) => fs.readFileSync(path.join(publicDir, p), 'utf8');
const HARASSMENT = 'https://www.atlib.jp/customer-harassment-policy/';
const PRIVACY = 'https://www.atlib.jp/privacy-policy/';

test('formal policies remain and duplicate privacy-policy pages are absent', () => {
  for (const p of ['privacy-policy/index.html', 'customer-harassment-policy/index.html']) {
    assert.ok(fs.existsSync(path.join(publicDir, p)), p);
  }
  for (const p of ['policy', 'recruit/policy']) {
    assert.ok(!fs.existsSync(path.join(publicDir, p)), 'Legacy privacy page must be removed: ' + p);
  }
  assert.doesNotMatch(read('recruit/sitemap.xml'), /recruit\.atlib\.jp\/policy\//);
});

test('corporate page footers link to the harassment policy', () => {
  for (const p of ['index.html', 'company/index.html', 'services/index.html', 'works/index.html', 'contact/index.html']) {
    const html = read(p);
    const footer = html.slice(html.indexOf('<footer'));
    assert.ok(footer.includes(HARASSMENT), 'Corporate footer missing policy: ' + p);
    assert.ok(footer.includes(PRIVACY), 'Corporate footer missing privacy: ' + p);
  }
});

test('recruitment page footers link to both unified corporate policies', () => {
  for (const p of [
    'recruit/index.html', 'recruit/message/index.html', 'recruit/company/index.html',
    'recruit/member/index.html', 'recruit/member/ia/index.html', 'recruit/member/mm/index.html',
    'recruit/member/sy/index.html', 'recruit/member/yt/index.html',
    'recruit/workstyle/index.html', 'recruit/requirements/index.html',
    'recruit/entry/thanks.html',
  ]) {
    const html = read(p);
    const footer = html.slice(html.indexOf('<footer'));
    assert.ok(footer.includes(HARASSMENT), 'Recruit footer missing policy: ' + p);
    assert.ok(footer.includes(PRIVACY), 'Recruit footer missing privacy: ' + p);
    assert.doesNotMatch(footer, /href="(?:\.\.\/)+policy\/?"/, p);
  }
});
