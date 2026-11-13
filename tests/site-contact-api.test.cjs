const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const {
  createSiteContactApiRouter,
  safeSmtpFailure,
  verifySiteContactTurnstile,
} = require('../dist/routes/siteContactApi');

const allowedOrigin = 'https://atlib-tp65-brand-preview.yoshihisa-hagisaka.chatgpt.site';
const config = {
  turnstileSecret: 'test-only-secret',
  allowedOrigins: [allowedOrigin, 'https://www.atlib.jp'],
  allowedTurnstileHostnames: ['atlib-tp65-brand-preview.yoshihisa-hagisaka.chatgpt.site', 'www.atlib.jp'],
  diagnosticLogs: false,
};
const valid = {
  inquiryType: 'services',
  company: '株式会社テスト',
  name: 'テスト 太郎',
  email: 'customer@example.com',
  phone: '',
  message: '日本語で相談したいです。',
  privacyConsent: true,
  website: '',
  turnstileToken: 'example-token',
};

async function withApi(run, options = {}) {
  const sent = [];
  const mailer = options.mailer ?? {
    async sendContactNotification(to, data) { sent.push({ to, data }); },
  };
  const verifyCalls = [];
  const verify = options.verify ?? (async (input) => { verifyCalls.push(input); return true; });
  const app = express();
  app.use(createSiteContactApiRouter(mailer, options.config ?? config, verify, options.logger));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (payload = valid, opts = {}) => fetch(`${base}/api/contact`, {
    method: opts.method ?? 'POST',
    headers: { Origin: allowedOrigin, 'Content-Type': 'application/json', ...opts.headers },
    body: opts.raw ?? JSON.stringify(payload),
  });
  try {
    await run({ base, post, sent, verifyCalls });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('sends a notification only to the approved ML with the customer as Reply-To data', async () => {
  await withApi(async ({ post, sent, verifyCalls }) => {
    const response = await post();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, code: 'accepted' });
    assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'contact@atlib.jp');
    assert.equal(sent[0].data.email, 'customer@example.com');
    assert.equal(sent[0].data.inquiry_type, 'サービスについてのご相談');
    assert.match(sent[0].data.message, /日本語で相談したいです。/);
    assert.equal(verifyCalls.length, 1);
    assert.equal(verifyCalls[0].secret, 'test-only-secret');
  });
});

test('rejects invalid fields, honeypot hits, and forged headers before verification', async () => {
  await withApi(async ({ post, sent, verifyCalls }) => {
    for (const payload of [
      { ...valid, inquiryType: 'invalid' },
      { ...valid, privacyConsent: false },
      { ...valid, website: 'bot-filled' },
      { ...valid, email: 'a@example.com\nBcc:evil@example.com' },
      { ...valid, turnstileToken: '' },
    ]) {
      assert.equal((await post(payload)).status, 400);
    }
    assert.equal(sent.length, 0);
    assert.equal(verifyCalls.length, 0);
  });
});

test('Turnstile denial and verification outage never send mail', async () => {
  await withApi(async ({ post }) => assert.equal((await post()).status, 403), {
    verify: async () => false,
  });
  await withApi(async ({ post }) => assert.equal((await post()).status, 403), {
    verify: async () => { throw new Error('siteverify unavailable'); },
  });
});

test('accepts only explicitly allowed browser origins and valid preflight', async () => {
  await withApi(async ({ base, post, sent }) => {
    assert.equal((await post(valid, { headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await post(valid, { headers: { Origin: '' } })).status, 403);
    const preflight = await fetch(`${base}/api/contact`, {
      method: 'OPTIONS',
      headers: { Origin: allowedOrigin, 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), allowedOrigin);
    assert.equal(sent.length, 0);
  });
});

test('configuration missing, wrong method, wrong content type, malformed and huge JSON fail closed', async () => {
  await withApi(async ({ post }) => assert.equal((await post()).status, 503), {
    config: { ...config, turnstileSecret: '' },
  });
  await withApi(async ({ post, base }) => {
    assert.equal((await fetch(`${base}/api/contact`, { method: 'GET', headers: { Origin: allowedOrigin } })).status, 405);
    assert.equal((await post(valid, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal((await post(valid, { raw: '{not-json' })).status, 400);
    assert.equal((await post({ ...valid, message: 'a'.repeat(33000) })).status, 413);
  });
});

test('SMTP failure never reports acceptance', async () => {
  await withApi(async ({ post }) => {
    const response = await post();
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { ok: false, code: 'notification_failed' });
  }, { mailer: { async sendContactNotification() { throw new Error('smtp failed'); } } });
});

test('Staging diagnostic logs contain only trace-correlated allowlisted SMTP fields', async () => {
  const events = [];
  const logger = {
    info(fields, message) { events.push({ level: 'info', fields, message }); },
    warn(fields, message) { events.push({ level: 'warn', fields, message }); },
  };
  const smtpError = Object.assign(new Error('raw response with customer@example.com'), {
    code: 'EAUTH',
    responseCode: 535,
    command: 'AUTH PLAIN',
    response: 'credential and address must never be logged',
  });
  await withApi(async ({ post }) => {
    const response = await post();
    assert.equal(response.status, 502);
  }, {
    config: { ...config, diagnosticLogs: true },
    logger,
    mailer: { async sendContactNotification() { throw smtpError; } },
  });
  assert.deepEqual(events.map(({ level, fields }) => ({ level, fields })), [
    { level: 'info', fields: { event: 'site_contact_smtp_start', traceId: null } },
    {
      level: 'warn',
      fields: {
        event: 'site_contact_smtp_failure',
        traceId: null,
        smtp: { code: 'EAUTH', responseCode: 535, command: 'AUTH' },
      },
    },
  ]);
  assert.doesNotMatch(JSON.stringify(events), /customer@example|credential|raw response|stack/iu);
});

test('SMTP diagnostic classification rejects unapproved values and raw error content', () => {
  assert.deepEqual(safeSmtpFailure({
    code: 'SECRET_CODE', responseCode: '535', command: 'VRFY customer@example.com', response: 'raw',
  }), { code: 'UNKNOWN', responseCode: null, command: null });
  assert.deepEqual(safeSmtpFailure({
    code: 'ESMTP', responseCode: 550, command: 'RCPT TO:<customer@example.com>',
  }), { code: 'ESMTP', responseCode: 550, command: 'RCPT TO' });
});

test('rate limit blocks the sixth submission from one IP within 15 minutes', async () => {
  await withApi(async ({ post, sent }) => {
    for (let index = 0; index < 5; index += 1) assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 429);
    assert.equal(sent.length, 5);
  });
});

test('Siteverify requires success, exact hostname and the contact action', async () => {
  const input = { token: 'sample', secret: 'fake', hostnames: ['www.atlib.jp'] };
  for (const [body, expected] of [
    [{ success: true, hostname: 'www.atlib.jp', action: 'contact' }, true],
    [{ success: false, hostname: 'www.atlib.jp', action: 'contact' }, false],
    [{ success: true, hostname: 'evil.example', action: 'contact' }, false],
    [{ success: true, hostname: 'www.atlib.jp', action: 'different' }, false],
  ]) {
    const calls = [];
    const accepted = await verifySiteContactTurnstile(input, async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify(body), { status: 200 });
    });
    assert.equal(accepted, expected);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  }
  assert.equal(await verifySiteContactTurnstile(input, async () => { throw new Error('offline'); }), false);
});
