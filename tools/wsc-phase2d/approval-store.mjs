import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const json = (value) => `${JSON.stringify(value)}\n`;
const validId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{16,200}$/.test(value);
const validUrl = (value) => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && url.toString() === value; } catch { return false; } };

// Local-only implementation of the Phase 2C approvalStore injection contract.
// Approval values never enter audit logs; only their SHA-256 reference does.
export function createLocalApprovalStore(root, { clock = () => Date.now() } = {}) {
  const base = path.resolve(root); const grants = path.join(base, 'grants'); const claimed = path.join(base, 'claimed'); const consumed = path.join(base, 'consumed'); const revoked = path.join(base, 'revoked'); const audit = path.join(base, 'audit.jsonl');
  for (const dir of [base, grants, claimed, consumed, revoked]) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = (dir, approvalId) => { if (!validId(approvalId)) throw new Error('APPROVAL_ID_INVALID'); return path.join(dir, `${digest(approvalId)}.json`); };
  const appendAudit = (event, approvalId, fields = {}) => fs.appendFileSync(audit, json({ at: new Date(clock()).toISOString(), event, approval_ref: digest(approvalId), ...fields }), { mode: 0o600 });
  const move = (from, to) => { try { fs.renameSync(from, to); return true; } catch (error) { if (error.code === 'ENOENT' || error.code === 'EEXIST') return false; throw error; } };
  return {
    issue({ approvalId = crypto.randomBytes(24).toString('base64url'), targetUrl, expiresAt, executor }) {
      if (!validId(approvalId) || !validUrl(targetUrl) || !Number.isFinite(expiresAt) || expiresAt <= clock() || typeof executor !== 'string' || !executor) throw new Error('APPROVAL_GRANT_INVALID');
      const target = file(grants, approvalId); try { fs.writeFileSync(target, json({ approvalId, targetUrl, expiresAt, executor, status: 'ACTIVE' }), { flag: 'wx', mode: 0o600 }); } catch (error) { if (error.code === 'EEXIST') throw new Error('APPROVAL_ID_ALREADY_EXISTS'); throw error; }
      appendAudit('ISSUED', approvalId, { target_url: targetUrl, executor }); return { approvalId, targetUrl, expiresAt };
    },
    consume({ approvalId, url, now = clock(), executor }) {
      if (!validId(approvalId) || !validUrl(url)) return null;
      const source = file(grants, approvalId); const claim = file(claimed, approvalId); if (!move(source, claim)) return null;
      let grant; try { grant = JSON.parse(fs.readFileSync(claim, 'utf8')); } catch { appendAudit('CORRUPT', approvalId); return null; }
      if (grant.status !== 'ACTIVE' || grant.approvalId !== approvalId || grant.targetUrl !== url || grant.expiresAt <= now || (executor && grant.executor !== executor)) { move(claim, file(revoked, approvalId)); appendAudit('REJECTED', approvalId, { reason: 'BINDING_OR_EXPIRY' }); return null; }
      if (!move(claim, file(consumed, approvalId))) { appendAudit('REJECTED', approvalId, { reason: 'CONSUME_COLLISION' }); return null; }
      appendAudit('CONSUMED', approvalId, { target_url: url, executor: grant.executor }); return { targetUrl: grant.targetUrl, expiresAt: grant.expiresAt, executor: grant.executor };
    },
    cancel({ approvalId, executor }) {
      if (!validId(approvalId)) return false; const source = file(grants, approvalId); const target = file(revoked, approvalId); if (!move(source, target)) return false; appendAudit('REVOKED', approvalId, { executor }); return true;
    },
    auditEntries() { return fs.existsSync(audit) ? fs.readFileSync(audit, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []; }
  };
}
