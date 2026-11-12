#!/usr/bin/env node
'use strict';

/**
 * One-off Google Workspace SMTP smoke test using the existing corporate-site
 * Mailer and Google Cloud Secret Manager credential. No API or site deployment.
 *
 *   npm run build
 *   node scripts/smoke-site-contact-email.cjs --check
 *   node scripts/smoke-site-contact-email.cjs --send
 *
 * The recipient is deliberately fixed to the already-approved company ML.
 * This script never prints, saves, or accepts a plaintext SMTP password.
 */

const { execFileSync } = require('node:child_process');

const PROJECT = 'atlib-corporate-site';
const REGION = 'asia-northeast1';
const SERVICE = 'corporate-site';
const RECIPIENT = 'contact@atlib.jp';
const DEFAULT_SECRET = 'corporate-site-smtp-password';

function gcloud(args) {
  try {
    return execFileSync(process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud', args, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      // Windows .cmd launch needs cmd.exe; all arguments are code-owned.
      ...(process.platform === 'win32' ? { shell: true } : {}),
    });
  } catch {
    // Do not print subprocess stderr: a secret command must never leak values.
    throw new Error(`gcloud command failed (${args[0]} ${args[1]}). Check login, permissions and project.`);
  }
}

function lookupEnv(service, name) {
  const container = service?.spec?.template?.spec?.containers?.[0];
  return container?.env?.find((entry) => entry.name === name);
}

function nonSecretEnv(service, name) {
  const entry = lookupEnv(service, name);
  if (!entry || typeof entry.value !== 'string' || !entry.value) {
    throw new Error(`${name} is missing as a literal Cloud Run environment value; check the service configuration.`);
  }
  return entry.value;
}

function smtpSecret(service) {
  const entry = lookupEnv(service, 'SMTP_PASSWORD');
  if (entry?.valueFrom?.secretKeyRef) {
    const { name, key } = entry.valueFrom.secretKeyRef;
    if (!/^[a-z][a-z0-9-]*$/u.test(name) || !/^(latest|[1-9][0-9]*)$/u.test(String(key))) {
      throw new Error('SMTP_PASSWORD secret reference has an unexpected format.');
    }
    return { name, version: String(key) };
  }
  // If the old service has an inline SMTP_PASSWORD, do not read/copy it from
  // service metadata; the canonical Secret Manager secret is used instead.
  return { name: DEFAULT_SECRET, version: 'latest' };
}

async function main() {
  const mode = process.argv[2];
  if (!['--check', '--send'].includes(mode) || process.argv.length !== 3) {
    throw new Error('Use --check (configuration only) or --send (one email to contact@atlib.jp).');
  }

  const service = JSON.parse(gcloud([
    'run', 'services', 'describe', SERVICE,
    `--project=${PROJECT}`, `--region=${REGION}`, '--format=json',
  ]));

  const host = nonSecretEnv(service, 'SMTP_HOST');
  const port = Number(lookupEnv(service, 'SMTP_PORT')?.value ?? 587);
  const user = nonSecretEnv(service, 'SMTP_USER');
  const from = nonSecretEnv(service, 'SMTP_FROM');
  const secret = smtpSecret(service);

  if (host !== 'smtp.gmail.com' || port !== 587) {
    throw new Error('SMTP endpoint differs from approved smtp.gmail.com:587; stop and review.');
  }
  if (!/@atlib\.jp\b/iu.test(user) || !/@atlib\.jp\b/iu.test(from)) {
    throw new Error('SMTP_USER or SMTP_FROM is outside the approved atlib.jp domain; stop and review.');
  }

  console.log('GCP project:', PROJECT);
  console.log('Cloud Run service (read only):', `${REGION}/${SERVICE}`);
  console.log('SMTP endpoint:', `${host}:${port}`);
  console.log('SMTP_USER:', user);
  console.log('SMTP_FROM:', from);
  console.log('Secret Manager reference:', `${secret.name}:${secret.version}`, '(value hidden)');
  console.log('Recipient (fixed):', RECIPIENT);

  if (mode === '--check') {
    console.log('CHECK COMPLETE. No secret accessed and no email sent.');
    return;
  }

  const password = gcloud([
    'secrets', 'versions', 'access', secret.version,
    `--secret=${secret.name}`, `--project=${PROJECT}`,
  ]);
  if (!password) throw new Error('SMTP password secret is empty.');

  const { Mailer } = require('../dist/services/mailer');
  const mailer = new Mailer({ host, port, user, password, from });
  const marker = `atLIB-SMTP-TEST-${new Date().toISOString()}`;
  await mailer.sendContactNotification(RECIPIENT, {
    inquiry_type: '動作確認（テスト）',
    company: 'atLIB株式会社（社内テスト）',
    name: '問い合わせフォーム 動作確認',
    email: user,
    phone: '',
    message: [
      '【テストメールです。実際のお問い合わせではありません】',
      'WordPress廃止に向けた既存Google Workspace SMTP通知の単発送信確認です。',
      `照合ID: ${marker}`,
      '宛先: contact@atlib.jp（社内メーリングリスト）',
    ].join('\n'),
  });

  // SMTP acceptance is not the same as delivery to every ML member.
  console.log('SMTP ACCEPTED: one test message submitted to the company ML.');
  console.log('Matching ID:', marker);
  console.log('Check the actual ML inbox and From / To / Reply-To headers.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Smoke test stopped:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { lookupEnv, nonSecretEnv, smtpSecret };
