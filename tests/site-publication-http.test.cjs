const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test('HTTP preview / publication / recruit routing, with no mail sent', async () => {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'dist', 'server.js')], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      SITE_PUBLIC_MODE: 'public',
      SMTP_HOST: '127.0.0.1',
      SMTP_USER: 'synthetic-user',
      SMTP_PASSWORD: 'synthetic-password',
      SMTP_FROM: 'system@atlib.jp',
      FORM_HMAC_SECRET: 'synthetic-only',
      SITE_CONTACT_TURNSTILE_SITE_KEY: 'synthetic-site-key-123456',
      SITE_CONTACT_TURNSTILE_SECRET: 'synthetic-only',
      SITE_CONTACT_ALLOWED_ORIGINS: '',
    },
    stdio: 'ignore',
  });
  // Node fetch overrides Host with the URL authority. Use http.request to
  // emulate the real HTTPS LB's forwarded hostname without network access.
  const request = (pathname, host, extraHeaders = {}, method = 'GET', body = '') => new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1', port, path: pathname, method,
      headers: {
        Host: host,
        ...(body ? {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        } : {}),
        ...extraHeaders,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: { get: (name) => res.headers[name.toLowerCase()] ?? null },
        text: async () => Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.end(body);
  });

  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (child.exitCode !== null) break;
      try {
        const response = await request('/healthz', 'www.atlib.jp');
        ready = response.status === 200;
        if (ready) break;
      } catch { /* wait for server startup */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, 'local synthetic site server failed to start');

    const live = await request('/', 'www.atlib.jp');
    const liveHtml = await live.text();
    assert.equal(live.status, 200);
    assert.equal(live.headers.get('x-robots-tag'), null);
    assert.equal(live.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
    assert.equal(live.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.match(live.headers.get('content-security-policy'), /frame-ancestors 'self'/u);
    assert.match(live.headers.get('content-security-policy'), /script-src 'self'/u);
    assert.match(liveHtml, /<meta name="robots" content="index,follow,max-image-preview:large">/u);
    assert.doesNotMatch(liveHtml, /デザイン検討用プレビュー|公開サイトではありません/u);

    const contact = await request('/contact/', 'www.atlib.jp');
    const contactHtml = await contact.text();
    assert.equal(contact.status, 200);
    assert.match(contact.headers.get('content-security-policy'), /frame-src https:\/\/challenges\.cloudflare\.com/u);
    assert.doesNotMatch(contactHtml, /Staging検証環境|__TURNSTILE_SITE_KEY__/u);
    assert.match(contactHtml, /data-sitekey="synthetic-site-key-123456"/u);

    const stage = await request('/', 'corporate-site-staging-123.run.app');
    const stageHtml = await stage.text();
    assert.equal(stage.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(stage.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.match(stageHtml, /公開サイトではありません/u);
    assert.match(stageHtml, /noindex,nofollow/u);

    const spoofed = await request('/', 'corporate-site-staging-123.run.app', {
      'X-Forwarded-Host': 'www.atlib.jp',
    });
    assert.equal(spoofed.headers.get('x-robots-tag'), 'noindex, nofollow');

    const old = await request('/index.html', 'www.atlib.jp');
    assert.equal(old.status, 301);
    assert.equal(old.headers.get('location'), '/');

    const slash = await request('/services?utm_source=test', 'www.atlib.jp');
    assert.equal(slash.status, 301);
    assert.equal(slash.headers.get('location'), '/services/?utm_source=test');

    const recruit = await request('/', 'recruit.atlib.jp');
    const recruitHtml = await recruit.text();
    assert.equal(recruit.status, 200);
    assert.equal(recruit.headers.get('content-security-policy'), null);
    assert.equal(recruit.headers.get('x-frame-options'), null);
    assert.doesNotMatch(recruitHtml, /ITで、企業に自由を。<\/title>/u);
    assert.match(recruitHtml, /https:\/\/note\.com\/atlib/u);
    assert.match(recruitHtml, /images\/workstyle\/atlib_note_banner_final\.png/u);

    for (const host of ['recruit.atlib.jp', 'www.recruit.atlib.jp']) {
      const form = await request('/entry/', host);
      const html = await form.text();
      assert.equal(form.status, 200, `recruitment entry form missing on ${host}`);
      assert.match(html, /<form id="entryForm" action="confirm\.php" method="POST">/u);
      assert.match(html, /name="privacy_consent" value="1" required/u);
      for (const key of ['name', 'kana', 'birthday', 'address', 'email', 'phone', 'history']) {
        assert.match(html, new RegExp(`name="${key}"`, 'u'));
      }
      assert.doesNotMatch(html, /href="\/entry\/"[^>]*>採用エントリーフォームへ/u);
      const thanks = await request('/entry/thanks.html', host);
      assert.equal(thanks.status, 200);
    }

    const entryFields = new URLSearchParams({
      job_type: 'IT技術職', name: 'テスト応募者', kana: 'てすとおうぼしゃ',
      birthday: '2000-01-01', gender_type: '', address: 'テスト住所',
      email: 'synthetic-applicant@example.invalid', phone: '0000000000',
      history: 'テスト用の経歴', message: '送信はしません', privacy_consent: '1',
    });
    const entryConfirm = await request('/entry/confirm.php', 'recruit.atlib.jp', {}, 'POST', entryFields.toString());
    const confirmHtml = await entryConfirm.text();
    assert.equal(entryConfirm.status, 200);
    assert.match(confirmHtml, /入力内容確認/u);
    assert.match(confirmHtml, /<form action="send\.php" method="POST"/u);
    assert.match(confirmHtml, /name="form_sig" value="[a-f0-9]+"/u);

    const withoutConsent = new URLSearchParams(entryFields);
    withoutConsent.delete('privacy_consent');
    const rejected = await request('/entry/confirm.php', 'recruit.atlib.jp', {}, 'POST', withoutConsent.toString());
    assert.equal(rejected.status, 302);
    assert.equal(rejected.headers.get('location'), 'index.html');

    const forged = await request('/entry/send.php', 'recruit.atlib.jp', {}, 'POST', entryFields.toString());
    assert.equal(forged.status, 400, 'unsigned entry submission must not send mail');

    for (const host of ['recruit.atlib.jp', 'www.recruit.atlib.jp']) {
      const noteBanner = await request('/images/workstyle/atlib_note_banner_final.png', host);
      assert.equal(noteBanner.status, 200, `recruit note banner missing on ${host}`);
      assert.match(noteBanner.headers.get('content-type'), /^image\/png/u);
    }

    const recruitViaCorporate = await request('/recruit/', 'www.atlib.jp');
    assert.equal(recruitViaCorporate.status, 200);
    assert.match(await recruitViaCorporate.text(), /https:\/\/note\.com\/atlib/u);

    for (const legacyPath of [
      '/business-web/', '/business-web/self-check/',
      '/business-web/self-check/self-check.js', '/joshisu-kaizen/',
      '/web-development-partner/', '/infravision-partner/',
      '/privacy-policy/', '/customer-harassment-policy/', '/policy/',
      '/thanks.html',
    ]) {
      const legacy = await request(legacyPath, 'www.atlib.jp');
      assert.equal(legacy.status, 200, `existing public path must survive: ${legacyPath}`);
      assert.equal(legacy.headers.get('content-security-policy'), null);
      assert.equal(legacy.headers.get('x-frame-options'), null);
    }
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
  }
});
