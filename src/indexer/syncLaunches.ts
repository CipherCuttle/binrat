import type { Hex, LaunchObserved } from '../core/types.js';
import type { LaunchSource, LaunchStore } from '../core/ports.js';
import { buildProvenanceFact, projectProvenanceEdges } from '../intelligence/provenance.js';

export interface SyncOptions {
  startBlock: bigint;
  confirmations: bigint;
  maxBatchBlocks: bigint;
  reorgLookbackBlocks: bigint;
  pollIntervalMs: number;
  maxBatchesPerRun?: number;
  /** Upper bound for adaptive batch growth. Omit to retain a fixed range. */
  maxAdaptiveBatchBlocks?: bigint;
  /** Stop between fully committed batches; an in-flight batch is never abandoned. */
  workBudgetMs?: number;
  /** Allows Pons catch-up to project once per committed work slice. */
  provenanceProjection?: 'PER_BATCH' | 'END_OF_RUN';
  /** Bounded concurrent canonical block reads; result order remains deterministic. */
  canonicalVerificationConcurrency?: number;
  now?: () => number;
  /** Queue-specific lease fencing hooks; called only at safe batch boundaries. */
  beforeBatch?: () => Promise<void>;
  beforePersist?: () => Promise<void>;
  beforeProjection?: () => Promise<void>;
}

export interface SyncReport {
  headBlock: bigint;
  targetBlock: bigint | null;
  startBlock: bigint | null;
  endBlock: bigint | null;
  inserted: number;
  duplicates: number;
  batches: number;
  reorgRewindFrom: bigint | null;
  checkpointBefore: bigint | null;
  checkpointAfter: bigint | null;
  backlogBefore: bigint | null;
  backlogAfter: bigint | null;
  blocksAdvanced: bigint;
  elapsedMs: number;
  logReads: number;
  densityNarrows: number;
  provenanceRefreshElapsedMs: number;
  workBudgetExhausted: boolean;
}

