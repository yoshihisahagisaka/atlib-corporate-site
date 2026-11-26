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

test('official MIXI and ISMS assets and certification facts are exact', () => {
  const crypto = require('node:crypto');
  const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
  const home = read('index.html');
  const company = read('company/index.html');
  assert.equal(hash('images/partner_logo_mixi.png'), 'de166bd8fb91d8edf30f9fbaa6b01e32ef8d2d89fda98e438ab6ee2ae2b37f53');
  assert.equal(hash('images/isms-gcerti-gijp-1167-ic.png'), '89725ad37e6ada14766b8b0f8beb31061292832d066ecbccaa6047d4bb383678');
  assert.match(home, /class="renewal-brand-client-logo-mixi"[^>]+width="6000" height="3614"/u);
  for (const html of [home, company, read('services/index.html'), read('works/index.html'), read('contact/index.html')]) {
    assert.match(html, /ISO\/IEC 27001:2022/u);
    assert.match(html, /情報セキュリティマネジメントシステム/u);
    assert.match(html, /認証番号：GIJP-1167-IC/u);
    assert.doesNotMatch(html, /認証範囲|認証対象事業所|認証(?:の)?(?:有効期間|有効期限)|2026年12月1日|2029年11月30日/u);
  }
  for (const relative of ['index.html', 'company/index.html', 'services/index.html', 'works/index.html', 'contact/index.html']) assert.match(read(relative), /class="renewal-isms-footer"/u, relative);
  for (const relative of ['index.html', 'company/index.html', 'services/index.html', 'works/index.html', 'contact/index.html']) assert.doesNotMatch(read(relative), /IAF/u, relative);
  for (const relative of ['index.html', 'company/index.html', 'services/index.html', 'works/index.html', 'contact/index.html']) assert.doesNotMatch(read(relative), /IAS|MSCB-113/u, relative);
});

test('human review final adjustments remove public status and phone copy while preserving paths', () => {
  const home = read('index.html');
  const services = read('services/index.html');
  const company = read('company/index.html');
  const css = read('css/atlib-service-renewal.css');
  assert.match(home, /renewal-brand-client-frame renewal-brand-client-frame-mixi/u);
  assert.match(css, /\.renewal-brand-client-frame-mixi \{[^}]*border: 1px solid #dbe2e8;[^}]*background: #fff;/u);
  assert.doesNotMatch(services, /商用公開準備中|構成検証中|「準備中」「検証中」|renewal-status/u);
  assert.doesNotMatch(company, /03-6661-1616|tel:0366611616/u);
  assert.match(company, /href="\.\.\/contact\/"/u);
  assert.match(css, /\.services-page main > \.renewal-advisory \{ margin: 0; padding-block: clamp\(1\.75rem, 2\.5vw, 3rem\); \}/u);
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


test('R3 editorial headings, diagram and section boundaries are structurally isolated', () => {
  const home = read('index.html');
  const services = read('services/index.html');
  const css = read('css/atlib-service-renewal.css');
  assert.doesNotMatch(home, /<header class="renewal-brand-heading/u);
  assert.equal([...home.matchAll(/<div class="renewal-brand-heading inview">/gu)].length, 4);
  const diagram = services.match(/<figure class="renewal-management-cycle">[\s\S]*?<\/figure>/u)?.[0];
  assert.ok(diagram);
  assert.equal([...diagram.matchAll(/class="renewal-cycle-step /gu)].length, 4);
  assert.doesNotMatch(diagram, /<(?:a|button)\b|role="button"|tabindex=/u);
  assert.match(css, /\.renewal-brand-heading \{ display: block;/u);
  assert.match(css, /\.services-page main > \.renewal-security \{ background: #f4f8f7; border-top:/u);
  assert.match(css, /\.services-page main > \.workflow-section#link5 \{ margin: 0;/u);
});
