import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
export function createLocalPrivateStore(root) {
  const base = path.resolve(root); fs.mkdirSync(base, { recursive: true });
  const inside = (...segments) => { if (segments.some(segment => typeof segment !== 'string' || segment === '' || segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\'))) throw new Error('STORE_PATH_ESCAPE'); const target = path.resolve(base, ...segments); if (!target.startsWith(`${base}${path.sep}`)) throw new Error('STORE_PATH_ESCAPE'); return target; };
  const atomic = (file, content) => { if (fs.existsSync(file)) throw new Error('STORE_IMMUTABLE_EXISTS'); const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, content, { mode: 0o600 }); fs.renameSync(temp, file); };
  return {
    startBatch(batch) { const dir = inside('batches', batch.batch_id); fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); const manifest = path.join(dir, 'manifest.json'); if (!fs.existsSync(manifest)) atomic(manifest, json(batch)); return dir; },
    readState(batchId) { const file = inside('batches', batchId, 'state.json'); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { batch_id: batchId, reports: {} }; },
    writeState(batchId, state) { const file = inside('batches', batchId, 'state.json'); const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, json(state), { mode: 0o600 }); fs.renameSync(temp, file); },
    saveReport(batchId, ids, artifacts) { const dir = inside('batches', batchId, 'reports', ids.report_id); fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); const entries = Object.entries(artifacts).map(([name, value]) => [name, typeof value === 'string' ? value : json(value)]); const checksums = {}; for (const [name, value] of entries) { const file = path.join(dir, name); atomic(file, value); checksums[name] = digest(value); } atomic(path.join(dir, 'integrity.json'), json({ ...ids, checksums })); return { relative_path: path.relative(base, dir).replace(/\\/g, '/'), checksums }; },
    verifyReport(batchId, reportId) { const dir = inside('batches', batchId, 'reports', reportId); const integrity = JSON.parse(fs.readFileSync(path.join(dir, 'integrity.json'), 'utf8')); return Object.entries(integrity.checksums).every(([name, sum]) => digest(fs.readFileSync(path.join(dir, name), 'utf8')) === sum); }
  };
}
