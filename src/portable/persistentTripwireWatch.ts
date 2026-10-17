/**
 * Dormant local-positive-event admission journal. No timer, WebSocket, RPC,
 * Case publication, WATCH HTTP route, or Telegram delivery exists here.
 * This consumes only externally presented hints, never infers absent launches.
 * Real source validation remains a separate, explicit integration gate.
 */
import {POSITIVE_EVENT_BUDGET, PROOF_METHOD_RESERVATIONS} from './persistentTripwireBudget.ts';

const PONS_FACTORY='0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e';
const addr=(v:unknown):v is string=>typeof v==='string' && /^0x[0-9a-f]{40}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string' && /^0x[0-9a-f]{64}$/.test(v);
export type PositiveGrant = Readonly<{
  id:string; mode:'POSITIVE_EVENT_ONLY_V1'; ownerId:string;
  deployer:string; tokenLaunchedTopic0:string; chainId:4663;
  startsAtMs:number; expiresAtMs:number; consentBlock:number;
  maxCandidates:number; setupBoundOutsideThisModule:true;
}>;
export type ChainHint = Readonly<{
  address:string; topics:readonly string[]; blockNumber:number;
  blockHash:string; transactionHash:string; logIndex:number;
  removed:boolean;
}>;
export interface SqlStatement {
  get(...v:unknown[]):any;
  run(...v:unknown[]):{changes:number};
}
export interface SqlPort {
  exec(sql:string):void;
  prepare(sql:string):SqlStatement;
}
export interface SharedForwardLedgerPort {
  /** Must be the pre-existing, independently verified 100/day ForwardBudgetLedger. */
  reserve(job:string,method:string,deadline:number):void;
}
const schema=`
CREATE TABLE IF NOT EXISTS positive_event_scopes_v1 (grant_id TEXT PRIMARY KEY, grant_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS positive_event_hints_v1 (
 grant_id TEXT NOT NULL, owner_id TEXT NOT NULL, deployer TEXT NOT NULL,
 block_number INTEGER NOT NULL, block_hash TEXT NOT NULL,
 tx_hash TEXT NOT NULL, log_index INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('PENDING','RESERVING','PROOF_SLOTS_RESERVED','UNKNOWN')),
 admitted_at_ms INTEGER, failure TEXT,
 PRIMARY KEY(grant_id,tx_hash,log_index)
);
`;
export type HintResult={state:'IGNORED'|'UNKNOWN'|'PENDING'|'DUPLICATE'|'PROOF_SLOTS_RESERVED',reason:string};
export class PersistentPositiveEventWatch {
  private readonly sql:SqlPort;
  private readonly grant:PositiveGrant;
  private readonly ledger:SharedForwardLedgerPort;
  private readonly now:()=>number;
  private constructor(sql:SqlPort, grant:PositiveGrant, ledger:SharedForwardLedgerPort,now:()=>number){
    this.sql=sql;this.grant=grant;this.ledger=ledger;this.now=now;
  }
  static open(sql:SqlPort, grant:PositiveGrant, ledger:SharedForwardLedgerPort, now=Date.now) {
    if (!grant || grant.mode!=='POSITIVE_EVENT_ONLY_V1' || grant.chainId!==4663 ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(grant.id) || !/^[a-zA-Z0-9:_-]{1,100}$/.test(grant.ownerId) ||
      !addr(grant.deployer) || grant.deployer!==grant.deployer.toLowerCase() ||
      !hash(grant.tokenLaunchedTopic0) ||
      !Number.isSafeInteger(grant.startsAtMs) || !Number.isSafeInteger(grant.expiresAtMs) ||
      grant.startsAtMs>=grant.expiresAtMs ||
      grant.expiresAtMs-grant.startsAtMs>POSITIVE_EVENT_BUDGET.lifetimeMs ||
      !Number.isSafeInteger(grant.consentBlock) || grant.consentBlock<0 ||
      !Number.isSafeInteger(grant.maxCandidates) || grant.maxCandidates<1 ||
      grant.maxCandidates>POSITIVE_EVENT_BUDGET.maxCandidates ||
      grant.setupBoundOutsideThisModule!==true ||
      typeof sql?.exec!=='function' || typeof sql?.prepare!=='function' ||
      typeof ledger?.reserve!=='function') throw Error('POSITIVE_EVENT_SCOPE_INVALID');
    // This schema has no triggers/sends and cannot activate a Watch.
    sql.exec(schema);
    // Bind this durable ID to its entire consent/owner/source/cost scope.
    const policyJson=JSON.stringify(grant);
    sql.exec('BEGIN IMMEDIATE');
    try {
      const prior=sql.prepare('SELECT grant_json FROM positive_event_scopes_v1 WHERE grant_id=?').get(grant.id) as {grant_json:string}|undefined;
      if (prior && prior.grant_json!==policyJson) throw Error('POSITIVE_EVENT_SCOPE_DRIFT');
      if (!prior) sql.prepare('INSERT INTO positive_event_scopes_v1 VALUES(?,?)').run(grant.id,policyJson);
      sql.exec('COMMIT');
    } catch(error) {sql.exec('ROLLBACK');throw error;}
    return new PersistentPositiveEventWatch(sql,Object.freeze({...grant}),ledger,now);
  }
  private validTime(){return this.now()>=this.grant.startsAtMs && this.now()<this.grant.expiresAtMs;}
  private withWrite<T>(f:()=>T):T{
    this.sql.exec('BEGIN IMMEDIATE');
    try {const r=f();this.sql.exec('COMMIT');return r;}
    catch(e){this.sql.exec('ROLLBACK');throw e;}
  }
  journal(hint:ChainHint):HintResult{
    if (!this.validTime())return {state:'UNKNOWN',reason:'GRANT_NOT_CURRENT'};
    if (!hint || typeof hint!=='object' || !Array.isArray(hint.topics) ||
      !addr(hint.address) || !hint.topics.every(hash) || hint.topics.length!==4 ||
      !hash(hint.blockHash) || !hash(hint.transactionHash) ||
      !Number.isSafeInteger(hint.blockNumber) || hint.blockNumber<0 ||
      !Number.isSafeInteger(hint.logIndex) || hint.logIndex<0 || hint.logIndex>1000000 ||
      typeof hint.removed!=='boolean')return {state:'UNKNOWN',reason:'MALFORMED_HINT'};
    if (hint.address!==PONS_FACTORY || hint.topics[0]!==this.grant.tokenLaunchedTopic0 ||
      hint.topics[3]!==`0x${this.grant.deployer.slice(2).padStart(64,'0')}`)
      return {state:'IGNORED',reason:'DIFFERENT_EXACT_DEPLOYER_OR_FACTORY'};
    if (hint.blockNumber<=this.grant.consentBlock)return {state:'IGNORED',reason:'BEFORE_CONSENT_BOUNDARY'};
    if (hint.removed) {
      // A removed hint invalidates even an already reserved candidate.
      this.sql.prepare("UPDATE positive_event_hints_v1 SET state='UNKNOWN',failure='REMOVED_OR_REORG_HINT' WHERE grant_id=? AND tx_hash=? AND log_index=?")
        .run(this.grant.id,hint.transactionHash,hint.logIndex);
      return {state:'UNKNOWN',reason:'REMOVED_OR_REORG_HINT'};
    }
    return this.withWrite(()=>{
      const old=this.sql.prepare('SELECT block_hash,state FROM positive_event_hints_v1 WHERE grant_id=? AND tx_hash=? AND log_index=?')
        .get(this.grant.id,hint.transactionHash,hint.logIndex) as {block_hash:string;state:string}|undefined;
      if (old){if(old.block_hash!==hint.blockHash){
        this.sql.prepare("UPDATE positive_event_hints_v1 SET state='UNKNOWN',failure='HINT_BLOCK_HASH_DRIFT' WHERE grant_id=? AND tx_hash=? AND log_index=?")
          .run(this.grant.id,hint.transactionHash,hint.logIndex);
        return {state:'UNKNOWN',reason:'HINT_BLOCK_HASH_DRIFT'};
      }return {state:'DUPLICATE',reason:'ALREADY_JOURNALED'};}
      const row=this.sql.prepare('SELECT COUNT(*) n FROM positive_event_hints_v1 WHERE grant_id=?').get(this.grant.id) as {n:number};
      if (!row || row.n>=POSITIVE_EVENT_BUDGET.maxHintRows)
        return {state:'UNKNOWN',reason:'PENDING_HINT_CAP'};
      this.sql.prepare("INSERT INTO positive_event_hints_v1 (grant_id,owner_id,deployer,block_number,block_hash,tx_hash,log_index,state) VALUES(?,?,?,?,?,?,?,'PENDING')")
        .run(this.grant.id,this.grant.ownerId,this.grant.deployer,hint.blockNumber,hint.blockHash,hint.transactionHash,hint.logIndex);
      return {state:'PENDING',reason:'UNVERIFIED_POSITIVE_HINT'};
    });
  }
  /** Reservations are durable in the EXISTING shared ledger before any future RPC. */
  reserveProof(txHash:string, logIndex:number, job:string):HintResult{
    if (!this.validTime())return {state:'UNKNOWN',reason:'GRANT_NOT_CURRENT'};
    if (!hash(txHash)||!Number.isSafeInteger(logIndex)||logIndex<0||logIndex>1000000||
      !/^[0-9a-f-]{36}$/.test(job))return {state:'UNKNOWN',reason:'BAD_PROOF_JOB'};
    const selected=this.withWrite(()=>{
      const row=this.sql.prepare('SELECT state FROM positive_event_hints_v1 WHERE grant_id=? AND tx_hash=? AND log_index=?')
        .get(this.grant.id,txHash,logIndex) as {state:string}|undefined;
      if(!row||row.state!=='PENDING')return false;
      const admitted=this.sql.prepare("SELECT COUNT(*) n FROM positive_event_hints_v1 WHERE grant_id=? AND state IN ('RESERVING','PROOF_SLOTS_RESERVED','UNKNOWN')")
        .get(this.grant.id) as {n:number};
      if(!admitted||admitted.n>=this.grant.maxCandidates)return false;
      this.sql.prepare("UPDATE positive_event_hints_v1 SET state='RESERVING',admitted_at_ms=? WHERE grant_id=? AND tx_hash=? AND log_index=? AND state='PENDING'")
        .run(this.now(),this.grant.id,txHash,logIndex);
      return true;
    });
    if(!selected)return {state:'UNKNOWN',reason:'ALREADY_CLAIMED_OR_GRANT_CAP'};
    // If process crashes during these reservations, RESERVING is terminal UNKNOWN.
    // Never replay a partial admission: already consumed slots cannot be refunded.
    try{
      const deadline=Math.min(this.grant.expiresAtMs,this.now()+POSITIVE_EVENT_BUDGET.maxJobMs);
      for(const method of PROOF_METHOD_RESERVATIONS){
        if(!this.validTime() || this.now()>=deadline)throw Error('PROOF_DEADLINE');
        this.ledger.reserve(job,`POSITIVE_HINT:${method}`,deadline);
      }
    }catch{
      this.sql.prepare("UPDATE positive_event_hints_v1 SET state='UNKNOWN',failure='BUDGET_OR_CRASH_UNCERTAIN' WHERE grant_id=? AND tx_hash=? AND log_index=? AND state='RESERVING'")
        .run(this.grant.id,txHash,logIndex);
      return {state:'UNKNOWN',reason:'SHARED_LEDGER_OR_GRANT_BLOCKED'};
    }
    this.sql.prepare("UPDATE positive_event_hints_v1 SET state='PROOF_SLOTS_RESERVED' WHERE grant_id=? AND tx_hash=? AND log_index=? AND state='RESERVING'")
      .run(this.grant.id,txHash,logIndex);
    return {state:'PROOF_SLOTS_RESERVED',reason:'NOT_CANONICALLY_VERIFIED_NO_CASE_OR_SEND'};
  }
  /** No resets on restart. In-flight RESERVING cannot be retried. */
  recoverInterrupted(){
    return this.sql.prepare("UPDATE positive_event_hints_v1 SET state='UNKNOWN',failure='INTERRUPTED_RESERVATION' WHERE grant_id=? AND state='RESERVING'")
      .run(this.grant.id).changes;
  }
  coverage(){return {kind:'POSITIVE_EVENTS_ONLY',absenceProven:false,quietIntervals:'UNKNOWN',disconnectedIntervals:'UNKNOWN',
    backlogCoverage:'UNKNOWN',casePublication:false,telegramDelivery:false} as const;}
}
