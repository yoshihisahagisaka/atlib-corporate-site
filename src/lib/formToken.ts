import crypto from 'crypto';

const MAX_AGE_MS = 30 * 60 * 1000; // 30分（元のPHPセッション実装の実質的な有効期限に相当）

/**
 * confirm→send の2段階フォームをステートレスに実装するための署名ヘルパー。
 *
 * 元のPHP実装は $_SESSION に確認済みデータとトークンを保存し、send.php側でトークン一致を
 * 検証していた。Cloud Runは複数インスタンスにスケールしうるサーバーレス環境でサーバー側
 * セッションを前提にできないため、確認画面の隠しフィールドに全フィールド値と発行時刻を
 * 載せて送り返してもらい、その内容とタイムスタンプに対するHMAC署名で改ざん・直接POSTを検知する。
 */
export function signFormFields(secret: string, timestampMs: number, fields: Record<string, string>): string {
  const canonical = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('&');
  return crypto.createHmac('sha256', secret).update(`${timestampMs}.${canonical}`).digest('hex');
}

export function verifyFormFields(
  secret: string,
  timestampMs: number,
  fields: Record<string, string>,
  signature: string,
): boolean {
  if (!Number.isFinite(timestampMs)) return false;
  const age = Date.now() - timestampMs;
  if (age < 0 || age > MAX_AGE_MS) return false;

  const expected = signFormFields(secret, timestampMs, fields);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