export async function syncLaunches(source: LaunchSource, store: LaunchStore, options: SyncOptions): Promise<SyncReport> {
  validateOptions(options);
  const now = options.now ?? Date.now;
  const startedAtMs = now();
  const deferProvenanceProjection = options.provenanceProjection === 'END_OF_RUN';
  const headBlock = await source.getHeadBlockNumber();
  if (headBlock < options.confirmations) return emptyReport(headBlock, startedAtMs, now());
  const targetBlock = headBlock - options.confirmations;
  if (targetBlock < options.startBlock) return { ...emptyReport(headBlock, startedAtMs, now()), targetBlock };
  await source.assertAuthority(targetBlock);

  let checkpoint = await store.getCheckpoint();
  const checkpointBefore = checkpoint?.blockNumber ?? null;
  let fromBlock = checkpoint ? checkpoint.blockNumber + 1n : options.startBlock;
  const backlogBefore = fromBlock <= targetBlock ? targetBlock - fromBlock + 1n : 0n;
  let reorgRewindFrom: bigint | null = null;

  if (checkpoint) {
    if (checkpoint.blockNumber > targetBlock) {
      throw new Error(
        `PROVIDER_HEAD_BEHIND_CHECKPOINT:head=${headBlock}:target=${targetBlock}:checkpoint=${checkpoint.blockNumber}`
      );
    }
    const canonicalHash = await source.getBlockHash(checkpoint.blockNumber);
    if (!sameHex(canonicalHash, checkpoint.blockHash)) {
      if (checkpoint.guardBlockNumber === null || checkpoint.guardBlockHash === null) {
        throw new Error(`REORG_DEPTH_UNVERIFIABLE:checkpoint=${checkpoint.blockNumber}`);
      }
      const canonicalGuardHash = await source.getBlockHash(checkpoint.guardBlockNumber);
      if (!sameHex(canonicalGuardHash, checkpoint.guardBlockHash)) {
        throw new Error(`REORG_DEPTH_EXCEEDED:checkpoint=${checkpoint.blockNumber}:guard=${checkpoint.guardBlockNumber}`);
      }
      reorgRewindFrom = maxBigInt(options.startBlock, checkpoint.guardBlockNumber + 1n);
      await store.rewindFromBlock(reorgRewindFrom);
      checkpoint = await store.getCheckpoint();
      fromBlock = checkpoint ? checkpoint.blockNumber + 1n : reorgRewindFrom;
    }
  }

  let provenanceRefreshElapsedMs = 0;
  let provenanceDirty = reorgRewindFrom !== null;
  if (!deferProvenanceProjection) {
    await options.beforeProjection?.();
    provenanceRefreshElapsedMs += await refreshProvenanceProjection(store, now, fromBlock, targetBlock);
  }
  if (fromBlock > targetBlock) {
    if (deferProvenanceProjection && provenanceDirty) {
      await options.beforeProjection?.();
      provenanceRefreshElapsedMs += await refreshProvenanceProjection(store, now, fromBlock, targetBlock);
    }
    const checkpointAfter = (await store.getCheckpoint())?.blockNumber ?? null;
    return completedReport({ headBlock, targetBlock, startBlock: null, endBlock: null, inserted: 0, duplicates: 0, batches: 0,
      reorgRewindFrom, checkpointBefore, checkpointAfter, backlogBefore, startedAtMs, endedAtMs: now(), logReads: 0,
      densityNarrows: 0, provenanceRefreshElapsedMs, workBudgetExhausted: false });
  }

  const initialFrom = fromBlock;
  let inserted = 0;
  let duplicates = 0;
  let batches = 0;
  let finalBlock: bigint | null = null;
  let logReads = 0;
  let densityNarrows = 0;
  let workBudgetExhausted = false;
  let batchBlocks = options.maxBatchBlocks;

  try {
    while (fromBlock <= targetBlock) {
      if (batches > 0 && options.workBudgetMs !== undefined && now() - startedAtMs >= options.workBudgetMs) {
        workBudgetExhausted = true;
        break;
      }
    let toBlock = minBigInt(targetBlock, fromBlock + batchBlocks - 1n);
    let launches: LaunchObserved[];
    let boundaryHashBefore: Hex;
    let narrowed = false;
    await options.beforeBatch?.();
    // Pons declares a safe density boundary after its log request. Narrow the
    // same uncommitted range until canonical per-block verification is bounded.
    // No logs are skipped: the committed checkpoint is always the narrowed end.
    while (true) {
      console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'LIVE_BATCH_START', fromBlock: fromBlock.toString(), toBlock: toBlock.toString() }));
      await source.assertAuthority(fromBlock);
      await source.assertAuthority(toBlock);

      boundaryHashBefore = await source.getBlockHash(toBlock);
      console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'LIVE_LOG_READ_START', fromBlock: fromBlock.toString(), toBlock: toBlock.toString() }));
      try {
        logReads += 1;
        launches = await source.catchUp(fromBlock, toBlock);
        break;
      } catch (error) {
        if (!isDensityBoundError(error) || fromBlock === toBlock) throw error;
        const narrowedTo = fromBlock + (toBlock - fromBlock) / 2n;
        if (narrowedTo < fromBlock) throw error;
        narrowed = true;
        densityNarrows += 1;
        console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'LIVE_BATCH_NARROWED', fromBlock: fromBlock.toString(), toBlock: narrowedTo.toString() }));
        toBlock = narrowedTo;
      }
    }
    console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'LIVE_LOG_READ_DONE', fromBlock: fromBlock.toString(), toBlock: toBlock.toString(), launchCount: launches.length }));
    await assertLaunchBlocksStillCanonical(source, launches, options.canonicalVerificationConcurrency ?? 1);
    const boundaryHashAfterRead = await source.getBlockHash(toBlock);
    if (!sameHex(boundaryHashBefore, boundaryHashAfterRead)) throw new Error(`REORG_DURING_READ:block=${toBlock}`);

    // A long upstream read must never let an expired lease turn into a second
    // writer. The caller may renew/fence only before any durable batch writes.
    await options.beforePersist?.();

    for (const launch of launches) {
      const result = await store.putLaunch(launch);
      if (result === 'INSERTED') inserted += 1;
      else duplicates += 1;
      await store.putProvenanceFact(await buildProvenanceFact(launch));
    }
    if (launches.length > 0) provenanceDirty = true;
    if (!deferProvenanceProjection && launches.length > 0) {
      await options.beforeProjection?.();
      provenanceRefreshElapsedMs += await refreshProvenanceProjection(store, now, fromBlock, toBlock);
    }

    const guardBlockNumber = toBlock > options.reorgLookbackBlocks ? toBlock - options.reorgLookbackBlocks : 0n;
    const guardBlockHash = await source.getBlockHash(guardBlockNumber);
    const boundaryHashBeforeCommit = await source.getBlockHash(toBlock);
    if (!sameHex(boundaryHashBefore, boundaryHashBeforeCommit)) {
      await store.rewindFromBlock(fromBlock);
      throw new Error(`REORG_DURING_COMMIT:block=${toBlock}`);
    }

    try { await source.assertAuthority(targetBlock); }
    catch (error) { await store.rewindFromBlock(fromBlock); throw error; }

    console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'CHECKPOINT_COMMIT_START', blockNumber: toBlock.toString() }));
    await store.commitCheckpoint({
      blockNumber: toBlock,
      blockHash: boundaryHashBeforeCommit,
      guardBlockNumber,
      guardBlockHash
    });
    console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'CHECKPOINT_COMMIT_DONE', blockNumber: toBlock.toString() }));
    finalBlock = toBlock;
    batches += 1;
    const completedBatchBlocks = toBlock - fromBlock + 1n;
    fromBlock = toBlock + 1n;
    if (options.maxAdaptiveBatchBlocks !== undefined) {
      batchBlocks = narrowed
        ? completedBatchBlocks
        : minBigInt(options.maxAdaptiveBatchBlocks, batchBlocks * 2n);
    }
    if (options.maxBatchesPerRun !== undefined && batches >= options.maxBatchesPerRun) break;
  }
  } finally {
    // Each committed batch already has facts.  Before this work slice returns
    // (including an error after an earlier committed batch), make the graph
    // equivalent to a full rebuild without repeating it in the hot loop.
    if (deferProvenanceProjection && provenanceDirty) {
      await options.beforeProjection?.();
      provenanceRefreshElapsedMs += await refreshProvenanceProjection(store, now, initialFrom, targetBlock);
    }
  }

  const checkpointAfter = (await store.getCheckpoint())?.blockNumber ?? null;
  return completedReport({ headBlock, targetBlock, startBlock: initialFrom, endBlock: finalBlock, inserted, duplicates, batches,
    reorgRewindFrom, checkpointBefore, checkpointAfter, backlogBefore, startedAtMs, endedAtMs: now(), logReads,
    densityNarrows, provenanceRefreshElapsedMs, workBudgetExhausted });
}

