const test=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path');
const run=(scenario,args=[])=>cp.spawnSync(process.execPath,['--require',path.join(__dirname,'fixtures/job-preload.cjs'),path.join(__dirname,'../dist/entrypoint.js'),...args],{encoding:'utf8',env:{...process.env,SG_TEST_SCENARIO:scenario}});
for(const [scenario,code] of Object.entries({success:null,latest:'PINNED_SECRET_VERSION_REQUIRED',parent:'ORGANIZATION_NOT_ALLOWED',mode:'C1_DRYRUN_ONLY',job:'EXPECTED_CLOUD_RUN_JOB_REQUIRED',execution:'EXPECTED_CLOUD_RUN_JOB_REQUIRED',identity:'RUNTIME_SERVICE_IDENTITY_MISMATCH','identity-io':'RUNTIME_IDENTITY_UNAVAILABLE','secret-missing':'SECRET_MOUNT_UNAVAILABLE','secret-empty':'SECRET_PAYLOAD_EMPTY_OR_INVALID','401':'GET_HTTP_401','403':'GET_HTTP_403',redirect:'GET_HTTP_302',timeout:'GET_HTTP_0',network:'GET_HTTP_0',token:'GCP_TOKEN_UNAVAILABLE','lost-create':'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND',conflict:'CLAIM_CONFLICT_UNKNOWN_NO_RESEND',read404:'DRYRUN_READBACK_MISSING',tamper:'DRYRUN_PLAN_HASH_MISMATCH'})){
 test('Job integration '+scenario,()=>{
  const r=run(scenario);assert.equal(r.status,code?1:0,r.stderr);const out=JSON.parse(r.stdout),count=JSON.parse(r.stderr);
  assert.doesNotMatch(r.stdout+r.stderr,/synthetic-(dns-secret|gcp-token|secret-marker)|Authorization|hostname|Host|payload/);
  assert.ok(count.methods.every(m=>m==='GET'));assert.ok(count.posts<=1);assert.ok(count.reads<=1);
  if(code){assert.equal(out.state,'STOP');assert.equal(out.code,code)}else{assert.equal(out.status,'DRYRUN_DURABLE_VERIFIED');assert.equal(out.generation,'27');assert.equal(count.posts,1);assert.equal(count.reads,1);assert.equal(count.pinned,true)}
  if(['latest','parent','mode','job','execution','identity','identity-io'].includes(scenario)){assert.equal(count.secret,0);assert.equal(count.dns,0)}
  if(['secret-missing','secret-empty'].includes(scenario))assert.equal(count.dns,0);
  if(scenario==='token'){assert.equal(count.posts,0);assert.equal(count.reads,0)}
  if(['lost-create','conflict'].includes(scenario)){assert.equal(count.posts,1);assert.equal(count.reads,0)}
  assert.equal(out.mutations,0);
 });
}
test('Job arguments rejected before identity and secret IO',()=>{const r=run('success',['--mode=other']);assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).code,'ARGUMENT_OVERRIDE_FORBIDDEN');const c=JSON.parse(r.stderr);assert.equal(c.identity,0);assert.equal(c.secret,0);assert.equal(c.dns,0)});
