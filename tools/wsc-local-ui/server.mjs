import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { parseCompaniesCsv } from '../wsc-phase2a/csv.mjs';
import { createLocalPrivateStore } from '../wsc-phase2a/local-store.mjs';
import { createSyntheticExecutor } from '../wsc-phase2a/safe-executor.mjs';
import { runSyntheticBatch } from '../wsc-phase2a/batch.mjs';
import { createDeliveryPackage } from '../wsc-delivery/delivery.mjs';
import { createBrowserPdfExporter } from '../wsc-delivery/browser-pdf.mjs';
import { runSingleUrl, runSingleUrlToPdf } from '../wsc-delivery/four-stage.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(root, 'public');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 20);
const safeName = value => String(value).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 120) || '企業';
const mustAbsoluteDirectory = value => {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('OUTPUT_DIRECTORY_REQUIRED');
  const target = path.resolve(value); if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) throw new Error('OUTPUT_DIRECTORY_INVALID');
  return target;
};
const deliveryAttemptRoot = (runRoot, batch) => path.join(runRoot, `delivery_${Date.now()}_${hash(JSON.stringify(batch.reports))}_${crypto.randomUUID()}`);
const publicDeliveryRoot = (outputRoot, batch) => path.join(outputRoot, `WSC_${hash(batch.batch_id)}_${Date.now()}_${crypto.randomUUID()}`);

export const localInternalWorkspaceRoot = () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'atLIB', 'WSC', 'local-ui');

export function findWindowsBrowser() {
  const candidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ];
  return candidates.find(fs.existsSync) || null;
}

export function createPdfExporter() {
  const browserPath = findWindowsBrowser();
  if (!browserPath) throw new Error('CHROME_OR_EDGE_NOT_FOUND');
  return createBrowserPdfExporter({ browserPath });
}

export async function runCsvSequential({ csv, outputRoot, internalWorkspaceRoot = localInternalWorkspaceRoot(), pdfExporter = createPdfExporter(), singleRunner = runSingleUrl, onProgress = () => {} }) {
  const parsed = parseCompaniesCsv(csv); const base = mustAbsoluteDirectory(outputRoot);
  const batchId = `bat_ui_${hash(csv)}`; const internalRunRoot = path.join(path.resolve(internalWorkspaceRoot), 'csv', hash(csv)); const storageRoot = path.join(internalRunRoot, '.wsc-private'); const approvalRoot = path.join(internalRunRoot, '.wsc-approvals');
  const store = createLocalPrivateStore(storageRoot); store.startBatch({ batch_id: batchId, mode: 'CSV_SEQUENTIAL_UI', csv_contract: parsed.header, rejected_rows: parsed.errors });
  let state = store.readState(batchId); let completed = 0; let failed = 0;
  for (const company of parsed.companies) {
    const current = state.reports[company.company_id];
    if (current?.status === 'REPORT_READY' && current.storage_batch_id && store.verifyReport(current.storage_batch_id, current.report_id)) { completed += 1; onProgress({ company: company.name, completed, failed, total: parsed.companies.length, status: 'SKIPPED_READY' }); continue; }
    const reportId = `rpt_ui_${hash(`${batchId}\u0000${company.company_id}`)}`;
    state.reports[company.company_id] = { company_id: company.company_id, report_id: reportId, status: 'RUNNING', started_at: new Date().toISOString() }; store.writeState(batchId, state);
    onProgress({ company: company.name, completed, failed, total: parsed.companies.length, status: 'RUNNING' });
    try {
      const result = await singleRunner({ url: company.normalizedUrl, name: company.name, headOffice: company.headOffice, storageRoot, approvalRoot, executor: 'wsc-local-ui-csv' });
      state.reports[company.company_id] = { company_id: company.company_id, report_id: result.reportId, storage_batch_id: result.batchId, status: 'REPORT_READY', completed_at: new Date().toISOString(), storage: result.stored };
      completed += 1;
    } catch (error) {
      state.reports[company.company_id] = { company_id: company.company_id, report_id: reportId, status: 'FAILED', completed_at: new Date().toISOString(), error_code: error.message };
      failed += 1;
    }
    store.writeState(batchId, state); onProgress({ company: company.name, completed, failed, total: parsed.companies.length, status: state.reports[company.company_id].status });
  }
  const batch = store.readState(batchId); const deliveryRoot = publicDeliveryRoot(base, batch);
  onProgress({ completed, failed, total: parsed.companies.length, status: 'PDF_EXPORTING' });
  try {
    const delivery = await createDeliveryPackage({ batch, storageRoot, outputRoot: deliveryRoot, pdfExporter });
    onProgress({ completed, failed, total: parsed.companies.length, status: 'DELIVERY_READY' });
    return { batch, intake: parsed, internalRunRoot, publicOutputRoot: deliveryRoot, deliveryRoot, delivery, completed, failed, deliveryStatus: 'READY' };
  } catch (error) {
    onProgress({ completed, failed, total: parsed.companies.length, status: 'PDF_EXPORT_FAILED', error: error.message });
    return { batch, intake: parsed, internalRunRoot, publicOutputRoot: deliveryRoot, deliveryRoot, delivery: null, completed, failed, deliveryStatus: 'FAILED', deliveryError: error.message };
  }
}

