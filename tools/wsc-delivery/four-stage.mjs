import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRestrictedNetworkProbe } from '../wsc-phase2c/restricted-network-probe.mjs';
import { createLocalApprovalStore } from '../wsc-phase2d/approval-store.mjs';
import { createLocalPrivateStore } from '../wsc-phase2a/local-store.mjs';
import { evaluate, render, normalizeDiagnosisUrl } from '../wsc-vs1/engine.mjs';

const root = path.dirname(fileURLToPath(import.meta.url)); const id = (prefix, value) => `${prefix}_${crypto.createHash('sha256').update(value).digest('hex').slice(0, 20)}`;
export async function runSingleUrl({ url, name, headOffice, storageRoot, approvalRoot, executor = 'local-single-url', now = () => Date.now() }) {
  if (!name || !headOffice) throw new Error('COMPANY_NAME_AND_HEAD_OFFICE_REQUIRED'); const targetUrl = normalizeDiagnosisUrl(url); const addresses = (await dns.lookup(new URL(targetUrl).hostname, { all: true, verbatim: true })).map(row => row.address);
  const approvals = createLocalApprovalStore(approvalRoot, { clock: now }); const grant = approvals.issue({ targetUrl, executor, expiresAt: now() + 60_000 }); const probe = createRestrictedNetworkProbe({ approvalStore: approvals, clock: now });
  const diagnosis = await probe({ url: targetUrl, addresses, mailDomain: null, approvalId: grant.approvalId }); const company = { name, headOffice, url: targetUrl, normalizedUrl: targetUrl, company_id: id('cmp', `${name}\u0000${headOffice}\u0000${targetUrl}`) }; const store = createLocalPrivateStore(storageRoot); const batchId = id('bat', targetUrl); const reportId = id('rpt', `${batchId}\u0000${company.company_id}`); const runId = id('run', `${batchId}\u0000${company.company_id}`); store.startBatch({ batch_id: batchId, mode: 'SINGLE_URL' });
  const report = evaluate(diagnosis, { rulesPath: path.join(root, '..', 'wsc-vs1', 'rules.json'), explanationsPath: path.join(root, '..', 'wsc-vs1', 'explanations.json') }); const html = render(report, company); const stored = store.saveReport(batchId, { company_id: company.company_id, diagnosis_run_id: runId, report_id: reportId }, { 'company.json': company, 'diagnosis.json': diagnosis, 'result.json': report, 'report.html': html }); return { batchId, reportId, company, diagnosis, report, htmlPath: path.join(storageRoot, stored.relative_path, 'report.html'), stored };
}

export async function runSingleUrlToPdf({ pdfExporter, pdfOutputPath, ...options }) {
  if (typeof pdfExporter !== 'function' || !pdfOutputPath) throw new Error('PDF_EXPORTER_AND_OUTPUT_REQUIRED');
  const result = await runSingleUrl(options); await pdfExporter({ htmlPath: result.htmlPath, pdfPath: pdfOutputPath, company: result.company });
  if (!fs.existsSync(pdfOutputPath) || !fs.readFileSync(pdfOutputPath).subarray(0, 4).equals(Buffer.from('%PDF'))) throw new Error('PDF_EXPORT_INVALID');
  return { ...result, pdfPath: pdfOutputPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [url, name, headOffice, storageRoot, approvalRoot] = process.argv.slice(2); if (!url || !name || !headOffice || !storageRoot || !approvalRoot) throw new Error('使い方: node four-stage.mjs URL 企業名 本店所在地 保存先 承認保存先');
  const result = await runSingleUrl({ url, name, headOffice, storageRoot, approvalRoot }); console.log(JSON.stringify({ targetUrl: result.diagnosis.targetUrl, reportId: result.reportId, htmlPath: result.htmlPath }, null, 2));
}
