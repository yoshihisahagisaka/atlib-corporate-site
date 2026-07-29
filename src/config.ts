import { getSecret } from './lib/secrets';

export interface Config {
  nodeEnv: string;
  port: number;
  gcpProjectId: string;
  smtp: {
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
  };
  formHmacSecret: string;
  contactNotifyEmail: string; // お問い合わせ通知の受信先（カンマ区切りで複数可）
  entryNotifyEmail: string; // 採用エントリー通知の受信先（カンマ区切りで複数可）
}

/**
 * 環境変数を優先し、値が無ければ Secret Manager から取得する。
 * Cloud Run本番では `--set-secrets` で環境変数に直接注入されるため通常はSecret Manager呼び出しは発生しない。
 * ハードコードは一切しない（値がどちらの手段でも取得できなければ起動時に例外で落とす）。
 */
async function resolveSecret(
  projectId: string,
  envValue: string | undefined,
  secretId: string,
): Promise<string> {
  if (envValue) return envValue;
  return getSecret(projectId, secretId);
}

export async function loadConfig(): Promise<Config> {
  const gcpProjectId = process.env.GCP_PROJECT_ID ?? 'atlib-corporate-site';

  const smtpPassword = await resolveSecret(gcpProjectId, process.env.SMTP_PASSWORD, 'corporate-site-smtp-password');
  const formHmacSecret = await resolveSecret(gcpProjectId, process.env.FORM_HMAC_SECRET, 'corporate-site-form-hmac-secret');

  const required = (name: string, value: string | undefined): string => {
    if (!value) throw new Error(`Missing required config value: ${name}`);
    return value;
  };

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 8080),
    gcpProjectId,
    smtp: {
      host: required('SMTP_HOST', process.env.SMTP_HOST),
      port: Number(process.env.SMTP_PORT ?? 587),
      user: required('SMTP_USER', process.env.SMTP_USER),
      password: smtpPassword,
      from: required('SMTP_FROM', process.env.SMTP_FROM),
    },
    formHmacSecret,
    contactNotifyEmail: process.env.CONTACT_NOTIFY_EMAIL ?? 'contact@atlib.jp, database@atlib.jp',
    entryNotifyEmail: process.env.ENTRY_NOTIFY_EMAIL ?? 'contact@atlib.jp, database@atlib.jp',
  };
}
