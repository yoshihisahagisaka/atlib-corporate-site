import fs from 'node:fs';
import path from 'node:path';

const csv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const filename = (value) => String(value).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 120) || '企業';
const crc32 = (buffer) => { let crc = 0xffffffff; for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; };
const u16 = (value) => Buffer.from([value & 255, (value >>> 8) & 255]); const u32 = (value) => Buffer.from([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
export function writeFlatZip(outputPath, files) {
  let offset = 0; const parts = []; const central = [];
  for (const { name, content } of files) { const data = Buffer.isBuffer(content) ? content : Buffer.from(content); const nameBytes = Buffer.from(path.basename(name)); const checksum = crc32(data); const local = Buffer.concat([Buffer.from('504b0304', 'hex'), u16(20), u16(0), u16(0), u16(0), u16(0), u32(checksum), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data]); parts.push(local); central.push(Buffer.concat([Buffer.from('504b0102', 'hex'), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(checksum), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes])); offset += local.length; }
  const directory = Buffer.concat(central); const footer = Buffer.concat([Buffer.from('504b0506', 'hex'), u16(0), u16(0), u16(files.length), u16(files.length), u32(directory.length), u32(offset), u16(0)]); fs.writeFileSync(outputPath, Buffer.concat([...parts, directory, footer]), { mode: 0o600 });
}

// Receives only already-generated local HTML. A caller must explicitly inject a
// browser/PDF adapter; this module never opens URLs or starts network traffic.
export async function createDeliveryPackage({ batch, storageRoot, outputRoot, pdfExporter }) {
  if (typeof pdfExporter !== 'function') throw new Error('PDF_EXPORTER_REQUIRED');
  const root = path.resolve(outputRoot); const pdfDir = path.join(root, 'pdf'); fs.mkdirSync(pdfDir, { recursive: true, mode: 0o700 }); const rows = [];
  for (const entry of Object.values(batch.reports)) {
    if (entry.status !== 'REPORT_READY') { rows.push({ company: entry.company_id, status: entry.status }); continue; }
    const reportDir = path.resolve(storageRoot, entry.storage.relative_path); if (!reportDir.startsWith(`${path.resolve(storageRoot)}${path.sep}`)) throw new Error('DELIVERY_STORAGE_ESCAPE');
    const company = JSON.parse(fs.readFileSync(path.join(reportDir, 'company.json'), 'utf8')); const htmlPath = path.join(reportDir, 'report.html'); const pdfName = `${filename(company.name)}_Webセキュリティ診断レポート.pdf`; const pdfPath = path.join(pdfDir, pdfName);
    if (fs.existsSync(pdfPath)) throw new Error('DELIVERY_FILENAME_COLLISION'); await pdfExporter({ htmlPath, pdfPath, company }); if (!fs.existsSync(pdfPath) || !fs.readFileSync(pdfPath).subarray(0, 4).equals(Buffer.from('%PDF'))) throw new Error('PDF_EXPORT_INVALID'); rows.push({ company: company.name, headOffice: company.headOffice, url: company.url, pdfName, status: 'READY' });
  }
  const list = ['企業名,本店所在地,URL,PDFファイル名,配布先（未指定）,状態', ...rows.map(row => [row.company, row.headOffice, row.url, row.pdfName, '', row.status].map(csv).join(','))].join('\n') + '\n'; const listPath = path.join(root, '配布先一覧.csv'); fs.writeFileSync(listPath, list, { mode: 0o600 });
  const emailPath = path.join(root, 'メール文案.txt'); fs.writeFileSync(emailPath, '件名：Webセキュリティ診断レポートのご送付\n\n本文は配布先・送付目的・承認済み案内文が確定後に作成します。\n本ファイルは送信機能を持ちません。\n', { mode: 0o600 });
  const files = fs.readdirSync(pdfDir).sort().map(name => ({ name, content: fs.readFileSync(path.join(pdfDir, name)) })); const zipPath = path.join(root, 'Webセキュリティ診断レポート.zip'); writeFlatZip(zipPath, files); return { pdfDir, zipPath, listPath, emailPath, rows };
}
