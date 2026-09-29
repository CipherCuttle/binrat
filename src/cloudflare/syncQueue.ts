import { ArcPadLaunchSource } from '../arc/arcpadSource.js';
import { deliverFindings, enqueueFindings } from '../autonomous/delivery.js';
import { arcWatchSource, robinhoodWatchSource, type WatchSource } from '../autonomous/source.js';
import { ARCPAD_START_BLOCK, ARC_CHAIN_ID } from '../arc/chain.js';
import { PonsLaunchSource } from '../pons/ponsSource.js';
import { PONS_V2_START_BLOCK, ROBINHOOD_CHAIN_ID } from '../pons/chain.js';
import { ArcObservationSource } from '../arc/observationSource.js';
import { ArcRatRadarSource, type RatRadarSource } from '../arc/ratRadarSource.js';
import type { LaunchSource } from '../core/ports.js';
import { syncHistoricalLaunches } from '../indexer/syncHistoricalLaunches.js';
import { syncLaunches } from '../indexer/syncLaunches.js';
import {
  syncObservations,
  type ObservationSource
} from '../observations/syncObservations.js';
import { D1RuntimeStateStore, type D1RuntimeState } from './runtimeState.js';
import { D1RatWatchStore, ratWatchAlertText } from './ratWatch.js';
import { D1RatRadarStore } from './ratRadarStore.js';
import { D1Store } from './d1Store.js';
import { D1SyncLeaseStore } from './syncLease.js';
import type { D1DatabaseLike } from './d1Types.js';

export interface SyncQueueProducerLike {
  send(body: BinratSyncMessage): Promise<unknown>;
}

