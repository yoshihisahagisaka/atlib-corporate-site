import { createHmac, randomUUID } from 'node:crypto';

/** Server-only bridge for mail-accepted SECU:MIE Web requests. Not browser facing. */
export type SecumieWebMirrorIntake = {
  companyName: string; unionName: string; registeredAddress: string;
  websiteUrl: string; contactName: string; contactEmail: string; contactPhone: string;
};
export type SecumieWebMirror = (input: SecumieWebMirrorIntake) => Promise<void>;

export function createSecumieWebMirror(
  endpoint: string, secret: string, fetchImpl: typeof fetch = globalThis.fetch,
): SecumieWebMirror | undefined {
  if (!endpoint && !secret) return undefined; // Existing email-only intake remains operational.
  if (!endpoint || secret.length < 32) throw new Error('Incomplete SECU:MIE Web mirror configuration');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      url.pathname !== '/api/internal/secumie-web/v1/temporary-intakes') {
    throw new Error('Invalid SECU:MIE Web mirror endpoint');
  }

  return async input => {
    const time = String(Date.now());
    const body = JSON.stringify({
      source: 'secumie_web_temporary', eventId: randomUUID(), ...input, consented: true,
    });
    const signature = createHmac('sha256', secret).update(time).update('\n').update(body).digest('hex');
    const response = await fetchImpl(url.href, {
      method: 'POST', redirect: 'error',
      headers: {
        'content-type': 'application/json',
        'x-secumie-timestamp': time,
        'x-secumie-signature': signature,
      },
      body,
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) throw new Error('SECU:MIE Web mirror unavailable');
    const outcome = await response.json() as { ok?: unknown };
    if (outcome.ok !== true) throw new Error('SECU:MIE Web mirror invalid response');
  };
}
