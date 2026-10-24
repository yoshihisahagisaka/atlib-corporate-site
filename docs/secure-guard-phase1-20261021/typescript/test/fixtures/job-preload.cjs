// Synthetic subprocess boundary. Never performs network or reads a real mounted secret.
const fs=require('node:fs');
const scenario=process.env.SG_TEST_SCENARIO||'success';
const policy={project:'msp-zabbix',region:'asia-northeast1',job:'secure-guard-cancellation',mode:'DryRun',organization_id:'10220954',organization_allowlist:['10220954'],msp_parent_id:'10220948',runtime_service_account:'secure-guard-job-sa@msp-zabbix.iam.gserviceaccount.com',source_sha:'a'.repeat(40),secret_version:'7',secret_version_resource:'projects/msp-zabbix/secrets/secure-guard-dnsfilter-api-key/versions/7',secret_path:'/var/run/guard-secrets/7'};
if(scenario==='latest')policy.secret_version='latest';
if(scenario==='parent')policy.organization_id=policy.msp_parent_id;
if(scenario==='mode')policy.mode='RequestUninstall';
const count={secret:0,identity:0,token:0,dns:0,posts:0,reads:0,methods:[],pinned:false};
const read=fs.readFileSync;
fs.readFileSync=function(path,...args){if(path==='/app/runtime-policy.json')return JSON.stringify(policy);if(path===policy.secret_path){count.secret++;if(scenario==='secret-missing')throw Error('synthetic-secret-marker');return scenario==='secret-empty'?'':'synthetic-dns-secret';}return read.call(this,path,...args)};
process.env.CLOUD_RUN_JOB=scenario==='job'?'other':policy.job;
if(scenario==='execution')delete process.env.CLOUD_RUN_EXECUTION;else process.env.CLOUD_RUN_EXECUTION='synthetic-execution';
const page=(data)=>({data,links:{next:null},meta:{total_count:data.length}});
const agent={id:'synthetic-agent',attributes:{hostname:'Host\u2028Synthetic',organization_id:policy.organization_id,network_id:'S1',status:'active',agent_state:'protected'}};
const spec={paths:{'/v1/organizations/{id}':{get:{parameters:[]}},'/v1/networks':{get:{parameters:[{name:'organization_id',in:'query',type:'string'}]}},'/v1/user_agents':{get:{parameters:[{name:'organization_ids',in:'query',type:'array'},{name:'network_ids',in:'query',type:'array'}]}}}};
let saved=null,objectName=null;
const response=(status,body)=>({status,json:async()=>body,text:async()=>String(body)});
global.fetch=async(url,options)=>{
 if(options.redirect!=='manual'||!options.signal)throw Error('missing transport safety');
 const u=new URL(url);
 if(u.hostname==='metadata.google.internal'){
  if(options.method!=='GET'||options.headers['Metadata-Flavor']!=='Google')throw Error('metadata headers');
  if(u.pathname.endsWith('/email')){count.identity++;if(scenario==='identity-io')throw Error('synthetic-secret-marker');return response(200,scenario==='identity'?'wrong-sa':policy.runtime_service_account)}
  count.token++;if(scenario==='token')return response(403,null);return response(200,{access_token:'synthetic-gcp-token'});
 }
 if(u.hostname==='api.dnsfilter.com'){
  count.dns++;count.methods.push(options.method);
  if(options.method!=='GET'||options.headers.Authorization!=='Bearer synthetic-dns-secret')throw Error('invalid DNS request');
  if(scenario==='timeout'||scenario==='network')throw Error('synthetic-secret-marker');
  if(['401','403','redirect'].includes(scenario))return response(scenario==='redirect'?302:Number(scenario),null);
  if(u.pathname==='/docs/api.json')return response(200,spec);
  if(u.pathname.startsWith('/v1/organizations/'))return response(200,{data:{id:policy.organization_id,attributes:{managed_by_msp_id:policy.msp_parent_id}}});
  if(u.pathname==='/v1/networks')return response(200,page([{id:'S1',attributes:{name:'Synthetic Site',organization_id:policy.organization_id}}]));
  if(u.pathname==='/v1/user_agents')return response(200,page([agent]));
  throw Error('unexpected DNS path');
 }
 if(u.hostname==='storage.googleapis.com'){
  if(options.headers.Authorization!=='Bearer synthetic-gcp-token')throw Error('invalid storage auth');
  if(options.method==='POST'){
   count.posts++;if(u.searchParams.get('ifGenerationMatch')!=='0')throw Error('missing precondition');
   objectName=u.searchParams.get('name');saved=options.body;
   if(scenario==='lost-create')throw Error('synthetic-secret-marker');
   if(scenario==='conflict')return response(412,null);
   return response(200,{bucket:'msp-zabbix-secure-guard-offboarding-audit',name:objectName,generation:'27'});
  }
  count.reads++;count.pinned=u.searchParams.get('generation')==='27'&&decodeURIComponent(u.pathname.split('/o/')[1])===objectName;
  if(!count.pinned)throw Error('unpinned read');
  if(scenario==='read404')return response(404,null);
  const plan=JSON.parse(saved);if(scenario==='tamper')plan.payload.inventory.agents[0].hostname='changed';
  return response(200,plan);
 }
 throw Error('network destination forbidden in offline fixture');
};
process.on('exit',()=>process.stderr.write(JSON.stringify(count)+'\n'));