export interface SyncQueueMessageLike<T = unknown> {
  body: T;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

export interface SyncQueueBatchLike<T = unknown> {
  messages: Array<SyncQueueMessageLike<T>>;
}

export interface CloudflareSyncEnv {
  DB: D1DatabaseLike;
  SYNC_QUEUE?: SyncQueueProducerLike;
  ARC_RPC_URL?: string;
  /** Optional production RPC; the public Robinhood endpoint is the safe fallback. */
  ROBINHOOD_RPC_URL?: string;
  BINRAT_LIVE_LOOKBACK_BLOCKS?: string;
  BINRAT_CONFIRMATIONS?: string;
  BINRAT_MAX_BATCH_BLOCKS?: string;
  /** Pons-only cap; Arc keeps its existing independent batch configuration. */
  BINRAT_PONS_MAX_BATCH_BLOCKS?: string;
  BINRAT_MAX_OBSERVATIONS_PER_SYNC?: string;
  BINRAT_RAT_RADAR_MAX_BATCH_BLOCKS?: string;
  BINRAT_RAT_RADAR_MAX_POOLS_PER_CYCLE?: string;
  TELEGRAM_BOT_TOKEN?: string;
  /** Requires the separately applied additive V1 migration. No automatic migration. */
  BINRAT_AUTONOMOUS_RAT_ENABLED?: string;
  BINRAT_TELEGRAM_MEDIA_ENABLED?: string;
  BINRAT_PUBLIC_SITE_URL?: string;
}

export interface BinratSyncMessage {
  kind: 'SYNC_CYCLE' | 'PONS_SYNC_CYCLE' | 'OBSERVATION_CYCLE' | 'RAT_WATCH_CYCLE' | 'RAT_RADAR_CYCLE';
  cycleId: string;
  enqueuedAtMs: number;
}

export interface CloudflareSyncDeps {
  now: () => number;
  launchSource?: LaunchSource;
  ponsLaunchSource?: LaunchSource;
  observationSource?: ObservationSource;
  ratRadarSource?: RatRadarSource;
  externalFetch?: typeof fetch;
  watchSource?: WatchSource;
}

export type SyncCycleResult =
  | { status: 'SUCCESS'; liveCaughtUp: boolean }
  | { status: 'BUSY' }
  | { status: 'RETRY'; code: string };

const SYNC_LEASE_NAME = 'binrat:arc-sync';
const PONS_SYNC_LEASE_NAME = 'binrat:pons-sync';
const OBSERVATION_LEASE_NAME = 'binrat:arc-observation';
const RAT_WATCH_LEASE_NAME = 'binrat:rat-watch';
const RAT_RADAR_LEASE_NAME = 'binrat:rat-radar';
const LIVE_SYNC_LEASE_MS = 120_000;
export const ARC_PUBLIC_RPC_FALLBACK_URL = 'https://rpc.mainnet.arc.io';
export const ROBINHOOD_PUBLIC_RPC_FALLBACK_URL = 'https://rpc.mainnet.chain.robinhood.com';

export async function enqueueSyncCycle(
  env: CloudflareSyncEnv,
  nowMs = Date.now(),
  cycleId = crypto.randomUUID()
): Promise<void> {
  if (!env.SYNC_QUEUE) throw new Error('MISSING_BINDING:SYNC_QUEUE');
  await env.SYNC_QUEUE.send({
    kind: 'SYNC_CYCLE',
    cycleId,
    enqueuedAtMs: nowMs
  });
}

export async function enqueuePonsSyncCycle(
  env: CloudflareSyncEnv,
  nowMs = Date.now(),
  cycleId = crypto.randomUUID()
): Promise<void> {
  if (!env.SYNC_QUEUE) throw new Error('MISSING_BINDING:SYNC_QUEUE');
  await env.SYNC_QUEUE.send({ kind: 'PONS_SYNC_CYCLE', cycleId, enqueuedAtMs: nowMs });
}

export async function enqueueObservationCycle(
  env: CloudflareSyncEnv,
  nowMs = Date.now(),
  cycleId = crypto.randomUUID()
): Promise<void> {
  if (!env.SYNC_QUEUE) throw new Error('MISSING_BINDING:SYNC_QUEUE');
  await env.SYNC_QUEUE.send({
    kind: 'OBSERVATION_CYCLE',
    cycleId,
    enqueuedAtMs: nowMs
  });
}

export async function enqueueRatWatchCycle(
  env: CloudflareSyncEnv,
  nowMs = Date.now(),
  cycleId = crypto.randomUUID()
): Promise<void> {
  if (!env.SYNC_QUEUE) throw new Error('MISSING_BINDING:SYNC_QUEUE');
  await env.SYNC_QUEUE.send({
    kind: 'RAT_WATCH_CYCLE',
    cycleId,
    enqueuedAtMs: nowMs
  });
}


export async function enqueueRatRadarCycle(
  env: CloudflareSyncEnv,
  nowMs = Date.now(),
  cycleId = crypto.randomUUID()
): Promise<void> {
  if (!env.SYNC_QUEUE) throw new Error('MISSING_BINDING:SYNC_QUEUE');
  await env.SYNC_QUEUE.send({
    kind: 'RAT_RADAR_CYCLE',
    cycleId,
    enqueuedAtMs: nowMs
  });
}

export async function handleSyncQueueBatch(
  batch: SyncQueueBatchLike,
  env: CloudflareSyncEnv,
  deps: CloudflareSyncDeps = { now: Date.now }
): Promise<void> {
  for (const message of batch.messages) {
    if (!isSyncMessage(message.body)) {
      message.ack();
      continue;
    }
    try {
      if (message.body.kind === 'OBSERVATION_CYCLE') {
        const result = await runCloudflareObservationCycle(env, message.body, deps);
        if (result.status === 'RETRY') message.retry({ delaySeconds: 30 });
        else message.ack();
        continue;
      }

      if (message.body.kind === 'PONS_SYNC_CYCLE') {
        const result = await runCloudflarePonsSyncCycle(env, message.body, deps);
        if (result.status === 'RETRY') { message.retry({ delaySeconds: 30 }); continue; }
        message.ack();
        if (result.status === 'SUCCESS' && result.liveCaughtUp && shouldEnqueueRatWatch(message.body.enqueuedAtMs)) {
          await enqueueRatWatchCycle(env, deps.now()).catch((error) => {
            console.error(JSON.stringify({ event: 'PONS_RAT_WATCH_ENQUEUE_FAILED', code: syncErrorCode(error) }));
          });
        }
        continue;
      }

      if (message.body.kind === 'RAT_WATCH_CYCLE') {
        const result = await runCloudflareRatWatchCycle(env, message.body, deps);
        if (result.status === 'RETRY') message.retry({ delaySeconds: 30 });
        else message.ack();
        continue;
      }

      if (message.body.kind === 'RAT_RADAR_CYCLE') {
        const result = await runCloudflareRatRadarCycle(env, message.body, deps);
        if (result.status === 'RETRY') message.retry({ delaySeconds: 30 });
        else message.ack();
        continue;
      }

      const result = await runCloudflareSyncCycle(env, message.body, deps);
      if (result.status === 'RETRY') {
        message.retry({ delaySeconds: 30 });
        continue;
      }

      message.ack();
      if (
        result.status === 'SUCCESS' &&
        result.liveCaughtUp &&
        shouldEnqueueObservation(message.body.enqueuedAtMs)
      ) {
        await enqueueObservationCycle(env, deps.now()).catch((error) => {
          console.error(JSON.stringify({
            event: 'OBSERVATION_ENQUEUE_FAILED',
            code: syncErrorCode(error)
          }));
        });
      }
      if (
        result.status === 'SUCCESS' &&
        result.liveCaughtUp &&
        shouldEnqueueRatWatch(message.body.enqueuedAtMs)
      ) {
        await enqueueRatWatchCycle(env, deps.now()).catch((error) => {
          console.error(JSON.stringify({
            event: 'RAT_WATCH_ENQUEUE_FAILED',
            code: syncErrorCode(error)
          }));
        });
      }
      if (
        result.status === 'SUCCESS' &&
        result.liveCaughtUp
      ) {
        await enqueueRatRadarCycle(env, deps.now()).catch((error) => {
          console.error(JSON.stringify({
            event: 'RAT_RADAR_ENQUEUE_FAILED',
            code: ratRadarSyncErrorCode(error)
          }));
        });
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: 'SYNC_QUEUE_UNCAUGHT',
        kind: message.body.kind,
        cycleId: message.body.cycleId,
        code: syncErrorCode(error)
      }));
      message.retry({ delaySeconds: 30 });
    }
  }
}

