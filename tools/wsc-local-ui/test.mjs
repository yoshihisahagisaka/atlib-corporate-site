import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { replaySavedJson } from './server.mjs';
const temp=fs.mkdtempSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'..','.test-ui-'));const url='https://ui-replay.example/';const csv=`企業名,本店所在地,URL\n再生テスト社,東京,${url}\n`;const fixture=JSON.parse(fs.readFileSync(new URL('../wsc-vs1/fixtures/synthetic-protected.json',import.meta.url),'utf8'));const result=await replaySavedJson({csv,diagnosesByUrl:{[url]:{...fixture,targetUrl:url,checkedAt:'2026-10-27T00:00:00.000Z'}},outputRoot:temp,pdfExporter:async({pdfPath})=>fs.writeFileSync(pdfPath,'%PDF-1.4\nUI replay\n')});assert.equal(result.batch.reports[Object.keys(result.batch.reports)[0]].status,'REPORT_READY');assert.ok(fs.existsSync(result.delivery.zipPath));assert.equal(result.delivery.rows.filter(row=>row.status==='READY').length,1);fs.rmSync(temp,{recursive:true,force:true});console.log('WSC local UI replay test: PASS');