export async function runLaunchWatcher(
  source: LaunchSource,
  store: LaunchStore,
  options: SyncOptions,
  signal?: AbortSignal,
  onSync?: (report: SyncReport) => void
): Promise<void> {
  while (!signal?.aborted) {
    const report = await syncLaunches(source, store, options);
    onSync?.(report);
    await sleep(options.pollIntervalMs, signal);
  }
}

async function ensureProvenanceProjection(store: LaunchStore): Promise<void> {
  const missing = await store.listLaunchesMissingProvenance();
  for (const launch of missing) await store.putProvenanceFact(await buildProvenanceFact(launch));
  const facts = await store.listProvenanceFacts();
  const projected = await projectProvenanceEdges(facts);
  const existing = await store.listProvenanceEdges();
  const existingDigests = new Map(existing.map((edge) => [edge.edgeId, edge.evidenceDigest]));
  const unchanged = existing.length === projected.length && projected.every(
    (edge) => existingDigests.get(edge.edgeId) === edge.evidenceDigest
  );
  if (!unchanged) await store.replaceProvenanceEdges(projected);
}

async function refreshProvenanceProjection(store: LaunchStore, now: () => number, fromBlock: bigint, targetBlock: bigint): Promise<number> {
  const startedAtMs = now();
  console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'PROVENANCE_REFRESH_START', fromBlock: fromBlock.toString(), targetBlock: targetBlock.toString() }));
  await ensureProvenanceProjection(store);
  const elapsedMs = now() - startedAtMs;
  console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'PROVENANCE_REFRESH_DONE', fromBlock: fromBlock.toString(), targetBlock: targetBlock.toString(), elapsedMs }));
  return elapsedMs;
}

