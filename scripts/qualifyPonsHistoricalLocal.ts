/** One historical Pons launch, with the pre-existing BINRAT ledger and lock.
 * PREVIEW is the default. Never touches Pons Paper or creates a Watch.
 * The matching collector lock MUST be inherited on fd 9 from the shell wrapper.
 */
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {readFileSync,lstatSync,fstatSync,statfsSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {BudgetLedger,HISTORICAL_SOURCE_PRINCIPAL,HISTORICAL_SOURCE_GRANT_ID} from '../src/portable/budget.js';
import {oneShotAlchemyQualificationWire} from '../src/portable/oneShotAlchemyQualificationWire.js';
import {qualifyHistoricalPonsLaunch,type KnownHistoricalPonsEvent} from '../src/portable/tripwireSourceQualification.js';
import {PONS_V2_FACTORY} from '../src/pons/chain.js';

export const HISTORICAL_BLOCK=79_496_536;
export const HISTORICAL_DEPLOYER='0x0d9526dcfe9fa87b138c7edd8db803b45600705f';
const BASE=join(homedir(),'.local/share/binrat-rescue/20261011/replacement-proof/collector-data');
const DATA=join(BASE,'binrat.sqlite'),LEDGER=join(BASE,'budget.sqlite');
const LOCK=join(BASE,'binrat.sqlite.collector.lock');
const CREDS=join(homedir(),'.config/binrat/robinhood-alchemy-rpc.url');
const GRANT_ID=HISTORICAL_SOURCE_GRANT_ID,H32=/^0x[0-9a-f]{64}$/;
const LIMITS={attemptsPerDay:100,attemptsPerRun:50,blocksPerRun:1000,runtimeMs:60000,attemptsPerRequest:1};

function regular(path:string){
 const st=lstatSync(path);
 if(!st.isFile()||st.isSymbolicLink())throw Error('EXISTING_LOCAL_FILE_UNSAFE_OR_MISSING');
}
function table(db:Database.Database,name:string):boolean{
 return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
}
export function selectHistoricalLaunch(db:Database.Database):KnownHistoricalPonsEvent {
 if(!table(db,'launches')||!table(db,'provenance_facts'))throw Error('LOCAL_CASE_STORE_NOT_READY');
 const rows=db.prepare(`SELECT l.block_number,l.block_hash,l.tx_hash,l.log_index,l.creator,l.event_id,
    f.source_event_id,f.observed_block,f.observed_block_hash,f.log_index AS fact_index,f.creator AS fact_creator
    FROM launches l JOIN provenance_facts f ON f.chain_id=l.chain_id AND f.launch_id=l.launch_id
    WHERE l.chain_id=4663 AND l.source='PONS_V2' AND l.launcher=? AND l.creator=?
      AND CAST(l.block_number AS INTEGER)=? LIMIT 2`)
   .all(PONS_V2_FACTORY,HISTORICAL_DEPLOYER,HISTORICAL_BLOCK) as Array<Record<string,unknown>>;
 if(rows.length!==1)throw Error('HISTORICAL_CASE_NOT_UNIQUE_OR_ABSENT');
 const r=rows[0];
 if(r.block_number!==String(HISTORICAL_BLOCK)||typeof r.block_hash!=='string'||!H32.test(r.block_hash)||
   typeof r.tx_hash!=='string'||!H32.test(r.tx_hash)||typeof r.log_index!=='number'||
   !Number.isSafeInteger(r.log_index)||r.log_index<0||
   r.event_id!==r.source_event_id||r.observed_block!==r.block_number||
   r.observed_block_hash!==r.block_hash||r.fact_index!==r.log_index||
   r.fact_creator!==r.creator)throw Error('HISTORICAL_CASE_PROVENANCE_MISMATCH');
 return {blockNumber:HISTORICAL_BLOCK,blockHash:r.block_hash,transactionHash:r.tx_hash,
   logIndex:r.log_index,deployer:HISTORICAL_DEPLOYER};
}
/** Historical source qualification has no Telegram owner and confers zero
 * consent to create a Watch or send a message. Do not infer one from a launch. */
export function historicalQualificationPrincipal(configured?:string):string {
 if(configured!==undefined)throw Error('HISTORICAL_WATCH_OWNER_OVERRIDE_DENIED');
 return HISTORICAL_SOURCE_PRINCIPAL;
}
export function readHistoricalBudget(db:Database.Database,time:number){
 if(!table(db,'rpc_attempts')||!table(db,'budget_meta'))throw Error('ORIGINAL_LEDGER_SCHEMA_MISSING');
 const day=new Date(time).toISOString().slice(0,10);
 const meta=db.prepare('SELECT version,last_day FROM budget_meta WHERE singleton=1')
   .get() as {version:number;last_day:string}|undefined;
 if(!meta||meta.version!==1||day<meta.last_day)throw Error('LEDGER_CLOCK_OR_META_INVALID');
 const used=(db.prepare('SELECT count(*) n FROM rpc_attempts WHERE day=?').get(day) as {n:number}).n;
 if(!Number.isSafeInteger(used)||used<0||used+8>100)
   throw Error('SHARED_DAY_100_REQUEST_GATE_BLOCKED');
 if(table(db,'tripwire_proof_grants_v1')&&
   db.prepare('SELECT 1 FROM tripwire_proof_grants_v1 WHERE grant_id=?').get(GRANT_ID))
   throw Error('ONE_SHOT_GRANT_ALREADY_CREATED');
 return {day,used,after:used+8};
}
function inheritedLock(){
 if(process.env.BINRAT_SOURCE_LOCK_FD!=='9')throw Error('ORIGINAL_COLLECTOR_FLOCK_REQUIRED');
 const fd=fstatSync(9),target=lstatSync(LOCK);
 if(fd.ino!==target.ino||fd.dev!==target.dev||!target.isFile()||target.isSymbolicLink())
   throw Error('COLLECTOR_LOCK_IDENTITY_MISMATCH');
}
function secretUrl(){
 regular(CREDS);
 const s=lstatSync(CREDS);
 if(s.uid!==process.getuid?.()||(s.mode&0o077)!==0||s.size>1024)
   throw Error('ALCHEMY_CREDENTIAL_FILE_UNSAFE');
 return readFileSync(CREDS,'utf8').trim();
}
export async function runOnce(args:string[]){
 if(args.length>1||args.some(a=>a!=='--execute'))throw Error('UNRECOGNIZED_ARGUMENT');
 const execute=args.length===1;
 regular(DATA);regular(LEDGER);regular(LOCK);
 if(execute)inheritedLock();
 const cases=new Database(DATA,{readonly:true,fileMustExist:true,timeout:0});
 let known:KnownHistoricalPonsEvent,ownerId:string;
 try{
   known=selectHistoricalLaunch(cases);
   ownerId=historicalQualificationPrincipal(process.env.BINRAT_TRIPWIRE_OWNER_ID);
 }finally{cases.close()}
 const previous=new Database(LEDGER,{readonly:true,fileMustExist:true,timeout:0});
 let budget:{day:string;used:number;after:number};
 try{budget=readHistoricalBudget(previous,Date.now())}finally{previous.close()}
 const disk=statfsSync(dirname(LEDGER));
 if(disk.bavail*disk.bsize<64*1024*1024)throw Error('LEDGER_DISK_GATE_BLOCKED');
 if(!execute){
   console.log(JSON.stringify({verdict:'PREFLIGHT_ONLY',networkRequests:0,
     principal:ownerId,telegramWatchAuthorized:false,
     historicalBlock:known.blockNumber,transactionHash:known.transactionHash,
     logIndex:known.logIndex,deployer:known.deployer,sharedDailyRequests:budget,
     proposedReservations:8,modeledCu:800,ponsPaperUntouched:true},null,2));
   return;
 }
 const url=secretUrl();
 // Reject wrong endpoint and malformed credentials BEFORE creating a ledger job/grant.
 const wire=oneShotAlchemyQualificationWire({httpsUrl:url,approved:true,stopsAtMs:Date.now()+55_000});
 const ledger=new BudgetLedger(LEDGER,LIMITS);
 let job:string|undefined;
 try{
   const started=Date.now(),deadline=started+55_000,grantExpires=started+60_000;
   job=ledger.start(BigInt(HISTORICAL_BLOCK));
   const generation=randomUUID();
   ledger.createHistoricalQualificationGrant({grantId:GRANT_ID,generation,
     deployer:HISTORICAL_DEPLOYER,stopsAtMs:grantExpires,maxMilliCu:800_000,approved:true});
   const result=await qualifyHistoricalPonsLaunch({ledger,job,grantId:GRANT_ID,deadlineMs:deadline,
     known,scope:{ownerId,generation,deployer:HISTORICAL_DEPLOYER},wire});
   ledger.finish(job,true);
   const output=join(BASE,'pons-source-qualification-20261015-v1.json');
   writeFileSync(output,JSON.stringify({verdict:'QUALIFIED_HISTORICAL_POSITIVE',...result},null,2)+'\n',
     {flag:'wx',mode:0o600});
   console.log(JSON.stringify({verdict:'QUALIFIED_HISTORICAL_POSITIVE',receipt:output,
     launchId:result.launchId,requestsReserved:8,modeledCu:800,
     noAlertsOrLiveWatch:true},null,2));
 }catch(error){
   if(job){try{ledger.finish(job,false)}catch{}}
   const msg=error instanceof Error?error.message:'';
   throw Error(/^TRIPWIRE_[A-Z0-9_]+$/.test(msg)?msg:'HISTORICAL_QUALIFICATION_BLOCKED');
 }finally{ledger.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 runOnce(process.argv.slice(2)).catch(error=>{
   const message=error instanceof Error?error.message:'QUALIFICATION_BLOCKED';
   console.error(JSON.stringify({ok:false,error:/^[A-Z0-9_]+$/.test(message)?message:'QUALIFICATION_BLOCKED'}));
   process.exitCode=1;
 });
}
