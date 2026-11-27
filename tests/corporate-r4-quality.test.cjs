'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const root=path.join(__dirname,'..','public');
const base='https://www.atlib.jp/';
const pages={'index.html':'','services/index.html':'services/','company/index.html':'company/','works/index.html':'works/','contact/index.html':'contact/'};
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
function graph(s){const m=[...s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)];assert.equal(m.length,1);const j=JSON.parse(m[0][1]);assert.equal(j['@context'],'https://schema.org');return j['@graph'];}
function by(g,t){const a=g.filter(x=>x['@type']===t);assert.equal(a.length,1,t);return a[0];}
function meta(s,name,attribute='name'){const m=[...s.matchAll(new RegExp(`<meta ${attribute}="${name}" content="([^"]*)">`,'gu'))];assert.equal(m.length,1,name);return m[0][1];}
test('R4 metadata, entity identity and publication controls',()=>{
 const titles=new Set(); const org=by(graph(read('index.html')),'Organization');
 for(const [f,route] of Object.entries(pages)){
  const s=read(f),g=graph(s),url=base+route;const title=s.match(/<title>([^<]+)<\/title>/u)[1];
  assert.ok(!titles.has(title));titles.add(title);assert.equal(meta(s,'og:title','property'),title);assert.equal(meta(s,'og:description','property'),meta(s,'description'));assert.equal(meta(s,'og:url','property'),url);
  assert.ok(s.includes(`<link rel="canonical" href="${url}">`));assert.equal(meta(s,'robots'),'noindex,nofollow');assert.equal([...s.matchAll(/<h1\b/gu)].length,1);
  assert.deepEqual(by(g,'Organization'),org);assert.equal(org['@id'],base+'#organization');assert.deepEqual(org.sameAs,['https://note.com/atlib']);assert.equal(by(g,'WebSite').publisher['@id'],org['@id']);
  const p=g.find(x=>x['@id']===url+'#webpage');assert.ok(p);assert.equal(p.url,url);assert.equal(p.name,title);assert.equal(p.description,meta(s,'description'));
  assert.equal(p.isPartOf['@id'],base+'#website');assert.equal(p.about['@id'],org['@id']);
  if(route){const b=by(g,'BreadcrumbList');assert.equal(p.breadcrumb['@id'],b['@id']);assert.deepEqual(b.itemListElement.map(x=>[x.position,x.item]),[[1,base],[2,url]]);}
  else assert.ok(!g.some(x=>x['@type']==='BreadcrumbList'));
  const footer=s.split('<footer>')[1].split('</footer>')[0];assert.ok(footer.includes('<a href="https://note.com/atlib">公式note</a>'));
  assert.doesNotMatch(JSON.stringify(g),/"(?:telephone|price|priceRange|offers|aggregateRating|review)"\s*:/u);
  assert.doesNotMatch(s,/03[- ]?6661[- ]?1616|0366611616|MSCB-113/u);
  assert.ok(!s.includes('href="../index.html'));assert.ok(s.includes('atlib-service-renewal.css?v=20261126-r4'));
 }
});
test('R4 services use only confirmed services, with descriptive visible links',()=>{
 const s=read('services/index.html'),g=graph(s),services=g.filter(x=>x['@type']==='Service');
 assert.deepEqual(services.map(x=>x.name),['IT経営KAIZEN','業務KAIZEN','セキュリティコンサルティング','カジュアルコンサル','SECU:MIE WEB','SECU:MIE Insight']);
 for(const svc of services){assert.equal(svc.provider['@id'],base+'#organization');assert.ok(s.includes(svc.name));}
 for(const f of ['index.html','services/index.html'])for(const name of ['IT経営KAIZEN','業務KAIZEN'])assert.ok(read(f).includes(name+'の詳細を見る'));
 assert.match(s,/<h3 class="renewal-business-heading">業務から考える、Webシステム開発。<\/h3>/u);
});
test('R4 only lazy-loads three non-hero editorial photos; hero stays unchanged',()=>{
 const s=read('index.html');const hero=s.slice(s.indexOf('<div class="mainimg"'),s.indexOf('<div class="brand-line"'));assert.doesNotMatch(hero,/loading="lazy"/u);
 const images=[...s.matchAll(/<img src="images\/(landscape1|mainimg2|mainimg3)\.jpg" width="([1-9]\d*)" height="([1-9]\d*)" loading="lazy" decoding="async"/gu)];assert.equal(images.length,3);
 for(const [,name,w,h] of images){assert.ok(Number(w)>0&&Number(h)>0,name);}
});

test('R4 note banner is accessible, original and outside protected blocks',()=>{
 const s=read('index.html'),css=read('css/atlib-service-renewal.css');
 const m=s.match(/<section class="renewal-note-section"[\s\S]*?<\/section>/u);assert.ok(m);
 assert.ok(s.indexOf('id="diagnosis"')<m.index&&m.index<s.indexOf('id="contact"'));
 assert.equal([...m[0].matchAll(/<a\b/gu)].length,1);assert.match(m[0],/href="https:\/\/note\.com\/atlib"/u);
 assert.match(m[0],/<h2 id="renewal-note-title">ITのこと、経営のこと。<\/h2>/u);
 assert.match(m[0],/<svg[^>]+aria-hidden="true" focusable="false"/u);
 assert.doesNotMatch(m[0],/<(?:img|script|button|iframe)\b/u);
 assert.match(s,/fonts\.googleapis\.com\/css2\?family=M\+PLUS\+Rounded\+1c:wght@700&amp;display=swap&amp;text=/u);
 assert.match(css,/\.renewal-note-banner:focus-visible/u);
 for(const f of Object.keys(pages).filter(x=>x!=='index.html'))assert.doesNotMatch(read(f),/renewal-note-section|M\+PLUS\+Rounded\+1c|Klee\+One/u);
});