export async function runCloudflareSyncCycle(
  env: CloudflareSyncEnv,
  message: BinratSyncMessage,
  deps: CloudflareSyncDeps = { now: Date.now }
): Promise<SyncCycleResult> {
  if (!isSyncMessage(message)) return { status: 'RETRY', code: 'SYNC_MESSAGE_INVALID' };

  const lease = new D1SyncLeaseStore(env.DB);
  const nowMs = deps.now();
  console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'LEASE_CLAIM_START', cycleId: message.cycleId, nowMs }));
  if (!(await lease.claim(SYNC_LEASE_NAME, message.cycleId, nowMs, LIVE_SYNC_LEASE_MS))) {
    console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'LEASE_BUSY', cycleId: message.cycleId, nowMs }));
    return { status: 'BUSY' };
  }

  console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'LEASE_CLAIMED', cycleId: message.cycleId, nowMs }));
  const store = new D1Store(env.DB, ARC_CHAIN_ID);
  const runtimeStore = new D1RuntimeStateStore(env.DB, ARC_CHAIN_ID);
  let previous: D1RuntimeState | null = null;
  let phase: SyncFailurePhase = 'RUNTIME_D1';

  try {
    console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'RUNTIME_READ_START', cycleId: message.cycleId }));
    previous = await runtimeStore.get();
    console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'RUNTIME_READ_DONE', cycleId: message.cycleId, previousUpdatedAtMs: previous?.updatedAtMs ?? null }));

    let source: LaunchSource;
    phase = 'SOURCE_CONSTRUCTION';
    try {
      const rpcUrl = deps.launchSource ? undefined : resolveArcRpcUrl(env);
      source = deps.launchSource ?? new ArcPadLaunchSource({ rpcUrl });
    } catch (error) {
      const code = reportSyncFailure(message.cycleId, 'SOURCE_CONSTRUCTION', error);
      phase = 'RUNTIME_D1';
      await persistLiveFailure(runtimeStore, previous, code, deps.now);
      return { status: 'RETRY', code };
    }

    let bootstrapHead: bigint;
    phase = 'SOURCE_BOOTSTRAP';
    try {
      console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'SOURCE_BOOTSTRAP_START', cycleId: message.cycleId }));
      bootstrapHead = await source.getHeadBlockNumber();
      await source.assertAuthority(bootstrapHead);
      console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'SOURCE_BOOTSTRAP_DONE', cycleId: message.cycleId, bootstrapHead: bootstrapHead.toString() }));
    } catch (error) {
      const code = reportSyncFailure(message.cycleId, 'SOURCE_BOOTSTRAP', error);
      phase = 'RUNTIME_D1';
      await persistLiveFailure(runtimeStore, previous, code, deps.now);
      return { status: 'RETRY', code };
    }

    const lookback = BigInt(integerSetting(env.BINRAT_LIVE_LOOKBACK_BLOCKS, 1000, 1, 1_000_000));
    const confirmations = BigInt(integerSetting(env.BINRAT_CONFIRMATIONS, 2, 0, 10_000));
    const maxBatchBlocks = BigInt(integerSetting(env.BINRAT_MAX_BATCH_BLOCKS, 1000, 1, 100_000));
    const recentStart = bootstrapHead > lookback ? bootstrapHead - lookback : 0n;
    const liveWindowStart = recentStart > ARCPAD_START_BLOCK ? recentStart : ARCPAD_START_BLOCK;
    phase = 'RUNTIME_D1';
    const beforeCheckpoint = await store.getCheckpoint();
    const startBlock = beforeCheckpoint ? ARCPAD_START_BLOCK : liveWindowStart;
    const historyTarget =
      previous && previous.headBlock !== null && previous.targetBlock !== null
        ? previous.historyBackfillTargetBlock
        : liveWindowStart > ARCPAD_START_BLOCK
          ? liveWindowStart - 1n
          : null;

    let liveReport;
    phase = 'LIVE_SYNC';
    try {
      console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'LIVE_SYNC_START', cycleId: message.cycleId }));
      liveReport = await syncLaunches(source, store, {
        startBlock,
        confirmations,
        maxBatchBlocks,
        reorgLookbackBlocks: 32n,
        pollIntervalMs: 1000,
        maxBatchesPerRun: 1
      });
      console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'LIVE_SYNC_DONE', cycleId: message.cycleId, batches: liveReport.batches, endBlock: liveReport.endBlock?.toString() ?? null }));
    } catch (error) {
      const code = reportSyncFailure(message.cycleId, 'LIVE_SYNC', error);
      phase = 'RUNTIME_D1';
      await persistLiveFailure(runtimeStore, previous, code, deps.now);
      return { status: 'RETRY', code };
    }

    const checkpoint = await store.getCheckpoint();
    const liveCaughtUp = Boolean(
      liveReport.targetBlock !== null &&
      checkpoint &&
      checkpoint.blockNumber >= liveReport.targetBlock
    );

    let historyBackfillComplete = previous?.historyBackfillComplete ?? historyTarget === null;
    let lastHistoryError = previous?.lastHistoryError ?? null;
    let observationReady = previous?.observationReady ?? false;
    let lastObservationError = previous?.lastObservationError ?? null;

    if (liveCaughtUp && historyTarget === null) {
      historyBackfillComplete = true;
      lastHistoryError = null;
    }

    const liveUpdatedAtMs = deps.now();
    console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'RUNTIME_WRITE_START', cycleId: message.cycleId }));
    phase = 'RUNTIME_D1';
    await runtimeStore.put({
      sourceVerified: true,
      liveCaughtUp,
      headBlock: liveReport.headBlock,
      targetBlock: liveReport.targetBlock,
      observationReady,
      historyBackfillComplete,
      historyBackfillTargetBlock: historyTarget,
      lastSyncError: null,
      lastHistoryError,
      lastObservationError,
      updatedAtMs: liveUpdatedAtMs
    });

    console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'RUNTIME_WRITE_DONE', cycleId: message.cycleId }));

    // Live authority is durable before subordinate history work begins. A slow or failed
    // archive read must not prevent this cycle from refreshing the public live heartbeat.
    if (liveCaughtUp && historyTarget !== null && !historyBackfillComplete) {
      console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'HISTORY_SYNC_START', cycleId: message.cycleId }));
      phase = 'HISTORY_SYNC';
      try {
        const history = await syncHistoricalLaunches(source, store, {
          startBlock: ARCPAD_START_BLOCK,
          endBlock: historyTarget,
          maxBatchBlocks
        });
        historyBackfillComplete = history.complete;
        lastHistoryError = null;
        console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'HISTORY_SYNC_DONE', cycleId: message.cycleId, nextBlock: history.nextBlock.toString(), complete: history.complete }));
      } catch (error) {
        historyBackfillComplete = false;
        const code = reportSyncFailure(message.cycleId, 'HISTORY_SYNC', error);
        lastHistoryError = code;
        console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'HISTORY_SYNC_FAILED', cycleId: message.cycleId, code: lastHistoryError }));
      }

      phase = 'RUNTIME_D1';
      await runtimeStore.put({
        sourceVerified: true,
        liveCaughtUp,
        headBlock: liveReport.headBlock,
        targetBlock: liveReport.targetBlock,
        observationReady,
        historyBackfillComplete,
        historyBackfillTargetBlock: historyTarget,
        lastSyncError: null,
        lastHistoryError,
        lastObservationError,
        // History completion/error state must not extend live-read authority.
        updatedAtMs: liveUpdatedAtMs
      });
    }

    return { status: 'SUCCESS', liveCaughtUp };
  } catch (error) {
    reportSyncFailure(message.cycleId, phase, error);
    throw error;
  } finally {
    store.close();
    console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'LEASE_RELEASE_START', cycleId: message.cycleId }));
    await lease.release(SYNC_LEASE_NAME, message.cycleId);
    console.error(JSON.stringify({ event: 'SYNC_PHASE', phase: 'LEASE_RELEASE_DONE', cycleId: message.cycleId }));
  }
}

