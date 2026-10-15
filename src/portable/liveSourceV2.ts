/** One pinned owner source: WS hints + bounded finalized reconciliation. Never auto-started. */
import { createPublicClient, custom, formatTransactionReceipt, toEventSelector, toHex, type Log, type RpcTransactionReceipt } from 'viem';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { PonsLaunchSource } from '../pons/ponsSource.js';
import { ponsTokenLaunchedEvent } from '../pons/ponsAbi.js';
import { PONS_V2_FACTORY, PONS_V2_FACTORY_CODE_HASH } from '../pons/chain.js';
import { keccak256 } from 'viem';
import { FORWARD_LIMITS, forwardRequire, validateForwardPoint,
  type ForwardAuthority, type ForwardPoint, type ForwardRange, type LiveSourcePolicyV2 } from '../public/forwardCase.js';
import type { ForwardSession, ForwardSource } from './forwardSource.js';
import type { ForwardBudgetLedger } from './forwardSource.js';
import type { PortableDatabase } from './sqlite.js';
import { forwardReceiptRoot } from './forwardReceiptRoot.js';
import { LiveSourceCostV2, type LiveSourceGrantV2 } from './liveSourceCostV2.js';
import type { PortableForwardWatchV1 } from './forwardWatch.js';
import type { VerifiedMiniAppPrincipal } from '../telegram/miniAppAuth.js';

export const ORBBOOK_CASE_V2 = '89461b966a4f194a69fa7e319c8fd25afc5851b2f0e2e7eeda660d05a82eb610';
export const ORBBOOK_DEPLOYER_V2 = '0x0d9526dcfe9fa87b138c7edd8db803b45600705f';
export const LIVE_FILTER_V2 = Object.freeze({address:PONS_V2_FACTORY,
  topics:Object.freeze([toEventSelector(ponsTokenLaunchedEvent),null,null,'0x'+ORBBOOK_DEPLOYER_V2.slice(2).padStart(64,'0')])});
export interface LiveSocketV2 { send(data:string):void; close():void }
export interface LiveWireV2 {
  readonly live: boolean;
  request(method:string,params:unknown[]):Promise<{result:unknown;bytes:number}>;
  open(handlers:{open():void;message(data:string|Uint8Array):void;close():void;error():void}):LiveSocketV2;
}
const SCHEMA = `
CREATE TABLE IF NOT EXISTS live_source_state_v2 (
 canary_id TEXT PRIMARY KEY, generation TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL, policy_json TEXT NOT NULL,
 phase TEXT NOT NULL, epoch INTEGER NOT NULL DEFAULT 0, last_audit_ms INTEGER, failure TEXT);
CREATE TABLE IF NOT EXISTS live_source_hints_v2 (
 canary_id TEXT NOT NULL REFERENCES live_source_state_v2(canary_id), event_key TEXT NOT NULL,
 block_number INTEGER NOT NULL, block_hash TEXT NOT NULL, payload_json TEXT NOT NULL, removed INTEGER NOT NULL,
 PRIMARY KEY(canary_id,event_key));
CREATE TRIGGER IF NOT EXISTS live_source_scope_v2 BEFORE UPDATE ON live_source_state_v2
WHEN NEW.canary_id!=OLD.canary_id OR NEW.generation!=OLD.generation OR NEW.owner_id!=OLD.owner_id OR NEW.policy_json!=OLD.policy_json
BEGIN SELECT RAISE(ABORT,'LIVE_SOURCE_SCOPE_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS live_source_retained_v2 BEFORE DELETE ON live_source_state_v2
BEGIN SELECT RAISE(ABORT,'LIVE_SOURCE_RETAINED'); END;
`;
interface SourceRow {canary_id:string;generation:string;owner_id:string;policy_json:string;phase:string;epoch:number;last_audit_ms:number|null;failure:string|null}
interface Hint {event_key:string;block_number:number;block_hash:string;payload_json:string;removed:number}
const quantity=(v:unknown):v is string=>typeof v==='string'&&/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^0x[0-9a-f]{64}$/i.test(v);
const rawId=(l:Record<string,unknown>)=>`${String(l.transactionHash).toLowerCase()}:${BigInt(String(l.logIndex))}`;

