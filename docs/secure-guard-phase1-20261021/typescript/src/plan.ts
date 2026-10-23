import type {Get} from './inventory';
import {GuardStop,inventory} from './inventory';

export type Policy={project:string;region:string;job:string;mode:string;organization_id:string;organization_allowlist:string[];msp_parent_id:string;runtime_service_account:string;source_sha:string;secret_version:string;secret_version_resource:string;secret_path:string};
const fail=(s:string):never=>{throw new GuardStop(s)};
export function checkPolicy(p:Policy,args:string[]=[]):void{
 if(args.length)fail('ARGUMENT_OVERRIDE_FORBIDDEN');
 if(p.mode!=='DryRun')fail('C1_DRYRUN_ONLY');
 if(p.project!=='msp-zabbix'||p.region!=='asia-northeast1'||p.job!=='secure-guard-cancellation')fail('DEPLOYMENT_SCOPE_MISMATCH');
 if(p.runtime_service_account!=='secure-guard-job-sa@msp-zabbix.iam.gserviceaccount.com')fail('EXPECTED_IDENTITY_INVALID');
 if(!/^\d+$/.test(p.organization_id)||!/^\d+$/.test(p.msp_parent_id)||p.organization_id===p.msp_parent_id||!p.organization_allowlist.includes(p.organization_id))fail('ORGANIZATION_NOT_ALLOWED');
 if(!/^[a-f0-9]{40}$/.test(p.source_sha))fail('SOURCE_SHA_REQUIRED');
 if(!/^[1-9][0-9]*$/.test(p.secret_version))fail('PINNED_SECRET_VERSION_REQUIRED');
 if(p.secret_version_resource!==`projects/msp-zabbix/secrets/secure-guard-dnsfilter-api-key/versions/${p.secret_version}`||p.secret_path!==`/var/run/guard-secrets/${p.secret_version}`)fail('SECRET_VERSION_MISMATCH');
}
/** Matches the PowerShell ordered-property JSON contract for the ASCII fixture subset.
 * Cross-runtime PowerShell hash equivalence is a separate mandatory gate. */
export async function hashOrdered(value:unknown):Promise<string>{const bytes=new TextEncoder().encode(JSON.stringify(value));const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
export async function makePlan(sourceSha:string,inv:Awaited<ReturnType<typeof inventory>>){
 const payload={source_sha:sourceSha,mode:'DryRun' as const,inventory:inv,mutations_enabled:false as const};
 return {plan_hash:await hashOrdered(payload),payload};
}
export async function getOnlyPlan(p:Policy,identity:()=>Promise<string>,secret:()=>Promise<string>,fetch:Get){
 checkPolicy(p);
 if(await identity()!==p.runtime_service_account)fail('RUNTIME_SERVICE_IDENTITY_MISMATCH');
 const key=await secret();
 if(!key||!key.trim()||/[\r\n]/.test(key))fail('SECRET_PAYLOAD_EMPTY_OR_INVALID');
 const get:Get=async url=>{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='api.dnsfilter.com'||u.port||u.username||u.password||u.hash)fail('DNS_URI_NOT_ALLOWED');
  return fetch(url);
 };
 const specResult=await get('https://api.dnsfilter.com/docs/api.json');
 if(specResult.status!==200)fail('GET_HTTP_'+specResult.status);
 if(!specResult.body||typeof specResult.body!=='object'||Array.isArray(specResult.body))fail('UNKNOWN_OPENAPI');
 const inv=await inventory(get,specResult.body as Record<string,unknown>,p.organization_id,p.msp_parent_id);
 return makePlan(p.source_sha,inv);
}
