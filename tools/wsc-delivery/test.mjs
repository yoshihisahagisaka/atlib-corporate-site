import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSyntheticBatch } from '../wsc-phase2a/batch.mjs';
import { createLocalPrivateStore } from '../wsc-phase2a/local-store.mjs';
import { createSyntheticExecutor } from '../wsc-phase2a/safe-executor.mjs';
import { createDeliveryPackage } from './delivery.mjs';

const root = path.dirname(fileURLToPath(import.meta.url)); const temp = fs.mkdtempSync(path.join(root, '.test-delivery-')); const storageRoot = path.join(temp, 'storage'); const outputRoot = path.join(temp, 'output'); const csv = '企業名,本店所在地,URL\n合成A,東京,https://delivery-a.example/\n合成B,大阪,https://delivery-b.example/\n';
const fixture = JSON.parse(fs.readFileSync(path.join(root, '..', 'wsc-vs1', 'fixtures', 'synthetic-protected.json'), 'utf8')); const executor = createSyntheticExecutor({ resolve: () => ['93.184.216.34'], probe: async url => ({ remoteAddress: '93.184.216.34', diagnosis: { ...structuredClone(fixture), targetUrl: url, mailDomain: null, checkedAt: '2026-10-27T00:00:00.000Z' } }) });
const result = await runSyntheticBatch({ csv, executor, store: createLocalPrivateStore(storageRoot), batchId: 'bat_delivery' }); const delivered = await createDeliveryPackage({ batch: result.batch, storageRoot, outputRoot, pdfExporter: async ({ pdfPath }) => fs.writeFileSync(pdfPath, '%PDF-1.4\nSynthetic PDF\n') });
assert.equal(delivered.rows.filter(row => row.status === 'READY').length, 2); assert.equal(fs.readdirSync(delivered.pdfDir).length, 2); assert.ok(fs.readFileSync(delivered.zipPath).subarray(0, 4).equals(Buffer.from('PK\x03\x04'))); assert.match(fs.readFileSync(delivered.listPath, 'utf8'), /配布先（未指定）/); assert.match(fs.readFileSync(delivered.emailPath, 'utf8'), /送信機能を持ちません/); await assert.rejects(() => createDeliveryPackage({ batch: result.batch, storageRoot, outputRoot: path.join(temp, 'no-exporter') }), /PDF_EXPORTER_REQUIRED/); fs.rmSync(temp, { recursive: true, force: true }); console.log('WSC CSV delivery tests: PASS');
