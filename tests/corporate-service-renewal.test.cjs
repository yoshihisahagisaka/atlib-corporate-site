const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', 'public');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('approved Phase 1 service hierarchy and public links are present', () => {
  const home = read('index.html');
  const services = read('services/index.html');
  for (const id of ['kaizen', 'it-management-kaizen', 'business-kaizen', 'security', 'casual-consulting']) {
    assert.match(home, new RegExp(`id="${id}"`));
    assert.match(services, new RegExp(`id="${id}"`));
  }
  assert.match(home, /id="diagnosis"/u);
  for (const href of [
    'https://service.atlib.jp/it-management-kaizen/',
    'https://sales.atlib.jp/it-management-kaizen/free-diagnosis/',
    'https://service.atlib.jp/business-web/',
    'https://service.atlib.jp/business-web/self-check/',
    'https://www.atlib.jp/secumie-web/',
  ]) assert.match(home, new RegExp(`href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
});

test('corporate navigation is aligned while legacy anchors stay available', () => {
  for (const relative of ['index.html', 'company/index.html', 'services/index.html', 'works/index.html', 'contact/index.html']) {
    const html = read(relative);
    assert.match(html, /KAIZENサービス/u, relative);
    assert.match(html, /無料診断/u, relative);
    assert.match(html, /支援実績/u, relative);
    assert.match(html, /https:\/\/recruit\.atlib\.jp\//u, relative);
  }
  const home = read('index.html');
  const services = read('services/index.html');
  for (const id of ['link3', 'consultation-examples']) assert.match(home, new RegExp(`id="${id}"`));
  for (const id of ['service-list', 'it-bpo', 'it-projects']) assert.match(services, new RegExp(`id="${id}"`));
});

test('renewal styling remains isolated and official assets remain referenced', () => {
  const css = read('css/atlib-service-renewal.css');
  const home = read('index.html');
  assert.match(css, /Corporate Site Renewal Phase 1/u);
  assert.doesNotMatch(css, /(^|[},]\s*)(body|html|header|footer|#menubar)(?=[\s,{:#.])/mu);
  for (const asset of ['images/concept.jpg', 'images/mainimg2.jpg', 'images/mainimg3.jpg', 'images/brand/atlib-logo.png', 'images/brand/it-management-kaizen-logo-v1.png']) {
    assert.match(home, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(home, /class="work-section"/u);
  assert.match(home, /class="slide img1"/u);
});
