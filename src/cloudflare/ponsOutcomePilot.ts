import { canonicalJson } from '../evidence/canonical.js';
import type { D1DatabaseLike } from './d1Types.js';
import type { CloudflareSyncEnv } from './syncQueue.js';
import { D1PonsOutcomeObservationStore } from './ponsOutcomeStore.js';
import { D1Store } from './d1Store.js';
import { D1RuntimeStateStore } from './runtimeState.js';
import { deriveEventId, deriveLaunchId, launchAuthorityJson } from '../core/identity.js';
import { PONS_V2_FACTORY } from '../pons/chain.js';
import type { PonsOutcomeObservationReceipt, PonsOutcomeObservationStore } from '../pons/outcomeReceipts.js';

export const OUTCOME_RPC_LIMIT = 40;
export const OUTCOME_WORK_MS = 15_000;
export const OUTCOME_DUE_SQL = `SELECT * FROM pons_outcome_jobs INDEXED BY idx_pons_outcome_due
 WHERE pilot_id=? AND state='READY' AND due_ms<=?
 ORDER BY due_ms,launch_id,horizon_ms LIMIT 1`;
interface Pilot { pilot_id:string; enabled:number; start_block:number; valid_from_ms:number; expires_ms:number; rpc_remaining:number; cycles_remaining:number; pending_cycle:string|null; pending_at_ms:number|null }
export interface OutcomeJob {pilot_id:string; launch_id:string; horizon_ms:number; launch_timestamp_ms:number; due_ms:number; attempts:number}

export function outcomePilotConfigured(env:CloudflareSyncEnv):boolean {
  return env.BINRAT_PONS_READ_ONLY==='true' && env.BINRAT_PONS_OUTCOME_ENABLED==='true' &&
    env.BINRAT_PONS_OUTCOME_COLLECT_AUTHORIZED==='true' &&
    /^[A-Za-z0-9_-]{1,64}$/.test(env.BINRAT_PONS_OUTCOME_PILOT_ID ?? '') &&
    (env.BINRAT_PONS_OUTCOME_MAX_PER_CYCLE===undefined || env.BINRAT_PONS_OUTCOME_MAX_PER_CYCLE==='1');
}

