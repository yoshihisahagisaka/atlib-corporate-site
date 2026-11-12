'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { lookupEnv, nonSecretEnv, smtpSecret } = require('../scripts/smoke-site-contact-email.cjs');

function service(env) {
  return { spec: { template: { spec: { containers: [{ env }] } } } };
}

test('reads only named nonsecret Cloud Run environment values', () => {
  const config = service([
    { name: 'SMTP_USER', value: 'system@atlib.jp' },
    { name: 'SMTP_PASSWORD', value: 'not-to-be-printed' },
  ]);
  assert.equal(lookupEnv(config, 'SMTP_USER').value, 'system@atlib.jp');
  assert.equal(nonSecretEnv(config, 'SMTP_USER'), 'system@atlib.jp');
  assert.throws(() => nonSecretEnv(config, 'SMTP_FROM'), /SMTP_FROM is missing/);
});

test('uses the existing named Secret Manager secret without exposing inline password', () => {
  assert.deepEqual(smtpSecret(service([
    { name: 'SMTP_PASSWORD', value: 'must-not-leak' },
  ])), { name: 'corporate-site-smtp-password', version: 'latest' });
});

test('honors valid Cloud Run secret references and rejects unexpected references', () => {
  assert.deepEqual(smtpSecret(service([
    { name: 'SMTP_PASSWORD', valueFrom: { secretKeyRef: { name: 'corporate-site-smtp-password', key: '4' } } },
  ])), { name: 'corporate-site-smtp-password', version: '4' });

  assert.throws(() => smtpSecret(service([
    { name: 'SMTP_PASSWORD', valueFrom: { secretKeyRef: { name: '../other-secret', key: 'latest' } } },
  ])), /unexpected format/);
});
