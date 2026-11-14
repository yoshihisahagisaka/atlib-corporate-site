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
  const request = (pathname, host, extraHeaders = {}) => new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1', port, path: pathname, method: 'GET',
      headers: { Host: host, ...extraHeaders },
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
    req.end();
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
    assert.match(liveHtml, /<meta name="robots" content="index,follow,max-image-preview:large">/u);
    assert.doesNotMatch(liveHtml, /デザイン検討用プレビュー|公開サイトではありません/u);

    const contact = await request('/contact/', 'www.atlib.jp');
    const contactHtml = await contact.text();
    assert.equal(contact.status, 200);
    assert.doesNotMatch(contactHtml, /Staging検証環境|__TURNSTILE_SITE_KEY__/u);
    assert.match(contactHtml, /data-sitekey="synthetic-site-key-123456"/u);

    const stage = await request('/', 'corporate-site-staging-123.run.app');
    const stageHtml = await stage.text();
    assert.equal(stage.headers.get('x-robots-tag'), 'noindex, nofollow');
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
    assert.equal(recruit.status, 200);
    assert.doesNotMatch(await recruit.text(), /ITで、企業に自由を。<\/title>/u);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
  }
});
