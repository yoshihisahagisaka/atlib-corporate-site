import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validTargetUrl, temporaryIntakeMessage } from '../public/js/secumie-web-temporary.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(dir, '../public/secumie-web/index.html'), 'utf8');

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
});
