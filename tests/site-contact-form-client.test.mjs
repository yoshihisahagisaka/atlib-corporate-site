import assert from 'node:assert/strict';
import test from 'node:test';
import { contactApiUrl, contactCanSubmit, contactPayload } from '../public/js/contact-form.mjs';

test('submission stays disabled when the site is in preview or using the test Turnstile key', () => {
  const endpoint = 'https://api.atlib.jp/api/contact';
  assert.equal(contactCanSubmit({ enabled: 'false', endpoint, sitekey: 'production-key' }), false);
  assert.equal(contactCanSubmit({ enabled: 'true', endpoint: '', sitekey: 'production-key' }), false);
  assert.equal(contactCanSubmit({ enabled: 'true', endpoint, sitekey: '1x00000000000000000000AA' }), false);
  assert.equal(contactCanSubmit({ enabled: 'true', endpoint, sitekey: 'production-key' }), true);
});

test('API endpoint requires HTTPS and the exact contact route', () => {
  assert.equal(contactApiUrl('/api/contact'), '/api/contact');
  assert.equal(contactApiUrl('/api/contact?redirect=https://evil.example'), null);
  assert.equal(contactApiUrl('http://api.atlib.jp/api/contact'), null);
  assert.equal(contactApiUrl('https://api.atlib.jp/collect'), null);
  assert.equal(contactApiUrl('https://api.atlib.jp/api/contact?redirect=https://evil.example'), null);
  assert.equal(contactApiUrl('https://api.atlib.jp/api/contact'), 'https://api.atlib.jp/api/contact');
});

test('payload maps existing form names to API fields with no arbitrary destination', () => {
  const result = contactPayload({
    inquiryType: 'other', company: ' 株式会社テスト ', name: ' 山田 太郎 ',
    email: ' user@example.com ', phone: '', message: ' 相談です ',
    privacyConsent: true, website: '',
  }, 'token');
  assert.deepEqual(result, {
    inquiryType: 'other', company: '株式会社テスト', name: '山田 太郎',
    email: 'user@example.com', phone: '', message: '相談です',
    privacyConsent: true, website: '', turnstileToken: 'token',
  });
  assert.equal(Object.hasOwn(result, 'to'), false);
});
