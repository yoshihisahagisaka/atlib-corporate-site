'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const { createEntryFormRouter } = require('../dist/routes/entryForm');

test('recruit entry confirmation and signed submission use the existing mail flow without external SMTP', async () => {
  const notifications = [];
  const replies = [];
  const mailer = {
    async sendEntryNotification(to, data) { notifications.push({ to, data }); },
    async sendEntryAutoReply(to, data) { replies.push({ to, data }); },
  };
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(createEntryFormRouter(mailer, {
    formHmacSecret: 'test-only-hmac-secret',
    entryNotifyEmail: 'recruit-test@example.invalid',
  }));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const data = {
    job_type: 'IT技術職', name: '応募テスト', kana: 'おうぼてすと',
    birthday: '2000-01-01', gender_type: '', address: 'テスト住所',
    email: 'applicant@example.invalid', phone: '0000000000',
    history: 'テスト経歴', message: 'テストメッセージ',
  };
  const post = (path, fields) => fetch(`${base}${path}`, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });

  try {
    const confirm = await post('/recruit/entry/confirm.php', { ...data, privacy_consent: '1' });
    const html = await confirm.text();
    assert.equal(confirm.status, 200);
    assert.match(html, /<form action="send\.php" method="POST"/u);
    const timestamp = html.match(/name="form_ts" value="(\d+)"/u)?.[1];
    const signature = html.match(/name="form_sig" value="([0-9a-f]{64})"/u)?.[1];
    assert.ok(timestamp && signature, 'confirmation must include signed form fields');

    const missingConsent = await post('/recruit/entry/confirm.php', data);
    assert.equal(missingConsent.status, 302);
    assert.equal(missingConsent.headers.get('location'), 'index.html');

    const modified = await post('/recruit/entry/send.php', {
      ...data, name: '差し替え', form_ts: timestamp, form_sig: signature,
    });
    assert.equal(modified.status, 400);
    assert.deepEqual(notifications, []);
    assert.deepEqual(replies, []);

    const send = await post('/recruit/entry/send.php', {
      ...data, form_ts: timestamp, form_sig: signature,
    });
    assert.equal(send.status, 302);
    assert.equal(send.headers.get('location'), 'thanks.html');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].to, 'recruit-test@example.invalid');
    assert.deepEqual(notifications[0].data, data);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].to, 'applicant@example.invalid');
    assert.deepEqual(replies[0].data, data);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
