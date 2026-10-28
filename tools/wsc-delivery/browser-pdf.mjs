import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const browserPdfArgs = ({ htmlPath, pdfPath }) => ['--headless=new', '--disable-gpu', '--no-first-run', '--print-to-pdf-no-header', `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href];

export function createBrowserPdfExporter({ browserPath, timeoutMs = 30_000 } = {}) {
  if (!browserPath || !path.isAbsolute(browserPath)) throw new Error('BROWSER_PATH_REQUIRED');
  return ({ htmlPath, pdfPath }) => new Promise((resolve, reject) => {
    if (!fs.existsSync(htmlPath) || fs.existsSync(pdfPath)) return reject(new Error('PDF_INPUT_OR_OUTPUT_INVALID'));
    const child = spawn(browserPath, browserPdfArgs({ htmlPath, pdfPath }), { windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => child.kill(), timeoutMs); child.on('error', error => { clearTimeout(timer); reject(error); }); child.on('exit', code => { clearTimeout(timer); if (code !== 0 || !fs.existsSync(pdfPath)) return reject(new Error('PDF_BROWSER_EXPORT_FAILED')); resolve(); });
  });
}