/**
 * Robinhood is a separate readiness authority.  An Arc error is neither read nor
 * written here, so live Pons evidence keeps working while legacy Arc is stale.
 */
export async function runCloudflarePonsSyncCycle(
  env: CloudflareSyncEnv,
  message: BinratSyncMessage,
  deps: CloudflareSyncDeps = { now: Date.now }
): Promise<SyncCycleResult> {
  if (!isSyncMessage(message) || message.kind !== 'PONS_SYNC_CYCLE') {
    return { status: 'RETRY', code: 'PONS_SYNC_MESSAGE_INVALID' };
  }
  const nowMs = deps.now();
  const lease = new D1SyncLeaseStore(env.DB);
  if (!(await lease.claim(PONS_SYNC_LEASE_NAME, message.cycleId, nowMs, LIVE_SYNC_LEASE_MS))) {
    return { status: 'BUSY' };
  }
  const store = new D1Store(env.DB, ROBINHOOD_CHAIN_ID);
  const runtime = new D1RuntimeStateStore(env.DB, ROBINHOOD_CHAIN_ID);
  let previous: D1RuntimeState | null = null;
  try {
    previous = await runtime.get();
    let source: LaunchSource;
    try {
      source = deps.ponsLaunchSource ?? new PonsLaunchSource({ rpcUrl: resolveRobinhoodRpcUrl(env) });
    } catch (error) {
      const code = reportSyncFailure(message.cycleId, 'SOURCE_CONSTRUCTION', error);
      await persistLiveFailure(runtime, previous, code, deps.now);
      return { status: 'RETRY', code };
    }
    let head: bigint;
    try {
      head = await source.getHeadBlockNumber();
      await source.assertAuthority(head);
    } catch (error) {
      const code = reportSyncFailure(message.cycleId, 'SOURCE_BOOTSTRAP', error);
      await persistLiveFailure(runtime, previous, code, deps.now);
      return { status: 'RETRY', code };
    }
    const lookback = BigInt(integerSetting(env.BINRAT_LIVE_LOOKBACK_BLOCKS, 1000, 1, 1_000_000));
    // 512 blocks makes normal near-head Pons work compact.  The source narrows
    // dense event windows before writing, keeping canonical block checks below
    // the Workers Free external-subrequest ceiling without touching Arc.
    const maxBatchBlocks = BigInt(integerSetting(env.BINRAT_PONS_MAX_BATCH_BLOCKS, 512, 1, 512));
    const recentStart = head > lookback ? head - lookback : 0n;
    const liveWindowStart = recentStart > PONS_V2_START_BLOCK ? recentStart : PONS_V2_START_BLOCK;
    const checkpoint = await store.getCheckpoint();
    const startBlock = checkpoint ? PONS_V2_START_BLOCK : liveWindowStart;
    let report;
    try {
      report = await syncLaunches(source, store, {
        startBlock,
        confirmations: BigInt(integerSetting(env.BINRAT_CONFIRMATIONS, 2, 0, 10_000)),
        maxBatchBlocks, reorgLookbackBlocks: 32n, pollIntervalMs: 1000, maxBatchesPerRun: 1
      });
    } catch (error) {
      const code = reportSyncFailure(message.cycleId, 'LIVE_SYNC', error);
      await persistLiveFailure(runtime, previous, code, deps.now);
      return { status: 'RETRY', code };
    }
    const after = await store.getCheckpoint();
    const liveCaughtUp = Boolean(report.targetBlock !== null && after && after.blockNumber >= report.targetBlock);
    await runtime.put({
      sourceVerified: true, liveCaughtUp, headBlock: report.headBlock, targetBlock: report.targetBlock,
      observationReady: false, historyBackfillComplete: false, historyBackfillTargetBlock: null,
      lastSyncError: null, lastHistoryError: null, lastObservationError: null, updatedAtMs: deps.now()
    });
    return { status: 'SUCCESS', liveCaughtUp };
  } catch (error) {
    const code = reportSyncFailure(message.cycleId, 'RUNTIME_D1', error);
    if (previous) await persistLiveFailure(runtime, previous, code, deps.now).catch(() => undefined);
    return { status: 'RETRY', code };
  } finally {
    store.close();
    await lease.release(PONS_SYNC_LEASE_NAME, message.cycleId);
  }
}

