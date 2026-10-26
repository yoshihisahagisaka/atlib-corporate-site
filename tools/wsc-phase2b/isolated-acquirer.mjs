import { validatePublicTarget } from '../wsc-phase2a/safe-executor.mjs';

const timeout = (promise, milliseconds) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('ACQUISITION_TIMEOUT')), milliseconds))]);
const emptyMailDns = () => ({ spf: { lookupStatus: 'UNVERIFIED', records: [], recordCount: 0, error: 'MAIL_DOMAIN_UNSPECIFIED' }, dmarc: { lookupStatus: 'UNVERIFIED', records: [], recordCount: 0, error: 'MAIL_DOMAIN_UNSPECIFIED' }, mx: { status: 'UNVERIFIED', values: [] }, ds: { status: 'UNVERIFIED', values: [] } });

// This module deliberately has no HTTP, TLS, DNS, or socket client. It accepts
// an isolated probe only, and represents the contract a future approved
// transport must satisfy: pre/post DNS stability and connection-IP binding.
export function createIsolatedAcquirer({ resolve, probe, timeoutMs = 15000, maxResponseBytes = 1_000_000 } = {}) {
  if (typeof resolve !== 'function' || typeof probe !== 'function') throw new Error('ISOLATED_ACQUIRER_REQUIRES_MOCKS');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || !Number.isInteger(maxResponseBytes) || maxResponseBytes < 1) throw new Error('ACQUISITION_LIMIT_INVALID');
  return async ({ url, mailDomain } = {}) => {
    const before = validatePublicTarget(url, resolve);
    if (mailDomain !== undefined && (typeof mailDomain !== 'string' || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(mailDomain))) throw new Error('MAIL_DOMAIN_INVALID');
    const response = await timeout(Promise.resolve().then(() => probe({ url: before.url, addresses: before.addresses, mailDomain: mailDomain ?? null })), timeoutMs);
    const after = validatePublicTarget(url, resolve);
    if (before.host !== after.host || before.addresses.join(',') !== after.addresses.join(',')) throw new Error('DNS_REBIND_DETECTED');
    if (!response || !before.addresses.includes(response.remoteAddress)) throw new Error('CONNECTION_IP_MISMATCH');
    if (!Number.isInteger(response.responseBytes) || response.responseBytes < 0 || response.responseBytes > maxResponseBytes) throw new Error('HTTP_RESPONSE_SIZE_LIMIT');
    if (response.redirectUrl) { const redirect = validatePublicTarget(response.redirectUrl, resolve); if (redirect.url !== before.url) throw new Error('REDIRECT_REQUIRES_SEPARATE_APPROVAL'); }
    if (!response.diagnosis || response.diagnosis.targetUrl !== before.url) throw new Error('DIAGNOSIS_TARGET_MISMATCH');
    const diagnosis = structuredClone(response.diagnosis);
    diagnosis.schemaVersion ??= '2.0'; diagnosis.checkedAt ??= '1970-01-01T00:00:00.000Z';
    if (!mailDomain) { diagnosis.mailDomain = null; diagnosis.dns = emptyMailDns(); }
    else if (diagnosis.mailDomain !== mailDomain) throw new Error('MAIL_DOMAIN_RESULT_MISMATCH');
    return diagnosis;
  };
}

export const externalTransport = () => { throw new Error('EXTERNAL_TRANSPORT_DISABLED_PENDING_APPROVAL'); };
