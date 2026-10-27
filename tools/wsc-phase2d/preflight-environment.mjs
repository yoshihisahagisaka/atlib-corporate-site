import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createLocalApprovalStore } from './approval-store.mjs';
import { createLocalPrivateStore } from '../wsc-phase2a/local-store.mjs';

const safe = (value) => typeof value === 'string' ? value.replace(/[\r\n]/g, ' ').slice(0, 200) : undefined;
const json = (value) => `${JSON.stringify(value)}\n`;

// This prepares local-only directories. It deliberately has no transport import.
export function createPreflightEnvironment(root, { clock } = {}) {
  const base = path.resolve(root); const logs = path.join(base, 'logs'); fs.mkdirSync(logs, { recursive: true, mode: 0o700 });
  const log = (event, { actor, targetUrl, approvalId, resultCode, reportId } = {}) => {
    const record = { at: new Date((clock || (() => Date.now()))()).toISOString(), event: safe(event), actor: safe(actor), target_url: safe(targetUrl), approval_ref: approvalId ? crypto.createHash('sha256').update(approvalId).digest('hex') : undefined, result_code: safe(resultCode), report_id: safe(reportId) };
    fs.appendFileSync(path.join(logs, 'execution.jsonl'), json(Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined))), { mode: 0o600 });
  };
  return { approvals: createLocalApprovalStore(path.join(base, 'approvals'), { clock }), artifacts: createLocalPrivateStore(path.join(base, 'artifacts')), log };
}
