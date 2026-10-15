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
  finish(job: string, success: boolean): void {
    this.db.prepare('UPDATE collector_jobs SET state=?,ended_at_ms=?,stop_code=? WHERE job_id=? AND state=\'RUNNING\'')
      .run(success ? 'SUCCEEDED' : 'FAILED', this.now(), success ? null : 'BOUNDED_RUN_FAILED', job);
  }
  close(): void { this.db.close(); }
}
