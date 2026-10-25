import net from 'node:net';

const privateV4 = (ip) => /^(10\.|127\.|0\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.|198\.1[89]\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip);
const privateV6 = (ip) => ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:') || ip.startsWith('::ffff:127.');
export const isPublicAddress = (ip) => net.isIP(ip) !== 0 && !privateV4(ip) && !privateV6(ip);

export function validatePublicTarget(value, resolve) {
  let url;
  try { url = new URL(value); } catch { throw new Error('URL_INVALID'); }
  if (url.protocol !== 'https:' || url.port && url.port !== '443' || url.username || url.password) throw new Error('URL_NOT_ALLOWED');
  if (url.hostname === 'localhost' || net.isIP(url.hostname) || url.hostname.endsWith('.local')) throw new Error('URL_HOST_NOT_PUBLIC');
  const addresses = resolve(url.hostname);
  if (!Array.isArray(addresses) || !addresses.length || addresses.some(ip => !isPublicAddress(ip))) throw new Error('DNS_NOT_PUBLIC');
  return { url: url.toString(), host: url.hostname.toLowerCase(), addresses: [...new Set(addresses)].sort() };
}

// Phase 2A deliberately has no network transport. This adapter accepts only a
// synthetic probe and verifies its declared connection address against DNS both
// before and after the probe, preventing a production caller from bypassing the
// DNS/connection binding requirement.
export function createSyntheticExecutor({ resolve, probe }) {
  if (typeof resolve !== 'function' || typeof probe !== 'function') throw new Error('SYNTHETIC_EXECUTOR_REQUIRES_RESOLVER_AND_PROBE');
  return async (targetUrl) => {
    const before = validatePublicTarget(targetUrl, resolve);
    const response = await probe(before.url, before.addresses);
    const after = validatePublicTarget(targetUrl, resolve);
    if (before.host !== after.host || before.addresses.join(',') !== after.addresses.join(',')) throw new Error('DNS_REBIND_DETECTED');
    if (!response || !before.addresses.includes(response.remoteAddress)) throw new Error('CONNECTION_IP_MISMATCH');
    if (response.redirectUrl) {
      const redirect = validatePublicTarget(response.redirectUrl, resolve);
      if (redirect.url !== before.url) throw new Error('REDIRECT_REQUIRES_SEPARATE_APPROVAL');
    }
    if (!response.diagnosis || response.diagnosis.targetUrl !== before.url) throw new Error('DIAGNOSIS_TARGET_MISMATCH');
    return response.diagnosis;
  };
}
