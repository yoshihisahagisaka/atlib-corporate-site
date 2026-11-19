/** Per-submission notification for the temporary SECU:MIE Web intake.
 * The incoming webhook must be installed specifically into #pj-msp-営業関連.
 * Never include personal contact details, union, address or free-text notes.
 */
export type SecumieSlackIntake = { company: string; targetUrl: string };
export type SecumieSlackNotifier = (intake: SecumieSlackIntake) => Promise<void>;

export function createSecumieSlackNotifier(
  webhookValue: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): SecumieSlackNotifier | undefined {
  if (!webhookValue) return undefined;
  const webhook = new URL(webhookValue);
  if (webhook.protocol !== 'https:' || webhook.hostname !== 'hooks.slack.com' ||
      webhook.username || webhook.password || webhook.port || webhook.search || webhook.hash ||
      !/^\/services\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/u.test(webhook.pathname)) {
    throw new Error('Invalid SECUMIE_WEB_SLACK_WEBHOOK_URL configuration');
  }

  return async ({ company, targetUrl }) => {
    const response = await fetchImpl(webhook.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        text: 'SECU:MIE Web 暫定受付：新規申し込み',
        blocks: [{
          type: 'section',
          text: {
            type: 'plain_text',
            text: `SECU:MIE Web 暫定受付\n企業名：${company}\n診断対象URL：${targetUrl}`,
            emoji: false,
          },
        }],
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) throw new Error('SECU:MIE Slack webhook rejected notification');
  };
}