// Test-only replay: it uses the existing Phase 2A synthetic executor, report
// renderer and delivery package. No DNS, TLS or HTTPS operation is possible.
export async function replaySavedJson({ csv, diagnosesByUrl, outputRoot, pdfExporter }) {
  const parsed = parseCompaniesCsv(csv); const executor = createSyntheticExecutor({ resolve: () => ['93.184.216.34'], probe: async url => ({ remoteAddress: '93.184.216.34', diagnosis: diagnosesByUrl[url] }) });
  const root = mustAbsoluteDirectory(outputRoot); const storageRoot = path.join(root, '.wsc-private'); const result = await runSyntheticBatch({ csv, executor, store: createLocalPrivateStore(storageRoot), batchId: `bat_replay_${hash(csv)}`, maxAttempts: 1 });
  const deliveryRoot = deliveryAttemptRoot(root, result.batch);
  try {
    const delivery = await createDeliveryPackage({ batch: result.batch, storageRoot, outputRoot: deliveryRoot, pdfExporter });
    return { ...result, deliveryRoot, delivery, deliveryStatus: 'READY' };
  } catch (error) {
    return { ...result, deliveryRoot, delivery: null, deliveryStatus: 'FAILED', deliveryError: error.message };
  }
}

export const dialogScript = () => "Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.Application]::EnableVisualStyles();$d=New-Object System.Windows.Forms.FolderBrowserDialog;if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){[Console]::Out.Write($d.SelectedPath)}";
export const dialogPowerShellArgs = () => ['-NoProfile', '-STA', '-Command', dialogScript()];
export const chooseOutputFolder = () => new Promise((resolve, reject) => {
  const child = spawn('powershell.exe', dialogPowerShellArgs(), { windowsHide: false });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.on('error', () => reject(new Error('WINDOWS_DIALOG_FAILED')));
  // `close` waits for standard output to close, so the selected path is not
  // lost when PowerShell exits immediately after the user presses OK.
  child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error('WINDOWS_DIALOG_FAILED')));
});
export const explorerArgs = target => [target];
export const openOutputFolder = target => new Promise((resolve, reject) => {
  const child = spawn('explorer.exe', explorerArgs(target), { windowsHide: false });
  child.on('error', () => reject(new Error('WINDOWS_EXPLORER_FAILED')));
  child.on('spawn', resolve);
});
export const csvFromRequest = body => {
  if (typeof body.csv !== 'string' || body.csv.trim() === '') throw new Error('CSV_CONTENT_INVALID');
  return body.csv;
};
const readBody = request => new Promise((resolve, reject) => { let body = ''; request.on('data', chunk => { body += chunk; if (body.length > 1_000_000) request.destroy(); }); request.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('REQUEST_JSON_INVALID')); } }); request.on('error', reject); });
const send = (response, status, value) => { response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); response.end(JSON.stringify(value)); };
const localUiOrigin = 'http://127.0.0.1:38152';
const isLocalUiPage = value => typeof value === 'string' && (value === localUiOrigin || value.startsWith(`${localUiOrigin}/`));
export const isLocalUiApiRequest = request => {
  if (request.headers.host !== '127.0.0.1:38152') return false;
  if (request.method === 'GET') return isLocalUiPage(request.headers.origin) || isLocalUiPage(request.headers.referer);
  return request.headers.origin === localUiOrigin;
};

