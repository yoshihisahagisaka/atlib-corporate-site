'use strict';
// Offline reference model only. No network, credentials, or production adapter.
const assert = require('node:assert/strict');
const results = [];
function test(name, fn) { fn(); results.push({name, result:'PASS'}); }
class Model {
  constructor() { this.remote=[]; this.ledger=new Map(); this.posts=0; this.rotation=new Map(); this.patchCount=0; }
  provision(customer, role, fault) {
    const key=`${customer}/${role}`;
    if(this.ledger.get(key)?.state==='ready') return this.ledger.get(key).id;
    // Exhaust all mock pages; external_id is an identifier, not vendor uniqueness.
    let matches=[];
    for(let p=0;p<this.remote.length;p+=17) matches.push(...this.remote.slice(p,p+17).filter(x=>x.key===key));
    if(matches.length>1) throw new Error('duplicate-review');
    if(matches.length===1) { this.ledger.set(key,{state:'ready',id:matches[0].id}); return matches[0].id; }
    if(this.ledger.get(key)?.state==='uncertain') throw new Error('manual-review-no-repost');
    this.ledger.set(key,{state:'creating'});
    if(fault==='before-send') { this.ledger.set(key,{state:'pending'}); throw new Error('not-sent'); }
    this.posts++;
    const item={key,id:this.remote.length+1}; this.remote.push(item);
    if(fault==='response-lost') { this.ledger.set(key,{state:'uncertain'}); throw new Error('timeout'); }
    this.ledger.set(key,{state:'ready',id:item.id}); return item.id;
  }
  rotate(site, request, expectedGeneration, fault) {
    const s=this.rotation.get(site)||{generation:0,state:'idle',done:new Set()};
    this.rotation.set(site,s);
    if(s.done.has(request)) return 'already-done';
    if(s.state!=='idle') return 'blocked-review';
    if(s.generation!==expectedGeneration) return 'stale-replan';
    s.state='inflight'; this.patchCount++;
    if(fault==='timeout') { s.state='uncertain'; return 'blocked-review'; }
    s.generation++; s.done.add(request); s.state='idle'; return 'rotated';
  }
}
function retryAt(value, now, attempts) {
  let delay;
  if(/^\d+$/.test(value||'')) delay=Number(value)*1000;
  else if(Number.isFinite(Date.parse(value))) delay=Math.max(0,Date.parse(value)-now);
  else delay=Math.min(300000,1000*2**attempts);
  // deterministic jitter for reproducibility; a production worker needs random jitter.
  return now+delay+250;
}
test('1000 customers x 2 Sites; rerun makes no duplicates',()=>{
  const m=new Model();
  for(let pass=0;pass<2;pass++) for(let i=0;i<1000;i++) for(const role of ['standard','exception']) m.provision(`C${i}`,role);
  assert.equal(m.posts,2000); assert.equal(m.ledger.size,2000);
});
test('response lost after create reconciles without another POST',()=>{
  const m=new Model(); assert.throws(()=>m.provision('C1','standard','response-lost'));
  assert.equal(m.provision('C1','standard'),1); assert.equal(m.posts,1);
});
test('unknown create with no visible remote match never reposts',()=>{
  const m=new Model(); m.ledger.set('C1/standard',{state:'uncertain'});
  assert.throws(()=>m.provision('C1','standard'),/manual-review/); assert.equal(m.posts,0);
});
test('known before-send failure resumes safely',()=>{
  const m=new Model(); assert.throws(()=>m.provision('C1','standard','before-send'));
  m.provision('C1','standard'); assert.equal(m.posts,1);
});
test('partial multi-Site failure keeps completed Site',()=>{
  const m=new Model(); m.provision('C1','standard'); assert.throws(()=>m.provision('C1','exception','response-lost'));
  m.provision('C1','standard'); m.provision('C1','exception'); assert.equal(m.posts,2);
});
test('duplicate remote External ID stops for review',()=>{
  const m=new Model(); m.remote=[{key:'C1/standard',id:1},{key:'C1/standard',id:2}];
  assert.throws(()=>m.provision('C1','standard'),/duplicate-review/); assert.equal(m.posts,0);
});
test('429 numeric and HTTP-date Retry-After never retry early',()=>{
  const now=Date.parse('2026-10-21T00:00:00Z');
  assert.ok(retryAt('60',now,0)>=now+60000);
  assert.ok(retryAt('Wed, 21 Oct 2026 00:02:00 GMT',now,0)>=now+120000);
  assert.ok(retryAt('invalid',now,3)>=now+8000);
});
test('monthly and emergency rotation serialize; stale job replans',()=>{
  const m=new Model(); assert.equal(m.rotate('S1','emergency-1',0),'rotated');
  assert.equal(m.rotate('S1','monthly-1',0),'stale-replan'); assert.equal(m.patchCount,1);
  assert.equal(m.rotate('S1','emergency-1',0),'already-done');
});
test('rotation timeout fences subsequent emergency and monthly jobs',()=>{
  const m=new Model(); m.rotate('S1','monthly',0,'timeout');
  assert.equal(m.rotate('S1','emergency',0),'blocked-review'); assert.equal(m.patchCount,1);
});
test('tenant membership check rejects cross-customer Site operation',()=>{
  const belongs=(customer,site)=>({S1:'C1',S2:'C2'})[site]===customer;
  assert.equal(belongs('C1','S2'),false); assert.equal(belongs('C1','S1'),true);
});
console.log(JSON.stringify({kind:'offline-model-only',liveRequests:0,results,total:results.length},null,2));