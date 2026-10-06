/** Dedicated local replay journal. No production adapters or delivery authority. */
import Database from 'better-sqlite3';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { assertContract } from './contracts.js';
import { replay, type EvalCase, type JobReceipt } from './offline.js';

export const MAX_LOCAL_ADVANCES = 32;
const APPLICATION_ID = 0x42524c31;
type Action = { kind: 'CREATE' } | { kind: 'ADVANCE'; throughBlock: string } | { kind: 'CANCEL' };
export type LocalPhase = 'READY' | 'WAITING' | 'FOUND' | 'EXPIRED' | 'EXHAUSTED' | 'CANCELLED' | 'HALTED';
export interface LocalSnapshot {
  schemaVersion: 'binrat.local-rat-job/1'; mode: 'LOCAL_SYNTHETIC_REPLAY'; jobId: string;
  sourceDigest: string; revision: number; previousDigest: string | null; digest: string; action: Action;
  phase: LocalPhase; outcome: 'PENDING' | 'SUPPORTED_FINDING' | 'NO_FINDING_IN_REPLAY_WINDOW' |
    'INCOMPLETE_COVERAGE' | 'TOOL_BUDGET_EXHAUSTED' | 'LOCAL_STEP_LIMIT' | 'OWNER_CANCELLED' | 'SOURCE_REJECTED';
  advances: number; receipt: JobReceipt | null; failure: string | null;
  localCase: { provenance: 'SYNTHETIC_OFFLINE_REPLAY'; findingId: string; diff: NonNullable<JobReceipt['caseDiff']> } | null;
  notification: { id: string; state: 'PREPARED_ONLY'; deliveryAuthorized: false; target: 'UNASSIGNED'; text: string } | null;
}
const terminal = (phase: LocalPhase): boolean => phase !== 'READY' && phase !== 'WAITING';
const safeFailure = (error: unknown): string => error instanceof Error && /^[A-Z][A-Z0-9_]{0,100}$/.test(error.message)
  ? error.message : 'REPLAY_VALIDATION_FAILED';

function boundary(source: EvalCase, value: string, previous: LocalSnapshot): void {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(value) || BigInt(value) < BigInt(source.job.window.fromBlock) ||
      BigInt(value) > BigInt(source.job.window.toBlock) ||
      (previous.receipt && BigInt(value) < BigInt(previous.receipt.throughBlock))) throw new Error('LOCAL_BOUNDARY_INVALID');
}

async function transition(source: EvalCase, sourceDigest: string, previous: LocalSnapshot | null, action: Action): Promise<LocalSnapshot> {
  if (!action || typeof action !== 'object' || Array.isArray(action) ||
      !['CREATE', 'ADVANCE', 'CANCEL'].includes(action.kind) ||
      Object.keys(action).sort().join(',') !== (action.kind === 'ADVANCE' ? 'kind,throughBlock' : 'kind') ||
      (action.kind === 'ADVANCE' && typeof action.throughBlock !== 'string')) throw new Error('LOCAL_ACTION_INVALID');
  const state: Omit<LocalSnapshot, 'digest'> = {
    schemaVersion: 'binrat.local-rat-job/1', mode: 'LOCAL_SYNTHETIC_REPLAY', jobId: source.job.jobId,
    sourceDigest, revision: previous ? previous.revision + 1 : 0, previousDigest: previous?.digest ?? null, action,
    phase: previous?.phase ?? 'READY', outcome: previous?.outcome ?? 'PENDING', advances: previous?.advances ?? 0,
    receipt: previous?.receipt ?? null, failure: previous?.failure ?? null,
    localCase: previous?.localCase ?? null, notification: previous?.notification ?? null
  };
  if (action.kind === 'CREATE') {
    if (previous) throw new Error('LOCAL_TRANSITION_INVALID');
  } else {
    if (!previous || terminal(previous.phase)) throw new Error('LOCAL_TRANSITION_INVALID');
    if (action.kind === 'CANCEL') { state.phase = 'CANCELLED'; state.outcome = 'OWNER_CANCELLED'; }
    else {
      boundary(source, action.throughBlock, previous);
      if (previous.advances >= MAX_LOCAL_ADVANCES || previous.receipt?.throughBlock === action.throughBlock) {
        throw new Error('LOCAL_TRANSITION_INVALID');
      }
      state.advances++;
      try { state.receipt = await replay(source, { throughBlock: action.throughBlock }); }
      catch (error) { state.phase = 'HALTED'; state.outcome = 'SOURCE_REJECTED'; state.failure = safeFailure(error); }
      if (state.phase !== 'HALTED') {
        const receipt = state.receipt!;
        if (receipt.status === 'EXHAUSTED') { state.phase = 'EXHAUSTED'; state.outcome = 'TOOL_BUDGET_EXHAUSTED'; }
        else if (receipt.alert.decision === 'ALERT' && receipt.caseDiff && receipt.alert.findingId) {
          state.phase = 'FOUND'; state.outcome = 'SUPPORTED_FINDING';
          state.localCase = { provenance: 'SYNTHETIC_OFFLINE_REPLAY', findingId: receipt.alert.findingId, diff: receipt.caseDiff };
          state.notification = {
            id: await sha256Hex({ jobId: source.job.jobId, findingId: receipt.alert.findingId }),
            state: 'PREPARED_ONLY', deliveryAuthorized: false, target: 'UNASSIGNED',
            text: `Synthetic replay: a funded recipient later deployed on Pons. Finding ${receipt.alert.findingId}. Declared fixture window only.`
          };
        } else if (action.throughBlock === source.job.window.toBlock) {
          state.phase = 'EXPIRED'; state.outcome = receipt.status === 'DEGRADED' ? 'INCOMPLETE_COVERAGE' : 'NO_FINDING_IN_REPLAY_WINDOW';
        } else if (state.advances === MAX_LOCAL_ADVANCES) { state.phase = 'EXHAUSTED'; state.outcome = 'LOCAL_STEP_LIMIT'; }
        else { state.phase = 'WAITING'; state.outcome = 'PENDING'; }
      }
    }
  }
  return { ...state, digest: await sha256Hex(state) };
}

