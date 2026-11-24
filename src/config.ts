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
  siteContact: {
    turnstileSiteKey: string;
    turnstileSecret: string;
    allowedOrigins: string[];
    allowedTurnstileHostnames: string[];
    diagnosticLogs: boolean;
  };
  businessKaizenAnonymousKpi: {
    enabled: boolean;
    turnstileSiteKey: string;
    apiEndpoint: string;
    allowedOrigins: string[];
  };
}

function configuredOrigins(value: string | undefined): string[] {
  return (value ?? '').split(',').map((part) => part.trim()).filter((part) => {
    try {
      const parsed = new URL(part);
      return parsed.protocol === 'https:' && parsed.origin === part && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  });
}

function configuredHostnames(value: string | undefined): string[] {
  return (value ?? '').split(',').map((part) => part.trim().toLowerCase()).filter((part) =>
    /^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/u.test(part));
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
  const anonymousSiteKey = process.env.BUSINESS_KAIZEN_ANONYMOUS_KPI_TURNSTILE_SITE_KEY ?? '';
  const anonymousEndpoint = process.env.BUSINESS_KAIZEN_ANONYMOUS_KPI_API_ENDPOINT ?? '';
  const anonymousOrigins = configuredOrigins(process.env.BUSINESS_KAIZEN_ANONYMOUS_KPI_ALLOWED_ORIGINS);
  let anonymousEndpointValid = false;
  try {
    const endpoint = new URL(anonymousEndpoint);
    anonymousEndpointValid = endpoint.protocol === 'https:' && !endpoint.username && !endpoint.password &&
      !endpoint.search && !endpoint.hash && endpoint.pathname === '/api/public/business-kaizen/anonymous-events';
  } catch { anonymousEndpointValid = false; }
  const anonymousEnabled = process.env.BUSINESS_KAIZEN_ANONYMOUS_KPI_ENABLED === 'true' &&
    /^[A-Za-z0-9_-]{10,100}$/u.test(anonymousSiteKey) && anonymousEndpointValid && anonymousOrigins.length > 0;

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
    // Optional while the new Site remains a private static preview. The API
    // returns 503 (fail closed) until all three are provisioned in Cloud Run.
    siteContact: {
      turnstileSiteKey: process.env.SITE_CONTACT_TURNSTILE_SITE_KEY ?? '',
      turnstileSecret: process.env.SITE_CONTACT_TURNSTILE_SECRET ?? '',
      allowedOrigins: configuredOrigins(process.env.SITE_CONTACT_ALLOWED_ORIGINS),
      allowedTurnstileHostnames: configuredHostnames(process.env.SITE_CONTACT_TURNSTILE_HOSTNAMES),
      diagnosticLogs: process.env.SITE_CONTACT_DIAGNOSTIC_LOGS === 'true',
    },
    businessKaizenAnonymousKpi: {
      enabled: anonymousEnabled,
      turnstileSiteKey: anonymousSiteKey,
      apiEndpoint: anonymousEndpoint,
      allowedOrigins: anonymousOrigins,
    },
  };
}
