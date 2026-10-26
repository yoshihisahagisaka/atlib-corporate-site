import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createIsolatedAcquirer } from '../wsc-phase2b/isolated-acquirer.mjs';
import { createRestrictedNetworkProbe } from './restricted-network-probe.mjs';
import { createTestConnectionAdapter } from './test-connection-adapter.mjs';

const root = path.dirname(fileURLToPath(import.meta.url)); const url = 'https://example-protected.test/'; const resolve = () => ['93.184.216.34'];
const fixture = JSON.parse(fs.readFileSync(path.join(root, '..', 'wsc-vs1', 'fixtures', 'synthetic-protected.json'), 'utf8'));
const diagnosis = () => ({ ...structuredClone(fixture), targetUrl: url, mailDomain: null, checkedAt: '2026-10-26T00:00:00.000Z' });
const disabled = createRestrictedNetworkProbe();
await assert.rejects(() => disabled({ url, addresses: resolve(), mailDomain: null }), /EXTERNAL_NETWORK_DISABLED_PENDING_APPROVAL/);
let request; const adapter = createTestConnectionAdapter(async input => { request = input; return { remoteAddress: '93.184.216.34', responseBytes: 2, bodyChunks: ['ok'], diagnosis: diagnosis() }; });
const acquire = createIsolatedAcquirer({ resolve, probe: adapter }); const result = await acquire({ url });
assert.equal(request.connection.servername, 'example-protected.test'); assert.equal(request.connection.hostHeader, 'example-protected.test'); assert.equal(request.connection.rejectUnauthorized, true);
assert.equal(result.schemaVersion, '2.0'); assert.equal(result.targetUrl, url); assert.equal(result.mailDomain, null); assert.equal(result.dns.spf.lookupStatus, 'UNVERIFIED');
console.log('WSC Phase 2C restricted-transport tests: PASS');