async function assertLaunchBlocksStillCanonical(source: LaunchSource, launches: LaunchObserved[], concurrency: number): Promise<void> {
  const byBlock = new Map<bigint, Hex>();
  for (const launch of launches) {
    const expected = byBlock.get(launch.blockNumber);
    if (expected && !sameHex(expected, launch.blockHash)) throw new Error(`REORG_DURING_SYNC:block=${launch.blockNumber}`);
    byBlock.set(launch.blockNumber, launch.blockHash);
  }
  const blocks = [...byBlock.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const canonical = await mapBounded(blocks, concurrency, async ([blockNumber, expected]) => {
    const actual = await source.getBlockHash(blockNumber);
    if (!sameHex(actual, expected)) throw new Error(`REORG_DURING_SYNC:block=${blockNumber}`);
    return actual;
  });
  // Force every read to settle before returning; the ordered result is useful
  // to make the concurrency boundary deterministic for callers and tests.
  if (canonical.length !== blocks.length) throw new Error('CANONICAL_BLOCK_VERIFICATION_INCOMPLETE');
}

function validateOptions(options: SyncOptions): void {
  if (options.startBlock < 0n) throw new Error('startBlock must be >= 0');
  if (options.confirmations < 0n) throw new Error('confirmations must be >= 0');
  if (options.maxBatchBlocks < 1n) throw new Error('maxBatchBlocks must be >= 1');
  if (options.reorgLookbackBlocks < 1n) throw new Error('reorgLookbackBlocks must be >= 1');
  if (!Number.isFinite(options.pollIntervalMs) || options.pollIntervalMs < 100) throw new Error('pollIntervalMs must be >= 100');
  if (
    options.maxBatchesPerRun !== undefined &&
    (!Number.isSafeInteger(options.maxBatchesPerRun) || options.maxBatchesPerRun < 1)
  ) throw new Error('maxBatchesPerRun must be a positive safe integer');
  if (options.maxAdaptiveBatchBlocks !== undefined && options.maxAdaptiveBatchBlocks < options.maxBatchBlocks) {
    throw new Error('maxAdaptiveBatchBlocks must be >= maxBatchBlocks');
  }
  if (options.workBudgetMs !== undefined && (!Number.isSafeInteger(options.workBudgetMs) || options.workBudgetMs < 1_000)) {
    throw new Error('workBudgetMs must be a safe integer >= 1000');
  }
  if (options.canonicalVerificationConcurrency !== undefined &&
    (!Number.isSafeInteger(options.canonicalVerificationConcurrency) || options.canonicalVerificationConcurrency < 1 || options.canonicalVerificationConcurrency > 6)) {
    throw new Error('canonicalVerificationConcurrency must be an integer from 1 to 6');
  }
}

function emptyReport(headBlock: bigint, startedAtMs: number, endedAtMs: number): SyncReport {
  return completedReport({ headBlock, targetBlock: null, startBlock: null, endBlock: null, inserted: 0, duplicates: 0, batches: 0,
    reorgRewindFrom: null, checkpointBefore: null, checkpointAfter: null, backlogBefore: null, startedAtMs, endedAtMs,
    logReads: 0, densityNarrows: 0, provenanceRefreshElapsedMs: 0, workBudgetExhausted: false });
}

function completedReport(input: Omit<SyncReport, 'backlogAfter' | 'blocksAdvanced' | 'elapsedMs'> & { backlogBefore: bigint | null; startedAtMs: number; endedAtMs: number }): SyncReport {
  const checkpointAfter = input.checkpointAfter;
  const backlogAfter = input.targetBlock === null || checkpointAfter === null
    ? null
    : checkpointAfter >= input.targetBlock ? 0n : input.targetBlock - checkpointAfter;
  const blocksAdvanced = input.checkpointBefore === null
    ? (checkpointAfter === null || input.startBlock === null ? 0n : checkpointAfter - input.startBlock + 1n)
    : (checkpointAfter === null || checkpointAfter <= input.checkpointBefore ? 0n : checkpointAfter - input.checkpointBefore);
  return { ...input, backlogAfter, blocksAdvanced, elapsedMs: Math.max(0, input.endedAtMs - input.startedAtMs) };
}

async function mapBounded<T, R>(items: T[], concurrency: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await run(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function sameHex(a: Hex, b: Hex): boolean { return a.toLowerCase() === b.toLowerCase(); }
function isDensityBoundError(error: unknown): boolean {
  return error instanceof Error && error.message === 'PONS_LAUNCH_BLOCK_DENSITY';
}
function minBigInt(a: bigint, b: bigint): bigint { return a < b ? a : b; }
function maxBigInt(a: bigint, b: bigint): bigint { return a > b ? a : b; }

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}