export async function runCloudflareObservationCycle(
  env: CloudflareSyncEnv,
  message: BinratSyncMessage,
  deps: CloudflareSyncDeps = { now: Date.now }
): Promise<
  | { status: 'SUCCESS'; observationReady: boolean }
  | { status: 'BUSY' }
  | { status: 'RETRY'; code: string }
> {
  if (!isSyncMessage(message) || message.kind !== 'OBSERVATION_CYCLE') {
    return { status: 'RETRY', code: 'SYNC_MESSAGE_INVALID' };
  }

  const lease = new D1SyncLeaseStore(env.DB);
  if (!(await lease.claim(OBSERVATION_LEASE_NAME, message.cycleId, deps.now()))) {
    return { status: 'BUSY' };
  }

  const store = new D1Store(env.DB, ARC_CHAIN_ID);
  const runtimeStore = new D1RuntimeStateStore(env.DB, ARC_CHAIN_ID);

  try {
    const previous = await runtimeStore.get();
    if (
      !previous ||
      !previous.sourceVerified ||
      !previous.liveCaughtUp ||
      previous.lastSyncError
    ) {
      return { status: 'SUCCESS', observationReady: previous?.observationReady ?? false };
    }

    const rpcUrl = deps.observationSource
      ? undefined
      : resolveArcRpcUrl(env);
    const source = deps.observationSource ?? new ArcObservationSource({ rpcUrl });
    const confirmations = BigInt(integerSetting(env.BINRAT_CONFIRMATIONS, 2, 0, 10_000));

    let observationReady = false;
    let lastObservationError: string | null = null;
    try {
      await syncObservations(source, store, {
        confirmations,
        maxObservationsPerSync: integerSetting(
          env.BINRAT_MAX_OBSERVATIONS_PER_SYNC,
          1,
          1,
          10_000
        )
      });
      observationReady = true;
    } catch (error) {
      const code = observationSyncErrorCode(error);
      lastObservationError = code;
      console.error(JSON.stringify({ event: 'OBSERVATION_SYNC_FAILED', code }));
    }

    await runtimeStore.put({
      sourceVerified: previous.sourceVerified,
      liveCaughtUp: previous.liveCaughtUp,
      headBlock: previous.headBlock,
      targetBlock: previous.targetBlock,
      observationReady,
      historyBackfillComplete: previous.historyBackfillComplete,
      historyBackfillTargetBlock: previous.historyBackfillTargetBlock,
      lastSyncError: previous.lastSyncError,
      lastHistoryError: previous.lastHistoryError,
      lastObservationError,
      // Observation enrichment must never refresh live-read authority.
      updatedAtMs: previous.updatedAtMs
    });

    return { status: 'SUCCESS', observationReady };
  } finally {
    store.close();
    await lease.release(OBSERVATION_LEASE_NAME, message.cycleId);
  }
}

export async function runCloudflareRatRadarCycle(
  env: CloudflareSyncEnv,
  message: BinratSyncMessage,
  deps: CloudflareSyncDeps = { now: Date.now }
): Promise<
  | { status: 'SUCCESS'; poolsProcessed: number; receiptsInserted: number; receiptsDuplicate: number; poolsFailed: number }
  | { status: 'BUSY' }
  | { status: 'RETRY'; code: string }
