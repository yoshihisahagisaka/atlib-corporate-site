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

test('approved v4 separates the editorial home from the detailed service catalogue', () => {
  const home = read('index.html');
  const services = read('services/index.html');
  const css = read('css/atlib-service-renewal.css');
  for (const value of ['renewal-brand-thinking', 'renewal-brand-values', 'renewal-brand-services', 'renewal-brand-diagnosis']) {
    assert.match(home, new RegExp(value, 'u'));
  }
  assert.ok(home.indexOf('id="link1"') < home.indexOf('id="link4"'));
  assert.ok(home.indexOf('id="link4"') < home.indexOf('id="track-record"'));
  assert.ok(home.indexOf('id="track-record"') < home.indexOf('id="kaizen"'));
  assert.ok(home.indexOf('id="track-record"') < home.indexOf('renewal-brand-clients'));
  assert.ok(home.indexOf('renewal-brand-clients') < home.indexOf('id="kaizen"'));
  assert.ok(home.indexOf('id="kaizen"') < home.indexOf('class="motion-section"'));
  assert.ok(home.indexOf('class="mission-section') < home.indexOf('id="diagnosis"'));
  assert.match(services, /UNDERSTAND \/ DESIGN \/ BUILD/u);
  assert.match(services, /業務理解・要件設計・開発/u);
  assert.match(services, /renewal-advisory-options/u);
  assert.match(services, /月額相談/u);
  assert.match(services, /必要なときに別途依頼/u);
  assert.match(services, /id="link5"/u);
  assert.doesNotMatch(home, /renewal-flow|renewal-advisory-options|renewal-diagnostic-visual/u);
  for (const html of [home, services]) assert.doesNotMatch(html, /KAIZENとは独立したサービス|従来の常駐型情シスアウトソーシングではなく|公開済みの3つの無料診断/u);
  assert.match(css, /Corporate Brand Design v4/u);
});

test('previously published client logos are restored from existing assets only', () => {
  const home = read('index.html');
  assert.match(home, /id="renewal-brand-clients-title">主な取引企業/u);
  for (const [file, company] of [
    ['mixi', '株式会社MIXI'], ['shinei', 'シンエイ動画株式会社'],
    ['glm', '株式会社グローバル・リンク・マネジメント'], ['gks', '株式会社ゲンバカンリシステムズ'],
    ['yamato', '株式会社大和バルブ'], ['tokai', '藤海ビルサービス株式会社'],
    ['micren', 'マイクレン・ヘルスケア株式会社'], ['vidaway', '株式会社Vidaway'],
  ]) {
    assert.match(home, new RegExp(`images/partner_logo_${file}\\.png[^>]+alt="${company}"`, 'u'));
  }
});

test('human review v2 logo, copy removals and IT management explainer are exact', () => {
  const home = read('index.html');
  const services = read('services/index.html');
  const css = read('css/atlib-service-renewal.css');
  assert.match(home, /src="business-web\/assets\/gyomu-kaizen-logo\.png"[^>]*alt="業務KAIZEN"/u);
  assert.match(services, /src="\.\.\/business-web\/assets\/gyomu-kaizen-logo\.png"[^>]*alt="業務KAIZEN"/u);
  for (const html of [home, services]) {
    assert.doesNotMatch(html, /無料診断からのご利用をおすすめ|全社員向けヘルプデスク、継続管理、無制限の実作業/u);
  }
  assert.doesNotMatch(home, /BUILDは運用開始に必要な初期整備/u);
  assert.match(services, /id="management-explainer-title">IT経営KAIZENとは/u);
  assert.match(services, /考えることから、実行すること。<br>そして、改善を続けること。/u);
  for (const value of ['設計Assessment', '実行支援', '運用支援', '継続KAIZEN']) assert.match(services, new RegExp(value, 'u'));
  for (const id of ['it-projects', 'it-bpo']) assert.match(services, new RegExp(`id="${id}"`, 'u'));
  assert.doesNotMatch(services, /IT経営KAIZENの実行・運用支援/u);
  assert.match(css, /\.renewal-management-services \{[^}]*grid-template-columns: repeat\(2,/u);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.renewal-management-services \{ grid-template-columns: 1fr; \}/u);
});
