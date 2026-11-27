const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const m=JSON.parse(read('scripts/production-overlay/v37/manifest.json'));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
test('v3.7 approved public overlay bytes and scope',()=>{
 assert.equal(m.publicOverlay.allowedFiles.length,17);
 assert.deepEqual(Object.keys(m.publicOverlay.files).sort(),m.publicOverlay.allowedFiles.slice().sort());
 for(const [f,h] of Object.entries(m.publicOverlay.files))assert.equal(hash(f),h,f);
 assert.deepEqual(m.routeOverlay.allowedFiles,['dist/server.js']);
 assert.equal(m.runtimeAfterSha256,m.routeOverlay.files['dist/server.js']);
});
test('v3.7 routes reuse corporate publication handler',()=>{
 const s=read('src/server.ts');
 for(const route of ['services/casual-consulting','services/security-consulting','guide'])assert.ok(s.includes(`['/${route}/', '${route}/index.html'],`),route);
 for(const fn of ['corporatePageSecurityHeaders','renderCorporatePage','isPublicRequest'])assert.ok(s.includes(fn));
});
test('formal diagnosis links and detail routes, not union QR links',()=>{
 for(const f of ['public/index.html','public/services/index.html','public/llms.txt']){
  const s=read(f);assert.doesNotMatch(s,/https?:\/\/(?:www\.)?atlib\.jp\/secumie-web\//u);
  for(const n of ['secumie-web','secumie-insight'])assert.ok(s.includes(`https://service.atlib.jp/${n}/`),f);
 }
 for(const p of ['guide/','services/casual-consulting/','services/security-consulting/']){
  assert.ok(read('public/sitemap.xml').includes(`https://www.atlib.jp/${p}`));
  const s=read(`public/${p}index.html`);assert.ok(s.includes(`href="https://www.atlib.jp/${p}"`));
 }
});
