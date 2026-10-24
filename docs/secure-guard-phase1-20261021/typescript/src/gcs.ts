import {GuardStop} from './inventory';

export const GUARD_BUCKET='msp-zabbix-secure-guard-offboarding-audit';
export type Scope='DryRun'|'Claims';
export type StorageResponse={status:number;body:unknown};
export type StorageTransport=(method:'GET'|'POST',url:string,headers:Readonly<Record<string,string>>,body:string|null)=>Promise<StorageResponse>;
export type TokenReader=()=>Promise<string>;
const fail=(code:string):never=>{throw new GuardStop(code)};
const paths=/^(?:claims\/organizations\/[0-9]+\/current|claims\/operations\/[a-f0-9]{64}\/agents\/[a-zA-Z0-9-]+\/uninstall|audit\/[a-f0-9]{64}\/[a-zA-Z0-9-]+\.json|dryruns\/organizations\/[0-9]+\/plans\/[a-f0-9]{64}\.json)$/;
export function validatePath(path:string):void{if(!paths.test(path))fail('AUDIT_OBJECT_PATH_INVALID');}
export class GuardStore {
 constructor(readonly bucket:string,readonly scope:Scope,private readonly transport:StorageTransport,private readonly tokenReader:TokenReader){
  if(bucket!==GUARD_BUCKET)fail('AUDIT_BUCKET_NOT_ALLOWED');
  if(scope!=='DryRun'&&scope!=='Claims')fail('AUDIT_STORE_SCOPE_INVALID');
 }
 async request(method:'GET'|'POST',path:string,value:unknown=null,generation?:string):Promise<unknown|null>{
  validatePath(path);
  const dry=path.startsWith('dryruns/');
  if((this.scope==='DryRun')!==dry||!['GET','POST'].includes(method))fail('AUDIT_STORE_SCOPE_INVALID');
  if(generation&&(method!=='GET'||!/^[1-9][0-9]*$/.test(generation)))fail('AUDIT_STORE_SCOPE_INVALID');
  const encoded=encodeURIComponent(path);
  const url=method==='POST'
   ?`https://storage.googleapis.com/upload/storage/v1/b/${this.bucket}/o?uploadType=media&name=${encoded}&ifGenerationMatch=0`
   :`https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/${encoded}?alt=media${generation?'&generation='+generation:''}`;
  let token:string;
  try{token=await this.tokenReader();}catch{return fail('GCP_TOKEN_UNAVAILABLE');}
  if(!token?.trim())fail('GCP_TOKEN_UNAVAILABLE');
  let response:StorageResponse;
  try{
   response=await this.transport(method,url,{Authorization:'Bearer '+token,...(method==='POST'?{'Content-Type':'application/json'}:{})},method==='POST'?JSON.stringify(value):null);
  }catch{return fail('AUDIT_IO_FAILED_UNKNOWN_NO_RESEND');}
  if(!response||typeof response!=='object'||typeof response.status!=='number'||!Number.isInteger(response.status))fail('AUDIT_IO_FAILED_UNKNOWN_NO_RESEND');
  if(method==='GET'&&response.status===404)return null;
  if(response.status===412)fail('CLAIM_CONFLICT_UNKNOWN_NO_RESEND');
  if(response.status!==200&&response.status!==201)fail('AUDIT_IO_FAILED_UNKNOWN_NO_RESEND');
  return response.body;
 }
}