// This is deliberately only an in-memory, single-process execution lock. It
// does not replace the Phase 2A report state, which remains the source of
// truth for reusable HTML artifacts.
export function createExecutionLock() {
  let activeJobId = null;
  return {
    acquire(jobId) { if (activeJobId) return false; activeJobId = jobId; return true; },
    release(jobId) { if (activeJobId === jobId) activeJobId = null; },
    active() { return activeJobId; }
  };
}

export function createLocalUiServer() {
  const jobs = new Map(); const executionLock = createExecutionLock();
  return http.createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url.startsWith('/api/job/')) { if (!isLocalUiApiRequest(request)) return send(response, 403, { error: 'LOCAL_UI_REQUEST_REQUIRED' }); return send(response, 200, jobs.get(request.url.slice('/api/job/'.length)) || { status: 'NOT_FOUND' }); }
      if (request.method === 'GET') { const file = request.url === '/' ? 'index.html' : request.url.slice(1); const target = path.resolve(publicRoot, file); if (!target.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(target)) return send(response, 404, { error: 'NOT_FOUND' }); response.writeHead(200, { 'content-type': file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8' }); return fs.createReadStream(target).pipe(response); }
      if (!isLocalUiApiRequest(request)) return send(response, 403, { error: 'LOCAL_UI_REQUEST_REQUIRED' });
      const body = await readBody(request);
      if (request.url === '/api/choose-folder') return send(response, 200, { path: await chooseOutputFolder() });
      if (request.url === '/api/open-folder') { const target = mustAbsoluteDirectory(body.path); await openOutputFolder(target); return send(response, 200, { ok: true }); }
      if (request.url === '/api/run-single') { const outputRoot = mustAbsoluteDirectory(body.outputRoot); const runRoot = path.join(outputRoot, `WSC_${Date.now()}`); fs.mkdirSync(runRoot, { recursive: true, mode: 0o700 }); const internalRunRoot = path.join(localInternalWorkspaceRoot(), 'single', `${Date.now()}_${crypto.randomUUID()}`); const jobId = 'single'; if (!executionLock.acquire(jobId)) return send(response, 409, { error: 'ANOTHER_WSC_JOB_RUNNING' }); const pdfPath = path.join(runRoot, `${safeName(body.name)}_Webセキュリティ診断レポート.pdf`); try { const result = await runSingleUrlToPdf({ url: body.url, name: body.name, storageRoot: path.join(internalRunRoot, '.wsc-private'), approvalRoot: path.join(internalRunRoot, '.wsc-approvals'), pdfExporter: createPdfExporter(), pdfOutputPath: pdfPath, executor: 'wsc-local-ui-single' }); return send(response, 200, { runRoot, pdfPath: result.pdfPath, reportId: result.reportId, deliveryStatus: 'READY' }); } finally { executionLock.release(jobId); } }
      if (request.url === '/api/run-csv') { const csv = csvFromRequest(body); const jobId = crypto.randomUUID(); if (!executionLock.acquire(jobId)) return send(response, 409, { error: 'ANOTHER_WSC_JOB_RUNNING' }); jobs.set(jobId, { status: 'RUNNING', events: [] }); runCsvSequential({ csv, outputRoot: body.outputRoot, onProgress: event => jobs.get(jobId)?.events.push(event) }).then(result => jobs.set(jobId, { status: result.deliveryStatus === 'READY' ? 'COMPLETE' : 'FAILED_DELIVERY', result, events: jobs.get(jobId)?.events || [] }), error => jobs.set(jobId, { status: 'FAILED', error: error.message, events: jobs.get(jobId)?.events || [] })).finally(() => { executionLock.release(jobId); }); return send(response, 202, { jobId }); }
      return send(response, 404, { error: 'NOT_FOUND' });
    } catch (error) { return send(response, 400, { error: error.message }); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { const server = createLocalUiServer(); server.listen(38152, '127.0.0.1', () => console.log('WSC local UI: http://127.0.0.1:38152')); }
