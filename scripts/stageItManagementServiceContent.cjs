'use strict';
// Stage only approved public LP assets into a private service-host directory.
// The existing WWW /it-management-kaizen/ content remains untouched on release.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = path.resolve(__dirname,'../public/it-management-kaizen');
const target = path.resolve(__dirname,'../dist/service-content/it-management-kaizen');
const assets = [
  'approach-action-v14.webp',
  'approach-change-v16.webp',
  'approach-fact-v14.webp',
  'approach-future-v14.webp',
  'approach-hero-v14.webp',
  'atlib-corporate-logo.png',
  'diagnosis-report-stack-concept.webp',
  'hero-photo-provisional.png',
  'it-management-kaizen-logo-v1.png',
  'it-management-kaizen-logo-v2.png',
  'it-management-kaizen-v44.js',
];

const html = fs.readFileSync(path.join(source,'index.html'),'utf8');
const references = [...new Set([...html.matchAll(/assets\/([A-Za-z0-9._-]+\.(?:png|webp|js))/g)].map(m=>m[1]))].sort();
assert.deepEqual(references, [...assets].sort(), 'Only the approved referenced files may be staged');

fs.rmSync(target,{recursive:true,force:true}); // Generated output only; never touch public/ WWW files.
fs.mkdirSync(path.join(target,'assets'),{recursive:true});
fs.copyFileSync(path.join(source,'index.html'),path.join(target,'index.html'));
for(const filename of assets) {
  const input=path.join(source,'assets',filename);
  assert.ok(fs.statSync(input).isFile() && fs.statSync(input).size>0,filename);
  fs.copyFileSync(input,path.join(target,'assets',filename));
}
console.log('ITMGMT_PRIVATE_SERVICE_ASSETS='+assets.length+' PASS');
