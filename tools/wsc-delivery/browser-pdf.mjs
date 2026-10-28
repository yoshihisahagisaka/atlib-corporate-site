import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
let cdpRequestId = 0;
const deadline = async (check, timeoutMs) => {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) { const result = await check(); if (result) return result; await pause(50); }
  throw new Error('PDF_BROWSER_EXPORT_TIMEOUT');
};
const cdp = (socket, method, params = {}) => new Promise((resolve, reject) => {
  const id = ++cdpRequestId; const timer = setTimeout(() => { socket.removeEventListener('message', listener); reject(new Error('PDF_CDP_TIMEOUT')); }, 10_000);
  const listener = event => { const message = JSON.parse(event.data); if (message.id !== id) return; clearTimeout(timer); socket.removeEventListener('message', listener); message.error ? reject(new Error(`PDF_CDP_${message.error.code}`)) : resolve(message.result); };
  socket.addEventListener('message', listener); socket.send(JSON.stringify({ id, method, params }));
});
const openSocket = url => new Promise((resolve, reject) => { const socket = new WebSocket(url); const timer = setTimeout(() => reject(new Error('PDF_CDP_CONNECT_TIMEOUT')), 10_000); socket.addEventListener('open', () => { clearTimeout(timer); resolve(socket); }, { once: true }); socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('PDF_CDP_CONNECT_FAILED')); }, { once: true }); });

export const browserPdfArgs = ({ htmlPath, userDataDir }) => ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${userDataDir}`, pathToFileURL(htmlPath).href];

export function createBrowserPdfExporter({ browserPath, timeoutMs = 30_000 } = {}) {
  if (!browserPath || !path.isAbsolute(browserPath)) throw new Error('BROWSER_PATH_REQUIRED');
  return async ({ htmlPath, pdfPath }) => {
    if (!fs.existsSync(htmlPath) || fs.existsSync(pdfPath)) throw new Error('PDF_INPUT_OR_OUTPUT_INVALID');
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wsc-cdp-')); const pageUrl = pathToFileURL(htmlPath).href;
    let launchError = null; const child = spawn(browserPath, browserPdfArgs({ htmlPath, userDataDir: profile }), { windowsHide: true, stdio: 'ignore' }); child.once('error', error => { launchError = error; });
    try {
      const port = await deadline(() => { if (launchError) throw new Error('PDF_BROWSER_LAUNCH_FAILED'); const activePort = path.join(profile, 'DevToolsActivePort'); return fs.existsSync(activePort) ? Number(fs.readFileSync(activePort, 'utf8').split(/\r?\n/)[0]) : null; }, timeoutMs);
      const target = await deadline(async () => { try { const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.ok ? response.json() : []); return pages.find(page => page.type === 'page' && page.url === pageUrl); } catch { return null; } }, timeoutMs);
      const socket = await openSocket(target.webSocketDebuggerUrl);
      try {
        await cdp(socket, 'Page.enable');
        await deadline(async () => (await cdp(socket, 'Runtime.evaluate', { expression: 'document.readyState' })).result?.value === 'complete', timeoutMs);
        const result = await cdp(socket, 'Page.printToPDF', { displayHeaderFooter: false, printBackground: true, preferCSSPageSize: true });
        fs.writeFileSync(pdfPath, Buffer.from(result.data, 'base64'), { mode: 0o600 });
      } finally { socket.close(); }
    } catch (error) {
      if (fs.existsSync(pdfPath)) fs.rmSync(pdfPath, { force: true });
      throw error;
    } finally {
      if (child.exitCode === null) {
        child.kill();
        await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(2_000)]);
      }
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* A browser descendant may release its temporary profile shortly after exit. */ }
    }
  };
}