export class D1OutcomePilot {
  constructor(private readonly env:CloudflareSyncEnv, private readonly now:()=>number) {}
  private get db():D1DatabaseLike {return this.env.DB;}
  async authorize():Promise<Pilot> {
    if (!outcomePilotConfigured(this.env)) throw new Error('PONS_OUTCOME_NOT_AUTHORIZED');
    const p=await this.db.prepare('SELECT * FROM pons_outcome_pilots WHERE pilot_id=? LIMIT 1')
      .bind(this.env.BINRAT_PONS_OUTCOME_PILOT_ID).first<Pilot>();
    const now=this.now();
    if (!p || p.enabled!==1 || !Number.isSafeInteger(now) ||
      ![p.start_block,p.valid_from_ms,p.expires_ms,p.rpc_remaining,p.cycles_remaining].every(Number.isSafeInteger) ||
      p.start_block<0 || p.valid_from_ms<0 || now<p.valid_from_ms || now>=p.expires_ms ||
      p.expires_ms-p.valid_from_ms>172800000 || p.rpc_remaining<0 || p.rpc_remaining>1200 ||
      p.cycles_remaining<0 || p.cycles_remaining>120) throw new Error('PONS_OUTCOME_NOT_AUTHORIZED');
    return p;
  }
  async next():Promise<OutcomeJob|null> {
    const p=await this.authorize();
    return this.db.prepare(OUTCOME_DUE_SQL).bind(p.pilot_id,this.now()).first<OutcomeJob>();
  }
  async schedule(cycleId:string):Promise<boolean> {
    const p=await this.authorize();
    if (!await this.next()) return false;
    const now=this.now();
    const r=await this.db.prepare(`UPDATE pons_outcome_pilots SET pending_cycle=?,pending_at_ms=?,next_enqueue_ms=?
      WHERE pilot_id=? AND enabled=1 AND valid_from_ms<=? AND expires_ms>? AND next_enqueue_ms<=?
      AND cycles_remaining>0 AND rpc_remaining>=?`)
      .bind(cycleId,now,now+60000,p.pilot_id,now,now,now,OUTCOME_RPC_LIMIT).run();
    if (!r.success) throw new Error('PONS_OUTCOME_SCHEDULE_FAILED');
    return r.meta?.changes===1;
  }
  async consume(cycleId:string):Promise<boolean> {
    const p=await this.authorize();const now=this.now();
    const r=await this.db.prepare(`UPDATE pons_outcome_pilots SET pending_cycle=NULL,
      rpc_remaining=rpc_remaining-?,cycles_remaining=cycles_remaining-1
      WHERE pilot_id=? AND enabled=1 AND expires_ms>? AND pending_cycle=?
      AND pending_at_ms BETWEEN ? AND ? AND rpc_remaining>=? AND cycles_remaining>0`)
      .bind(OUTCOME_RPC_LIMIT,p.pilot_id,now,cycleId,now-60000,now,OUTCOME_RPC_LIMIT).run();
    if (!r.success) throw new Error('PONS_OUTCOME_RESERVE_FAILED');
    return r.meta?.changes===1;
  }
  async refundUnused(calls:number):Promise<void> {
    if (!Number.isSafeInteger(calls) || calls<0 || calls>OUTCOME_RPC_LIMIT) throw new Error('PONS_OUTCOME_ACCOUNTING_INVALID');
    const r=await this.db.prepare('UPDATE pons_outcome_pilots SET rpc_remaining=rpc_remaining+? WHERE pilot_id=?')
      .bind(OUTCOME_RPC_LIMIT-calls,this.env.BINRAT_PONS_OUTCOME_PILOT_ID).run();
    if (!r.success) throw new Error('PONS_OUTCOME_ACCOUNTING_FAILED');
  }
  async healthy():Promise<void> {
    await this.authorize();
    const runtime=await new D1RuntimeStateStore(this.db,4663).get();
    const cp=await new D1PonsOutcomeObservationStore(this.db).getCheckpoint();
    if (!runtime || !runtime.sourceVerified || !runtime.liveCaughtUp || runtime.lastSyncError ||
      this.now()-runtime.updatedAtMs<0 || this.now()-runtime.updatedAtMs>120000 ||
      !cp || runtime.targetBlock!==cp.blockNumber) throw new Error('PONS_OUTCOME_SCANNER_STALE');
  }
  async attempt(job:OutcomeJob):Promise<void> {
    await this.authorize();
    const r=await this.db.prepare(`UPDATE pons_outcome_jobs SET attempts=attempts+1
      WHERE pilot_id=? AND launch_id=? AND horizon_ms=? AND state='READY' AND attempts<2`)
      .bind(job.pilot_id,job.launch_id,job.horizon_ms).run();
    if (!r.success || r.meta?.changes!==1) throw new Error('PONS_OUTCOME_ATTEMPTS_EXHAUSTED');
  }
  async finish(job:OutcomeJob,code?:string):Promise<void> {
    // Failure bookkeeping is allowed after revocation; it cannot admit new work.
    const r=await this.db.prepare(`UPDATE pons_outcome_jobs SET state=CASE
      WHEN ? IS NULL THEN 'DONE' WHEN attempts>=2 OR ?=0 THEN 'FAILED' ELSE 'READY' END,last_error=?
      WHERE pilot_id=? AND launch_id=? AND horizon_ms=?`)
      .bind(code??null,code && /^(PONS_OUTCOME_RPC_TIMEOUT|SYNC_HTTP_429|SYNC_HTTP_5\d\d|SYNC_TIMEOUT_ERROR|SYNC_ABORT_ERROR|SYNC_HTTP_REQUEST_ERROR|SYNC_NETWORK_ERROR)$/.test(code)?1:0,code??null,job.pilot_id,job.launch_id,job.horizon_ms).run();
    if (!r.success) throw new Error('PONS_OUTCOME_JOB_FINISH_FAILED');
  }
  async store(job:OutcomeJob,check:()=>Promise<void>,owner:string):Promise<PonsOutcomeObservationStore> {
    const p=await this.authorize();
    const launch=await new D1Store(this.db,4663).getLaunch(job.launch_id);
    if (!launch || launch.source!=='PONS_V2' || launch.chainId!==4663 ||
      launch.launcher.toLowerCase()!==PONS_V2_FACTORY.toLowerCase() ||
      launch.blockNumber<=BigInt(p.start_block) || job.launch_timestamp_ms<p.valid_from_ms ||
      job.due_ms!==job.launch_timestamp_ms+job.horizon_ms ||
      ![300000,3600000,86400000].includes(job.horizon_ms) ||
      launch.launchId!==await deriveLaunchId(launch) || launch.eventId!==await deriveEventId(launch)) {
      throw new Error('PONS_OUTCOME_JOB_SOURCE_INVALID');
    }
    const authority=await this.db.prepare('SELECT authority_json FROM launches WHERE launch_id=? LIMIT 1').bind(job.launch_id).first<{authority_json:string}>();
    if (!authority || authority.authority_json.length>8192) throw new Error('PONS_OUTCOME_JOB_SOURCE_INVALID');
    const raw=JSON.parse(authority.authority_json);
    delete raw.observedAtMs; // The existing A2 contract accepts this one legacy ingestion field.
    if (canonicalJson(raw)!==launchAuthorityJson(launch)) throw new Error('PONS_OUTCOME_JOB_SOURCE_INVALID');
    const base=new D1PonsOutcomeObservationStore(this.db);
    return {
      getCheckpoint:()=>base.getCheckpoint(),
      listCandidates:async()=>[{launchId:launch.launchId,token:launch.token,curve:launch.pool,blockNumber:launch.blockNumber,blockHash:launch.blockHash}],
      listForLaunch:async id=>{
        const receipts=await base.listForLaunch(id);
        for (const r of receipts) {
          if (r.launchId!==launch.launchId || r.token!==launch.token || r.curve!==launch.pool ||
            r.targetTimestampMs!==job.launch_timestamp_ms+r.horizonMs) throw new Error('PONS_OUTCOME_STORED_BINDING_INVALID');
        }
        return receipts;
      },
      put:async(receipt:PonsOutcomeObservationReceipt)=>{
        await check();await this.healthy();
        if (receipt.targetTimestampMs!==job.due_ms || receipt.horizonMs!==job.horizon_ms) throw new Error('PONS_OUTCOME_JOB_TARGET_MISMATCH');
        // Authorization predicate shares the receipt INSERT statement, closing the revoke/write race.
        return base.putAuthorized(receipt,p.pilot_id,this.now(),owner);
      }
    };
  }
}
