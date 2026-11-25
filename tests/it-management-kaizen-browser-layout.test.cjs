'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {spawnSync} = require('node:child_process');

const source = path.resolve(__dirname, '../public/it-management-kaizen/index.html');
const candidates = process.platform === 'win32'
  ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
     'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe']
  : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const chrome = process.env.CHROME_PATH || candidates.find(fs.existsSync);
const viewports = [320, 360, 390, 393, 430, 650, 651, 768, 1024, 1440];

function wrapper(width, targetUrl) {
  return `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{margin:0;width:100%;height:100%;border:0}</style>
<iframe id="target"></iframe><pre id="result"></pre>
<script>
const requested=${width};
target.onload=()=>{
 const w=target.contentWindow,d=target.contentDocument;
 d.documentElement.style.scrollBehavior='auto';
 d.querySelectorAll('details').forEach(x=>x.open=true);
 d.querySelector('#diagnosis').scrollIntoView();
 w.dispatchEvent(new Event('scroll'));
 const cw=d.documentElement.clientWidth;
 const rect=el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width}};
 const textOverflow=[...d.querySelectorAll('h1,h2,h3,p,summary,[data-it-diagnosis-link]')]
  .map(el=>({tag:el.tagName,className:el.className,rect:rect(el)}))
  .filter(x=>x.rect.right>cw+1||x.rect.left< -1);
 const ctas=[...d.querySelectorAll('[data-it-diagnosis-link]')]
  .map(el=>({href:el.href,rect:rect(el),visible:!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)}));
 const failedImages=[...d.images].filter(x=>!x.complete||x.naturalWidth===0).map(x=>x.src);
 const output={requested,innerWidth:w.innerWidth,clientWidth:cw,
  scrollWidth:d.documentElement.scrollWidth,bodyScrollWidth:d.body.scrollWidth,
  visualViewportWidth:w.visualViewport.width,
  mobileMedia:w.matchMedia('(max-width:650px)').matches,scrollY:w.scrollY,
  textOverflow,ctas,failedImages,
  faqOpen:[...d.querySelectorAll('details')].every(x=>x.open),
  headerScrolled:d.querySelector('.header').classList.contains('is-scrolled'),
  stickyHidden:d.querySelector('#mobile-sticky-cta').hidden};
 target.style.display='none';
 document.getElementById('result').textContent=JSON.stringify(output);
 document.documentElement.dataset.done='true';
};
target.style.width=requested+'px';target.style.height='1200px';
target.src=${JSON.stringify(targetUrl)};
<\/script>`;
}

function run(width) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `itmgmt-layout-${width}-`));
  try {
    const target = pathToFileURL(source).href
      + '?utm_source=layout-test&utm_campaign=v44&secret=blocked#diagnosis';
    const page = path.join(dir, 'probe.html');
    fs.writeFileSync(page, wrapper(width, target));
    const result = spawnSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--allow-file-access-from-files', '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=2500', `--user-data-dir=${path.join(dir, 'profile')}`,
      '--window-size=1600,1300', '--dump-dom', pathToFileURL(page).href,
    ], {encoding:'utf8', maxBuffer:4*1024*1024});
    assert.equal(result.status, 0, result.stderr);
    const match = result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match, `missing result ${width}`);
    const json = match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<').replaceAll('&gt;', '>');
    return JSON.parse(json);
  } finally {
    fs.rmSync(dir, {recursive:true, force:true});
  }
}

test('IT management LP has no horizontal overflow at release viewports',
  {skip: !chrome}, () => {
  for (const width of viewports) {
    const r = run(width);
    assert.equal(r.innerWidth, width, `${width}: innerWidth`);
    assert.ok(r.clientWidth <= width && r.clientWidth >= width - 20,
      `${width}: clientWidth`);
    assert.ok(r.scrollWidth <= r.clientWidth + 1, `${width}: document`);
    assert.ok(r.bodyScrollWidth <= r.clientWidth + 1, `${width}: body`);
    assert.ok(Math.abs(r.visualViewportWidth - r.clientWidth) <= 1,
      `${width}: visualViewport`);
    assert.equal(r.mobileMedia, width <= 650, `${width}: media`);
    assert.deepEqual(r.textOverflow, [], `${width}: clipped text/CTA`);
    assert.equal(r.ctas.length, 4, `${width}: CTA count`);
    for (const cta of r.ctas) {
      const u = new URL(cta.href);
      assert.equal(u.origin + u.pathname,
        'https://sales.atlib.jp/it-management-kaizen/free-diagnosis/');
      assert.equal(u.searchParams.get('utm_source'), 'layout-test');
      assert.equal(u.searchParams.get('utm_campaign'), 'v44');
      assert.equal(u.searchParams.has('secret'), false);
      if (cta.rect.width) {
        assert.ok(cta.rect.left >= -1 && cta.rect.right <= r.clientWidth + 1,
          `${width}: CTA rect`);
      }
    }
    assert.deepEqual(r.failedImages, [], `${width}: images`);
    assert.equal(r.faqOpen, true, `${width}: FAQ`);
    assert.ok(r.scrollY > 32, `${width}: scroll`);
    assert.equal(r.headerScrolled, true, `${width}: header`);
    if (width <= 650) assert.equal(r.stickyHidden, false, `${width}: sticky`);
  }
});
