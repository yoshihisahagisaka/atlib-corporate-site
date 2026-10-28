import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalPrivateStore } from '../wsc-phase2a/local-store.mjs';
import { browserPdfArgs } from '../wsc-delivery/browser-pdf.mjs';
import { createExecutionLock, createLocalUiServer, csvFromRequest, dialogPowerShellArgs, dialogScript, explorerArgs, isLocalUiApiRequest, replaySavedJson, runCsvSequential } from './server.mjs';

const temp = fs.mkdtempSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.test-ui-'));
const url = 'https://ui-replay.example/';
const csv = `企業名,本店所在地,URL\n再生テスト社,東京,${url}\n`;
const fixture = JSON.parse(fs.readFileSync(new URL('../wsc-vs1/fixtures/synthetic-protected.json', import.meta.url), 'utf8'));
const diagnosesByUrl = { [url]: { ...fixture, targetUrl: url, checkedAt: '2026-10-27T00:00:00.000Z' } };
const validRequest = { method: 'POST', headers: { host: '127.0.0.1:38152', origin: 'http://127.0.0.1:38152' } };

assert.equal(isLocalUiApiRequest(validRequest), true);
assert.equal(isLocalUiApiRequest({ headers: { host: '127.0.0.1:38152', origin: 'https://example.invalid' } }), false);
assert.equal(isLocalUiApiRequest({ headers: { host: 'localhost:38152', origin: 'http://127.0.0.1:38152' } }), false);

const requestApi = (server, headers) => new Promise(resolve => {
  const request = new EventEmitter(); request.method = 'GET'; request.url = '/api/job/test-job'; request.headers = headers;
  const response = new EventEmitter(); response.writeHead = status => { response.status = status; }; response.end = body => resolve({ status: response.status, body: JSON.parse(body) });
  server.emit('request', request, response);
});
const localServer = createLocalUiServer();
const progressResponse = await requestApi(localServer, { host: '127.0.0.1:38152', referer: 'http://127.0.0.1:38152/' });
assert.equal(progressResponse.status, 200);
assert.equal(progressResponse.body.status, 'NOT_FOUND');
const foreignResponse = await requestApi(localServer, { host: '127.0.0.1:38152', referer: 'https://example.invalid/' });
assert.equal(foreignResponse.status, 403);

assert.deepEqual(explorerArgs('C:\\Users\\example\\Downloads'), ['C:\\Users\\example\\Downloads']);
assert.deepEqual(dialogPowerShellArgs().slice(0, 3), ['-NoProfile', '-STA', '-Command']);
assert.match(dialogScript(), /FolderBrowserDialog/);
assert.match(dialogScript(), /SelectedPath/);
assert.equal(csvFromRequest({ csv }), csv);
assert.throws(() => csvFromRequest({ csv: '' }), /CSV_CONTENT_INVALID/);
const uiHtml = fs.readFileSync(new URL('./public/index.html', import.meta.url), 'utf8');
const uiScript = fs.readFileSync(new URL('./public/app.js', import.meta.url), 'utf8');
assert.match(uiHtml, /id="csvFile" type="file" accept="\.csv,text\/csv"/);
assert.doesNotMatch(uiHtml, /chooseCsv|csvPath/);
assert.match(uiHtml, /id="chooseFolder"/);
assert.match(uiScript, /csvFile\.text\(\)/);
assert.match(uiScript, /choose-folder/);
assert.ok(browserPdfArgs({ htmlPath: 'C:\\report.html', pdfPath: 'C:\\report.pdf' }).includes('--print-to-pdf-no-header'));

const lock = createExecutionLock();
assert.equal(lock.acquire('csv-1'), true);
assert.equal(lock.acquire('csv-2'), false);
lock.release('csv-2');
assert.equal(lock.active(), 'csv-1');
lock.release('csv-1');
assert.equal(lock.acquire('csv-2'), true);

const failed = await replaySavedJson({ csv, diagnosesByUrl, outputRoot: temp, pdfExporter: async () => { throw new Error('PDF_TEST_FAILURE'); } });
assert.equal(failed.deliveryStatus, 'FAILED');
assert.equal(failed.batch.reports[Object.keys(failed.batch.reports)[0]].status, 'REPORT_READY');
assert.equal(fs.existsSync(failed.deliveryRoot), true);
assert.equal(fs.existsSync(path.join(failed.deliveryRoot, 'Webセキュリティ診断レポート.zip')), false);

const succeeded = await replaySavedJson({ csv, diagnosesByUrl, outputRoot: temp, pdfExporter: async ({ pdfPath }) => fs.writeFileSync(pdfPath, '%PDF-1.4\nUI replay\n') });
assert.equal(succeeded.deliveryStatus, 'READY');
assert.notEqual(succeeded.deliveryRoot, failed.deliveryRoot);
assert.equal(succeeded.batch.reports[Object.keys(succeeded.batch.reports)[0]].status, 'REPORT_READY');
assert.ok(fs.existsSync(succeeded.delivery.zipPath));
assert.equal(succeeded.delivery.rows.filter(row => row.status === 'READY').length, 1);

const userOutputRoot = path.join(temp, 'user-output');
const internalWorkspaceRoot = path.join(temp, 'internal-workspace');
fs.mkdirSync(userOutputRoot);
let fakeRun = 0;
const fakeSingleRunner = async ({ name, headOffice, url, storageRoot }) => {
  const store = createLocalPrivateStore(storageRoot); const batchId = `bat_fake_${fakeRun}`; const reportId = `rpt_fake_${fakeRun}`; const companyId = `cmp_fake_${fakeRun}`; fakeRun += 1;
  store.startBatch({ batch_id: batchId, mode: 'SYNTHETIC_UI_TEST' });
  const company = { name, headOffice, url, normalizedUrl: url, company_id: companyId };
  const stored = store.saveReport(batchId, { company_id: companyId, diagnosis_run_id: `run_${reportId}`, report_id: reportId }, { 'company.json': company, 'diagnosis.json': diagnosesByUrl[url], 'result.json': { findings: [] }, 'report.html': '<!doctype html><title>synthetic</title>' });
  return { batchId, reportId, stored };
};
const publicDelivery = await runCsvSequential({ csv, outputRoot: userOutputRoot, internalWorkspaceRoot, singleRunner: fakeSingleRunner, pdfExporter: async ({ pdfPath }) => fs.writeFileSync(pdfPath, '%PDF-1.4\nPublic output\n') });
assert.equal(publicDelivery.deliveryStatus, 'READY');
assert.ok(publicDelivery.publicOutputRoot.startsWith(`${userOutputRoot}${path.sep}`));
assert.ok(fs.existsSync(publicDelivery.delivery.zipPath));
assert.ok(fs.existsSync(path.join(internalWorkspaceRoot, 'csv')));
assert.equal(fs.existsSync(path.join(userOutputRoot, '.wsc-private')), false);
assert.equal(fs.existsSync(path.join(userOutputRoot, '.wsc-approvals')), false);

fs.rmSync(temp, { recursive: true, force: true });
console.log('WSC local UI replay and safety tests: PASS');
