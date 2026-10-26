import dns from 'node:dns/promises';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { isPublicAddress, validatePublicTarget } from '../wsc-phase2a/safe-executor.mjs';

const headers = ['strict-transport-security', 'content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'location'];
const absentDns = (error = 'MAIL_DOMAIN_UNSPECIFIED') => ({ spf: { lookupStatus: 'UNVERIFIED', records: [], recordCount: 0, error }, dmarc: { lookupStatus: 'UNVERIFIED', records: [], recordCount: 0, error }, mx: { status: 'UNVERIFIED', values: [] }, ds: { status: 'UNVERIFIED', values: [] } });
const txt = async (name, resolveTxt) => { try { return { status: 'FOUND', values: (await resolveTxt(name)).map(row => row.join('')) }; } catch (error) { return { status: 'UNVERIFIED', values: [], error: error.code || error.message }; } };
const mailDns = async (mailDomain, resolveTxt) => {
  if (!mailDomain) return absentDns(); const spfSource = await txt(mailDomain, resolveTxt); const dmarcSource = await txt(`_dmarc.${mailDomain}`, resolveTxt);
  const spf = spfSource.values.filter(value => /^v=spf1(?:\s|$)/i.test(value)); const dmarc = dmarcSource.values.filter(value => /^v=DMARC1(?:;|$)/i.test(value)); const tags = {};
  if (dmarc.length === 1) for (const segment of dmarc[0].split(';')) { const match = /^\s*([a-z]+)\s*=\s*(.*?)\s*$/i.exec(segment); if (match) tags[match[1].toLowerCase()] = match[2]; }
  return { spf: { lookupStatus: spfSource.status, records: spf, recordCount: spf.length, ...(spfSource.error ? { error: spfSource.error } : {}) }, dmarc: { lookupStatus: dmarcSource.status, records: dmarc, recordCount: dmarc.length, tags, ...(dmarcSource.error ? { error: dmarcSource.error } : {}) }, mx: { status: 'UNVERIFIED', values: [] }, ds: { status: 'UNVERIFIED', values: [] } };
};

// Network code is present for review, but disabled unless an exact target and
// one-use approval are both injected by a later, separately approved runner.
export function createRestrictedNetworkProbe({ approval, approvedTargetUrl, lookup = dns.lookup, resolveTxt = dns.resolveTxt, maxResponseBytes = 1_000_000 } = {}) {
  return async ({ url, addresses, mailDomain, signal }) => {
    if (approval !== 'APPROVED_EXTERNAL_TRANSPORT' || url !== approvedTargetUrl) throw new Error('EXTERNAL_NETWORK_DISABLED_PENDING_APPROVAL');
    const current = await lookup(new URL(url).hostname, { all: true, verbatim: true }); const resolved = current.map(row => row.address);
    const target = validatePublicTarget(url, () => resolved);
    if (target.addresses.join(',') !== [...new Set(addresses)].sort().join(',')) throw new Error('DNS_REBIND_DETECTED');
    const ip = target.addresses[0]; if (!isPublicAddress(ip)) throw new Error('DNS_NOT_PUBLIC');
    return new Promise((resolve, reject) => {
      const uri = new URL(url); let settled = false; const fail = (error) => { if (!settled) { settled = true; reject(error); } };
      const req = https.request({ protocol: 'https:', host: uri.hostname, port: 443, path: `${uri.pathname}${uri.search}`, method: 'GET', headers: { Host: uri.host, 'User-Agent': 'atLIB-public-security-check/2.0' }, agent: false, servername: uri.hostname, rejectUnauthorized: true, createConnection: () => tls.connect({ host: ip, port: 443, servername: uri.hostname, rejectUnauthorized: true }) }, async (res) => {
        const chunks = []; let total = 0; res.on('data', chunk => { total += chunk.length; if (total > maxResponseBytes) { req.destroy(new Error('HTTP_RESPONSE_BODY_SIZE_LIMIT')); } else chunks.push(chunk); });
        res.on('error', fail); res.on('end', async () => { if (settled) return; try { const socket = res.socket; if (!socket || socket.remoteAddress !== ip) throw new Error('CONNECTION_IP_MISMATCH'); const cert = socket.getPeerCertificate(); const mapped = Object.fromEntries(headers.map(name => [name.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('-'), res.headers[name] ? String(res.headers[name]) : null])); const diagnosis = { schemaVersion: '2.0', targetUrl: url, mailDomain: mailDomain ?? null, checkedAt: new Date().toISOString(), http: { status: 'OK', statusCode: res.statusCode, headers: mapped, redirectNotFollowed: true }, tls: { status: 'VALIDATED', negotiatedProtocol: socket.getProtocol(), subject: cert.subject?.CN ? `CN=${cert.subject.CN}` : null, issuer: cert.issuer?.CN ? `CN=${cert.issuer.CN}` : null, notAfter: cert.valid_to ? new Date(cert.valid_to).toISOString() : null, policyErrors: 'None', chainStatus: [] }, dns: await mailDns(mailDomain, resolveTxt) }; settled = true; resolve({ remoteAddress: ip, responseBytes: Number(res.headers['content-length'] || total), bodyChunks: chunks, redirectUrl: mapped.Location, diagnosis }); } catch (error) { fail(error); } });
      });
      const abort = () => req.destroy(new Error('ACQUISITION_ABORTED')); signal?.addEventListener('abort', abort, { once: true }); req.on('error', fail); req.setTimeout(15000, () => req.destroy(new Error('ACQUISITION_TIMEOUT'))); req.end();
    });
  };
}
