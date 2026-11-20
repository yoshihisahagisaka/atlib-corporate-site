import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validTargetUrl, temporaryIntakeMessage, setSecumieScreen, bindSecumieScreen } from '../public/js/secumie-web-temporary.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(dir, '../public/secumie-web/index.html'), 'utf8');
const script = readFileSync(path.join(dir, '../public/js/secumie-web-temporary.mjs'), 'utf8');

test('temporary intake requires company, union, website and contact details', () => {
  for (const name of ['unionName', 'company', 'registeredAddress', 'targetUrl', 'name', 'email', 'phone', 'privacyConsent']) {
    assert.match(html, new RegExp(`name="${name}"[^>]*required`));
  }
  assert.match(html, /data-intake-enabled="__SECUMIE_TEMP_ENABLED__"/);
  assert.match(html, /data-contact-api-url="\/api\/contact"/);
  assert.match(html, /data-action="contact"/);
  assert.match(html, /__TURNSTILE_SITE_KEY__/);
  assert.match(html, /https:\/\/www\.atlib\.jp\/privacy-policy\//);
});

test('temporary intake shows a compact form and the exact report-delivery receipt copy', () => {
  assert.doesNotMatch(html, /class="intro"|class="form-help"|id="form-title"/);
  assert.doesNotMatch(html, /社内ネットワークへの接続や、パスワードの提出/);
  assert.doesNotMatch(html, /必須項目をご入力ください。所属組合名は正式名称/);
  assert.match(html, /<h2>お申し込みを受け付けました<\/h2>/);
  assert.match(html, /<p>診断結果はこの画面には表示されません。<\/p>/);
  assert.match(html, /<p>診断実施の上、後日セキュリティ診断報告レポートをatLIBから送付いたします。<\/p>/);
});

test('temporary intake uses the protected contact API and never claims automatic data sharing', () => {
  assert.match(html, /協会・所属組合へ担当者情報や診断結果を自動提供することはありません/);
  assert.doesNotMatch(html, /api\/public\/secumie-web\/v1\/requests/);
  assert.equal(validTargetUrl('https://example.jp/path'), true);
  for (const url of ['http://example.jp', 'javascript:alert(1)', 'https://user:pass@example.jp', 'not-a-url']) {
    assert.equal(validTargetUrl(url), false);
  }
  const message = temporaryIntakeMessage({unionName:' 組合A\r\n',registeredAddress:'東京都中央区',targetUrl:'https://example.jp/'});
  assert.match(message, /所属組合：組合A\n/);
  assert.match(message, /診断対象URL：https:\/\/example\.jp\//);
  assert.match(message, /自動提供なし/);
  assert.throws(() => temporaryIntakeMessage({unionName:'A',registeredAddress:'B',targetUrl:'http://example.jp'}));
  assert.match(script, /body\.source = 'secumie_web_temporary'/);
  assert.match(script, /body\.targetUrl = targetUrl\.trim\(\)/);
});

test('guide and application are two panels on the same URL, keeping the original intake', () => {
  assert.match(html, /id="secumie-guide" class="guide-screen"/);
  assert.match(html, /id="secumie-form-view"[^>]* hidden>/);
  assert.match(html, /id="secumie-temporary-form"/);
  assert.match(html, /data-secumie-open-form/g);
  assert.match(html, /結果のご説明・ご相談/);
  assert.match(html, /すべての脆弱性や不正アクセスの有無を確認するものではありません/);

  const events = {};
  const makeElement = (name) => ({
    hidden: name === 'form',
    focus() { events.focus = name; },
    scrollIntoView() { events.scroll = name; },
    addEventListener(type, handler) { events[name + ':' + type] = handler; },
  });
  const els = {
    'secumie-guide': makeElement('guide'),
    'secumie-form-view': makeElement('form'),
    'secumie-guide-heading': makeElement('guide-heading'),
    'secumie-form-heading': makeElement('form-heading'),
    'secumie-back-to-guide': makeElement('back'),
  };
  const triggers = [makeElement('open1'), makeElement('open2')];
  const doc = {
    getElementById(id) { return els[id] ?? null; },
    querySelectorAll(selector) { return selector === '[data-secumie-open-form]' ? triggers : []; },
  };
  assert.equal(bindSecumieScreen(doc), true);
  events['open1:click']();
  assert.equal(els['secumie-guide'].hidden, true);
  assert.equal(els['secumie-form-view'].hidden, false);
  assert.equal(events.focus, 'form-heading');
  events['back:click']();
  assert.equal(els['secumie-guide'].hidden, false);
  assert.equal(els['secumie-form-view'].hidden, true);
  assert.equal(events.focus, 'guide-heading');
  assert.equal(setSecumieScreen(doc, 'other'), false);
});
