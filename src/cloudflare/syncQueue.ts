import { ArcPadLaunchSource } from '../arc/arcpadSource.js';
import { ARCPAD_START_BLOCK, ARC_CHAIN_ID } from '../arc/chain.js';
import { ArcObservationSource } from '../arc/observationSource.js';
import type { LaunchSource } from '../core/ports.js';
import { syncHistoricalLaunches } from '../indexer/syncHistoricalLaunches.js';
import { syncLaunches } from '../indexer/syncLaunches.js';
import {
  syncObservations,
  type ObservationSource
} from '../observations/syncObservations.js';
import { D1RuntimeStateStore, type D1RuntimeState } from './runtimeState.js';
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
  BINRAT_LIVE_LOOKBACK_BLOCKS?: string;
  BINRAT_CONFIRMATIONS?: string;
  BINRAT_MAX_BATCH_BLOCKS?: string;
  BINRAT_MAX_OBSERVATIONS_PER_SYNC?: string;
}

export interface BinratSyncMessage {
  kind: 'SYNC_CYCLE';
  cycleId: string;
  enqueuedAtMs: number;
}

export interface CloudflareSyncDeps {
  now: () => number;
  launchSource?: LaunchSource;
  observationSource?: ObservationSource;
}

export type SyncCycleResult =
  | { status: 'SUCCESS'; liveCaughtUp: boolean }
  | { status: 'BUSY' }
  | { status: 'RETRY'; code: string };

const SYNC_LEASE_NAME = 'binrat:arc-sync';

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

export async function handleSyncQueueBatch(
  batch: SyncQueueBatchLike,
  env: CloudflareSyncEnv
): Promise<void> {
  for (const message of batch.messages) {
    if (!isSyncMessage(message.body)) {
      message.ack();
      continue;
    }
    try {
      const result = await runCloudflareSyncCycle(env, message.body);
      if (result.status === 'RETRY') message.retry({ delaySeconds: 30 });
      else message.ack();
    } catch {
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
  if (!(await lease.claim(SYNC_LEASE_NAME, message.cycleId, nowMs))) {
    return { status: 'BUSY' };
  }

  const store = new D1Store(env.DB, ARC_CHAIN_ID);
  const runtimeStore = new D1RuntimeStateStore(env.DB, ARC_CHAIN_ID);
  let previous: D1RuntimeState | null = null;

  try {
    previous = await runtimeStore.get();
    const rpcUrl = deps.launchSource ? undefined : required(env.ARC_RPC_URL, 'ARC_RPC_URL');
    const source = deps.launchSource ?? new ArcPadLaunchSource({ rpcUrl });
    const observationSource = deps.observationSource ?? new ArcObservationSource({
      rpcUrl: deps.observationSource ? undefined : required(env.ARC_RPC_URL, 'ARC_RPC_URL')
    });

    let bootstrapHead: bigint;
    try {
      bootstrapHead = await source.getHeadBlockNumber();
      await source.assertAuthority(bootstrapHead);
    } catch (error) {
      const code = syncErrorCode(error);
      await persistLiveFailure(runtimeStore, previous, code, deps.now);
      return { status: 'RETRY', code };
    }

    const lookback = BigInt(integerSetting(env.BINRAT_LIVE_LOOKBACK_BLOCKS, 1000, 1, 1_000_000));
    const confirmations = BigInt(integerSetting(env.BINRAT_CONFIRMATIONS, 2, 0, 10_000));
    const maxBatchBlocks = BigInt(integerSetting(env.BINRAT_MAX_BATCH_BLOCKS, 1000, 1, 100_000));
    const recentStart = bootstrapHead > lookback ? bootstrapHead - lookback : 0n;
    const liveWindowStart = recentStart > ARCPAD_START_BLOCK ? recentStart : ARCPAD_START_BLOCK;
    const beforeCheckpoint = await store.getCheckpoint();
    const startBlock = beforeCheckpoint ? ARCPAD_START_BLOCK : liveWindowStart;
    const historyTarget =
      previous && previous.headBlock !== null && previous.targetBlock !== null
        ? previous.historyBackfillTargetBlock
        : liveWindowStart > ARCPAD_START_BLOCK
          ? liveWindowStart - 1n
          : null;

    let liveReport;
    try {
      liveReport = await syncLaunches(source, store, {
        startBlock,
        confirmations,
        maxBatchBlocks,
        reorgLookbackBlocks: 32n,
        pollIntervalMs: 1000,
        maxBatchesPerRun: 1
      });
    } catch (error) {
      const code = syncErrorCode(error);
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

    if (liveCaughtUp) {
      if (historyTarget === null) {
        historyBackfillComplete = true;
        lastHistoryError = null;
      } else if (!historyBackfillComplete) {
        try {
          const history = await syncHistoricalLaunches(source, store, {
            startBlock: ARCPAD_START_BLOCK,
            endBlock: historyTarget,
            maxBatchBlocks
          });
          historyBackfillComplete = history.complete;
          lastHistoryError = null;
        } catch (error) {
          historyBackfillComplete = false;
          const code = syncErrorCode(error);
          lastHistoryError = code === 'SYNC_FAILED' ? 'HISTORY_SYNC_FAILED' : code;
        }
      }

      try {
        await syncObservations(observationSource, store, {
          confirmations,
          maxObservationsPerSync: integerSetting(
            env.BINRAT_MAX_OBSERVATIONS_PER_SYNC,
            1,
            1,
            10_000
          )
        });
        observationReady = true;
        lastObservationError = null;
      } catch (error) {
        observationReady = false;
        const code = observationSyncErrorCode(error);
        lastObservationError = code;
        console.error(JSON.stringify({ event: 'OBSERVATION_SYNC_FAILED', code }));
      }
    }

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
      updatedAtMs: deps.now()
    });

    return { status: 'SUCCESS', liveCaughtUp };
  } finally {
    store.close();
    await lease.release(SYNC_LEASE_NAME, message.cycleId);
  }
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

function syncErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const code = message.match(
    /^(ARC_[A-Z_]+|ARCPAD_[A-Z_]+|REORG_[A-Z_]+|LAUNCH_[A-Z_]+|PROVENANCE_[A-Z_]+|OBSERVATION_[A-Z_]+|HISTORY_[A-Z_]+)(?=:|$)/
  )?.[1];
  return code ?? 'SYNC_FAILED';
}

function observationSyncErrorCode(error: unknown): string {
  const code = syncErrorCode(error);
  if (code !== 'SYNC_FAILED') return code;

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
  if (!error || typeof error !== 'object') return null;
  const status = (error as { status?: unknown }).status;
  return Number.isInteger(status) && Number(status) >= 100 && Number(status) <= 599
    ? Number(status)
    : null;
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
    item.kind === 'SYNC_CYCLE' &&
    typeof item.cycleId === 'string' &&
    /^[A-Za-z0-9:_-]{1,200}$/.test(item.cycleId) &&
    Number.isSafeInteger(item.enqueuedAtMs) &&
    Number(item.enqueuedAtMs) >= 0
  );
}
