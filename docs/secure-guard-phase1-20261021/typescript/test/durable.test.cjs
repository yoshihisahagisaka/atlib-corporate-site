const test=require('node:test'),assert=require('node:assert/strict');
const {makePlan}=require('../dist/plan.js'),{GuardStore,GUARD_BUCKET}=require('../dist/gcs.js'),{saveDryRun,projectPlan}=require('../dist/durable.js');
const policy={project:'msp-zabbix',region:'asia-northeast1',job:'secure-guard-cancellation',mode:'DryRun',organization_id:'10220954',organization_allowlist:['10220954'],msp_parent_id:'11473',runtime_service_account:'secure-guard-job-sa@msp-zabbix.iam.gserviceaccount.com',source_sha:'a'.repeat(40),secret_version:'1',secret_version_resource:'projects/msp-zabbix/secrets/secure-guard-dnsfilter-api-key/versions/1',secret_path:'/var/run/guard-secrets/1'};
const inv=()=>({organization_id:'10220954',msp_parent_id:'11473',sites:[{id:'S1',name:'東京\u2028拠点',organization_id:'10220954'}],agents:[{uuid:'agent-1',hostname:'Host\u2028A',organization_id:'10220954',site_id:'S1',status:'active',agent_state:'protected'}],paging:{site_pages:1,site_total:1,org_agent_pages:1,org_agent_total:1,per_site:[{scope:'site',site_id:'S1',pages:1,total:1,proof:'explicit-next-null+stable-total_count+unique-ids'}]},visibility:'API default documented collection only; relay/deleted visibility requires review'});
const plan=()=>makePlan(policy.source_sha,inv());
test('C2 projection accepts valid Unicode plan',async()=>{const p=await plan();assert.deepEqual(await projectPlan(p,policy),p);});
test('C2 durable create and pinned readback',async()=>{const p=await plan();let writes=0,reads=0;const s=new GuardStore(GUARD_BUCKET,'DryRun',async(m,u,h,b)=>{if(m==='POST'){writes++;assert.match(u,/ifGenerationMatch=0$/);return {status:200,body:{bucket:GUARD_BUCKET,name:'dryruns/organizations/10220954/plans/'+p.plan_hash+'.json',generation:'17'}};}reads++;assert.match(u,/generation=17$/);return {status:200,body:JSON.parse(b??JSON.stringify(p))};},async()=> 'synthetic-token');const r=await saveDryRun(s,p,policy);assert.equal(r.status,'DRYRUN_DURABLE_VERIFIED');assert.equal(r.mutations,0);assert.equal(writes,1);assert.equal(reads,1);});
test('C2 create conflict prevents readback and retry',async()=>{const p=await plan();let n=0;const s=new GuardStore(GUARD_BUCKET,'DryRun',async()=>{n++;return {status:412,body:null};},async()=> 'synthetic-token');await assert.rejects(()=>saveDryRun(s,p,policy),{code:'CLAIM_CONFLICT_UNKNOWN_NO_RESEND'});assert.equal(n,1);});
test('C2 altered plan hash rejected before storage',async()=>{const p=await plan();p.plan_hash='0'.repeat(64);let n=0;const s=new GuardStore(GUARD_BUCKET,'DryRun',async()=>{n++;return {status:200,body:{}};},async()=> 'synthetic-token');await assert.rejects(()=>saveDryRun(s,p,policy),{code:'DRYRUN_PLAN_HASH_MISMATCH'});assert.equal(n,0);});
test('C2 readback content mismatch fails closed',async()=>{const p=await plan();let n=0;const s=new GuardStore(GUARD_BUCKET,'DryRun',async(m)=>{n++;return m==='POST'?{status:200,body:{bucket:GUARD_BUCKET,name:'dryruns/organizations/10220954/plans/'+p.plan_hash+'.json',generation:'7'}}:{status:200,body:{...p,payload:{...p.payload,inventory:{...p.payload.inventory,visibility:'tampered'}}}};},async()=> 'synthetic-token');await assert.rejects(()=>saveDryRun(s,p,policy));assert.equal(n,2);});
test('C2 rejects unknown secret-like inventory attribute',async()=>{const p=await plan();p.payload.inventory.agents[0].api_key='synthetic';await assert.rejects(()=>projectPlan(p,policy),{code:'DRYRUN_PLAN_SCHEMA_INVALID'});});

test('stateful GCS readback uses actual POST bytes, not original fixture',async()=>{
 const p=await plan();let saved=null,calls=0;
 const s=new GuardStore(GUARD_BUCKET,'DryRun',async(m,u,h,b)=>{
  calls++;if(m==='POST'){saved=b;return {status:200,body:{bucket:GUARD_BUCKET,name:'dryruns/organizations/10220954/plans/'+p.plan_hash+'.json',generation:'21'}};}
  assert.match(u,/generation=21$/);return {status:200,body:JSON.parse(saved)};
 },async()=> 'synthetic-token');
 const receipt=await saveDryRun(s,p,policy);assert.equal(receipt.mutations,0);assert.equal(calls,2);
});
test('null create metadata is safe UNKNOWN',async()=>{
 const p=await plan();const s=new GuardStore(GUARD_BUCKET,'DryRun',async()=>({status:200,body:null}),async()=> 'synthetic-token');
 await assert.rejects(()=>saveDryRun(s,p,policy),{code:'DRYRUN_CREATE_RESULT_UNKNOWN_NO_RESEND'});
});
test('numeric string paging preserves hash-compatible types',async()=>{
 const i=inv();i.paging.site_pages='2';const p=await makePlan(policy.source_sha,i);
 assert.deepEqual(await projectPlan(p,policy),p);
});
test('per-site pages 01 rejects with schema code',async()=>{
 const i=inv();i.paging.per_site[0].pages='01';const p=await makePlan(policy.source_sha,i);
 await assert.rejects(()=>projectPlan(p,policy),{code:'DRYRUN_PLAN_SCHEMA_INVALID'});
});
test('stateful readback rejects tampered bytes even with self-consistent new hash',async()=>{
 const p=await plan();let saved=null;
 const s=new GuardStore(GUARD_BUCKET,'DryRun',async(m,u,h,b)=>{
  if(m==='POST'){saved=b;return {status:200,body:{bucket:GUARD_BUCKET,name:'dryruns/organizations/10220954/plans/'+p.plan_hash+'.json',generation:'8'}};}
  const altered=JSON.parse(saved);altered.payload.inventory.agents[0].hostname='different';
  altered.plan_hash=await require('../dist/plan.js').hashOrdered(altered.payload);
  return {status:200,body:altered};
 },async()=> 'synthetic-token');
 await assert.rejects(()=>saveDryRun(s,p,policy));
});
