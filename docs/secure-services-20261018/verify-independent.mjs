import fs from'node:fs/promises';import assert from'node:assert/strict';import{cfg,sendCost,routeStats,portfolio,breakEven}from'./model.mjs';
const old=JSON.parse(await fs.readFile('secure-send-infra-analysis/docs/infra-analysis/break-even-results.json','utf8'));
let checks=0;for(let u=0;u<4;u++)for(const[m,seats]of[[0,5],[1,20],[2,50]]){const prior=old.find(r=>r.arch==='Run'&&r.mix===m&&r.use===Math.min(u,2)&&r.ops===1&&r.share===.3);if(u<3){assert.ok(Math.abs(sendCost(seats,u).infra-prior.variableInfra)<1e-7);assert.ok(Math.abs(sendCost(seats,u).support-prior.variableSupport)<1e-7);checks++;}}
const st=routeStats(1,1,2,500,1);for(const r of st){if(r.gDiscount+r.sDiscount>0)assert.ok(Math.abs(r.gDiscount+r.sDiscount-500)<1e-9);}
const p=portfolio(1,st,[0,0,1],.4);assert.equal(p.dns,22500);const s=portfolio(100,st,[0,1,0],.4);assert.equal(s.dns,0);assert.equal(s.gFixed,0);
const both=portfolio(100,st,[0,0,1],.4);assert.ok(Math.abs(both.profit-both.gProfit-both.sProfit)<1e-7);assert.ok(Math.abs((both.gBase+both.sBase)*.4-both.gShare-both.sShare)<1e-7);
const d2=routeStats(1,1,2,1000,1);const after=portfolio(100,d2,[0,0,1],.4);assert.ok(Math.abs(both.profit-after.profit-100*500*(1-.4-.036))<1e-6);
const alt={...cfg,discountMode:'guard'},pa=portfolio(100,routeStats(1,1,2,500,1,alt),[0,0,1],.4,alt);assert.ok(Math.abs(pa.profit-both.profit)<1e-6);assert.ok(pa.sProfit>both.sProfit);
const b=breakEven(st,cfg.mixes[3],.4);assert.deepEqual(b,{first:25,sustained:25,both:53});
await fs.writeFile('secure-services-business-analysis/docs/secure-services-20261018/independent-verification.json',JSON.stringify({priorSendCasesMatched:checks,dnsFloorOnce:true,sendOnlyNoDNS:true,discountFeeShareIdentity:true,serviceAllocationTotalIdentity:true,selectedBreakEven:b},null,2));console.log('Independent historical cost and invoice identities passed.');
