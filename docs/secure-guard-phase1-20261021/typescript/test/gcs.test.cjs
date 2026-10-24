const test=require('node:test');const assert=require('node:assert/strict');
const {GuardStore,GUARD_BUCKET}=require('../dist/gcs.js');
const path='dryruns/organizations/10220954/plans/'+'a'.repeat(64)+'.json';
const store=(transport,scope='DryRun',token=async()=> 'synthetic-token')=>new GuardStore(GUARD_BUCKET,scope,transport,token);
test('create-only includes precondition and scoped object path',async()=>{let called=0;const s=store(async(m,u,h,b)=>{called++;assert.equal(m,'POST');assert.match(u,/ifGenerationMatch=0$/);assert.match(u,/name=dryruns%2Forganizations%2F10220954/);assert.equal(h.Authorization,'Bearer synthetic-token');assert.equal(b,'{"ok":true}');return {status:200,body:{generation:'7'}};});assert.deepEqual(await s.request('POST',path,{ok:true}),{generation:'7'});assert.equal(called,1);});
test('read uses pinned generation',async()=>{const s=store(async(m,u)=>{assert.equal(m,'GET');assert.match(u,/alt=media&generation=7$/);return {status:200,body:{ok:true}};});assert.deepEqual(await s.request('GET',path,null,'7'),{ok:true});});
test('conflict stops without retry',async()=>{let n=0;const s=store(async()=>{n++;return {status:412,body:null};});await assert.rejects(()=>s.request('POST',path,{}),{code:'CLAIM_CONFLICT_UNKNOWN_NO_RESEND'});assert.equal(n,1);});
test('ambiguous transport error stops without retry',async()=>{let n=0;const s=store(async()=>{n++;throw Error('secret-bearing error');});await assert.rejects(()=>s.request('POST',path,{}),{code:'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND'});assert.equal(n,1);});
test('scope prevents claims in dryrun',async()=>{let n=0;const s=store(async()=>{n++;return {status:200,body:{}};});await assert.rejects(()=>s.request('POST','claims/organizations/10220954/current',{}),{code:'AUDIT_STORE_SCOPE_INVALID'});assert.equal(n,0);});
test('invalid path rejected before token',async()=>{const s=store(async()=>{throw Error('called');});await assert.rejects(()=>s.request('GET','../../secrets'),{code:'AUDIT_OBJECT_PATH_INVALID'});});
test('token failure stops before HTTP',async()=>{let n=0;const s=store(async()=>{n++;return {status:200,body:{}};},'DryRun',async()=>{throw Error('token detail');});await assert.rejects(()=>s.request('GET',path),{code:'GCP_TOKEN_UNAVAILABLE'});assert.equal(n,0);});
test('404 read returns null',async()=>{const s=store(async()=>({status:404,body:null}));assert.equal(await s.request('GET',path),null);});

test('null transport response fails with safe UNKNOWN code',async()=>{let n=0;const s=store(async()=>{n++;return null;});await assert.rejects(()=>s.request('POST',path,{}),{code:'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND'});assert.equal(n,1);});
test('undefined transport response fails with safe UNKNOWN code',async()=>{let n=0;const s=store(async()=>{n++;return undefined;});await assert.rejects(()=>s.request('POST',path,{}),{code:'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND'});assert.equal(n,1);});
