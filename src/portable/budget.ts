import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { lstatSync, statfsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Limits } from './config.js';

export const BUDGET_SCHEMA = `
CREATE TABLE budget_meta (singleton INTEGER PRIMARY KEY CHECK(singleton=1), version INTEGER NOT NULL CHECK(version=1), last_day TEXT NOT NULL);
INSERT INTO budget_meta VALUES(1,1,'1970-01-01');
CREATE TABLE collector_jobs (job_id TEXT PRIMARY KEY, start_block TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('RUNNING','SUCCEEDED','FAILED','INTERRUPTED')), started_at_ms INTEGER NOT NULL, ended_at_ms INTEGER, stop_code TEXT);
CREATE TABLE rpc_attempts (attempt_id INTEGER PRIMARY KEY, job_id TEXT NOT NULL REFERENCES collector_jobs(job_id), day TEXT NOT NULL, method TEXT NOT NULL, reserved_at_ms INTEGER NOT NULL);
CREATE INDEX rpc_attempts_day ON rpc_attempts(day);
CREATE INDEX rpc_attempts_job ON rpc_attempts(job_id);
`;


/** Additive, owner-approved model for one proof grant; no automatic activation.
 * Milli-CU units avoid floating-point budget drift. WS accounting is NOT included. */
export const TRIPWIRE_PROOF_BUDGET_SCHEMA = `
CREATE TABLE IF NOT EXISTS tripwire_proof_grants_v1 (
  grant_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE, generation TEXT NOT NULL UNIQUE,
  deployer TEXT NOT NULL, created_at_ms INTEGER NOT NULL,
  stops_at_ms INTEGER NOT NULL, max_milli_cu INTEGER NOT NULL CHECK(max_milli_cu BETWEEN 1 AND 10000000),
  reserved_milli_cu INTEGER NOT NULL DEFAULT 0 CHECK(reserved_milli_cu BETWEEN 0 AND max_milli_cu)
);
`;
const TRIPWIRE_PROOF_METHODS = [
  'eth_getBlockByNumber','eth_getBlockByNumber','eth_getBlockByNumber',
  'eth_getLogs','eth_getBlockReceipts','eth_getBlockByNumber'
] as const;
const TRIPWIRE_PROOF_MILLI_CU = 400_000;
/** Conservative 24h subscription reservation: 8 admission requests (800 CU),
 * 3 connection/control operations (60 CU) and 72 KiB of frames (2949.12 CU).
 * This is a model, NOT a provider invoice. No automatic network connection. */
export const TRIPWIRE_STREAM_MILLI_CU = 3_809_120;
export const TRIPWIRE_STREAM_MAX_BYTES = 72 * 1024;
export const TRIPWIRE_STREAM_FRAME_MAX_BYTES = 8192;
export const TRIPWIRE_STREAM_SCHEMA = `
CREATE TABLE IF NOT EXISTS tripwire_stream_reservations_v1 (
  grant_id TEXT PRIMARY KEY REFERENCES tripwire_proof_grants_v1(grant_id),
  owner_id TEXT NOT NULL, generation TEXT NOT NULL UNIQUE, deployer TEXT NOT NULL,
  reserved_at_ms INTEGER NOT NULL, received_bytes INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL CHECK(state IN ('ADMITTED','UNKNOWN','STOPPED'))
);
`;


