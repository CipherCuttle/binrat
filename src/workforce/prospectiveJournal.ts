/** Dedicated local SQLite request journal. Reserve before sending; no automatic RPC retries. */
import Database from 'better-sqlite3';
import { canonicalJson } from '../evidence/canonical.js';
import { auditProspective, captureTerminal, sealCapture, validateProspectiveManifest,
  type ProspectiveManifest, type CaptureCall, type RpcRequest, type ProspectiveState } from './prospective.js';

export interface RpcAttempt {rawResponse:string;error:string|null}
export type PublicReadTransport=(request:RpcRequest)=>Promise<RpcAttempt>;
const APPLICATION_ID=0x42525031;
export class ProspectiveJournal {
  private readonly db:Database.Database;
  constructor(path:string,create=false,readOnly=false){
    if(!path||path===':memory:'||path.startsWith('file:'))throw new Error('PROSPECTIVE_DB_PATH_REQUIRED');
    this.db=new Database(path,{readonly:readOnly,fileMustExist:!create});
    try{
      const app=this.db.pragma('application_id',{simple:true}),version=this.db.pragma('user_version',{simple:true});
      const tables=this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      if(app===0&&version===0&&tables.length===0&&create&&!readOnly){
        this.db.transaction(()=>{
          this.db.exec('CREATE TABLE prospective_manifest (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL); CREATE TABLE prospective_calls (sequence INTEGER PRIMARY KEY, json TEXT NOT NULL);');
          this.db.pragma(`application_id=${APPLICATION_ID}`);this.db.pragma('user_version=1');
        })();
      }else if(app!==APPLICATION_ID||version!==1)throw new Error('PROSPECTIVE_DB_OWNERSHIP_REQUIRED');
      if(!readOnly){this.db.pragma('journal_mode=WAL');this.db.pragma('synchronous=FULL');}
      this.db.pragma('busy_timeout=5000');
    }catch(error){this.db.close();throw error;}
  }
  close(){this.db.close();}
  async register(input:unknown){
    const manifest=await validateProspectiveManifest(input);
    this.db.transaction(()=>{
      const previous=this.db.prepare('SELECT json FROM prospective_manifest WHERE id=1').get() as {json:string}|undefined;
      if(previous){if(previous.json!==canonicalJson(manifest))throw new Error('PROSPECTIVE_MANIFEST_CONFLICT');return;}
      this.db.prepare('INSERT INTO prospective_manifest VALUES (1,?)').run(canonicalJson(manifest));
    })();
    return this.inspect();
  }
  async restore(input:unknown){
    const value=input as {mode?:string;manifest?:{json?:string};calls?:{sequence:number;json:string}[]};
    if(!value||value.mode!=='UNVERIFIED_PROSPECTIVE_EXPORT'||typeof value.manifest?.json!=='string'||!Array.isArray(value.calls)||value.calls.length>48||
      value.calls.some((row,i)=>row.sequence!==i+1||typeof row.json!=='string'))throw new Error('PROSPECTIVE_EXPORT_INVALID');
    const manifest=JSON.parse(value.manifest.json) as ProspectiveManifest,calls=value.calls.map(row=>JSON.parse(row.json) as CaptureCall);
    await auditProspective(manifest,calls);
    this.db.transaction(()=>{
      const current=this.db.prepare('SELECT json FROM prospective_manifest WHERE id=1').get() as {json:string}|undefined;
      const rows=this.db.prepare('SELECT sequence,json FROM prospective_calls ORDER BY sequence').all();
      if(current||rows.length){
        if(current?.json!==canonicalJson(manifest)||canonicalJson(rows)!==canonicalJson(value.calls))throw new Error('PROSPECTIVE_RESTORE_CONFLICT');
        return;
      }
      this.db.prepare('INSERT INTO prospective_manifest VALUES (1,?)').run(canonicalJson(manifest));
      const insert=this.db.prepare('INSERT INTO prospective_calls VALUES (?,?)');for(const call of calls)insert.run(call.sequence,canonicalJson(call));
    })();
    return this.inspect();
  }
  private raw(){
    return this.db.transaction(()=>{
      const row=this.db.prepare('SELECT json FROM prospective_manifest WHERE id=1').get() as {json:string}|undefined;
      if(!row)throw new Error('PROSPECTIVE_MANIFEST_REQUIRED');
      const entries=this.db.prepare('SELECT sequence,json FROM prospective_calls ORDER BY sequence').all() as {sequence:number;json:string}[];
      if(entries.length>48||entries.some((entry,i)=>entry.sequence!==i+1))throw new Error('PROSPECTIVE_JOURNAL_INVALID');
      return {manifest:JSON.parse(row.json) as ProspectiveManifest,calls:entries.map(row=>JSON.parse(row.json) as CaptureCall)};
    })();
  }
  async inspect(now?:number){const data=this.raw();return auditProspective(data.manifest,data.calls,now);}
  export(){
    return {mode:'UNVERIFIED_PROSPECTIVE_EXPORT',manifest:this.db.prepare('SELECT json FROM prospective_manifest WHERE id=1').get(),
      calls:this.db.prepare('SELECT sequence,json FROM prospective_calls ORDER BY sequence').all()};
  }
  /** Append attempts against the original budget. A crash after reservation leaves a blocking PENDING row. */
  async step(transport:PublicReadTransport,now=()=>Date.now()):Promise<ProspectiveState>{
    for(let count=0;count<16;count++){
      const data=this.raw(),before=await auditProspective(data.manifest,data.calls,now());
      if(captureTerminal(before)||!before.nextRequest)return before;
      const pending=await sealCapture({sequence:data.calls.length+1,previousDigest:data.calls.at(-1)?.digest??data.manifest.digest,
        startedAtMs:now(),completedAtMs:null,request:before.nextRequest,status:'PENDING' as const,rawResponse:null,error:null});
      this.db.transaction(()=>{
        const rows=this.db.prepare('SELECT sequence,json FROM prospective_calls ORDER BY sequence').all() as {sequence:number;json:string}[];
        if(rows.length!==data.calls.length||rows.some((row,i)=>row.json!==canonicalJson(data.calls[i])))throw new Error('PROSPECTIVE_REVISION_CONFLICT');
        this.db.prepare('INSERT INTO prospective_calls VALUES (?,?)').run(pending.sequence,canonicalJson(pending));
      })();
      let attempt:RpcAttempt;
      try{attempt=await transport(pending.request);}catch{attempt={rawResponse:'',error:'PUBLIC_RPC_TRANSPORT_FAILED'};}
      if(typeof attempt.rawResponse!=='string'||attempt.rawResponse.length>1_000_000)attempt={rawResponse:typeof attempt.rawResponse==='string'?attempt.rawResponse.slice(0,1_000_000):'',error:'PUBLIC_RPC_RESPONSE_TOO_LARGE'};
      if(attempt.error!==null&&!/^[A-Z][A-Z0-9_]{0,100}$/.test(attempt.error))attempt.error='PUBLIC_RPC_TRANSPORT_FAILED';
      const complete=await sealCapture({...pending,completedAtMs:now(),status:attempt.error?'FAILED' as const:'COMPLETE' as const,rawResponse:attempt.rawResponse,error:attempt.error});
      const changed=this.db.prepare('UPDATE prospective_calls SET json=? WHERE sequence=? AND json=?').run(canonicalJson(complete),pending.sequence,canonicalJson(pending));
      if(changed.changes!==1)throw new Error('PROSPECTIVE_REVISION_CONFLICT');
      const after=await this.inspect(now());
      // One logical boundary per invocation. Subsequent observation requires an explicit manual step.
      if(captureTerminal(after)||after.phase==='HANDOFF_PREPARED'||
        (after.stage==='SAMPLE'&&pending.request.method==='eth_getBlockByNumber'&&pending.request.params[1]===true)||
        (after.stage==='WATCH_HEAD'&&(before.stage==='WATCH_HEAD'||before.stage==='RANGE_ANCHOR')))return after;
    }
    return this.inspect(now());
  }
}
