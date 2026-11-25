'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const publicRoot = path.join(root, 'public');
const evidenceRoot = path.join(root, 'docs/evidence/issue-81-browser');
const widths = [320, 390, 650, 651, 768, 1024, 1440];
const pages = [{ name: 'home', file: 'index.html' }, { name: 'services', file: 'services/index.html' }, { name: 'company', file: 'company/index.html' }];
const chromeCandidates = process.platform === 'win32'
  ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe']
  : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const chrome = process.env.CHROME_PATH || chromeCandidates.find(fs.existsSync);
if (!chrome) throw new Error('Chrome/Chromium not found');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForFile(file, attempts = 100) {
  for (let i = 0; i < attempts; i += 1) {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').split(/\r?\n/u);
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${file}`);
}
function cdp(wsUrl) {
  const socket = new WebSocket(wsUrl); let id = 0; const pending = new Map(); const listeners = new Map();
  const ready = new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const item = pending.get(message.id); pending.delete(message.id);
      if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
    } else for (const handler of listeners.get(message.method) || []) handler(message.params);
  };
  socket.onclose = () => {
    for (const item of pending.values()) item.reject(new Error('CDP WebSocket closed unexpectedly'));
    pending.clear();
  };
  return {
    ready,
    on(method, handler) { const list = listeners.get(method) || []; list.push(handler); listeners.set(method, list); },
    send(method, params = {}) { return new Promise((resolve, reject) => { const requestId = ++id; pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })); }); },
    close() { socket.close(); },
  };
}
function requestJson(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => { let body = ''; res.setEncoding('utf8'); res.on('data', (chunk) => { body += chunk; }); res.on('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } }); });
    req.setTimeout(10000, () => req.destroy(new Error(`CDP HTTP timeout: ${url}`)));
    req.on('error', reject); req.end();
  });
}
function staticServer() {
  const types = { '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const file = path.resolve(publicRoot, `.${relative}`);
    if (!file.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
}

async function inspect(port, siteOrigin, page, width) {
  const url = `${siteOrigin}/${page.file}`;
  const target = await requestJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, 'PUT');
  const client = cdp(target.webSocketDebuggerUrl); await client.ready;
  const errors = { console: [], page: [], resource: [] };
  client.on('Runtime.consoleAPICalled', (event) => { if (event.type === 'error') errors.console.push(event.args.map((item) => item.value || item.description || '').join(' ')); });
  client.on('Runtime.exceptionThrown', (event) => errors.page.push(event.exceptionDetails.text));
  client.on('Network.loadingFailed', (event) => { if (!event.canceled) errors.resource.push(`${event.errorText}:${event.type}`); });
  await Promise.all(['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable'].map((method) => client.send(method)));
  await client.send('Emulation.setDeviceMetricsOverride', { width, height: 1200, deviceScaleFactor: 1, mobile: false });
  await client.send('Page.navigate', { url }); await sleep(1200);
  await client.send('Runtime.evaluate', { expression: `(async()=>{ for(let y=0;y<document.documentElement.scrollHeight;y+=Math.max(300,innerHeight*.8)){ scrollTo(0,y); await new Promise(r=>setTimeout(r,45)); } scrollTo(0,0); await new Promise(r=>setTimeout(r,500)); return true; })()`, awaitPromise: true, returnByValue: true });
  const expression = `(() => {
    const d=document, root=d.documentElement, body=d.body;
    const broken=[...d.images].filter(x=>!x.complete||x.naturalWidth===0).map(x=>x.getAttribute('src'));
    const logo=d.querySelector('img.renewal-business-logo');
    const section=d.querySelector(${JSON.stringify(page.name === 'home' ? '.renewal-brand-services' : page.name === 'services' ? '.renewal-management-explainer' : '.renewal-isms-company')});
    const gallery=d.querySelector('.motion-section .img');
    let slider=null; const indicators=[...d.querySelectorAll('.slide-indicators button,.slide-indicators span')];
    if (indicators.length>1) { const before=[...d.querySelectorAll('.slide')].findIndex(x=>x.classList.contains('active')); indicators[1].click(); const after=[...d.querySelectorAll('.slide')].findIndex(x=>x.classList.contains('active')); slider={before,after}; }
    const rect=section?.getBoundingClientRect();
    const overflow=[...d.querySelectorAll('body *')].map((el)=>{const r=el.getBoundingClientRect();return{tag:el.tagName,className:String(el.className||''),id:el.id,left:r.left,right:r.right,width:r.width};}).filter((x)=>x.right>root.clientWidth+1||x.left< -1).slice(0,25);
    const requiredAnchors=${JSON.stringify(page.name === 'home' ? ['link1','link4','track-record','kaizen','diagnosis','contact'] : page.name === 'services' ? ['kaizen','it-projects','it-bpo','business-kaizen','security','casual-consulting','link5'] : ['mvv','messages','business','information'])};
    const clientLogos=[...d.querySelectorAll('.renewal-brand-client-logos img')];
    const isms=[...d.querySelectorAll('img[src*="isms-gcerti-gijp-1167-ic.png"]')];
    const mixi=d.querySelector('img.renewal-brand-client-logo-mixi');
    return {innerWidth:innerWidth,clientWidth:root.clientWidth,scrollWidth:root.scrollWidth,bodyScrollWidth:body.scrollWidth,overflow,broken,logo:{present:!!logo,complete:logo?.complete,naturalWidth:logo?.naturalWidth,naturalHeight:logo?.naturalHeight},clientLogos:{count:clientLogos.length,visible:clientLogos.filter(x=>x.getBoundingClientRect().width>0&&x.getBoundingClientRect().height>0).length},officialLogos:{ismsCount:isms.length,ismsVisible:isms.filter(x=>x.getBoundingClientRect().width>=45&&x.getBoundingClientRect().height>0).length,mixiPresent:!!mixi,mixiNaturalWidth:mixi?.naturalWidth,mixiNaturalHeight:mixi?.naturalHeight},section:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,anchors:requiredAnchors.filter(id=>!d.getElementById(id)),gallery:{present:!!gallery,animation:getComputedStyle(gallery||body).animationName},menuInteraction:null,slider};
  })()`;
  const evaluated = await client.send('Runtime.evaluate', { expression, returnByValue: true });
  const metrics = evaluated.result.value;
  if (width <= 650) {
    const menuState = async (action = '') => (await client.send('Runtime.evaluate', { expression: `(() => { const button=document.querySelector('#menubar_hdr'); ${action} return button ? button.classList.contains('ham') : null; })()`, returnByValue: true })).result.value;
    const before = await menuState(); const opened = await menuState('button.click();'); await sleep(400); const openedAfterWait = await menuState();
    const closed = await menuState('button.click();'); await sleep(400); const closedAfterWait = await menuState();
    metrics.menuInteraction = { before, opened, openedAfterWait, closed, closedAfterWait };
  }
  await client.send('Runtime.evaluate', { expression: `(async()=>{ for(let y=0;y<document.documentElement.scrollHeight;y+=Math.max(300,innerHeight*.8)){ scrollTo(0,y); await new Promise(r=>setTimeout(r,45)); } scrollTo(0,0); await new Promise(r=>setTimeout(r,1100)); return true; })()`, awaitPromise: true, returnByValue: true });
  if ([390, 1440].includes(width)) {
    await client.send('Runtime.evaluate', { expression: `(()=>{ const effects=['up','down','transform1','transform2','transform3','blur']; document.querySelectorAll('.inview').forEach((element)=>{ for(const effect of effects) if(element.classList.contains(effect)) element.classList.add(effect+'style'); }); return true; })()`, returnByValue: true });
    await sleep(1100);
    const layout = await client.send('Page.getLayoutMetrics');
    const full = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: layout.cssContentSize.width, height: layout.cssContentSize.height, scale: 1 } });
    fs.writeFileSync(path.join(evidenceRoot, `${page.name}-v4-${width}-full.png`), Buffer.from(full.data, 'base64'));
    if (metrics.section) {
      const partial = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...metrics.section, scale: 1 } });
      fs.writeFileSync(path.join(evidenceRoot, `${page.name}-v4-feature-${width}.png`), Buffer.from(partial.data, 'base64'));
    }
  }
  client.close(); await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
  return { page: page.name, width, ...metrics, errors };
}

(async () => {
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'corporate-renewal-browser-'));
  const server = staticServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const siteOrigin = `http://127.0.0.1:${server.address().port}`;
  const processHandle = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let chromeError = '';
  processHandle.stderr.on('data', (chunk) => { chromeError += chunk.toString(); });
  processHandle.on('exit', (code) => { if (code !== 0) process.stderr.write(`CHROME_EXIT=${code} ${chromeError.slice(-2000)}\n`); });
  try {
    const [portText] = await waitForFile(path.join(profile, 'DevToolsActivePort'));
    const port = Number(portText); const results = [];
    for (const width of widths) for (const page of pages) {
      process.stdout.write(`BROWSER_GATE_START=${page.name}/${width}\n`);
      results.push(await inspect(port, siteOrigin, page, width));
      process.stdout.write(`BROWSER_GATE_PASS=${page.name}/${width}\n`);
    }
    fs.writeFileSync(path.join(evidenceRoot, 'browser-gate-v4.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), widths, results }, null, 2)}\n`);
    for (const result of results) {
      assert.equal(result.innerWidth, result.width, `${result.page}/${result.width}: viewport`);
      assert.ok(result.scrollWidth <= result.clientWidth + 1, `${result.page}/${result.width}: document overflow ${result.scrollWidth}/${result.clientWidth} ${JSON.stringify(result.overflow)}`);
      assert.ok(result.bodyScrollWidth <= result.clientWidth + 1, `${result.page}/${result.width}: body overflow ${result.bodyScrollWidth}/${result.clientWidth} ${JSON.stringify(result.overflow)}`);
      assert.deepEqual(result.broken, [], `${result.page}/${result.width}: broken images`);
      assert.deepEqual(result.anchors, [], `${result.page}/${result.width}: required anchors`);
      if (result.page !== 'company') {
        assert.equal(result.logo.present, true, `${result.page}/${result.width}: business logo missing`);
        assert.equal(result.logo.complete, true, `${result.page}/${result.width}: business logo incomplete`);
        assert.ok(result.logo.naturalWidth > 0 && result.logo.naturalHeight > 0, `${result.page}/${result.width}: business logo dimensions`);
      }
      assert.ok(result.officialLogos.ismsCount >= 1, `${result.page}/${result.width}: ISMS logo missing`);
      assert.equal(result.officialLogos.ismsVisible, result.officialLogos.ismsCount, `${result.page}/${result.width}: ISMS minimum display size`);
      assert.deepEqual(result.errors, { console: [], page: [], resource: [] }, `${result.page}/${result.width}: browser errors`);
      if (result.width <= 650) {
        assert.equal(result.menuInteraction?.before, false, `${result.page}/${result.width}: mobile menu initial`);
        assert.equal(result.menuInteraction?.openedAfterWait, true, `${result.page}/${result.width}: mobile menu open`);
        assert.equal(result.menuInteraction?.closedAfterWait, false, `${result.page}/${result.width}: mobile menu close`);
      }
      if (result.page === 'home') assert.notEqual(result.slider?.before, result.slider?.after, `${result.width}: slider`);
      if (result.page === 'home') assert.notEqual(result.gallery?.animation, 'none', `${result.width}: gallery animation`);
      if (result.page === 'home') assert.deepEqual(result.clientLogos, { count: 8, visible: 8 }, `${result.width}: client logos`);
      if (result.page === 'home') assert.deepEqual({ present: result.officialLogos.mixiPresent, width: result.officialLogos.mixiNaturalWidth, height: result.officialLogos.mixiNaturalHeight }, { present: true, width: 6000, height: 3614 }, `${result.width}: official MIXI logo`);
      if (result.page === 'services') assert.ok(result.section?.height > 0, `${result.width}: explainer section`);
      if (result.page === 'company') assert.ok(result.section?.height > 0, `${result.width}: ISMS company section`);
    }
    process.stdout.write(`CORPORATE_BROWSER_GATE=${results.length} PASS\n`);
  } finally {
    if (processHandle.exitCode === null) {
      processHandle.kill();
      await Promise.race([new Promise((resolve) => processHandle.once('exit', resolve)), sleep(3000)]);
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; }
      catch (error) { if (attempt === 4) throw error; await sleep(200); }
    }
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