> {
  if (!isSyncMessage(message) || message.kind !== 'RAT_RADAR_CYCLE') {
    return { status: 'RETRY', code: 'SYNC_MESSAGE_INVALID' };
  }

  const lease = new D1SyncLeaseStore(env.DB);
  const nowMs = deps.now();
  console.error(JSON.stringify({ event: 'RAT_RADAR_PHASE', phase: 'LEASE_CLAIM_START', cycleId: message.cycleId }));
  if (!(await lease.claim(RAT_RADAR_LEASE_NAME, message.cycleId, nowMs))) {
    console.error(JSON.stringify({ event: 'RAT_RADAR_PHASE', phase: 'LEASE_BUSY', cycleId: message.cycleId }));
    return { status: 'BUSY' };
  }
  console.error(JSON.stringify({ event: 'RAT_RADAR_PHASE', phase: 'LEASE_CLAIMED', cycleId: message.cycleId }));

  const store = new D1Store(env.DB, ARC_CHAIN_ID);
  const radar = new D1RatRadarStore(env.DB, ARC_CHAIN_ID);
  try {
    console.error(JSON.stringify({ event: 'RAT_RADAR_PHASE', phase: 'RUNTIME_READ_START', cycleId: message.cycleId }));
    const runtime = await new D1RuntimeStateStore(env.DB, ARC_CHAIN_ID).get();
    const checkpoint = await store.getCheckpoint();
    console.error(JSON.stringify({ event: 'RAT_RADAR_PHASE', phase: 'RUNTIME_READ_DONE', cycleId: message.cycleId, checkpointBlock: checkpoint?.blockNumber.toString() ?? null }));
    if (
      !runtime ||
      !checkpoint ||
      !runtime.sourceVerified ||
      !runtime.liveCaughtUp ||
      runtime.lastSyncError
    ) {
      return {
        status: 'SUCCESS',
        poolsProcessed: 0,
        receiptsInserted: 0,
        receiptsDuplicate: 0,
        poolsFailed: 0
      };
    }

    const launches = (await store.listLaunches())
      .filter((launch) => launch.blockNumber <= checkpoint.blockNumber);
    console.error(JSON.stringify({ event: 'RAT_RADAR_PHASE', phase: 'CURSOR_INITIALIZATION_START', cycleId: message.cycleId, launchCount: launches.length }));
    await radar.ensurePoolCursors(launches, nowMs);
    console.error(JSON.stringify({ event: 'RAT_RADAR_PHASE', phase: 'CURSOR_INITIALIZATION_DONE', cycleId: message.cycleId }));

    const rpcUrl = deps.ratRadarSource ? undefined : resolveArcRpcUrl(env);
    const source = deps.ratRadarSource ?? new ArcRatRadarSource({ rpcUrl });
    try {
      await source.assertAuthority(checkpoint.blockNumber, checkpoint.blockHash);
    } catch (error) {
      return { status: 'RETRY', code: ratRadarSyncErrorCode(error) };
    }

    const maxBatchBlocks = BigInt(integerSetting(
      env.BINRAT_RAT_RADAR_MAX_BATCH_BLOCKS,
      10_000,
      1,
      250_000
    ));
    const maxPools = integerSetting(
      env.BINRAT_RAT_RADAR_MAX_POOLS_PER_CYCLE,
      4,
      1,
      20
    );
    let poolsProcessed = 0;
    let receiptsInserted = 0;
    let receiptsDuplicate = 0;
    let poolsFailed = 0;

    for (let index = 0; index < maxPools; index += 1) {
      const cursor = await radar.nextPoolCursor(checkpoint.blockNumber, nowMs);
      if (!cursor) break;
      console.error(JSON.stringify({ event: 'RAT_RADAR_PHASE', phase: 'CURSOR_SELECTED', cycleId: message.cycleId, nextBlock: cursor.nextBlock.toString() }));
      const launch = await store.getLaunch(cursor.launchId);
      if (!launch) return { status: 'RETRY', code: 'RAT_RADAR_CURSOR_LAUNCH_MISSING' };

      const toBlock = cursor.nextBlock + maxBatchBlocks - 1n > checkpoint.blockNumber
        ? checkpoint.blockNumber
        : cursor.nextBlock + maxBatchBlocks - 1n;

      try {
        console.error(JSON.stringify({ event: 'RAT_RADAR_PHASE', phase: 'POOL_READ_START', cycleId: message.cycleId, fromBlock: cursor.nextBlock.toString(), toBlock: toBlock.toString() }));
        const receipts = await source.catchUp(launch, cursor.nextBlock, toBlock);
        console.error(JSON.stringify({ event: 'RAT_RADAR_PHASE', phase: 'POOL_READ_DONE', cycleId: message.cycleId, receiptCount: receipts.length }));
        await source.assertAuthority(checkpoint.blockNumber, checkpoint.blockHash);
        console.error(JSON.stringify({ event: 'RAT_RADAR_PHASE', phase: 'RECEIPT_PERSISTENCE_START', cycleId: message.cycleId, receiptCount: receipts.length }));
        for (const receipt of receipts) {
          const result = await radar.putSwap(receipt);
          if (result === 'INSERTED') receiptsInserted += 1;
          else receiptsDuplicate += 1;
        }
        await radar.advancePoolCursor(
          launch.launchId,
          cursor.nextBlock,
          toBlock + 1n,
          deps.now()
        );
        console.error(JSON.stringify({ event: 'RAT_RADAR_PHASE', phase: 'CURSOR_ADVANCED', cycleId: message.cycleId, nextBlock: (toBlock + 1n).toString() }));
        poolsProcessed += 1;
      } catch (error) {
        const code = ratRadarSyncErrorCode(error);
        console.error(JSON.stringify({ event: 'RAT_RADAR_POOL_FAILED', cycleId: message.cycleId, code }));
        if (
          code.startsWith('ARC_CHAIN_ID_DRIFT') ||
          code.startsWith('RAT_RADAR_CHECKPOINT_REORG') ||
          code.startsWith('RAT_RADAR_BLOCK_HASH_MISSING')
        ) {
          return { status: 'RETRY', code };
        }
        poolsFailed += 1;
        const backoffMinutes = Math.min(60, 2 ** Math.min(cursor.failureCount, 5));
        await radar.recordPoolFailure(
          launch.launchId,
          cursor.nextBlock,
          code,
          deps.now() + backoffMinutes * 60_000,
          deps.now()
        );
      }
    }

    return {
      status: 'SUCCESS',
      poolsProcessed,
      receiptsInserted,
      receiptsDuplicate,
      poolsFailed
    };
  } finally {
    store.close();
    console.error(JSON.stringify({ event: 'RAT_RADAR_PHASE', phase: 'LEASE_RELEASE_START', cycleId: message.cycleId }));
    await lease.release(RAT_RADAR_LEASE_NAME, message.cycleId);
    console.error(JSON.stringify({ event: 'RAT_RADAR_PHASE', phase: 'LEASE_RELEASE_DONE', cycleId: message.cycleId }));
  }
}

