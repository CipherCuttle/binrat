import type { ChainCheckpoint } from '../core/types.js';
import type { SyncReport } from '../indexer/syncLaunches.js';
import type { PortableDatabase } from './sqlite.js';

export const PROGRESS_SCHEMA = `CREATE TABLE IF NOT EXISTS portable_collector_progress (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1), coverage_from TEXT,
  checkpoint_block TEXT NOT NULL, checkpoint_hash TEXT NOT NULL,
  high_water_block TEXT NOT NULL, sequence INTEGER NOT NULL,
  verified_at_ms INTEGER NOT NULL, advanced_at_ms INTEGER
);`;

interface Progress {
  coverage_from: string | null; checkpoint_block: string; checkpoint_hash: string;
  high_water_block: string; sequence: number; verified_at_ms: number; advanced_at_ms: number | null;
}

/** Committed in the SAME transaction as checkpoint/evidence. A no-op poll or
 * replay below the previous high-water mark cannot renew the progress clock.
 * Imported history is not retroactively claimed as locally scanned coverage. */
export function recordProgress(db: PortableDatabase, before: ChainCheckpoint | null,
  after: ChainCheckpoint, report: SyncReport, time: number) {
  const old = db.sql.prepare('SELECT * FROM portable_collector_progress WHERE singleton=1').get() as Progress | undefined;
  const high = old ? BigInt(old.high_water_block) : before?.blockNumber ?? -1n;
  const advanced = after.blockNumber > high;
  let from = old?.coverage_from ?? null;
  if (report.batches > 0 && report.startBlock !== null) {
    if (from === null || !old || report.startBlock > BigInt(old.checkpoint_block) + 1n ||
        report.startBlock < BigInt(from)) from = report.startBlock.toString();
  }
  db.sql.prepare(`INSERT OR REPLACE INTO portable_collector_progress VALUES(1,?,?,?,?,?,?,?)`).run(
    from, after.blockNumber.toString(), after.blockHash,
    (advanced ? after.blockNumber : high).toString(), (old?.sequence ?? 0) + Number(advanced),
    time, advanced ? time : old?.advanced_at_ms ?? null);
}

export function monitoringHealth(db: PortableDatabase, status: Record<string, unknown>,
  checkpoint: { block_number: string; block_hash: string } | undefined, now: number, maxAgeMs = 180000) {
  const exists = db.sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='portable_collector_progress'").get();
  const p = exists ? db.sql.prepare('SELECT * FROM portable_collector_progress WHERE singleton=1').get() as Progress | undefined : undefined;
  const runtime = db.sql.prepare(`SELECT head_block,target_block,updated_at_ms,source_verified,last_sync_error
    FROM binrat_runtime_state WHERE chain_id=4663`).get() as {
      head_block: string | null; target_block: string | null; updated_at_ms: number;
      source_verified: number; last_sync_error: string | null;
    } | undefined;
  const recent = (time: number | null | undefined) => time !== null && time !== undefined &&
    Number.isSafeInteger(time) && time <= now && now - time < maxAgeMs;
  const bound = !!p && !!checkpoint && p.checkpoint_block === checkpoint.block_number && p.checkpoint_hash === checkpoint.block_hash;
  const progressOk = bound && recent(p.advanced_at_ms) && recent(p.verified_at_ms) &&
    recent(runtime?.updated_at_ms) && runtime?.source_verified === 1 && runtime.last_sync_error === null;
  const state = status.state === 'NO_VERIFIED_SNAPSHOT' ? 'UNAVAILABLE' :
    status.state === 'FRESH_VERIFIED' && progressOk ? 'FRESH' : 'STALE';
  const backlog = checkpoint && runtime?.target_block !== null && runtime?.target_block !== undefined
    ? BigInt(runtime.target_block) - BigInt(checkpoint.block_number) : null;
  return { schemaVersion: 'binrat.monitoring/1', ok: state === 'FRESH', state, progressOk,
    reason: state === 'FRESH' ? null : state === 'UNAVAILABLE' ? 'NO_VERIFIED_SNAPSHOT' :
      runtime?.last_sync_error ? 'LAST_RUN_FAILED' : !bound ? 'NO_LOCAL_PROGRESS_PROOF' :
      !recent(p.advanced_at_ms) ? 'NO_RECENT_CHECKPOINT_ADVANCE' : 'NOT_CAUGHT_UP_OR_STALE',
    chainHead: runtime?.head_block ?? null, chainHeadObservedAtMs: runtime?.updated_at_ms ?? null,
    scannerCheckpoint: checkpoint?.block_number ?? null, publishedSnapshotCheckpoint: status.checkpointBlock ?? null,
    coverageFromBlock: bound ? p.coverage_from : null, coverageThroughBlock: bound && p.coverage_from ? p.checkpoint_block : null,
    backlogBlocks: backlog === null ? null : (backlog > 0n ? backlog : 0n).toString(),
    progressToken: p ? `${p.sequence}:${p.high_water_block}` : null,
    lastProgressAtMs: p?.advanced_at_ms ?? null, lastVerifiedAtMs: p?.verified_at_ms ?? null,
    progressValidUntilMs: p?.advanced_at_ms === null || p?.advanced_at_ms === undefined ? null : p.advanced_at_ms + maxAgeMs,
    maxAgeMs };
}