export async function createLiveSourceV2(options:{
  db:PortableDatabase; ledger:ForwardBudgetLedger; job:()=>string; deadline:()=>number;
  grant:LiveSourceGrantV2; wire:LiveWireV2; now?:()=>number;
}) {
  return new LiveSourceV2(options,await sha256Hex(options.grant));
}
export class LiveSourceV2 implements ForwardSource {
  readonly livePolicy:LiveSourcePolicyV2;
  readonly cost:LiveSourceCostV2;
  private readonly now:()=>number;
  private socket?:LiveSocketV2;
  private subscription:string|null=null;
  private serial=0;
  private authorityVerified=false;
  private finalizedEpoch=-1;
  private expiry?:ReturnType<typeof setTimeout>;
  constructor(private readonly o:{db:PortableDatabase;ledger:ForwardBudgetLedger;job:()=>string;deadline:()=>number;
    grant:LiveSourceGrantV2;wire:LiveWireV2;now?:()=>number},tariffDigest:string) {
    this.now=o.now??Date.now;
    this.livePolicy=Object.freeze({kind:'ALCHEMY_LOGS_RECONCILED_V2',canaryId:o.grant.canaryId,ownerId:o.grant.ownerId,
      tariffDigest,finality:'FINALIZED_TAG',maxRangeBlocks:50000,auditMs:60000,absenceProven:false});
    this.cost=new LiveSourceCostV2(o.db,o.grant,this.now);this.o=Object.freeze({...o,grant:this.cost.grant});o.db.sql.exec(SCHEMA);
    const row=this.row();
    if(row&&!['BLOCKED','EXHAUSTED','STOPPED'].includes(row.phase))this.invalidate('RECOVERING','RESTART_RECONCILIATION_REQUIRED');
  }
  private row():SourceRow|undefined {return this.o.db.sql.prepare('SELECT * FROM live_source_state_v2 WHERE canary_id=?').get(this.livePolicy.canaryId) as SourceRow|undefined;}
  prepare(a:ForwardAuthority) {
    forwardRequire(a.originalCase.material.caseId===ORBBOOK_CASE_V2&&a.deployer===ORBBOOK_DEPLOYER_V2&&
      a.ownerId===this.livePolicy.ownerId&&canonicalJson(a.liveSource)===canonicalJson(this.livePolicy),'LIVE_SOURCE_SCOPE_INVALID');
    const row=this.row();
    if(row)forwardRequire(row.generation===a.generation&&row.policy_json===canonicalJson(this.livePolicy),'LIVE_SOURCE_SCOPE_INVALID');
    else this.o.db.sql.prepare("INSERT INTO live_source_state_v2(canary_id,generation,owner_id,policy_json,phase) VALUES(?,?,?,?,'DISCONNECTED')")
      .run(this.livePolicy.canaryId,a.generation,a.ownerId,canonicalJson(this.livePolicy));
  }
  private closeSocket(){const socket=this.socket;this.socket=undefined;this.subscription=null;this.serial++;socket?.close();}
  private invalidate(phase:string,failure:string,terminal=false) {
    const row=this.row();if(!row)return;
    this.o.db.sql.prepare('UPDATE live_source_state_v2 SET phase=?,epoch=epoch+1,failure=? WHERE canary_id=?').run(phase,failure,row.canary_id);
    this.o.db.sql.prepare("UPDATE pons_forward_watches_v1 SET state=?,failure=?,revision=revision+1 WHERE generation=? AND state NOT IN ('CANCELLED','REORG_BLOCKED','CASE_RETURN_UNAVAILABLE')")
      .run(terminal?'REORG_BLOCKED':failure==='CASE_RETURN_UNAVAILABLE'?'CASE_RETURN_UNAVAILABLE':'COVERAGE_UNKNOWN',failure,row.generation);
    if(terminal||['EXHAUSTED','BLOCKED','STOPPED'].includes(phase))this.o.db.sql.prepare("UPDATE pons_tripwire_outbox SET state='CANCELLED' WHERE watch_generation=? AND state='PENDING'").run(row.generation);
  }
  private fail(error:unknown):never {
    const message=error instanceof Error?error.message:'';
    const budget=/BUDGET|TARIFF|EXHAUST|RUNTIME/.test(message);
    if(budget)this.cost.halt();
    clearTimeout(this.expiry);
    this.closeSocket();this.invalidate(budget?'EXHAUSTED':'BLOCKED',budget?'LIVE_BUDGET_EXHAUSTED':'LIVE_SOURCE_UNAVAILABLE');
    throw Error(budget?'LIVE_BUDGET_EXHAUSTED':'LIVE_SOURCE_UNAVAILABLE');
  }
  private reserve(method:string) {
    const row=this.row();
    if(row)forwardRequire(this.socket&&this.subscription&&['RECOVERING','LIVE'].includes(row.phase)||
      method==='eth_subscribe'&&this.socket&&row.phase==='CONNECTING','LIVE_SOURCE_HALTED');
    this.cost.rpc(method);
    this.o.ledger.reserve(this.o.job(),method,Math.min(this.o.deadline(),this.o.grant.stopsAtMs));
  }
  private async rpc(method:string,params:unknown[]) {
    try{
      forwardRequire(!this.o.wire.live||this.o.grant.liveApproved,'LIVE_SOURCE_NOT_AUTHORIZED');
      this.reserve(method);
      const response=await this.o.wire.request(method,params);
      this.cost.received(response.bytes,false);
      forwardRequire(response.bytes<=1048576,'LIVE_RESPONSE_LIMIT');return response.result;
    }catch(error){return this.fail(error);}
  }
  async connect() {
    this.cost.active();forwardRequire(this.row()&&!this.socket,'LIVE_SOURCE_CONNECT_INVALID');
    forwardRequire(['DISCONNECTED','RECOVERING'].includes(this.row()!.phase),'LIVE_SOURCE_HALTED');
    const watch=this.o.db.sql.prepare('SELECT state FROM pons_forward_watches_v1 WHERE generation=?').get(this.row()!.generation) as {state:string};
    forwardRequire(!['CANCELLED','REORG_BLOCKED','CASE_RETURN_UNAVAILABLE'].includes(watch.state),'LIVE_SOURCE_HALTED');
    forwardRequire(!this.o.wire.live||this.o.grant.liveApproved,'LIVE_SOURCE_NOT_AUTHORIZED');
    this.cost.connection();this.invalidate('CONNECTING','STARTUP_OR_RECONNECT_RECONCILIATION_REQUIRED');
    clearTimeout(this.expiry);this.expiry=setTimeout(()=>this.stop(),Math.max(1,this.o.grant.stopsAtMs-this.now()));
    this.authorityVerified=false;
    const serial=++this.serial;
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>{this.closeSocket();this.invalidate('BLOCKED','LIVE_SUBSCRIPTION_TIMEOUT');reject(Error('LIVE_SUBSCRIPTION_TIMEOUT'));},8000);
      const bad=(error:unknown)=>{clearTimeout(timer);try{this.fail(error);}catch(failure){reject(failure);}};
      try{this.socket=this.o.wire.open({
        open:()=>{if(serial!==this.serial)return;try{this.reserve('eth_subscribe');
          this.socket!.send(JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_subscribe',params:['logs',LIVE_FILTER_V2]}));}catch(error){bad(error);}},
        message:data=>{
          try{
            const bytes=typeof data==='string'?Buffer.byteLength(data):data.byteLength;this.cost.received(bytes,true);
            if(serial!==this.serial)return;
            const value=JSON.parse(typeof data==='string'?data:new TextDecoder('utf-8',{fatal:true}).decode(data));
            if(!this.subscription){forwardRequire(value?.jsonrpc==='2.0'&&value.id===1&&typeof value.result==='string'&&
              /^0x[0-9a-f]{1,64}$/i.test(value.result)&&!('error'in value),'LIVE_SUBSCRIPTION_INVALID');
              this.subscription=value.result;this.invalidate('RECOVERING','RECONCILIATION_REQUIRED');clearTimeout(timer);resolve();return;}
            forwardRequire(value?.jsonrpc==='2.0'&&value.method==='eth_subscription'&&value.params?.subscription===this.subscription,'LIVE_SUBSCRIPTION_INVALID');
            this.hint(value.params.result);
          }catch(error){bad(error);}
        },
        close:()=>{if(serial!==this.serial)return;clearTimeout(timer);this.socket=undefined;this.subscription=null;
          this.invalidate('DISCONNECTED','DISCONNECT_RECONCILIATION_REQUIRED');reject(Error('LIVE_DISCONNECTED'));},
        error:()=>{if(serial===this.serial)bad(Error('LIVE_SOCKET_ERROR'));}
      });}catch(error){bad(error);}
    });
  }
  private hint(l:Record<string,unknown>) {
    forwardRequire(l&&typeof l.address==='string'&&Array.isArray(l.topics),'LIVE_LOG_INVALID');
    // Unrelated frames are charged, then ignored. They cannot alter any coverage cursor or finding.
    if(l.address.toLowerCase()!==LIVE_FILTER_V2.address||l.topics[0]!==LIVE_FILTER_V2.topics[0]||l.topics[3]!==LIVE_FILTER_V2.topics[3])return;
    this.checkRaw(l);
    const row=this.row()!,key=rawId(l),payload=canonicalJson(l);
    const saved=this.o.db.sql.prepare('SELECT cursor_block,authority_json FROM pons_forward_watches_v1 WHERE generation=?').get(row.generation) as {cursor_block:number;authority_json:string};
    const cursor=saved.cursor_block;
    if(BigInt(String(l.blockNumber))<=BigInt(JSON.parse(saved.authority_json).boundary.block))return;
    const prior=this.o.db.sql.prepare('SELECT * FROM live_source_hints_v2 WHERE canary_id=? AND event_key=?').get(row.canary_id,key) as Hint|undefined;
    if(prior?.payload_json===payload)return;
    if(Number(BigInt(String(l.blockNumber)))<=cursor){
      const finding=this.o.db.sql.prepare(`SELECT case_json FROM pons_forward_findings_v1 WHERE generation=?
        AND json_extract(case_json,'$.material.record.launch.txHash')=? AND json_extract(case_json,'$.material.record.launch.logIndex')=?`)
        .get(row.generation,String(l.transactionHash).toLowerCase(),Number(BigInt(String(l.logIndex)))) as {case_json:string}|undefined;
      if(finding&&!l.removed){const known=JSON.parse(finding.case_json).material.record.launch;
        if(known.blockHash===String(l.blockHash).toLowerCase()&&known.blockNumber===String(BigInt(String(l.blockNumber)))&&
          known.token==='0x'+String((l.topics as string[])[1]).slice(-40)&&known.pool==='0x'+String((l.topics as string[])[2]).slice(-40))return;}
      this.closeSocket();this.invalidate('BLOCKED','LATE_OR_REMOVED_FINALIZED_EVENT',true);return;
    }
    forwardRequire(!prior||prior.removed===1||l.removed===true,'LIVE_HINT_CONFLICT');
    const count=(this.o.db.sql.prepare('SELECT COUNT(*) n FROM live_source_hints_v2 WHERE canary_id=?').get(row.canary_id) as {n:number}).n;
    forwardRequire(prior||count<32,'LIVE_HINT_LIMIT');
    this.o.db.sql.prepare(`INSERT INTO live_source_hints_v2 VALUES(?,?,?,?,?,?) ON CONFLICT(canary_id,event_key)
      DO UPDATE SET block_number=excluded.block_number,block_hash=excluded.block_hash,payload_json=excluded.payload_json,removed=excluded.removed`)
      .run(row.canary_id,key,Number(BigInt(String(l.blockNumber))),String(l.blockHash).toLowerCase(),payload,l.removed?1:0);
    this.invalidate('RECOVERING','FINALIZED_RECONCILIATION_REQUIRED');
  }
  private checkRaw(l:Record<string,unknown>) {
    forwardRequire(hash(l.blockHash)&&hash(l.transactionHash)&&quantity(l.blockNumber)&&quantity(l.logIndex)&&quantity(l.transactionIndex)&&
      BigInt(l.blockNumber)<=BigInt(Number.MAX_SAFE_INTEGER)&&BigInt(l.logIndex)<=1000000n&&typeof l.removed==='boolean'&&
      Array.isArray(l.topics)&&l.topics.length===4&&l.topics.every(hash)&&typeof l.data==='string'&&/^0x[0-9a-f]{192}$/i.test(l.data),'LIVE_LOG_INVALID');
  }
  private async header(block:bigint|'latest'|'finalized') {
    const raw=await this.rpc('eth_getBlockByNumber',[typeof block==='bigint'?toHex(block):block,false]) as Record<string,unknown>;
    forwardRequire(raw&&quantity(raw.number)&&hash(raw.hash)&&hash(raw.parentHash)&&hash(raw.receiptsRoot)&&quantity(raw.timestamp)&&
      (typeof block!=='bigint'||BigInt(raw.number)===block)&&Array.isArray(raw.transactions)&&raw.transactions.every(hash),'FORWARD_HEADER_UNAVAILABLE');
    const point:ForwardPoint={block:BigInt(raw.number).toString(),hash:raw.hash.toLowerCase(),parentHash:raw.parentHash.toLowerCase(),
      receiptsRoot:raw.receiptsRoot.toLowerCase(),timestampMs:Number(BigInt(raw.timestamp))*1000};
    validateForwardPoint(point);forwardRequire(point.timestampMs<=this.now(),'FORWARD_HEADER_FUTURE');
    return {point,transactions:raw.transactions as string[]};
  }
  open(requestLimit:number):ForwardSession {
    forwardRequire(Number.isSafeInteger(requestLimit)&&requestLimit>0&&requestLimit<=50,'LIVE_BUDGET_INVALID');
    let requests=0,finalized:ForwardPoint|undefined;
    const bounded=<T>(run:()=>Promise<T>)=>{forwardRequire(++requests<=requestLimit,'LIVE_BUDGET_SESSION_EXHAUSTED');return run();};
    return {
      maxScanBlocks:this.livePolicy.maxRangeBlocks,
      authority:async()=>{
        if(this.authorityVerified)return;
        forwardRequire(await bounded(()=>this.rpc('eth_chainId',[]))==='0x1237','LIVE_CHAIN_DRIFT');
        const code=await bounded(()=>this.rpc('eth_getCode',[PONS_V2_FACTORY,'latest']));
        forwardRequire(typeof code==='string'&&/^0x[0-9a-f]+$/i.test(code)&&keccak256(code as `0x${string}`)===PONS_V2_FACTORY_CODE_HASH,'LIVE_FACTORY_DRIFT');
        this.authorityVerified=true;
      },
      head:async()=>{const {point}=await bounded(()=>this.header('latest'));
        forwardRequire(this.now()-point.timestampMs<=60000,'LIVE_HEAD_STALE');return point;},
      point:async b=>(await bounded(()=>this.header(b))).point,
      finalizedTarget:async()=>{
        this.finalizedEpoch=this.row()?.epoch??-1;this.commitCheck();
        finalized=(await bounded(()=>this.header('finalized'))).point;return finalized;
      },
      scan:async(deployer,from,through)=>{
        forwardRequire(deployer===ORBBOOK_DEPLOYER_V2&&from>=0n&&through>=from&&through-from<50000n&&
          finalized&&through<=BigInt(finalized.block),'LIVE_RANGE_INVALID');
        this.commitCheck();const epoch=this.row()!.epoch;
        const end=(await bounded(()=>this.header(through))).point;
        const raw=await bounded(()=>this.rpc('eth_getLogs',[{...LIVE_FILTER_V2,fromBlock:toHex(from),toBlock:toHex(through)}]));
        forwardRequire(Array.isArray(raw)&&raw.length<=FORWARD_LIMITS.events,'LIVE_LOG_LIMIT');
        const unique=new Map<string,Record<string,unknown>>();
        for(const log of raw as Record<string,unknown>[]){this.checkRaw(log);
          forwardRequire(log.removed===false&&String(log.address).toLowerCase()===PONS_V2_FACTORY&&
            (log.topics as string[])[0]===LIVE_FILTER_V2.topics[0]&&(log.topics as string[])[3]===LIVE_FILTER_V2.topics[3]&&
            BigInt(String(log.blockNumber))>=from&&BigInt(String(log.blockNumber))<=through,'LIVE_RANGE_LOG_INVALID');
          const key=rawId(log),prior=unique.get(key);forwardRequire(!prior||canonicalJson(prior)===canonicalJson(log),'LIVE_EVENT_CONFLICT');unique.set(key,log);
        }
        const hints=this.o.db.sql.prepare('SELECT * FROM live_source_hints_v2 WHERE canary_id=? AND block_number BETWEEN ? AND ? AND removed=0')
          .all(this.livePolicy.canaryId,Number(from),Number(through)) as Hint[];
        for(const hint of hints)forwardRequire(unique.has(hint.event_key)&&canonicalJson(unique.get(hint.event_key))===hint.payload_json,'LIVE_RECONCILIATION_OMISSION');
        const logs=[...unique.values()];
        const client=createPublicClient({transport:custom({request:async({method})=>{forwardRequire(method==='eth_getLogs','LIVE_DECODER_IO_DENIED');return logs;}},{retryCount:0})});
        const launches=await new PonsLaunchSource({client,now:this.now}).catchUp(from,through);
        forwardRequire(launches.length===logs.length,'LIVE_DECODER_DROP');
        const headers=new Map<string,ForwardPoint>(),evidence:unknown[]=[];let transactions=0;
        for(const block of [...new Set(launches.map(l=>l.blockNumber))]){
          const h=await bounded(()=>this.header(block));
          const receipts=await bounded(()=>this.rpc('eth_getBlockReceipts',[toHex(block)])) as RpcTransactionReceipt[];
          forwardRequire(Array.isArray(receipts)&&h.transactions.length<=128&&receipts.length===h.transactions.length&&
            forwardReceiptRoot(receipts)===h.point.receiptsRoot,'FORWARD_RECEIPTS_ROOT_UNAVAILABLE');
          const formatted=receipts.map(r=>formatTransactionReceipt(r)),all:Log[]=[];
          for(let i=0;i<formatted.length;i++){
            const receipt=formatted[i];forwardRequire(receipt.blockHash===h.point.hash&&receipt.blockNumber===block&&
              receipt.transactionIndex===i&&receipt.transactionHash===h.transactions[i],'LIVE_RECEIPT_BINDING_INVALID');
            for(const l of receipt.logs){forwardRequire(!l.removed&&l.blockHash===h.point.hash&&l.blockNumber===block&&
              l.transactionHash===receipt.transactionHash&&l.transactionIndex===i&&l.logIndex===all.length,'LIVE_RECEIPT_LOG_INVALID');all.push(l);}
          }
          forwardRequire(all.length<=1024,'LIVE_RECEIPT_LOG_LIMIT');
          const match=all.filter(l=>l.address.toLowerCase()===PONS_V2_FACTORY&&l.topics[0]===LIVE_FILTER_V2.topics[0]&&l.topics[3]===LIVE_FILTER_V2.topics[3]);
          const logIdentity=(l:Log)=>canonicalJson({block:l.blockNumber,hash:l.blockHash,tx:l.transactionHash,index:l.logIndex,topics:l.topics,data:l.data});
          const decoded=await client.getLogs({address:PONS_V2_FACTORY,event:ponsTokenLaunchedEvent,fromBlock:block,toBlock:block,strict:true});
          // The in-memory client returns the whole bounded range; narrow explicitly by canonical block.
          forwardRequire(canonicalJson(match.map(logIdentity).sort())===canonicalJson(decoded.filter(l=>l.blockNumber===block).map(logIdentity).sort()),'LIVE_RECONCILIATION_OMISSION');
          forwardRequire(canonicalJson((await bounded(()=>this.header(block))).point)===canonicalJson(h.point),'LIVE_REORG_DRIFT');
          headers.set(String(block),h.point);transactions+=receipts.length;evidence.push({header:h.point,receiptDigest:await sha256Hex(receipts)});
        }
        headers.set(end.block,end);
        const ordered=[...headers.values()].sort((a,b)=>Number(BigInt(a.block)-BigInt(b.block)));
        forwardRequire(this.row()!.epoch===epoch,'LIVE_RECONCILIATION_COVERAGE_INTERRUPTED');
        return {headers:ordered,launches,completeness:{kind:'PROVIDER_RECONCILED_V2',blocks:Number(through-from+1n),transactions,
          matchingEvents:launches.length,responseDigest:await sha256Hex({logs,evidence,end}),absenceProven:false,
          policyDigest:await sha256Hex(this.livePolicy),finalized,verifiedPositiveBlocks:[...new Set(launches.map(l=>String(l.blockNumber)))],
          subscriptionEpoch:epoch,logSetDigest:await sha256Hex(logs),hintsDigest:await sha256Hex(hints)}};
      }
    };
  }
  commitCheck(range?:ForwardRange) {
    this.cost.active();const row=this.row();
    forwardRequire(this.socket&&this.subscription&&row&&['RECOVERING','LIVE'].includes(row.phase),'LIVE_RECONCILIATION_REQUIRED');
    forwardRequire(row.epoch===(range?.completeness.kind==='PROVIDER_RECONCILED_V2'?range.completeness.subscriptionEpoch:this.finalizedEpoch===-1?row.epoch:this.finalizedEpoch),'LIVE_RECONCILIATION_COVERAGE_INTERRUPTED');
  }
  committed(){this.o.db.sql.prepare("UPDATE live_source_state_v2 SET phase='LIVE',last_audit_ms=?,failure=NULL WHERE canary_id=?").run(this.now(),this.livePolicy.canaryId);}
  locallyReconciled(){const row=this.row();return Boolean(this.socket&&this.subscription&&row?.phase==='LIVE'&&
    row.last_audit_ms!==null&&this.now()-row.last_audit_ms<=this.livePolicy.auditMs&&this.cost.snapshot().phase==='ACTIVE'&&this.now()<this.o.grant.stopsAtMs);}
  auditDue(){const row=this.row();return Boolean(row&&(row.phase==='RECOVERING'||row.last_audit_ms===null||this.now()-row.last_audit_ms>=this.livePolicy.auditMs));}
  async reconcile(engine:PortableForwardWatchV1,principal:VerifiedMiniAppPrincipal,generation:string,reason:'startup'|'reconnect'|'periodic'|'hint') {
    this.cost.active();forwardRequire(this.row()?.generation===generation,'LIVE_SOURCE_SCOPE_INVALID');
    const result=await engine.poll(principal,generation);
    if(['REORG_BLOCKED','CASE_RETURN_UNAVAILABLE'].includes(result.state)){this.closeSocket();this.invalidate('BLOCKED',result.state,result.state==='REORG_BLOCKED');}
    return {...result,reconciliationReason:reason};
  }
  /** Explicit canary entry only. The existing host owns ledger jobs and authentication.
   * No request retry: only a disconnected subscription may reconnect once, then reconcile.
   * A quiet socket still audits every 60s. A pending finalized boundary waits for that audit. */
  async runCanary(engine:PortableForwardWatchV1,principal:VerifiedMiniAppPrincipal,generation:string,options:{
    signal:AbortSignal;beginCycle():void;pause?:(ms:number)=>Promise<void>;
  }) {
    let attemptedAt:number|undefined,connected=false;
    const pause=options.pause??(ms=>new Promise<void>(resolve=>{
      const done=()=>{clearTimeout(timer);options.signal.removeEventListener('abort',done);resolve();};
      const timer=setTimeout(done,ms);options.signal.addEventListener('abort',done,{once:true});
    }));
    try{
      while(!options.signal.aborted&&this.now()<this.o.grant.stopsAtMs){
        const status=await engine.status(principal,generation);
        if(['CANCELLED','REORG_BLOCKED','CASE_RETURN_UNAVAILABLE'].includes(status.state))break;
        const row=this.row();forwardRequire(row?.generation===generation,'LIVE_SOURCE_SCOPE_INVALID');
        forwardRequire(!['BLOCKED','EXHAUSTED','STOPPED'].includes(row.phase),'LIVE_SOURCE_HALTED');
        const reconnect=!this.socket;
        if(reconnect||attemptedAt===undefined||this.now()-attemptedAt>=this.livePolicy.auditMs){
          options.beginCycle();this.cost.active();
          if(reconnect)await this.connect();
          const result=await this.reconcile(engine,principal,generation,reconnect?(connected?'reconnect':'startup'):'periodic');
          attemptedAt=this.now();connected=true;
          if(!['RECOVERING','LIVE'].includes(this.row()!.phase)||['REORG_BLOCKED','CASE_RETURN_UNAVAILABLE'].includes(result.state))break;
        }
        await pause(Math.min(1000,Math.max(1,this.o.grant.stopsAtMs-this.now())));
      }
    }finally{this.stop();}
  }
  stop(){clearTimeout(this.expiry);this.cost.halt('STOPPED');this.closeSocket();this.invalidate('STOPPED','LIVE_SOURCE_STOPPED');}
  disconnect(){clearTimeout(this.expiry);this.closeSocket();
    if(!['BLOCKED','EXHAUSTED','STOPPED'].includes(this.row()?.phase??''))this.invalidate('DISCONNECTED','DISCONNECT_RECONCILIATION_REQUIRED');}
  failed(state:string,code:string){
    if(code==='FORWARD_FINALITY_PENDING')return;
    clearTimeout(this.expiry);
    if(/BUDGET|CEILING|EXHAUST|RUNTIME/.test(code))this.cost.halt();
    this.closeSocket();this.invalidate(this.cost.snapshot().phase==='EXHAUSTED'?'EXHAUSTED':'BLOCKED',state,state==='REORG_BLOCKED');
  }
}