export async function runCloudflareRatWatchCycle(
  env: CloudflareSyncEnv,
  message: BinratSyncMessage,
  deps: CloudflareSyncDeps = { now: Date.now }
): Promise<
  | { status: 'SUCCESS'; enqueued: number; sent: number }
  | { status: 'BUSY' }
  | { status: 'RETRY'; code: string }
> {
  if (!isSyncMessage(message) || message.kind !== 'RAT_WATCH_CYCLE') {
    return { status: 'RETRY', code: 'SYNC_MESSAGE_INVALID' };
  }

  const lease = new D1SyncLeaseStore(env.DB);
  if (!(await lease.claim(RAT_WATCH_LEASE_NAME, message.cycleId, deps.now()))) {
    return { status: 'BUSY' };
  }

  try {
    const watches = new D1RatWatchStore(env.DB);
    if (env.BINRAT_AUTONOMOUS_RAT_ENABLED === 'true') {
      const enqueued = await enqueueFindings(env.DB,deps.now());
      const sent = await deliverFindings(env.DB,
        deps.watchSource ?? robinhoodWatchSource(resolveRobinhoodRpcUrl(env)),
        required(env.TELEGRAM_BOT_TOKEN,'TELEGRAM_BOT_TOKEN'),deps.externalFetch ?? fetch,deps.now,
        { enabled: env.BINRAT_TELEGRAM_MEDIA_ENABLED === 'true', origin: env.BINRAT_PUBLIC_SITE_URL ?? '' });
      return {status:'SUCCESS',enqueued,sent};
    }
    const enqueued = await watches.enqueueRecurrenceAlerts(ARC_CHAIN_ID, deps.now());
    const pending = await watches.listPending(5);
    if (pending.length === 0) return { status: 'SUCCESS', enqueued, sent: 0 };

    const token = required(env.TELEGRAM_BOT_TOKEN, 'TELEGRAM_BOT_TOKEN');
    const fetchImpl = deps.externalFetch ?? fetch;
    let sent = 0;
    for (const alert of pending) {
      try {
        const telegramMessageId = await sendRatWatchMessage(
          token,
          alert.chatId,
          ratWatchAlertText(alert),
          fetchImpl
        );
        await watches.completeSent(alert.alertId, telegramMessageId, deps.now());
        sent += 1;
      } catch {
        return { status: 'RETRY', code: 'RAT_WATCH_TELEGRAM_SEND_FAILED' };
      }
    }
    return { status: 'SUCCESS', enqueued, sent };
  } finally {
    await lease.release(RAT_WATCH_LEASE_NAME, message.cycleId);
  }
}

async function sendRatWatchMessage(
  token: string,
  chatId: number,
  text: string,
  fetchImpl: typeof fetch
): Promise<number> {
  const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4096),
      disable_web_page_preview: true
    })
  });
  let parsed: { ok?: boolean; result?: { message_id?: number } } = {};
  try { parsed = await response.json() as { ok?: boolean; result?: { message_id?: number } }; } catch {}
  if (!response.ok || parsed.ok !== true) throw new Error('RAT_WATCH_TELEGRAM_SEND_FAILED');
  if (!Number.isSafeInteger(parsed.result?.message_id)) {
    throw new Error('RAT_WATCH_TELEGRAM_MESSAGE_ID_MISSING');
  }
  return parsed.result!.message_id!;
}

async function persistLiveFailure(
  runtimeStore: D1RuntimeStateStore,
  previous: D1RuntimeState | null,
  code: string,
  now: () => number
): Promise<void> {
  await runtimeStore.put({
    sourceVerified: false,
    liveCaughtUp: false,
    headBlock: previous?.headBlock ?? null,
    targetBlock: previous?.targetBlock ?? null,
    observationReady: previous?.observationReady ?? false,
    historyBackfillComplete: previous?.historyBackfillComplete ?? false,
    historyBackfillTargetBlock: previous?.historyBackfillTargetBlock ?? null,
    lastSyncError: code,
    lastHistoryError: previous?.lastHistoryError ?? null,
    lastObservationError: previous?.lastObservationError ?? null,
    updatedAtMs: now()
  });
}

type SyncFailurePhase = 'SOURCE_CONSTRUCTION' | 'SOURCE_BOOTSTRAP' | 'LIVE_SYNC' | 'HISTORY_SYNC' | 'RUNTIME_D1';

interface SyncErrorDiagnostic {
  code: string;
  errorName: string;
  httpStatus: number | null;
  causeCode: string | null;
}

export function syncErrorCode(error: unknown): string {
  if (error instanceof Error && /(?:too many|limit).*subrequests?|subrequest.*(?:limit|exceeded)/i.test(error.message)) {
    return 'PLATFORM_SUBREQUEST_LIMIT';
  }
  const code = explicitSyncErrorCode(error);
  if (code) return code;

  const status = httpStatus(error);
  if (status !== null) return `SYNC_HTTP_${status}`;

  const causeCode = safeCauseCode(error);
  if (causeCode) return `SYNC_${causeCode}`;

  const errorName = safeErrorName(error);
  return errorName === 'UNKNOWN_ERROR' ? 'SYNC_UNKNOWN_ERROR' : `SYNC_${errorName}`;
}

