import { ArcPadLaunchSource } from '../arc/arcpadSource.js';
import { ARCPAD_START_BLOCK, ARC_CHAIN_ID } from '../arc/chain.js';
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
  BINRAT_LIVE_LOOKBACK_BLOCKS?: string;
  BINRAT_CONFIRMATIONS?: string;
  BINRAT_MAX_BATCH_BLOCKS?: string;
  BINRAT_MAX_OBSERVATIONS_PER_SYNC?: string;
  BINRAT_RAT_RADAR_MAX_BATCH_BLOCKS?: string;
  BINRAT_RAT_RADAR_MAX_POOLS_PER_CYCLE?: string;
  TELEGRAM_BOT_TOKEN?: string;
}

export interface BinratSyncMessage {
  kind: 'SYNC_CYCLE' | 'OBSERVATION_CYCLE' | 'RAT_WATCH_CYCLE' | 'RAT_RADAR_CYCLE';
  cycleId: string;
  enqueuedAtMs: number;
}

export interface CloudflareSyncDeps {
  now: () => number;
  launchSource?: LaunchSource;
  observationSource?: ObservationSource;
  ratRadarSource?: RatRadarSource;
  externalFetch?: typeof fetch;
}

export type SyncCycleResult =
  | { status: 'SUCCESS'; liveCaughtUp: boolean }
  | { status: 'BUSY' }
  | { status: 'RETRY'; code: string };

const SYNC_LEASE_NAME = 'binrat:arc-sync';
const OBSERVATION_LEASE_NAME = 'binrat:arc-observation';
const RAT_WATCH_LEASE_NAME = 'binrat:rat-watch';
const RAT_RADAR_LEASE_NAME = 'binrat:rat-radar';

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
      : required(env.ARC_RPC_URL, 'ARC_RPC_URL');
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
  if (!(await lease.claim(RAT_RADAR_LEASE_NAME, message.cycleId, nowMs))) {
    return { status: 'BUSY' };
  }

  const store = new D1Store(env.DB, ARC_CHAIN_ID);
  const radar = new D1RatRadarStore(env.DB, ARC_CHAIN_ID);
  try {
    const runtime = await new D1RuntimeStateStore(env.DB, ARC_CHAIN_ID).get();
    const checkpoint = await store.getCheckpoint();
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
    await radar.ensurePoolCursors(launches, nowMs);

    const rpcUrl = deps.ratRadarSource ? undefined : required(env.ARC_RPC_URL, 'ARC_RPC_URL');
    const source = deps.ratRadarSource ?? new ArcRatRadarSource({ rpcUrl });
    try {
      await source.assertAuthority(checkpoint.blockNumber, checkpoint.blockHash);
    } catch (error) {
      return { status: 'RETRY', code: ratRadarSyncErrorCode(error) };
    }

    const maxBatchBlocks = BigInt(integerSetting(
      env.BINRAT_RAT_RADAR_MAX_BATCH_BLOCKS,
      25_000,
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
      const launch = await store.getLaunch(cursor.launchId);
      if (!launch) return { status: 'RETRY', code: 'RAT_RADAR_CURSOR_LAUNCH_MISSING' };

      const toBlock = cursor.nextBlock + maxBatchBlocks - 1n > checkpoint.blockNumber
        ? checkpoint.blockNumber
        : cursor.nextBlock + maxBatchBlocks - 1n;

      try {
        const receipts = await source.catchUp(launch, cursor.nextBlock, toBlock);
        await source.assertAuthority(checkpoint.blockNumber, checkpoint.blockHash);
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
        poolsProcessed += 1;
      } catch (error) {
        const code = ratRadarSyncErrorCode(error);
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
    await lease.release(RAT_RADAR_LEASE_NAME, message.cycleId);
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

function syncErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const code = message.match(
    /^(ARC_[A-Z_]+|ARCPAD_[A-Z_]+|REORG_[A-Z_]+|LAUNCH_[A-Z_]+|PROVENANCE_[A-Z_]+|OBSERVATION_[A-Z_]+|HISTORY_[A-Z_]+)(?=:|$)/
  )?.[1];
  return code ?? 'SYNC_FAILED';
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

function shouldEnqueueObservation(enqueuedAtMs: number): boolean {
  return Math.floor(enqueuedAtMs / 60_000) % 2 === 0;
}

function shouldEnqueueRatWatch(enqueuedAtMs: number): boolean {
  return Math.floor(enqueuedAtMs / 60_000) % 5 === 0;
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
