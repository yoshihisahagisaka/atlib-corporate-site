'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.resolve(__dirname, '../public/it-management-kaizen');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'assets/it-management-kaizen-v44.js'), 'utf8');
const canonical = 'https://service.atlib.jp/it-management-kaizen/';
const questionnaire = 'https://sales.atlib.jp/it-management-kaizen/free-diagnosis/';

test('v44 approved service, SEO and structured data resolve to the new canonical host',()=>{
  assert.match(html, /会社の未来を、/);
  assert.match(html, /IT経営ビジョンセッション（60分）/);
  assert.match(html, /5ページの診断レポート/);
  assert.match(html, /rel="canonical" href="https:\/\/service\.atlib\.jp\/it-management-kaizen\/"/);
  assert.match(html, /property="og:url" content="https:\/\/service\.atlib\.jp\/it-management-kaizen\/"/);
  assert.match(html, /property="og:image" content="https:\/\/service\.atlib\.jp\/it-management-kaizen\/assets\/hero-photo-provisional\.png"/);
  assert.doesNotMatch(html, /https:\/\/www\.atlib\.jp\/it-management-kaizen\//);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(ld.length,1);
  const graph=JSON.parse(ld[0][1])['@graph'];
  assert.equal(graph.find(x=>x['@type']==='Service').url,canonical);
  assert.equal(graph.find(x=>x['@type']==='WebPage').url,canonical);
  assert.equal(graph.find(x=>x['@type']==='Organization').url,'https://www.atlib.jp/');
});

test('four CTAs connect directly to the existing 7-question intake; dead form is absent',()=>{
  const anchors=[...html.matchAll(/<a\b[^>]*data-it-diagnosis-link[^>]*>/g)].map(x=>x[0]);
  assert.equal(anchors.length,4);
  anchors.forEach(a=>assert.ok(a.includes('href="'+questionnaire+'"')));
  assert.doesNotMatch(html, /data-apply-open|id="apply35-form"|href="#apply"/);
});

test('approved LP assets are present and executable JavaScript is served only from self',()=>{
  const staged = path.resolve(__dirname,'../dist/service-content/it-management-kaizen');
  assert.equal(fs.readFileSync(path.join(staged,'index.html'),'utf8'),html);
  assert.equal(fs.readFileSync(path.join(staged,'assets/it-management-kaizen-v44.js'),'utf8'),js);
  assert.equal(fs.existsSync(path.join(staged,'assets/it-management-kaizen-dialogue-visual-v1.png')),false);
  const assets=[...new Set([...html.matchAll(/assets\/[A-Za-z0-9._-]+\.(?:png|webp|js)/g)].map(x=>x[0]))];
  assert.ok(assets.length>=10);
  for(const asset of assets)assert.ok(fs.existsSync(path.join(dir,asset)),asset);
  const allScripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.equal(allScripts.length,2);
  assert.ok(allScripts.some(x=>/type="application\/ld\+json"/.test(x[1])));
  assert.ok(allScripts.some(x=>/src="assets\/it-management-kaizen-v44\.js\?v=20261123-service1"/.test(x[1])));
  assert.ok(allScripts.every(x=>/type="application\/ld\+json"|src="assets\//.test(x[1])));
  new vm.Script(js);
});

test('existing approved CTA attribution forwards only allowlisted query parameters',()=>{
  const links=Array.from({length:4},()=>({href:questionnaire}));
  const window={location:{search:'?utm_source=conference&utm_campaign=nov26&acquisition_source_type=referral&secret=never'}};
  const document={
    // The shared JS also initializes sticky-header UI; this test isolates CTA
    // attribution by reporting no header elements in its synthetic DOM.
    querySelector:()=>null,
    getElementById(id){assert.equal(id,'mobile-sticky-cta');return null;},
    querySelectorAll(selector){assert.equal(selector,'a[data-it-diagnosis-link]');return links;}
  };
  vm.runInNewContext(js,{window,document,URL,URLSearchParams});
  links.forEach(link=>{
    const u=new URL(link.href);
    assert.equal(u.searchParams.get('utm_source'),'conference');
    assert.equal(u.searchParams.get('utm_campaign'),'nov26');
    assert.equal(u.searchParams.get('acquisition_source_type'),'referral');
    assert.equal(u.searchParams.has('secret'),false);
  });
});
