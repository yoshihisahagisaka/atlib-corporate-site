import {GuardStop} from './inventory';
import {GuardStore} from './gcs';
import {checkPolicy,hashOrdered,type Policy} from './plan';

const fail=(code:string):never=>{throw new GuardStop(code)};
type Obj=Record<string,any>;
const object=(v:unknown):Obj=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Obj:fail('DRYRUN_PLAN_SCHEMA_INVALID');
const keys=(v:unknown,expected:string[]):Obj=>{
 const o=object(v),actual=Object.keys(o);
 if(actual.length!==expected.length||actual.some(k=>!expected.includes(k)))fail('DRYRUN_PLAN_SCHEMA_INVALID');
 return o;
};
const decimal=(v:unknown,positive=false):number=>{
 if(typeof v!=='number'&&!(/^[0-9]+$/.test(String(v))))fail('DRYRUN_PLAN_SCHEMA_INVALID');
 const n=Number(v);
 if(!Number.isSafeInteger(n)||n<(positive?1:0))fail('DRYRUN_PLAN_SCHEMA_INVALID');
 return n;
};
const numericShape=(v:unknown,positive=false):void=>{
 const raw=String(v);
 if(!/^[0-9]+$/.test(raw)|| (positive&&!/^[1-9][0-9]*$/.test(raw)))fail('DRYRUN_PLAN_SCHEMA_INVALID');
 decimal(v,positive);
};
const txt=(v:unknown):string=>typeof v==='string'?v:fail('DRYRUN_PLAN_SCHEMA_INVALID');
export async function projectPlan(plan:unknown,policy:Policy){
 checkPolicy(policy);
 const p0=keys(plan,['plan_hash','payload']);
 const p=keys(p0.payload,['source_sha','mode','inventory','mutations_enabled']);
 if(!/^[a-f0-9]{64}$/.test(txt(p0.plan_hash))||p.source_sha!==policy.source_sha||p.mode!=='DryRun'||p.mutations_enabled!==false)fail('DRYRUN_PLAN_SCOPE_INVALID');
 const i=keys(p.inventory,['organization_id','msp_parent_id','sites','agents','paging','visibility']);
 if(i.organization_id!==policy.organization_id||i.msp_parent_id!==policy.msp_parent_id)fail('DRYRUN_PLAN_SCOPE_INVALID');
 if(!Array.isArray(i.sites)||!Array.isArray(i.agents))fail('DRYRUN_PLAN_SCHEMA_INVALID');
 const sites:Obj[]=[],agents:Obj[]=[],siteIds=new Set<string>(),agentIds=new Set<string>();
 for(const raw of i.sites){
  const s=keys(raw,['id','name','organization_id']);const id=txt(s.id);
  if(!id||s.organization_id!==policy.organization_id||siteIds.has(id.toLowerCase()))fail('DRYRUN_PLAN_SCOPE_INVALID');
  siteIds.add(id.toLowerCase());sites.push({id,name:txt(s.name),organization_id:txt(s.organization_id)});
 }
 for(const raw of i.agents){
  const a=keys(raw,['uuid','hostname','organization_id','site_id','status','agent_state']);
  const uuid=txt(a.uuid),site=txt(a.site_id),hostname=txt(a.hostname),status=txt(a.status),state=txt(a.agent_state);
  if(!uuid||!hostname||!status||!state||a.organization_id!==policy.organization_id||!siteIds.has(site.toLowerCase())||agentIds.has(uuid.toLowerCase()))fail('DRYRUN_PLAN_SCOPE_INVALID');
  agentIds.add(uuid.toLowerCase());agents.push({uuid,hostname,organization_id:txt(a.organization_id),site_id:site,status,agent_state:state});
 }
 const g=keys(i.paging,['site_pages','site_total','org_agent_pages','org_agent_total','per_site']);
 for(const field of ['site_pages','site_total','org_agent_pages','org_agent_total'])numericShape(g[field]);
 const sitePages=g.site_pages,siteTotal=g.site_total,orgPages=g.org_agent_pages,orgTotal=g.org_agent_total;
 if(!Array.isArray(g.per_site)||Number(siteTotal)!==sites.length||Number(orgTotal)!==agents.length||g.per_site.length!==sites.length)fail('DRYRUN_PLAN_SCHEMA_INVALID');
 const proofIds=new Set<string>(),perSite:Obj[]=[];
 for(const raw of g.per_site){
  const e=keys(raw,['scope','site_id','pages','total','proof']),id=txt(e.site_id);
  numericShape(e.pages,true);numericShape(e.total);
  const pages=e.pages,total=e.total;
  if(e.scope!=='site'||!siteIds.has(id.toLowerCase())||proofIds.has(id.toLowerCase())||e.proof!=='explicit-next-null+stable-total_count+unique-ids'||agents.filter(a=>a.site_id===id).length!==Number(total))fail('DRYRUN_PLAN_SCHEMA_INVALID');
  proofIds.add(id.toLowerCase());perSite.push({scope:'site',site_id:id,pages,total,proof:txt(e.proof)});
 }
 if(i.visibility!=='API default documented collection only; relay/deleted visibility requires review')fail('DRYRUN_PLAN_SCHEMA_INVALID');
 const payload={source_sha:txt(p.source_sha),mode:'DryRun',inventory:{organization_id:txt(i.organization_id),msp_parent_id:txt(i.msp_parent_id),sites,agents,paging:{site_pages:sitePages,site_total:siteTotal,org_agent_pages:orgPages,org_agent_total:orgTotal,per_site:perSite},visibility:txt(i.visibility)},mutations_enabled:false};
 if(await hashOrdered(payload)!==p0.plan_hash||await hashOrdered(p)!==p0.plan_hash)fail('DRYRUN_PLAN_HASH_MISMATCH');
 return {plan_hash:txt(p0.plan_hash),payload};
}
export async function saveDryRun(store:GuardStore,plan:unknown,policy:Policy){
 if(store.scope!=='DryRun')fail('AUDIT_STORE_SCOPE_INVALID');
 const safe=await projectPlan(plan,policy);
 const path=`dryruns/organizations/${safe.payload.inventory.organization_id}/plans/${safe.plan_hash}.json`;
 const response=await store.request('POST',path,safe);
 if(response===null||typeof response!=='object'||Array.isArray(response))fail('DRYRUN_CREATE_RESULT_UNKNOWN_NO_RESEND');
 const created=response as Obj;
 if(created.bucket!==store.bucket||created.name!==path||!(/^[1-9][0-9]*$/.test(String(created.generation))))fail('DRYRUN_CREATE_RESULT_UNKNOWN_NO_RESEND');
 const generation=String(created.generation);
 const read=await store.request('GET',path,null,generation);
 if(read===null)fail('DRYRUN_READBACK_MISSING');
 const verified=await projectPlan(read,policy);
 if(verified.plan_hash!==safe.plan_hash||await hashOrdered(verified)!==await hashOrdered(safe))fail('DRYRUN_READBACK_CONTENT_MISMATCH');
 return {status:'DRYRUN_DURABLE_VERIFIED',source_sha:policy.source_sha,plan_hash:safe.plan_hash,gcs_object:`gs://${store.bucket}/${path}`,generation,site_count:safe.payload.inventory.sites.length,agent_count:safe.payload.inventory.agents.length,mutations:0};
}
