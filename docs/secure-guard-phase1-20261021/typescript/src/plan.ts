import type {Get} from './inventory';
import {GuardStop,inventory} from './inventory';

export type Policy={project:string;region:string;job:string;mode:string;organization_id:string;organization_allowlist:string[];msp_parent_id:string;runtime_service_account:string;source_sha:string;secret_version:string;secret_version_resource:string;secret_path:string};
export type Phase='POLICY'|'IDENTITY'|'SECRET'|'OPENAPI'|'ORGANIZATION'|'INVENTORY'|'PLAN'|'GCS_CREATE'|'GCS_READBACK';
export type PhaseStatus='ENTER'|'COMPLETE';
export type PhaseObserver=(phase:Phase,status:PhaseStatus)=>void;
export function observe(observer:PhaseObserver|undefined,phase:Phase,status:PhaseStatus):void{try{observer?.(phase,status);}catch{/* diagnostics are observational only */}}
const fail=(s:string):never=>{throw new GuardStop(s)};
export function checkPolicy(p:Policy,args:string[]=[]):void{
 if(args.length)fail('ARGUMENT_OVERRIDE_FORBIDDEN');
 if(p.mode!=='DryRun')fail('C1_DRYRUN_ONLY');
 if(p.project!=='msp-zabbix'||p.region!=='asia-northeast1'||p.job!=='secure-guard-cancellation')fail('DEPLOYMENT_SCOPE_MISMATCH');
 if(p.runtime_service_account!=='secure-guard-job-sa@msp-zabbix.iam.gserviceaccount.com')fail('EXPECTED_IDENTITY_INVALID');
 if(!/^\d+$/.test(p.organization_id)||!/^\d+$/.test(p.msp_parent_id)||p.organization_id===p.msp_parent_id||!p.organization_allowlist.includes(p.organization_id))fail('ORGANIZATION_NOT_ALLOWED');
 if(!/^[a-f0-9]{40}$/i.test(p.source_sha))fail('SOURCE_SHA_REQUIRED');
 if(!/^[1-9][0-9]*$/.test(p.secret_version))fail('PINNED_SECRET_VERSION_REQUIRED');
 if(p.secret_version_resource!==`projects/msp-zabbix/secrets/secure-guard-dnsfilter-api-key/versions/${p.secret_version}`||p.secret_path!==`/var/run/guard-secrets/${p.secret_version}`)fail('SECRET_VERSION_MISMATCH');
}
/** Matches the PowerShell ordered-property JSON contract for the ASCII fixture subset.
 * Cross-runtime PowerShell hash equivalence is a separate mandatory gate. */
function psJson(value:unknown):string {
 const quote=(s:string)=>JSON.stringify(s).replace(/[\u0085\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
 const visit=(v:unknown):string=>{
  if(v===null)return 'null';
  if(typeof v==='string')return quote(v);
  if(typeof v==='boolean')return v?'true':'false';
  if(typeof v==='number'){
   if(!Number.isFinite(v))throw new GuardStop('HASH_NUMBER_INVALID');
   return JSON.stringify(v).replace(/e([+-]?)(\d+)$/,(_,sign:string,digits:string)=>'E'+(sign==='-'?'-':'+')+digits.padStart(2,'0'));
  }
  if(Array.isArray(v))return '['+v.map(x=>visit(x===undefined?null:x)).join(',')+']';
  if(typeof v==='object'&&v!==null)return '{'+Object.entries(v).filter(([,x])=>x!==undefined).map(([k,x])=>quote(k)+':'+visit(x)).join(',')+'}';
  throw new GuardStop('HASH_VALUE_UNSUPPORTED');
 };
 return visit(value);
}
export async function hashOrdered(value:unknown):Promise<string>{const bytes=new TextEncoder().encode(psJson(value));const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
export async function makePlan(sourceSha:string,inv:Awaited<ReturnType<typeof inventory>>,observer?:PhaseObserver){
 observe(observer,'PLAN','ENTER');
 const payload={source_sha:sourceSha,mode:'DryRun' as const,inventory:inv,mutations_enabled:false as const};
 const plan={plan_hash:await hashOrdered(payload),payload};
 observe(observer,'PLAN','COMPLETE');
 return plan;
}
export type AuthenticatedGet=(url:string,headers:Readonly<Record<string,string>>)=>ReturnType<Get>;
export async function getOnlyPlan(p:Policy,identity:()=>Promise<string>,secret:()=>Promise<string>,fetch:AuthenticatedGet,observer?:PhaseObserver){
 checkPolicy(p);
 observe(observer,'IDENTITY','ENTER');
 const actualIdentity=await identity();
 if(!actualIdentity)fail('RUNTIME_IDENTITY_UNAVAILABLE');
 if(actualIdentity!==p.runtime_service_account)fail('RUNTIME_SERVICE_IDENTITY_MISMATCH');
 observe(observer,'IDENTITY','COMPLETE');
 observe(observer,'SECRET','ENTER');
 const key=await secret();
 if(!key||!key.trim()||/[\r\n]/.test(key))fail('SECRET_PAYLOAD_EMPTY_OR_INVALID');
 observe(observer,'SECRET','COMPLETE');
 const get:Get=async url=>{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='api.dnsfilter.com'||u.port||u.username||u.password||u.hash)fail('DNS_URI_NOT_ALLOWED');
  return fetch(url,{Authorization:'Bearer '+key,Accept:'application/json'});
 };
 observe(observer,'OPENAPI','ENTER');
 const specResult=await get('https://api.dnsfilter.com/docs/api.json');
 if(specResult.status!==200)fail('GET_HTTP_'+specResult.status);
 if(!specResult.body||typeof specResult.body!=='object'||Array.isArray(specResult.body))fail('MISSING_OPERATION_get_/v1/organizations/{id}');
 observe(observer,'OPENAPI','COMPLETE');
 const inv=await inventory(get,specResult.body as Record<string,unknown>,p.organization_id,p.msp_parent_id,observer);
 return makePlan(p.source_sha,inv,observer);
}