/** Hashes detect accidental edits; deterministic replay also rejects re-sealed false counters/facts.
 * The local file is not an externally authenticated owner authority or billing record. */
export class LocalRatJobs {
  private readonly db: Database.Database;
  constructor(path: string, options: { create?: boolean; readOnly?: boolean } = {}) {
    if (!path || path === ':memory:' || path.startsWith('file:')) throw new Error('LOCAL_DB_PATH_REQUIRED');
    this.db = new Database(path, { readonly: options.readOnly ?? false, fileMustExist: !options.create });
    try {
      const application = this.db.pragma('application_id', { simple: true });
      const version = this.db.pragma('user_version', { simple: true });
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      if (application === 0 && version === 0 && tables.length === 0 && options.create && !options.readOnly) {
        this.db.transaction(() => {
          this.db.exec(`CREATE TABLE local_rat_jobs (job_id TEXT PRIMARY KEY, source_json TEXT NOT NULL, source_digest TEXT NOT NULL, revision INTEGER NOT NULL);
            CREATE TABLE local_rat_journal (job_id TEXT NOT NULL REFERENCES local_rat_jobs(job_id), revision INTEGER NOT NULL,
              snapshot_json TEXT NOT NULL, PRIMARY KEY(job_id, revision));`);
          this.db.pragma(`application_id = ${APPLICATION_ID}`); this.db.pragma('user_version = 1');
        })();
      } else if (application !== APPLICATION_ID || version !== 1) throw new Error('LOCAL_DB_OWNERSHIP_REQUIRED');
      if (!options.readOnly) { this.db.pragma('journal_mode = WAL'); this.db.pragma('synchronous = FULL'); }
      this.db.pragma('foreign_keys = ON'); this.db.pragma('busy_timeout = 5000');
    } catch (error) { this.db.close(); throw error; }
  }
  close(): void { this.db.close(); }
  listJobIds(limit = 24): string[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 64) throw new Error('LOCAL_LIST_LIMIT_INVALID');
    return (this.db.prepare('SELECT job_id FROM local_rat_jobs ORDER BY rowid DESC LIMIT ?').all(limit) as { job_id: string }[])
      .map(row => row.job_id);
  }
  private raw(jobId: string): { source: EvalCase; sourceDigest: string; revision: number; journal: LocalSnapshot[] } {
    return this.db.transaction(() => {
      const row = this.db.prepare('SELECT * FROM local_rat_jobs WHERE job_id = ?').get(jobId) as
        { source_json: string; source_digest: string; revision: number } | undefined;
      if (!row) throw new Error('LOCAL_JOB_NOT_FOUND');
      const entries = this.db.prepare('SELECT revision, snapshot_json FROM local_rat_journal WHERE job_id = ? ORDER BY revision').all(jobId) as
        { revision: number; snapshot_json: string }[];
      if (entries.length < 1 || entries.length > MAX_LOCAL_ADVANCES + 2 || entries.length !== row.revision + 1 ||
          entries.some((entry, index) => entry.revision !== index)) throw new Error('LOCAL_JOURNAL_INVALID');
      return { source: JSON.parse(row.source_json) as EvalCase, sourceDigest: row.source_digest, revision: row.revision,
        journal: entries.map(entry => JSON.parse(entry.snapshot_json) as LocalSnapshot) };
    })();
  }
  private async verified(jobId: string) {
    const data = this.raw(jobId);
    assertContract<EvalCase>('EVAL_CASE_V1', data.source);
    if (data.source.job.jobId !== jobId || await sha256Hex(data.source) !== data.sourceDigest) throw new Error('LOCAL_SOURCE_INVALID');
    let previous: LocalSnapshot | null = null;
    for (const stored of data.journal) {
      const rebuilt = await transition(data.source, data.sourceDigest, previous, stored.action);
      if (canonicalJson(rebuilt) !== canonicalJson(stored)) throw new Error('LOCAL_CHECKPOINT_INVALID');
      previous = rebuilt;
    }
    return { ...data, snapshot: previous! };
  }
  async create(input: unknown): Promise<LocalSnapshot> {
    assertContract<EvalCase>('EVAL_CASE_V1', input);
    const source = structuredClone(input);
    // Answers are deliberately removed from job identity and decisions.
    source.expected = { status: 'DONE', alert: 'SUPPRESS', claimKinds: [], maxToolCalls: 0, maxHandoffs: 0 };
    if (source.job.subject.entityType !== 'WALLET' || BigInt(source.job.window.fromBlock) > BigInt(source.job.window.toBlock)) {
      throw new Error('LOCAL_JOB_SCOPE_INVALID');
    }
    const sourceDigest = await sha256Hex(source), snapshot = await transition(source, sourceDigest, null, { kind: 'CREATE' });
    const inserted = this.db.transaction(() => {
      const found = this.db.prepare('SELECT source_digest FROM local_rat_jobs WHERE job_id = ?').get(source.job.jobId) as { source_digest: string } | undefined;
      if (found) { if (found.source_digest !== sourceDigest) throw new Error('LOCAL_JOB_ID_CONFLICT'); return false; }
      this.db.prepare('INSERT INTO local_rat_jobs VALUES (?, ?, ?, 0)').run(source.job.jobId, canonicalJson(source), sourceDigest);
      this.db.prepare('INSERT INTO local_rat_journal VALUES (?, 0, ?)').run(source.job.jobId, canonicalJson(snapshot));
      return true;
    })();
    return inserted ? snapshot : (await this.verified(source.job.jobId)).snapshot;
  }
  async inspect(jobId: string) {
    const data = await this.verified(jobId);
    return { ...data.snapshot, subject: data.source.job.subject, deadlineBlock: data.source.job.window.toBlock,
      evalId: data.source.evalId,
      coverage: 'DECLARED_SYNTHETIC_FIXTURE_ONLY', budget: data.source.job.budget,
      usage: data.snapshot.receipt?.usage ?? { toolCalls: 0, handoffs: 0, modelCalls: 0, costMicrousd: 0 },
      usageScope: data.snapshot.phase === 'HALTED' ? 'LAST_COMPLETED_PREFIX_FAILED_ATTEMPTS_UNCOUNTED' : 'LOGICAL_REPLAY_RESERVATIONS',
      remainingLocalAdvances: MAX_LOCAL_ADVANCES - data.snapshot.advances };
  }
  private commit(snapshot: LocalSnapshot, previous: LocalSnapshot): void {
    this.db.transaction(() => {
      const changed = this.db.prepare('UPDATE local_rat_jobs SET revision = ? WHERE job_id = ? AND revision = ?')
        .run(snapshot.revision, snapshot.jobId, previous.revision);
      if (changed.changes !== 1) throw new Error('LOCAL_REVISION_CONFLICT');
      this.db.prepare('INSERT INTO local_rat_journal VALUES (?, ?, ?)').run(snapshot.jobId, snapshot.revision, canonicalJson(snapshot));
    })();
  }
  async advance(jobId: string, throughBlock: string): Promise<LocalSnapshot> {
    const data = await this.verified(jobId), previous = data.snapshot;
    boundary(data.source, throughBlock, previous);
    if (terminal(previous.phase) || previous.receipt?.throughBlock === throughBlock) return previous;
    const snapshot = await transition(data.source, data.sourceDigest, previous, { kind: 'ADVANCE', throughBlock });
    this.commit(snapshot, previous); return snapshot;
  }
  async cancel(jobId: string): Promise<LocalSnapshot> {
    const data = await this.verified(jobId);
    if (terminal(data.snapshot.phase)) return data.snapshot;
    const snapshot = await transition(data.source, data.sourceDigest, data.snapshot, { kind: 'CANCEL' });
    this.commit(snapshot, data.snapshot); return snapshot;
  }
  /** Raw export remains available when verification fails; never admits exported claims. */
  exportEvidence(jobId: string): unknown {
    const row = this.db.prepare('SELECT * FROM local_rat_jobs WHERE job_id = ?').get(jobId);
    if (!row) throw new Error('LOCAL_JOB_NOT_FOUND');
    return { mode: 'UNVERIFIED_LOCAL_JOURNAL_EXPORT', job: row,
      journal: this.db.prepare('SELECT * FROM local_rat_journal WHERE job_id = ? ORDER BY revision').all(jobId) };
  }
}