export class BudgetLedger {
  private readonly db: Database.Database;
  private readonly inode: number;
  constructor(private readonly path: string, private readonly ceiling: Limits, private readonly now = Date.now) {
    // Missing ledger is an error, never an implicit reset.
    this.db = new Database(path, { fileMustExist: true, timeout: 0 });
    this.db.pragma('foreign_keys=ON');
    this.db.pragma('synchronous=FULL');
    this.db.pragma('journal_mode=WAL');
    this.inode = lstatSync(path).ino;
    const pageSize = this.db.pragma('page_size', { simple: true }) as number;
    this.db.pragma(`max_page_count = ${Math.floor(64 * 1024 * 1024 / pageSize)}`);
    if (this.db.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('BUDGET_CORRUPT');
    const meta = this.db.prepare('SELECT version FROM budget_meta WHERE singleton=1').get() as { version: number } | undefined;
    if (meta?.version !== 1 || (this.db.prepare('PRAGMA foreign_key_check').all()).length) throw new Error('BUDGET_INVALID');
  }
  start(startBlock: bigint): string {
    return this.db.transaction(() => {
      // The CLI holds a kernel flock before calling this method. Old running
      // work can only be a crashed process, never a second active collector.
      this.db.prepare("UPDATE collector_jobs SET state='INTERRUPTED',ended_at_ms=?,stop_code='PROCESS_INTERRUPTED' WHERE state='RUNNING'").run(this.now());
      const id = randomUUID();
      this.db.prepare("INSERT INTO collector_jobs(job_id,start_block,state,started_at_ms) VALUES(?,?,'RUNNING',?)").run(id, startBlock.toString(), this.now());
      return id;
    }).immediate();
  }
  reserve(job: string, method: string, deadline: number): void {
    const file = lstatSync(this.path);
    const disk = statfsSync(dirname(this.path));
    if (file.isSymbolicLink() || file.ino !== this.inode || disk.bavail * disk.bsize < 64 * 1024 * 1024) throw new Error('BUDGET_STORAGE_UNAVAILABLE');
    this.db.transaction(() => {
      const time = this.now();
      if (time >= deadline) throw new Error('RUNTIME_EXHAUSTED');
      if (this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='portable_budget_recovery'").get()) {
        const recovery = this.db.prepare('SELECT not_before_ms FROM portable_budget_recovery WHERE singleton=1').get() as { not_before_ms: number } | undefined;
        if (!recovery || !Number.isSafeInteger(recovery.not_before_ms) || time < recovery.not_before_ms) throw new Error('RESTORED_BUDGET_DAY_UNVERIFIED');
      }
      const row = this.db.prepare("SELECT started_at_ms FROM collector_jobs WHERE job_id=? AND state='RUNNING'").get(job) as { started_at_ms: number } | undefined;
      if (!row || time < row.started_at_ms || time - row.started_at_ms >= this.ceiling.runtimeMs) throw new Error('JOB_BUDGET_INVALID');
      const day = new Date(time).toISOString().slice(0, 10);
      const meta = this.db.prepare('SELECT last_day,version FROM budget_meta WHERE singleton=1').get() as { last_day: string; version: number } | undefined;
      if (!meta || meta.version !== 1 || day < meta.last_day) throw new Error('BUDGET_CLOCK_OR_META_INVALID');
      const perDay = (this.db.prepare('SELECT count(*) n FROM rpc_attempts WHERE day=?').get(day) as { n: number }).n;
      const perRun = (this.db.prepare('SELECT count(*) n FROM rpc_attempts WHERE job_id=?').get(job) as { n: number }).n;
      if (perDay >= this.ceiling.attemptsPerDay || perRun >= this.ceiling.attemptsPerRun) throw new Error('RPC_BUDGET_EXHAUSTED');
      this.db.prepare('UPDATE budget_meta SET last_day=? WHERE singleton=1').run(day);
      this.db.prepare('INSERT INTO rpc_attempts(job_id,day,method,reserved_at_ms) VALUES(?,?,?,?)').run(job, day, method, time);
    }).immediate(); // Durable BEFORE fetch. Errors and interrupted attempts count.
  }

  /** One-way 11-slot/3809.12-CU subscription-envelope admission.
   * Caller MUST hold the existing single-writer process lock. No I/O is made.
   * Setup, reconnects, and all incoming data must fit this single envelope. */
  reserveTripwireStream(job: string, grantId: string, deadline: number,
    scope: { ownerId:string; generation:string; deployer:string }): void {
    const file=lstatSync(this.path),disk=statfsSync(dirname(this.path));
    if (file.isSymbolicLink() || file.ino!==this.inode ||
      disk.bavail*disk.bsize<64*1024*1024) throw Error('BUDGET_STORAGE_UNAVAILABLE');
    this.db.exec(TRIPWIRE_STREAM_SCHEMA);
    this.db.transaction(()=>{
      const time=this.now();
      if(!Number.isSafeInteger(time)||time>=deadline) throw Error('TRIPWIRE_STREAM_DEADLINE');
      if(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='portable_budget_recovery'").get()){
        const recovery=this.db.prepare('SELECT not_before_ms FROM portable_budget_recovery WHERE singleton=1')
          .get() as {not_before_ms:number}|undefined;
        if(!recovery||time<recovery.not_before_ms)throw Error('RESTORED_BUDGET_DAY_UNVERIFIED');
      }
      const jobRow=this.db.prepare("SELECT started_at_ms FROM collector_jobs WHERE job_id=? AND state='RUNNING'")
        .get(job) as {started_at_ms:number}|undefined;
      if(!jobRow||time<jobRow.started_at_ms||time-jobRow.started_at_ms>=this.ceiling.runtimeMs||
        deadline>jobRow.started_at_ms+this.ceiling.runtimeMs)throw Error('JOB_BUDGET_INVALID');
      const grant=this.db.prepare('SELECT * FROM tripwire_proof_grants_v1 WHERE grant_id=?')
        .get(grantId) as {owner_id:string;generation:string;deployer:string;stops_at_ms:number;
          max_milli_cu:number;reserved_milli_cu:number}|undefined;
      if(!grant||grant.owner_id!==scope.ownerId||grant.generation!==scope.generation||
        grant.deployer!==scope.deployer||time>=grant.stops_at_ms||
        grant.reserved_milli_cu+TRIPWIRE_STREAM_MILLI_CU>grant.max_milli_cu)
        throw Error('TRIPWIRE_STREAM_GRANT_INVALID');
      const day=new Date(time).toISOString().slice(0,10);
      const meta=this.db.prepare('SELECT last_day,version FROM budget_meta WHERE singleton=1')
        .get() as {last_day:string;version:number}|undefined;
      if(!meta||meta.version!==1||day<meta.last_day)throw Error('BUDGET_CLOCK_OR_META_INVALID');
      const usedDay=(this.db.prepare('SELECT count(*) n FROM rpc_attempts WHERE day=?').get(day) as {n:number}).n;
      const usedJob=(this.db.prepare('SELECT count(*) n FROM rpc_attempts WHERE job_id=?').get(job) as {n:number}).n;
      if(usedDay+11>Math.min(100,this.ceiling.attemptsPerDay)||
        usedJob+11>Math.min(50,this.ceiling.attemptsPerRun))throw Error('RPC_BUDGET_EXHAUSTED');
      // UNIQUE grant/generation: never re-reserve a new 24h envelope on restart.
      this.db.prepare(`INSERT INTO tripwire_stream_reservations_v1
        (grant_id,owner_id,generation,deployer,reserved_at_ms,state)
        VALUES (?,?,?,?,?,'ADMITTED')`).run(grantId,scope.ownerId,scope.generation,scope.deployer,time);
      this.db.prepare('UPDATE tripwire_proof_grants_v1 SET reserved_milli_cu=reserved_milli_cu+? WHERE grant_id=?')
        .run(TRIPWIRE_STREAM_MILLI_CU,grantId);
      this.db.prepare('UPDATE budget_meta SET last_day=? WHERE singleton=1').run(day);
      const statement=this.db.prepare('INSERT INTO rpc_attempts(job_id,day,method,reserved_at_ms) VALUES(?,?,?,?)');
      for(let i=0;i<11;i++)statement.run(job,day,`tripwire_stream_reserved_${i+1}`,time);
    }).immediate();
  }

  /** Durable byte charging happens before processing a frame; it never creates
   * another allowance. Overflow fences the stream UNKNOWN, including duplicates. */
  chargeTripwireStreamFrame(grantId:string, scope:{ownerId:string;generation:string;deployer:string},
    bytes:number):void{
    if(!Number.isSafeInteger(bytes)||bytes<0||bytes>1024*1024)throw Error('TRIPWIRE_FRAME_SIZE_INVALID');
    this.db.transaction(()=>{
      const row=this.db.prepare('SELECT * FROM tripwire_stream_reservations_v1 WHERE grant_id=?')
        .get(grantId) as {owner_id:string;generation:string;deployer:string;
          received_bytes:number;state:string}|undefined;
      const grant=this.db.prepare('SELECT stops_at_ms FROM tripwire_proof_grants_v1 WHERE grant_id=?')
        .get(grantId) as {stops_at_ms:number}|undefined;
      if(!row||!grant||row.owner_id!==scope.ownerId||row.generation!==scope.generation||
        row.deployer!==scope.deployer||row.state!=='ADMITTED'||this.now()>=grant.stops_at_ms)
        throw Error('TRIPWIRE_STREAM_INACTIVE');
      if(bytes>TRIPWIRE_STREAM_FRAME_MAX_BYTES||
        row.received_bytes+bytes>TRIPWIRE_STREAM_MAX_BYTES){
        this.db.prepare("UPDATE tripwire_stream_reservations_v1 SET state='UNKNOWN' WHERE grant_id=?")
          .run(grantId);
        return;
      }
      this.db.prepare('UPDATE tripwire_stream_reservations_v1 SET received_bytes=received_bytes+? WHERE grant_id=?')
        .run(bytes,grantId);
    }).immediate();
    const state=this.db.prepare('SELECT state FROM tripwire_stream_reservations_v1 WHERE grant_id=?')
      .get(grantId) as {state:string};
    if(state.state!=='ADMITTED')throw Error('TRIPWIRE_STREAM_BYTES_EXHAUSTED');
  }

  stopTripwireStream(grantId:string):void {
    this.db.prepare("UPDATE tripwire_stream_reservations_v1 SET state='STOPPED' WHERE grant_id=?")
      .run(grantId);
  }

  /** Precondition: the parent CLI holds its exclusive writer lock.
   * Explicit grant creation alone authorizes no RPC, WS or notifications. */
  createTripwireProofGrant(grant: {
    grantId: string; ownerId: string; generation: string; deployer: string;
    stopsAtMs: number; maxMilliCu: number; approved: boolean;
  }): void {
    const now = this.now();
    if (!grant.approved || !/^[A-Za-z0-9_-]{1,80}$/.test(grant.grantId) ||
      !/^telegram:[1-9][0-9]*$/.test(grant.ownerId) ||
      !/^[0-9a-f-]{36}$/.test(grant.generation) || !/^0x[0-9a-f]{40}$/.test(grant.deployer) ||
      !Number.isSafeInteger(now) || !Number.isSafeInteger(grant.stopsAtMs) ||
      grant.stopsAtMs <= now || grant.stopsAtMs - now > 86_400_000 ||
      !Number.isSafeInteger(grant.maxMilliCu) || grant.maxMilliCu < 1 || grant.maxMilliCu > 10_000_000) {
      throw new Error('TRIPWIRE_PROOF_GRANT_INVALID');
    }
    this.db.exec(TRIPWIRE_PROOF_BUDGET_SCHEMA);
    this.db.transaction(() => {
      this.db.prepare(`INSERT OR IGNORE INTO tripwire_proof_grants_v1
        (grant_id,owner_id,generation,deployer,created_at_ms,stops_at_ms,max_milli_cu)
        VALUES (?,?,?,?,?,?,?)`).run(grant.grantId,grant.ownerId,grant.generation,grant.deployer,now,grant.stopsAtMs,grant.maxMilliCu);
      const persisted = this.db.prepare('SELECT * FROM tripwire_proof_grants_v1 WHERE grant_id=?')
        .get(grant.grantId) as {
          grant_id:string;owner_id:string;generation:string;deployer:string;created_at_ms:number;stops_at_ms:number;max_milli_cu:number;
        } | undefined;
      if (!persisted || persisted.owner_id !== grant.ownerId || persisted.generation !== grant.generation ||
        persisted.deployer !== grant.deployer || persisted.stops_at_ms !== grant.stopsAtMs ||
        persisted.max_milli_cu !== grant.maxMilliCu) throw new Error('TRIPWIRE_PROOF_GRANT_CONFLICT');
    }).immediate();
  }

  /** One proof is exactly six pre-reserved physical slots and 400 modeled CU.
   * A crash or rejected provider response never refunds the reservation.
   * WS setup/bytes must be charged separately before any real mounting. */
  reserveTripwireProof(job: string, grantId: string, deadline: number,
    scope: {ownerId:string;generation:string;deployer:string}): void {
    const file = lstatSync(this.path), disk = statfsSync(dirname(this.path));
    if (file.isSymbolicLink() || file.ino !== this.inode || disk.bavail * disk.bsize < 64 * 1024 * 1024)
      throw new Error('BUDGET_STORAGE_UNAVAILABLE');
    this.db.transaction(() => {
      const now = this.now();
      if (!Number.isSafeInteger(now) || now >= deadline) throw new Error('RUNTIME_EXHAUSTED');
      const recovery = this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='portable_budget_recovery'").get();
      if (recovery) {
        const state = this.db.prepare('SELECT not_before_ms FROM portable_budget_recovery WHERE singleton=1')
          .get() as {not_before_ms:number}|undefined;
        if (!state || !Number.isSafeInteger(state.not_before_ms) || now < state.not_before_ms)
          throw new Error('RESTORED_BUDGET_DAY_UNVERIFIED');
      }
      const jobRow = this.db.prepare("SELECT started_at_ms FROM collector_jobs WHERE job_id=? AND state='RUNNING'")
        .get(job) as {started_at_ms:number}|undefined;
      if (!jobRow || now < jobRow.started_at_ms || now-jobRow.started_at_ms >= this.ceiling.runtimeMs ||
        deadline > jobRow.started_at_ms + this.ceiling.runtimeMs)
        throw new Error('JOB_BUDGET_INVALID');
      const grant = this.db.prepare('SELECT owner_id,generation,deployer,stops_at_ms,max_milli_cu,reserved_milli_cu FROM tripwire_proof_grants_v1 WHERE grant_id=?')
        .get(grantId) as {owner_id:string;generation:string;deployer:string;stops_at_ms:number;max_milli_cu:number;reserved_milli_cu:number}|undefined;
      if (!grant || grant.owner_id !== scope.ownerId || grant.generation !== scope.generation ||
        grant.deployer !== scope.deployer || now >= grant.stops_at_ms || deadline > grant.stops_at_ms ||
        grant.reserved_milli_cu + TRIPWIRE_PROOF_MILLI_CU > grant.max_milli_cu)
        throw new Error('TRIPWIRE_PROOF_BUDGET_EXHAUSTED');
      const day = new Date(now).toISOString().slice(0,10);
      const meta = this.db.prepare('SELECT last_day,version FROM budget_meta WHERE singleton=1')
        .get() as {last_day:string;version:number}|undefined;
      if (!meta || meta.version !== 1 || day < meta.last_day) throw new Error('BUDGET_CLOCK_OR_META_INVALID');
      const usedDay = (this.db.prepare('SELECT count(*) n FROM rpc_attempts WHERE day=?').get(day) as {n:number}).n;
      const usedJob = (this.db.prepare('SELECT count(*) n FROM rpc_attempts WHERE job_id=?').get(job) as {n:number}).n;
      if (usedDay+6 > Math.min(100,this.ceiling.attemptsPerDay) ||
        usedJob+6 > Math.min(50,this.ceiling.attemptsPerRun))
        throw new Error('RPC_BUDGET_EXHAUSTED');
      this.db.prepare('UPDATE budget_meta SET last_day=? WHERE singleton=1').run(day);
      this.db.prepare('UPDATE tripwire_proof_grants_v1 SET reserved_milli_cu=reserved_milli_cu+? WHERE grant_id=?')
        .run(TRIPWIRE_PROOF_MILLI_CU,grantId);
      for (const method of TRIPWIRE_PROOF_METHODS) {
        this.db.prepare('INSERT INTO rpc_attempts(job_id,day,method,reserved_at_ms) VALUES(?,?,?,?)')
          .run(job,day,method,now);
      }
    }).immediate();
  }

  finish(job: string, success: boolean): void {
    this.db.prepare('UPDATE collector_jobs SET state=?,ended_at_ms=?,stop_code=? WHERE job_id=? AND state=\'RUNNING\'')
      .run(success ? 'SUCCEEDED' : 'FAILED', this.now(), success ? null : 'BOUNDED_RUN_FAILED', job);
  }
  close(): void { this.db.close(); }
}