function explicitSyncErrorCode(error: unknown): string | null {
  const message = error instanceof Error ? error.message : '';
  return message.match(
    /^(ARC_[A-Z_]+|ARCPAD_[A-Z_]+|PONS_[A-Z0-9_]+|REORG_[A-Z_]+|LAUNCH_[A-Z_]+|PROVENANCE_[A-Z_]+|OBSERVATION_[A-Z_]+|HISTORY_[A-Z_]+|D1_[A-Z_]+|SYNC_LEASE_[A-Z_]+|MISSING_CONFIG)(?=:|$)/
  )?.[1] ?? null;
}

function reportSyncFailure(cycleId: string, phase: SyncFailurePhase, error: unknown): string {
  const diagnostic = syncErrorDiagnostic(error);
  console.error(JSON.stringify({
    event: 'SYNC_FAILURE',
    cycleId,
    phase,
    code: diagnostic.code,
    errorName: diagnostic.errorName,
    httpStatus: diagnostic.httpStatus,
    causeCode: diagnostic.causeCode
  }));
  return diagnostic.code;
}

function syncErrorDiagnostic(error: unknown): SyncErrorDiagnostic {
  return {
    code: syncErrorCode(error),
    errorName: safeErrorName(error),
    httpStatus: httpStatus(error),
    causeCode: safeCauseCode(error)
  };
}

function safeErrorName(error: unknown): string {
  if (!(error instanceof Error)) return 'UNKNOWN_ERROR';
  const normalized = error.name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return new Set([
    'ABORT_ERROR',
    'ERROR',
    'FETCH_ERROR',
    'HTTP_REQUEST_ERROR',
    'NETWORK_ERROR',
    'RPC_ERROR',
    'TIMEOUT_ERROR',
    'TYPE_ERROR'
  ]).has(normalized) ? normalized : 'UNKNOWN_ERROR';
}

function safeCauseCode(error: unknown): string | null {
  const allowed = new Set([
    'ABORT_ERR',
    'ECONNABORTED',
    'ECONNREFUSED',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENETDOWN',
    'ENETUNREACH',
    'EPIPE',
    'ETIMEDOUT',
    'ERR_NETWORK',
    'ERR_SOCKET_CLOSED',
    'ERR_STREAM_PREMATURE_CLOSE',
    'UND_ERR_BODY_TIMEOUT',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_SOCKET'
  ]);
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && allowed.has(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

function ratRadarSyncErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const explicit = message.match(/^(RAT_RADAR_[A-Z0-9_]+|ARC_[A-Z0-9_]+)(?=:|$)/)?.[1];
  if (explicit) return explicit;

  const rawName = error instanceof Error ? error.name : '';
  const normalizedName = rawName
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
  return normalizedName && normalizedName !== 'ERROR'
    ? `RAT_RADAR_${normalizedName}`
    : 'RAT_RADAR_SYNC_FAILED';
}

function observationSyncErrorCode(error: unknown): string {
  const code = explicitSyncErrorCode(error);
  if (code) return code;

  const rawName = error instanceof Error ? error.name : '';
  const normalizedName = rawName
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  const status = httpStatus(error);
  if (normalizedName === 'HTTP_REQUEST_ERROR' && status !== null) {
    return `OBSERVATION_HTTP_${status}`;
  }

  return normalizedName && normalizedName !== 'ERROR'
    ? `OBSERVATION_${normalizedName}`
    : 'OBSERVATION_SYNC_FAILED';
}

function httpStatus(error: unknown): number | null {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth += 1) {
    const status = (current as { status?: unknown }).status;
    if (Number.isInteger(status) && Number(status) >= 100 && Number(status) <= 599) {
      return Number(status);
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

function shouldEnqueueObservation(enqueuedAtMs: number): boolean {
  return Math.floor(enqueuedAtMs / 60_000) % 2 === 0;
}

function shouldEnqueueRatWatch(enqueuedAtMs: number): boolean {
  return Math.floor(enqueuedAtMs / 60_000) % 5 === 0;
}

export function resolveArcRpcUrl(env: Pick<CloudflareSyncEnv, 'ARC_RPC_URL'>): string {
  const configured = env.ARC_RPC_URL?.trim();
  return configured || ARC_PUBLIC_RPC_FALLBACK_URL;
}

export function resolveRobinhoodRpcUrl(env: Pick<CloudflareSyncEnv, 'ROBINHOOD_RPC_URL'>): string {
  const configured = env.ROBINHOOD_RPC_URL?.trim();
  return configured || ROBINHOOD_PUBLIC_RPC_FALLBACK_URL;
}

function integerSetting(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}

function required(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`MISSING_CONFIG:${name}`);
  return trimmed;
}

function isSyncMessage(value: unknown): value is BinratSyncMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    (
      item.kind === 'SYNC_CYCLE' ||
      item.kind === 'PONS_SYNC_CYCLE' ||
      item.kind === 'OBSERVATION_CYCLE' ||
      item.kind === 'RAT_WATCH_CYCLE' ||
      item.kind === 'RAT_RADAR_CYCLE'
    ) &&
    typeof item.cycleId === 'string' &&
    /^[A-Za-z0-9:_-]{1,200}$/.test(item.cycleId) &&
    Number.isSafeInteger(item.enqueuedAtMs) &&
    Number(item.enqueuedAtMs) >= 0
  );
}
