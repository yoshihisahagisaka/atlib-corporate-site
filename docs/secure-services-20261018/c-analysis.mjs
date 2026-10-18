import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {cfg,routeStats,portfolio,breakEven,growth,joint,sendCost,mixes,labels,out} from './c-model.mjs';
const rows=[],detail=[],curves=[],growthRows=[];
export function scenario(sc=1,u=1,h=0,price='round',support=true,dns='floor'){
 const c=structuredClone(cfg);c.dnsMode=dns;
 if(!support){c.opsHourly=0;c.guardStages=c.guardStages.map(x=>[x[0],x[1],0]);c.sendStages=c.sendStages.map(x=>[x[0],x[1],0]);}
 if(price!=='round'){for(const p of [c.guardPlans[1],c.sendPlans[2]])p.bands=p.bands.map(([n,v])=>[n,v-20]);}
 const d=price==='product20'?980:1000;
 const st=routeStats(sc,1,2,d,u,c),hi=routeStats(sc,1,2,d,2,c);
 return {c,st:st.map((r,i)=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v*(1-h)+hi[i][k]*h])))};
}
for(let sc=0;sc<3;sc++)for(let u=0;u<4;u++)for(let mi=0;mi<6;mi++)for(const share of [.4,.5]){
 const {c,st}=scenario(sc,u);const mix=mixes[mi],be=breakEven(st,mix,share,c),p=portfolio(100,st,mix,share,c);
 const row={sc,u,mi,label:labels[mi],share,avgRevenue:p.revenue/100,avgBasic:p.sharePool/100,avgUsage:(p.gUsage+p.sUsage)/100,avgShare:(p.gShare+p.sShare)/100,...be,profits:cfg.counts.map(n=>portfolio(n,st,mix,share,c).profit)};
 rows.push(row);
 for(const n of cfg.counts)detail.push({sc,u,mi,share,...portfolio(n,st,mix,share,c)});
 if(sc===1&&u===1){for(let n=1;n<=1000;n++)curves.push({mi,share,...portfolio(n,st,mix,share,c)});for(const pace of [3,5,10]){const g=growth(st,mix,share,pace,c);const lastRed=g.rows.reduce((a,r)=>r.cumulative<0?r.month:a,0);growthRows.push({mi,share,...g,sustainedRecovery:lastRed===36?null:lastRed+1});}}
}
const sensitivities=[];
for(const price of ['round','service20','product20'])for(const h of [0,.1,.2,.3])for(const support of [true,false])for(const dns of ['floor','add'])for(const mi of [2,3,4,5])for(const share of [.4,.5]){
 const {c,st}=scenario(1,1,h,price,support,dns),be=breakEven(st,mixes[mi],share,c),p=portfolio(100,st,mixes[mi],share,c);
 sensitivities.push({price,h,support,dns,mi,share,...be,avgRevenue:p.revenue/100,avgShare:(p.gShare+p.sShare)/100,gProfit100:p.gProfit,sProfit100:p.sProfit,profits:cfg.counts.map(n=>portfolio(n,st,mixes[mi],share,c).profit)});
}
const checks=[];
for(const r of detail){assert(Math.abs(r.profit-r.gProfit-r.sProfit)<1e-7);assert(Math.abs(r.revenue-r.sharePool-r.gUsage-r.sUsage)<1e-7);assert(Math.abs(r.gShare+r.sShare-r.sharePool*r.share)<1e-7);assert(Math.abs(r.gPayment+r.sPayment-r.revenue*cfg.fee)<1e-7);if(r.ng===0)assert.equal(r.dns,0);}
for(const mi of [0,1,2,3,4,5]){const {c,st}=scenario(),p40=portfolio(100,st,mixes[mi],.4,c),p50=portfolio(100,st,mixes[mi],.5,c);assert(Math.abs(p40.profit-p50.profit-p40.sharePool*.1)<1e-7);}
const selected=rows.filter(r=>r.sc===1&&r.u===1),procurement=[];
for(const fx of [120,150,180])for(const unit of [.92,1.15])for(const share of [.4,.5]){const {c}=scenario();c.fx=fx;c.dnsUnit=unit;const st=routeStats(1,1,2,1000,1,c);procurement.push({fx,unit,share,...breakEven(st,mixes[3],share,c),profits:cfg.counts.map(n=>portfolio(n,st,mixes[3],share,c).profit)});}
const data={generated:'2026-10-18',source:{corporatePR18:'db8c254e2d88c81a6a269ac8ac828a799bcf1022',marketPR14:'40b7610f78e4e92702150cc73633688795bed459',sendPR3:'74facb2fd202b697f288701bca670f7bc70c86b5'},cfg,mixes,labels,rows,detail,growth:growthRows,sensitivities,procurement,joints:[0,1,2].map(sc=>joint(sc)),costs:[0,1,2,3].map(u=>sendCost(1,u)),verification:{scenarioCases:rows.length,detailCases:detail.length,shareReconciliations:'passed',independentIdentity:'C40 net minus C50 net = net basic * 10%',nativeExcel:'unverified'}};
await fs.writeFile(out+'/c-results.json',JSON.stringify(data));
const cols=['sc','u','mi','label','share','avgRevenue','avgBasic','avgUsage','avgShare','first','sustained','both','p10','p30','p50','p100','p300','p1000'];
await fs.writeFile(out+'/c-comparison.csv','\uFEFF'+[cols.join(','),...rows.map(r=>[r.sc,r.u,r.mi,r.label,r.share,r.avgRevenue,r.avgBasic,r.avgUsage,r.avgShare,r.first,r.sustained,r.both,...r.profits].join(','))].join('\r\n'));
for(const [name,data]of [['c-detail',detail],['c-sensitivity',sensitivities],['c-growth',growthRows.map(({rows,...r})=>r)]]){const ks=Object.keys(data[0]);await fs.writeFile(out+'/'+name+'.csv','\uFEFF'+[ks.join(','),...data.map(r=>ks.map(k=>JSON.stringify(typeof r[k]==='object'?JSON.stringify(r[k]):r[k])).join(','))].join('\r\n'));}
console.log(JSON.stringify({selected,growth:growthRows.filter(r=>r.mi===3).map(({rows,...r})=>r),high:sensitivities.filter(r=>r.mi===3&&r.price==='round'&&r.support&&r.dns==='floor')},null,2));
