import type { LaunchSource } from '../core/ports.js';
import type { ChainCheckpoint } from '../core/types.js';
import { D1Store } from '../cloudflare/d1Store.js';
import { D1RuntimeStateStore } from '../cloudflare/runtimeState.js';
import { buildPublicSnapshot, publishPublicSnapshot } from '../cloudflare/publicSnapshot.js';
import { latestPonsLaunchSnapshot } from '../autonomous/rats.js';
import { syncLaunches } from '../indexer/syncLaunches.js';
import { PortableDatabase } from './sqlite.js';
import type { Limits } from './config.js';
import { REORG_ARCHIVE_SCHEMA, archiveRewind, quarantineSnapshot } from './reorgArchive.js';
import { PROGRESS_SCHEMA, recordProgress } from './progress.js';

/** Existing evidence store, with atomic SQLite run commits and durable reorg
 * quarantine. The CLI kernel flock stays held across the quarantine commit. */
class PortablePonsStore extends D1Store {
  private checkpoint: ChainCheckpoint | null = null;
  constructor(private readonly database: PortableDatabase) { super(database, 4663); }
  override async getCheckpoint() {
    const result = await super.getCheckpoint();
    if (result) this.checkpoint = result;
    return result;
  }
  override async rewindFromBlock(block: bigint) {
    archiveRewind(this.database, block);
    await super.rewindFromBlock(block);
    // Invalidate a publication before attempting any replay requests. A crash
    // or budget failure must not keep the invalidated snapshot authoritative.
    quarantineSnapshot(this.database);
    this.database.sql.prepare('DELETE FROM pons_funding_receipts WHERE chain_id=4663 AND CAST(transfer_block AS INTEGER)>=?').run(Number(block));
    this.database.sql.prepare('DELETE FROM pons_funding_scan_state WHERE CAST(launch_block AS INTEGER)>=?').run(Number(block));
    this.database.sql.prepare('DELETE FROM pons_token_identity_receipts WHERE chain_id=4663 AND CAST(observed_block AS INTEGER)>=?').run(Number(block));
    // Retain the independently verified guard as a resumable checkpoint only
    // when this rewind actually ends just after that guard.
    if (this.checkpoint?.guardBlockNumber !== null && this.checkpoint?.guardBlockNumber !== undefined &&
        this.checkpoint.guardBlockHash && block === this.checkpoint.guardBlockNumber + 1n) {
      await super.commitCheckpoint({ blockNumber: this.checkpoint.guardBlockNumber,
        blockHash: this.checkpoint.guardBlockHash, guardBlockNumber: null, guardBlockHash: null });
    }
    this.database.sql.exec('COMMIT');
    this.database.sql.exec('BEGIN IMMEDIATE');
  }
}

export async function collectBounded(database: PortableDatabase, source: LaunchSource,
  startBlock: bigint, ceiling: Limits, now = Date.now) {
  // Local working copy only. A single canonical event cannot own two launch
  // rows, including when a provider supplies conflicting indexed token fields.
  // Existing conflicts fail closed before any source request or checkpoint.
  database.sql.exec(REORG_ARCHIVE_SCHEMA + PROGRESS_SCHEMA + `
    CREATE UNIQUE INDEX IF NOT EXISTS portable_launch_event_identity
    ON launches(chain_id,event_id);
  `);
  database.sql.exec('BEGIN IMMEDIATE'); // No source calls before writer exclusion.
  const started = now();
  let actualHead: bigint | null = null;
  let quarantined = false;
  try {
    const store = new PortablePonsStore(database);
    const before = await store.getCheckpoint();
    const from = before ? before.blockNumber + 1n : startBlock;
    const maximumHead = from + BigInt(ceiling.blocksPerRun) - 1n + 2n;
    const bounded: LaunchSource = {
      async getHeadBlockNumber() {
        actualHead = await source.getHeadBlockNumber();
        return actualHead < maximumHead ? actualHead : maximumHead;
      },
      async getBlockHash(n) {
        const value = await source.getBlockHash(n);
        if (!quarantined && before && n === before.blockNumber && value.toLowerCase() !== before.blockHash.toLowerCase()) {
          // Quarantine even when the guard is missing or also invalid. A deep
          // reorg must fail closed BEFORE a guard read/replay/crash can fail.
          quarantineSnapshot(database);
          database.sql.exec('COMMIT');
          database.sql.exec('BEGIN IMMEDIATE');
          quarantined = true;
        }
        return value;
      },
      assertAuthority: n => source.assertAuthority(n),
      catchUp: (a, b) => source.catchUp(a, b)
    };
    const report = await syncLaunches(bounded, store, {
      startBlock, confirmations: 2n, maxBatchBlocks: BigInt(ceiling.blocksPerRun),
      maxBatchesPerRun: 1, reorgLookbackBlocks: 128n, pollIntervalMs: 1000,
      workBudgetMs: Math.max(1000, ceiling.runtimeMs), provenanceProjection: 'END_OF_RUN',
      canonicalVerificationConcurrency: 1, now,
      beforePersist: async () => { if (now() - started >= ceiling.runtimeMs) throw new Error('RUNTIME_EXHAUSTED'); }
    });
    if (now() - started >= ceiling.runtimeMs) throw new Error('RUNTIME_EXHAUSTED');
    const target = actualHead! >= 2n ? actualHead! - 2n : null;
    const after = await store.getCheckpoint();
    const caughtUp = after !== null && after.blockNumber === target;
    if (after) recordProgress(database, before, after, report, now());
    await new D1RuntimeStateStore(database, 4663).put({
      sourceVerified: target !== null, liveCaughtUp: caughtUp, headBlock: actualHead,
      targetBlock: target, observationReady: false, historyBackfillComplete: false,
      historyBackfillTargetBlock: null, lastSyncError: null, lastHistoryError: null,
      lastObservationError: null, updatedAtMs: now()
    });
    if (caughtUp) {
      const latest = await latestPonsLaunchSnapshot(database, now(), 20);
      const snapshot = await buildPublicSnapshot({ schemaVersion: 'binrat.latest-launches/0.1',
        chainId: 4663, sourceCheckpoint: latest.sourceCheckpoint,
        checkpointBlockHash: latest.checkpointBlockHash, historyCoverage: 'PARTIAL', launches: latest.launches });
      await publishPublicSnapshot(database, snapshot, now());
    }
    if (now() - started >= ceiling.runtimeMs) throw new Error('RUNTIME_EXHAUSTED');
    database.sql.exec('COMMIT');
    return { ...report, headBlock: actualHead, targetBlock: target, liveCaughtUp: caughtUp,
      backlogBefore: target !== null && target >= from ? target - from + 1n : 0n,
      backlogAfter: target !== null && after ? (target > after.blockNumber ? target - after.blockNumber : 0n) : null };
  } catch (error) {
    if (database.sql.inTransaction) database.sql.exec('ROLLBACK');
    // No stale "fresh" bit survives a failed local run. Retain the snapshot's
    // original verification timestamp rather than fabricating a new one.
    database.sql.prepare("UPDATE binrat_runtime_state SET live_caught_up=0,last_sync_error='LOCAL_SYNC_FAILED' WHERE chain_id=4663").run();
    throw error;
  }
}
