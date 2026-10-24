import {checkPolicy,getOnlyPlan,type Policy} from './plan';
import {GuardStore,GUARD_BUCKET,type StorageTransport} from './gcs';
import {saveDryRun} from './durable';
import {GuardStop} from './inventory';

declare const require:((name:string)=>any)&{main:unknown};
declare const process:{argv:string[];env:Record<string,string|undefined>;stdout:{write:(s:string)=>void};stderr:{write:(s:string)=>void};exitCode:number};
const fs=require('node:fs') as {readFileSync:(path:string,encoding:string)=>string};
const metadata='http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/';
async function metadataJson(path:string):Promise<unknown>{
 try{
  const response=await fetch(metadata+path,{method:'GET',headers:{'Metadata-Flavor':'Google'},redirect:'manual',signal:AbortSignal.timeout(5000)});
  if(response.status!==200)return null;
  return await response.json().catch(()=>null);
 }catch{return null;}
}
async function metadataEmail():Promise<string>{
 try{
  const response=await fetch(metadata+'email',{method:'GET',headers:{'Metadata-Flavor':'Google'},redirect:'manual',signal:AbortSignal.timeout(5000)});
  return response.status===200?(await response.text()).trim():'';
 }catch{return '';}
}
async function token():Promise<string>{
 const v=await metadataJson('token') as {access_token?:unknown}|null;
 if(!v||typeof v.access_token!=='string'||!v.access_token)throw new GuardStop('GCP_TOKEN_UNAVAILABLE');
 return v.access_token;
}
async function dnsGet(url:string,headers:Readonly<Record<string,string>>){
 try{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='api.dnsfilter.com'||u.port||u.username||u.password||u.hash)throw new GuardStop('DNS_URI_NOT_ALLOWED');
  const response=await fetch(url,{method:'GET',headers,redirect:'manual',signal:AbortSignal.timeout(30000)});
  return {status:response.status,body:response.status===200?await response.json().catch(()=>null):null};
 }catch{return {status:0,body:null};}
}
const gcsTransport:StorageTransport=async(method,url,headers,body)=>{
 try{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='storage.googleapis.com'||u.port||u.username||u.password||u.hash)throw Error('forbidden');
  const response=await fetch(url,{method,headers,body:method==='POST'?body:undefined,redirect:'manual',signal:AbortSignal.timeout(30000)});
  return {status:response.status,body:(response.status===200||response.status===201)?await response.json().catch(()=>null):null};
 }catch{return {status:0,body:null};}
};
export async function execute():Promise<unknown>{
 if(process.argv.length!==2)throw new GuardStop('ARGUMENT_OVERRIDE_FORBIDDEN');
 const p=JSON.parse(fs.readFileSync('/app/runtime-policy.json','utf8')) as Policy;
 checkPolicy(p);
 if(process.env.CLOUD_RUN_JOB!==p.job||!process.env.CLOUD_RUN_EXECUTION)throw new GuardStop('EXPECTED_CLOUD_RUN_JOB_REQUIRED');
 const identity=await metadataEmail();
 if(!identity)throw new GuardStop('RUNTIME_IDENTITY_UNAVAILABLE');
 const secret=async()=>fs.readFileSync(p.secret_path,'utf8');
 const plan=await getOnlyPlan(p,async()=>identity,secret,dnsGet);
 const store=new GuardStore(GUARD_BUCKET,'DryRun',gcsTransport,token);
 return saveDryRun(store,plan,p);
}
if(typeof require!=='undefined'&&require.main===module){
 execute().then(receipt=>{process.stdout.write(JSON.stringify(receipt)+'\n');}).catch((e:unknown)=>{
  const code=e instanceof GuardStop&&/^[A-Z][A-Z0-9_]+$/.test(e.code)?e.code:'UNEXPECTED_ERROR_DETAILS_WITHHELD';
  process.stdout.write(JSON.stringify({state:'STOP',code,mutations:0})+'\n');process.exitCode=1;
 });
}
declare const module:unknown;
