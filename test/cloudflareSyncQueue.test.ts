import assert from 'node:assert/strict';
import test from 'node:test';
import { ARCPAD_START_BLOCK } from '../src/arc/chain.js';
import type { RatRadarSource } from '../src/arc/ratRadarSource.js';
import type { LaunchSource } from '../src/core/ports.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1RatRadarStore } from '../src/cloudflare/ratRadarStore.js';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1SyncLeaseStore } from '../src/cloudflare/syncLease.js';
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
  D1ResultLike
} from '../src/cloudflare/d1Types.js';
import {
  handleSyncQueueBatch,
  ARC_PUBLIC_RPC_FALLBACK_URL,
  calculatePonsVelocity,
  PONS_SYNC_LEASE_MS,
  resolveArcRpcUrl,
  resolveRobinhoodArchiveRpcUrl,
  runCloudflarePonsOutcomeCycle,
  runCloudflarePonsSyncCycle,
  runCloudflareObservationCycle,
  runCloudflareRatRadarCycle,
  runCloudflareSyncCycle,
  syncErrorCode,
  type BinratSyncMessage
} from '../src/cloudflare/syncQueue.js';
import { PonsLaunchSource } from '../src/pons/ponsSource.js';
import { PONS_V2_FACTORY, PONS_V2_START_BLOCK, ROBINHOOD_CHAIN_ID } from '../src/pons/chain.js';
import { buildPonsCurveOutcomeCapabilityReceipt } from '../src/pons/outcomeCapability.js';
import type { PonsOutcomeObservationSource } from '../src/pons/outcomeReceipts.js';
import type {
  ObservationBlockPoint,
  ObservationSource
} from '../src/observations/syncObservations.js';
import type { LaunchObservationFacts } from '../src/observations/types.js';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';
import { deriveRatRadarSwapReceipt, type RatRadarSwapReceipt } from '../src/ratRadar/activity.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const hash = (block: bigint) => `0x${block.toString(16).padStart(64, '0')}` as Hex;

class FakeLaunchSource implements LaunchSource {
  head = ARCPAD_START_BLOCK + 5_000n;
  catchUpCalls: Array<[bigint, bigint]> = [];

  async getHeadBlockNumber() { return this.head; }
  async getBlockHash(blockNumber: bigint) { return hash(blockNumber); }
  async assertAuthority(_blockNumber: bigint) {}
  async catchUp(fromBlock: bigint, toBlock: bigint): Promise<LaunchObserved[]> {
    this.catchUpCalls.push([fromBlock, toBlock]);
    return [];
  }
}

class FakePonsSource implements LaunchSource {
  head = PONS_V2_START_BLOCK + 100_002n;
  catchUpCalls: Array<[bigint, bigint]> = [];
  async getHeadBlockNumber() { return this.head; }
  async getBlockHash(blockNumber: bigint) { return hash(blockNumber); }
  async assertAuthority(_blockNumber: bigint) {}
  async catchUp(fromBlock: bigint, toBlock: bigint): Promise<LaunchObserved[]> {
    this.catchUpCalls.push([fromBlock, toBlock]);
    return [];
  }
}

class FakeObservationSource implements ObservationSource {
  constructor(private readonly head: bigint) {}
  async getHeadBlockNumber() { return this.head; }
  async getBlockPoint(blockNumber: bigint): Promise<ObservationBlockPoint> {
    return {
      blockNumber,
      blockHash: hash(blockNumber),
      timestampMs: Number(blockNumber) * 1_000
    };
  }
  async readObservationFacts(
    _launch: LaunchObserved,
    _blockNumber: bigint
  ): Promise<{ facts: LaunchObservationFacts; missing: string[] }> {
    return {
      facts: {},
      missing: [
        'POOL_CODE',
        'POOL_SLOT0',
        'POOL_LIQUIDITY',
        'CREATOR_BALANCE',
        'TOKEN_TOTAL_SUPPLY',
        'TOKEN_DECIMALS'
      ]
    };
  }
}

function message(id: string, at = 1_000): BinratSyncMessage {
  return { kind: 'SYNC_CYCLE', cycleId: id, enqueuedAtMs: at };
}

function observationMessage(id: string, at = 1_000): BinratSyncMessage {
  return { kind: 'OBSERVATION_CYCLE', cycleId: id, enqueuedAtMs: at };
}


function ratRadarMessage(id: string, at = 1_000): BinratSyncMessage {
  return { kind: 'RAT_RADAR_CYCLE', cycleId: id, enqueuedAtMs: at };
}

class FakeRatRadarSource implements RatRadarSource {
  authorityCalls: Array<[bigint, Hex]> = [];
  catchUpCalls: Array<[string, bigint, bigint]> = [];
  failLaunchId: string | null = null;
  receiptByLaunch = new Map<string, RatRadarSwapReceipt[]>();

  async assertAuthority(blockNumber: bigint, expectedBlockHash: Hex): Promise<void> {
    this.authorityCalls.push([blockNumber, expectedBlockHash]);
  }

  async catchUp(
    launch: LaunchObserved,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<RatRadarSwapReceipt[]> {
    this.catchUpCalls.push([launch.launchId, fromBlock, toBlock]);
    if (launch.launchId === this.failLaunchId) throw new Error('RAT_RADAR_TEST_POOL_FAILURE');
    return (this.receiptByLaunch.get(launch.launchId) ?? [])
      .filter((receipt) => receipt.blockNumber >= fromBlock && receipt.blockNumber <= toBlock);
  }
}


test('Arc RPC resolver prefers configured authority and otherwise uses the public mainnet fallback', () => {
  assert.equal(
    resolveArcRpcUrl({ ARC_RPC_URL: ' https://configured.example/rpc ' }),
    'https://configured.example/rpc'
  );
  assert.equal(resolveArcRpcUrl({}), ARC_PUBLIC_RPC_FALLBACK_URL);
  assert.equal(ARC_PUBLIC_RPC_FALLBACK_URL, 'https://rpc.mainnet.arc.io');
});

test('sync diagnostics preserve explicit codes and expose only bounded safe classes', () => {
  assert.equal(syncErrorCode(new Error('ARCPAD_AUTHORITY_TEST')), 'ARCPAD_AUTHORITY_TEST');
  assert.equal(syncErrorCode(new Error('PONS_GET_HEAD_FAILED')), 'PONS_GET_HEAD_FAILED');
  assert.equal(syncErrorCode(new Error('PONS_FACTORY_AUTHORITY_DRIFT')), 'PONS_FACTORY_AUTHORITY_DRIFT');

  const rateLimited = Object.assign(new Error('https://user:secret@rpc.example'), {
    name: 'HttpRequestError',
    status: 429
  });
  assert.equal(syncErrorCode(rateLimited), 'SYNC_HTTP_429');

  const unavailable = Object.assign(new Error('response body must not persist'), {
    name: 'HttpRequestError',
    cause: { status: 503 }
  });
  assert.equal(syncErrorCode(unavailable), 'SYNC_HTTP_503');

  assert.equal(
    syncErrorCode(Object.assign(new Error('timeout details'), { name: 'TimeoutError' })),
    'SYNC_TIMEOUT_ERROR'
  );
  assert.equal(
    syncErrorCode(new Error('Too many subrequests for this invocation')),
    'PLATFORM_SUBREQUEST_LIMIT'
  );
  assert.equal(
    syncErrorCode(Object.assign(new Error('abort details'), { name: 'AbortError' })),
    'SYNC_ABORT_ERROR'
  );
  assert.equal(syncErrorCode(new TypeError('type details')), 'SYNC_TYPE_ERROR');
  assert.equal(
    syncErrorCode(Object.assign(new Error('transport details'), { cause: { code: 'ECONNRESET' } })),
    'SYNC_ECONNRESET'
  );

  const unknown = Object.assign(new Error('https://secret.example/path?token=secret'), {
    name: 'Unexpected error name carrying secret'
  });
  const code = syncErrorCode(unknown);
  assert.equal(code, 'SYNC_UNKNOWN_ERROR');
  assert.equal(code.includes('secret'), false);
  assert.equal(code.includes('https'), false);

  const wrapped = new PonsLaunchSource({ client: {
    getBlockNumber: async () => { throw Object.assign(new Error('https://secret.example'), { name: 'TimeoutError' }); }
  } as never });
  return assert.rejects(wrapped.getHeadBlockNumber(), (error: unknown) => {
    assert.equal(syncErrorCode(error), 'SYNC_TIMEOUT_ERROR');
    return true;
  });
});

test('Cloudflare sync persists live authority before subordinate history reads', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const runtime = new D1RuntimeStateStore(db, 5042);
  const source = new FakeLaunchSource();
  let observedLiveState = false;

  source.catchUp = async (fromBlock: bigint, toBlock: bigint) => {
    source.catchUpCalls.push([fromBlock, toBlock]);
    if (fromBlock === ARCPAD_START_BLOCK) {
      const state = await runtime.get();
      observedLiveState = Boolean(
        state?.sourceVerified &&
        state.liveCaughtUp &&
        state.lastSyncError === null &&
        state.updatedAtMs === 10_000
      );
      throw new Error('HISTORY_ARCHIVE_UNAVAILABLE');
    }
    return [];
  };

  try {
    const result = await runCloudflareSyncCycle(
      {
        DB: db,
        BINRAT_LIVE_LOOKBACK_BLOCKS: '1000',
        BINRAT_MAX_BATCH_BLOCKS: '1000',
        BINRAT_CONFIRMATIONS: '2'
      },
      message('cycle-live-before-history'),
      { now: () => 10_000, launchSource: source }
    );

    assert.deepEqual(result, { status: 'SUCCESS', liveCaughtUp: true });
    assert.equal(observedLiveState, true);
    const final = await runtime.get();
    assert.equal(final?.lastHistoryError, 'HISTORY_ARCHIVE_UNAVAILABLE');
    assert.equal(final?.updatedAtMs, 10_000);
  } finally {
    db.close();
  }
});

test('Cloudflare sync cycle catches live window first and advances history in bounded batches', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const source = new FakeLaunchSource();
  const observations = new FakeObservationSource(source.head);
  let now = 10_000;
  try {
    const first = await runCloudflareSyncCycle(
      {
        DB: db,
        BINRAT_LIVE_LOOKBACK_BLOCKS: '1000',
        BINRAT_MAX_BATCH_BLOCKS: '1000',
        BINRAT_CONFIRMATIONS: '2'
      },
      message('cycle-1'),
      { now: () => now++, launchSource: source, observationSource: observations }
    );
    assert.deepEqual(first, { status: 'SUCCESS', liveCaughtUp: true });

    const runtime = new D1RuntimeStateStore(db, 5042);
    const state = await runtime.get();
    assert.equal(state?.sourceVerified, true);
    assert.equal(state?.liveCaughtUp, true);
    assert.equal(state?.headBlock, source.head);
    assert.equal(state?.targetBlock, source.head - 2n);
    assert.equal(state?.historyBackfillTargetBlock, ARCPAD_START_BLOCK + 3_999n);
    assert.equal(state?.lastSyncError, null);
    assert.equal(state?.observationReady, false);
    const liveUpdatedAtMs = state!.updatedAtMs;

    const observation = await runCloudflareObservationCycle(
      {
        DB: db,
        BINRAT_CONFIRMATIONS: '2',
        BINRAT_MAX_OBSERVATIONS_PER_SYNC: '1'
      },
      observationMessage('observation-1'),
      {
        now: () => 99_000,
        observationSource: observations
      }
    );
    assert.deepEqual(observation, { status: 'SUCCESS', observationReady: true });
    const afterObservation = await runtime.get();
    assert.equal(afterObservation?.observationReady, true);
    assert.equal(afterObservation?.updatedAtMs, liveUpdatedAtMs);

    const cursorAfterFirst = await db.prepare(
      'SELECT next_block FROM launch_history_backfill_state WHERE chain_id = ?'
    ).bind(5042).first<{ next_block: string }>();
    assert.equal(BigInt(cursorAfterFirst!.next_block), ARCPAD_START_BLOCK + 1_000n);

    const second = await runCloudflareSyncCycle(
      {
        DB: db,
        BINRAT_LIVE_LOOKBACK_BLOCKS: '1000',
        BINRAT_MAX_BATCH_BLOCKS: '1000',
        BINRAT_CONFIRMATIONS: '2'
      },
      message('cycle-2'),
      { now: () => now++, launchSource: source, observationSource: observations }
    );
    assert.deepEqual(second, { status: 'SUCCESS', liveCaughtUp: true });

    const cursorAfterSecond = await db.prepare(
      'SELECT next_block FROM launch_history_backfill_state WHERE chain_id = ?'
    ).bind(5042).first<{ next_block: string }>();
    assert.equal(BigInt(cursorAfterSecond!.next_block), ARCPAD_START_BLOCK + 2_000n);
  } finally {
    db.close();
  }
});

test('observation failures preserve a sanitized error class without blocking live readiness', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const source = new FakeLaunchSource();

  class FailingObservationSource extends FakeObservationSource {
    override async getHeadBlockNumber(): Promise<bigint> {
      const error = new Error('sensitive transport details intentionally omitted');
      error.name = 'BlockNotFoundError';
      throw error;
    }
  }

  try {
    await runCloudflareSyncCycle(
      {
        DB: db,
        BINRAT_LIVE_LOOKBACK_BLOCKS: '1000',
        BINRAT_MAX_BATCH_BLOCKS: '1000',
        BINRAT_CONFIRMATIONS: '2'
      },
      message('cycle-before-observation-fail'),
      {
        now: () => 14_000,
        launchSource: source
      }
    );
    const result = await runCloudflareObservationCycle(
      { DB: db, BINRAT_CONFIRMATIONS: '2' },
      observationMessage('cycle-observation-fail'),
      {
        now: () => 15_000,
        observationSource: new FailingObservationSource(source.head)
      }
    );

    assert.deepEqual(result, { status: 'SUCCESS', observationReady: false });
    const state = await new D1RuntimeStateStore(db, 5042).get();
    assert.equal(state?.sourceVerified, true);
    assert.equal(state?.liveCaughtUp, true);
    assert.equal(state?.observationReady, false);
    assert.equal(state?.lastObservationError, 'OBSERVATION_BLOCK_NOT_FOUND_ERROR');
    assert.equal(state?.lastSyncError, null);
  } finally {
    db.close();
  }
});

test('observation HTTP failures expose only sanitized status diagnostics', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const source = new FakeLaunchSource();

  class RateLimitedObservationSource extends FakeObservationSource {
    override async getHeadBlockNumber(): Promise<bigint> {
      const error = new Error('provider details intentionally omitted') as Error & { status?: number };
      error.name = 'HttpRequestError';
      error.status = 429;
      throw error;
    }
  }

  try {
    await runCloudflareSyncCycle(
      { DB: db },
      message('cycle-before-observation-429'),
      {
        now: () => 15_500,
        launchSource: source
      }
    );
    const result = await runCloudflareObservationCycle(
      { DB: db },
      observationMessage('cycle-observation-429'),
      {
        now: () => 16_000,
        observationSource: new RateLimitedObservationSource(source.head)
      }
    );

    assert.deepEqual(result, { status: 'SUCCESS', observationReady: false });
    const state = await new D1RuntimeStateStore(db, 5042).get();
    assert.equal(state?.observationReady, false);
    assert.equal(state?.lastObservationError, 'OBSERVATION_HTTP_429');
    assert.equal(state?.lastSyncError, null);
  } finally {
    db.close();
  }
});

test('successful live queue work schedules separate observation and Rat Watch jobs on minute zero', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const source = new FakeLaunchSource();
  const sent: BinratSyncMessage[] = [];
  let acked = 0;
  let retried = 0;
  let now = 17_000;

  try {
    await handleSyncQueueBatch(
      {
        messages: [{
          body: message('cycle-dispatch'),
          ack() { acked += 1; },
          retry() { retried += 1; }
        }]
      },
      {
        DB: db,
        SYNC_QUEUE: {
          async send(body) {
            sent.push(body);
          }
        },
        BINRAT_LIVE_LOOKBACK_BLOCKS: '1000',
        BINRAT_MAX_BATCH_BLOCKS: '1000',
        BINRAT_CONFIRMATIONS: '2'
      },
      {
        now: () => now++,
        launchSource: source
      }
    );

    assert.equal(acked, 1);
    assert.equal(retried, 0);
    assert.equal(sent.length, 3);
    assert.deepEqual(
      sent.map((item) => item.kind).sort(),
      ['OBSERVATION_CYCLE', 'RAT_RADAR_CYCLE', 'RAT_WATCH_CYCLE']
    );
  } finally {
    db.close();
  }
});

test('live queue skips observation scheduling on the alternate minute', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const source = new FakeLaunchSource();
  const sent: BinratSyncMessage[] = [];

  try {
    await handleSyncQueueBatch(
      {
        messages: [{
          body: message('cycle-no-observation', 61_000),
          ack() {},
          retry() { throw new Error('unexpected retry'); }
        }]
      },
      {
        DB: db,
        SYNC_QUEUE: { async send(body) { sent.push(body); } }
      },
      {
        now: () => 61_500,
        launchSource: source
      }
    );

    assert.deepEqual(sent.map((item) => item.kind), ['RAT_RADAR_CYCLE']);
  } finally {
    db.close();
  }
});

test('Pons partial slice retains the previous verified runtime boundary until its continuation catches up', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const source=new FakePonsSource();
  const store=new D1Store(db,ROBINHOOD_CHAIN_ID);
  const runtime=new D1RuntimeStateStore(db,ROBINHOOD_CHAIN_ID);
  const latestTarget=source.head-2n;
  const previousTarget=latestTarget-600n;
  try {
    await store.commitCheckpoint({
      blockNumber:previousTarget,
      blockHash:hash(previousTarget),
      guardBlockNumber:null,
      guardBlockHash:null
    });
    await runtime.put({
      sourceVerified:true,
      liveCaughtUp:true,
      headBlock:previousTarget+2n,
      targetBlock:previousTarget,
      observationReady:false,
      historyBackfillComplete:false,
      historyBackfillTargetBlock:null,
      lastSyncError:null,
      lastHistoryError:null,
      lastObservationError:null,
      updatedAtMs:100_000
    });

    const first=await runCloudflarePonsSyncCycle(
      {DB:db,BINRAT_PONS_MAX_BATCH_BLOCKS:'512'},
      {kind:'PONS_SYNC_CYCLE',cycleId:'pons-partial-retain-1',enqueuedAtMs:120_000},
      {now:()=>120_000,ponsLaunchSource:source}
    );
    assert.deepEqual(first,{status:'SUCCESS',liveCaughtUp:false});
    const retained=await runtime.get();
    assert.equal(retained?.targetBlock,previousTarget);
    assert.equal(retained?.liveCaughtUp,true);
    assert.equal(retained?.updatedAtMs,100_000);
    const partialCheckpoint=await store.getCheckpoint();
    assert.equal(partialCheckpoint?.blockNumber,previousTarget+512n);

    const second=await runCloudflarePonsSyncCycle(
      {DB:db,BINRAT_PONS_MAX_BATCH_BLOCKS:'512'},
      {kind:'PONS_SYNC_CYCLE',cycleId:'pons-partial-retain-2',enqueuedAtMs:121_000},
      {now:()=>121_000,ponsLaunchSource:source}
    );
    assert.deepEqual(second,{status:'SUCCESS',liveCaughtUp:true});
    const advanced=await runtime.get();
    assert.equal(advanced?.targetBlock,latestTarget);
    assert.equal(advanced?.liveCaughtUp,true);
    assert.equal(advanced?.updatedAtMs,121_000);
  } finally { store.close(); db.close(); }
});

test('Pons steady slice stays ahead of observed roughly 600 block-per-minute head growth', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const source = new FakePonsSource();
  const store = new D1Store(db, ROBINHOOD_CHAIN_ID);
  try {
    const target=source.head-2n;
    await store.commitCheckpoint({
      blockNumber:target-600n,
      blockHash:hash(target-600n),
      guardBlockNumber:null,
      guardBlockHash:null
    });
    const result=await runCloudflarePonsSyncCycle(
      {DB:db},
      {kind:'PONS_SYNC_CYCLE',cycleId:'pons-steady-600',enqueuedAtMs:60_000},
      {now:()=>120_000,ponsLaunchSource:source}
    );
    assert.deepEqual(result,{status:'SUCCESS',liveCaughtUp:true});
    assert.equal(source.catchUpCalls.length,1);
    assert.equal(source.catchUpCalls[0]![1]-source.catchUpCalls[0]![0]+1n,600n);
    const checkpoint=await store.getCheckpoint();
    assert.equal(checkpoint?.blockNumber,target);
  } finally { store.close(); db.close(); }
});

test('Pons backlog uses one lease writer, a bounded multi-batch slice, and exactly one continuation', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const source = new FakePonsSource();
  const sent: BinratSyncMessage[] = [];
  let acked = 0;
  try {
    await handleSyncQueueBatch({ messages: [{
      body: { kind: 'PONS_SYNC_CYCLE', cycleId: 'pons-backlog', enqueuedAtMs: 60_000 },
      ack() { acked += 1; }, retry() { throw new Error('unexpected retry'); }
    }] }, {
      DB: db,
      SYNC_QUEUE: { async send(body) { sent.push(body); } },
      BINRAT_LIVE_LOOKBACK_BLOCKS: '200000',
      BINRAT_PONS_CATCHUP_MAX_BATCHES: '1',
      BINRAT_PONS_CATCHUP_MAX_BATCH_BLOCKS: '4096',
      BINRAT_PONS_CATCHUP_WORK_BUDGET_MS: '60000'
    }, { now: () => 120_000, ponsLaunchSource: source });
    assert.equal(acked, 1);
    assert.equal(source.catchUpCalls.length, 1);
    assert.equal(source.catchUpCalls[0]?.[1] - source.catchUpCalls[0]?.[0] + 1n, 4_096n);
    assert.deepEqual(sent.map((item) => item.kind), ['PONS_SYNC_CYCLE']);

    const lease = new D1SyncLeaseStore(db);
    assert.equal(await lease.claim('binrat:pons-sync', 'other-owner', 130_000, 120_000), true);
    const busy = await runCloudflarePonsSyncCycle(
      { DB: db },
      { kind: 'PONS_SYNC_CYCLE', cycleId: 'contending-owner', enqueuedAtMs: 130_000 },
      { now: () => 130_001, ponsLaunchSource: source }
    );
    assert.deepEqual(busy, { status: 'BUSY' });
  } finally { db.close(); }
});

test('Pons timeout stays fail-closed, retries once through Queue, and clears only after a later advancing slice', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  class TimeoutThenRecoveryPonsSource extends FakePonsSource {
    attempts = 0;
    override async catchUp(fromBlock: bigint, toBlock: bigint): Promise<LaunchObserved[]> {
      this.catchUpCalls.push([fromBlock, toBlock]);
      this.attempts += 1;
      if (this.attempts === 3) {
        throw Object.assign(new Error('bounded timeout'), { name: 'TimeoutError' });
      }
      return [];
    }
  }
  const source = new TimeoutThenRecoveryPonsSource();
  let nowMs = 1_000;
  const env = {
    DB: db,
    BINRAT_LIVE_LOOKBACK_BLOCKS: '200000',
    BINRAT_PONS_CATCHUP_MAX_BATCHES: '1',
    BINRAT_PONS_CATCHUP_MAX_BATCH_BLOCKS: '4096',
    BINRAT_PONS_CATCHUP_WORK_BUDGET_MS: '60000'
  };
  const deliver = async (cycleId: string) => {
    let acked = 0;
    const retries: Array<{ delaySeconds?: number } | undefined> = [];
    await handleSyncQueueBatch({ messages: [{
      body: { kind: 'PONS_SYNC_CYCLE', cycleId, enqueuedAtMs: nowMs },
      ack() { acked += 1; }, retry(options) { retries.push(options); }
    }] }, env, { now: () => nowMs, ponsLaunchSource: source });
    nowMs += 30_000;
    return { acked, retries };
  };
  try {
    assert.deepEqual(await deliver('pons-success-1'), { acked: 1, retries: [] });
    const store = new D1Store(db, ROBINHOOD_CHAIN_ID);
    const checkpointAfterFirst = await store.getCheckpoint();
    assert.ok(checkpointAfterFirst);

    assert.deepEqual(await deliver('pons-success-2'), { acked: 1, retries: [] });
    const checkpointAfterProgress = await store.getCheckpoint();
    assert.ok(checkpointAfterProgress!.blockNumber > checkpointAfterFirst!.blockNumber);

    const timeout = await deliver('pons-timeout');
    assert.equal(timeout.acked, 0);
    assert.deepEqual(timeout.retries, [{ delaySeconds: 30 }]);
    const runtimeAfterTimeout = await new D1RuntimeStateStore(db, ROBINHOOD_CHAIN_ID).get();
    const checkpointAfterTimeout = await store.getCheckpoint();
    assert.equal(runtimeAfterTimeout?.sourceVerified, false);
    assert.equal(runtimeAfterTimeout?.liveCaughtUp, false);
    assert.equal(runtimeAfterTimeout?.lastSyncError, 'SYNC_TIMEOUT_ERROR');
    assert.deepEqual(checkpointAfterTimeout, checkpointAfterProgress);

    assert.deepEqual(await deliver('pons-retry-recovered'), { acked: 1, retries: [] });
    const runtimeAfterRecovery = await new D1RuntimeStateStore(db, ROBINHOOD_CHAIN_ID).get();
    const checkpointAfterRecovery = await store.getCheckpoint();
    assert.ok(checkpointAfterRecovery!.blockNumber > checkpointAfterTimeout!.blockNumber);
    assert.equal(runtimeAfterRecovery?.sourceVerified, true);
    assert.equal(runtimeAfterRecovery?.lastSyncError, null);
  } finally {
    db.close();
  }
});

test('Pons velocity receipt is bounded and compares backlog to head growth', () => {
  assert.equal(PONS_SYNC_LEASE_MS, 180_000);
  const receipt = calculatePonsVelocity(
    { headBlock: 100n, updatedAtMs: 1_000 },
    { headBlock: 110n, blocksAdvanced: 40n, elapsedMs: 2_000, backlogBefore: 80n, backlogAfter: 40n },
    3_000
  );
  assert.equal(receipt.catchupBlocksPerSecond, 20);
  assert.equal(receipt.headBlocksPerSecond, 5);
  assert.equal(receipt.catchupHeadRatio, 4);
  assert.equal(receipt.backlogDelta, -40n);
});

test('Cloudflare sync lease is fenced so an old owner cannot release a replacement lease', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const leases = new D1SyncLeaseStore(db);
  try {
    assert.equal(await leases.claim('sync', 'owner-a', 1_000, 1_000), true);
    assert.equal(await leases.claim('sync', 'owner-b', 1_500, 1_000), false);
    assert.equal(await leases.claim('sync', 'owner-b', 2_001, 1_000), true);
    await leases.release('sync', 'owner-a');
    assert.equal(await leases.claim('sync', 'owner-c', 2_002, 1_000), false);
  } finally {
    db.close();
  }
});

test('live authority failure is persisted fail-closed and requests retry', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  class FailingSource extends FakeLaunchSource {
    override async assertAuthority(_blockNumber: bigint) {
      throw new Error('ARCPAD_AUTHORITY_TEST');
    }
  }
  const source = new FailingSource();
  try {
    const result = await runCloudflareSyncCycle(
      { DB: db },
      message('cycle-fail'),
      {
        now: () => 5_000,
        launchSource: source,
        observationSource: new FakeObservationSource(source.head)
      }
    );
    assert.deepEqual(result, { status: 'RETRY', code: 'ARCPAD_AUTHORITY_TEST' });
    const state = await new D1RuntimeStateStore(db, 5042).get();
    assert.equal(state?.sourceVerified, false);
    assert.equal(state?.liveCaughtUp, false);
    assert.equal(state?.lastSyncError, 'ARCPAD_AUTHORITY_TEST');
  } finally {
    db.close();
  }
});

test('sanitized live failures remain fail-closed, do not advance a checkpoint, and retry', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  class TransportFailureSource extends FakeLaunchSource {
    override async getHeadBlockNumber(): Promise<bigint> {
      throw Object.assign(new Error('https://secret.example/rpc'), {
        name: 'TimeoutError',
        cause: { code: 'ETIMEDOUT' }
      });
    }
  }
  const source = new TransportFailureSource();
  let acked = 0;
  let retried = 0;
  try {
    await handleSyncQueueBatch(
      {
        messages: [{
          body: message('cycle-sanitized-live-failure'),
          ack() { acked += 1; },
          retry() { retried += 1; }
        }]
      },
      { DB: db },
      {
        now: () => 5_500,
        launchSource: source
      }
    );
    const state = await new D1RuntimeStateStore(db, 5042).get();
    const checkpoint = await new D1Store(db, 5042).getCheckpoint();
    assert.equal(acked, 0);
    assert.equal(retried, 1);
    assert.equal(state?.sourceVerified, false);
    assert.equal(state?.liveCaughtUp, false);
    assert.equal(state?.lastSyncError, 'SYNC_ETIMEDOUT');
    assert.equal(checkpoint, null);
  } finally {
    db.close();
  }
});


test('failed first cycle does not freeze an uninitialized null history target', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);

  class FirstFailureSource extends FakeLaunchSource {
    override async assertAuthority(_blockNumber: bigint) {
      throw new Error('ARCPAD_AUTHORITY_TEST');
    }
  }

  const failing = new FirstFailureSource();
  let now = 20_000;
  try {
    const first = await runCloudflareSyncCycle(
      { DB: db },
      message('cycle-first-fail'),
      {
        now: () => now++,
        launchSource: failing,
        observationSource: new FakeObservationSource(failing.head)
      }
    );
    assert.deepEqual(first, { status: 'RETRY', code: 'ARCPAD_AUTHORITY_TEST' });

    const failedState = await new D1RuntimeStateStore(db, 5042).get();
    assert.equal(failedState?.headBlock, null);
    assert.equal(failedState?.targetBlock, null);
    assert.equal(failedState?.historyBackfillTargetBlock, null);

    const recovered = new FakeLaunchSource();
    const second = await runCloudflareSyncCycle(
      {
        DB: db,
        BINRAT_LIVE_LOOKBACK_BLOCKS: '1000',
        BINRAT_MAX_BATCH_BLOCKS: '1000',
        BINRAT_CONFIRMATIONS: '2'
      },
      message('cycle-recovered'),
      {
        now: () => now++,
        launchSource: recovered,
        observationSource: new FakeObservationSource(recovered.head)
      }
    );

    assert.deepEqual(second, { status: 'SUCCESS', liveCaughtUp: true });
    const recoveredState = await new D1RuntimeStateStore(db, 5042).get();
    assert.equal(
      recoveredState?.historyBackfillTargetBlock,
      ARCPAD_START_BLOCK + 3_999n
    );
    assert.equal(recoveredState?.historyBackfillComplete, false);

    const cursor = await db.prepare(
      'SELECT next_block FROM launch_history_backfill_state WHERE chain_id = ?'
    ).bind(5042).first<{ next_block: string }>();
    assert.equal(BigInt(cursor!.next_block), ARCPAD_START_BLOCK + 1_000n);
  } finally {
    db.close();
  }
});

test('runtime read failure after claim cannot strand the durable sync lease', async () => {
  const inner = new D1CompatDatabase();
  await inner.exec(D1_SCHEMA_SQL);
  const db = new FailFirstRuntimeReadDatabase(inner);
  try {
    await assert.rejects(
      () => runCloudflareSyncCycle(
        { DB: db },
        message('cycle-runtime-read-fail'),
        {
          now: () => 30_000,
          launchSource: new FakeLaunchSource(),
          observationSource: new FakeObservationSource(ARCPAD_START_BLOCK + 5_000n)
        }
      ),
      /INJECTED_RUNTIME_READ_FAILURE/
    );

    const leases = new D1SyncLeaseStore(inner);
    assert.equal(
      await leases.claim('binrat:arc-sync', 'replacement-owner', 30_001, 1_000),
      true
    );
  } finally {
    inner.close();
  }
});

class FailFirstRuntimeReadDatabase implements D1DatabaseLike {
  private failed = false;

  constructor(private readonly inner: D1DatabaseLike) {}

  prepare(sql: string): D1PreparedStatementLike {
    const statement = this.inner.prepare(sql);
    if (!this.failed && sql.includes('SELECT * FROM binrat_runtime_state')) {
      this.failed = true;
      return new FailFirstStatement(statement);
    }
    return statement;
  }

  batch(statements: D1PreparedStatementLike[]): Promise<D1ResultLike[]> {
    return this.inner.batch(statements);
  }

  exec(sql: string): Promise<unknown> {
    return this.inner.exec(sql);
  }
}

class FailFirstStatement implements D1PreparedStatementLike {
  constructor(private readonly inner: D1PreparedStatementLike) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    return new FailFirstStatement(this.inner.bind(...values));
  }

  run<T = Record<string, unknown>>(): Promise<D1ResultLike<T>> {
    return this.inner.run<T>();
  }

  first<T = Record<string, unknown>>(): Promise<T | null> {
    return Promise.reject(new Error('INJECTED_RUNTIME_READ_FAILURE'));
  }

  all<T = Record<string, unknown>>(): Promise<D1ResultLike<T>> {
    return this.inner.all<T>();
  }
}

test('Rat Radar cycle ingests a bounded confirmed pool range and advances only after durable writes', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db, 5042);
  const runtime = new D1RuntimeStateStore(db, 5042);
  const radar = new D1RatRadarStore(db, 5042);
  const source = new FakeRatRadarSource();

  try {
    const launch = await makeRadarLaunch(100n, 1);
    await store.putLaunch(launch);
    await store.commitCheckpoint({
      blockNumber: 120n,
      blockHash: hash(120n),
      guardBlockNumber: 119n,
      guardBlockHash: hash(119n)
    });
    await runtime.put({
      sourceVerified: true,
      liveCaughtUp: true,
      headBlock: 122n,
      targetBlock: 120n,
      observationReady: true,
      historyBackfillComplete: false,
      historyBackfillTargetBlock: 99n,
      lastSyncError: null,
      lastHistoryError: null,
      lastObservationError: null,
      updatedAtMs: 10_000
    });

    source.receiptByLaunch.set(launch.launchId, [
      await makeRadarReceipt(launch, 105n, 1, address(900))
    ]);

    const result = await runCloudflareRatRadarCycle(
      {
        DB: db,
        BINRAT_RAT_RADAR_MAX_BATCH_BLOCKS: '10',
        BINRAT_RAT_RADAR_MAX_POOLS_PER_CYCLE: '1'
      },
      ratRadarMessage('radar-1'),
      { now: () => 20_000, ratRadarSource: source }
    );

    assert.deepEqual(result, {
      status: 'SUCCESS',
      poolsProcessed: 1,
      receiptsInserted: 1,
      receiptsDuplicate: 0,
      poolsFailed: 0
    });
    assert.deepEqual(source.catchUpCalls, [[launch.launchId, 100n, 109n]]);
    const cursor = await radar.nextPoolCursor(120n, 20_000);
    assert.equal(cursor?.launchId, launch.launchId);
    assert.equal(cursor?.nextBlock, 110n);
    assert.equal((await radar.listForLaunch(launch.launchId)).length, 1);
    assert.equal(source.authorityCalls.length, 2);
  } finally {
    store.close();
    db.close();
  }
});

test('Rat Radar cycle backs off one failed pool without blocking another pool', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db, 5042);
  const runtime = new D1RuntimeStateStore(db, 5042);
  const radar = new D1RatRadarStore(db, 5042);
  const source = new FakeRatRadarSource();

  try {
    const a = await makeRadarLaunch(100n, 11);
    const b = await makeRadarLaunch(100n, 12);
    await store.putLaunch(a);
    await store.putLaunch(b);
    await store.commitCheckpoint({
      blockNumber: 105n,
      blockHash: hash(105n),
      guardBlockNumber: 104n,
      guardBlockHash: hash(104n)
    });
    await runtime.put({
      sourceVerified: true,
      liveCaughtUp: true,
      headBlock: 107n,
      targetBlock: 105n,
      observationReady: true,
      historyBackfillComplete: false,
      historyBackfillTargetBlock: 99n,
      lastSyncError: null,
      lastHistoryError: null,
      lastObservationError: null,
      updatedAtMs: 30_000
    });
    await radar.ensurePoolCursors([a, b], 30_000);
    const first = await radar.nextPoolCursor(105n, 30_000);
    assert.ok(first);
    source.failLaunchId = first!.launchId;

    const result = await runCloudflareRatRadarCycle(
      {
        DB: db,
        BINRAT_RAT_RADAR_MAX_BATCH_BLOCKS: '6',
        BINRAT_RAT_RADAR_MAX_POOLS_PER_CYCLE: '2'
      },
      ratRadarMessage('radar-failure-isolation'),
      { now: () => 30_000, ratRadarSource: source }
    );

    assert.deepEqual(result, {
      status: 'SUCCESS',
      poolsProcessed: 1,
      receiptsInserted: 0,
      receiptsDuplicate: 0,
      poolsFailed: 1
    });
    const failed = await db.prepare(`
      SELECT next_block,failure_count,last_error,retry_after_ms
      FROM rat_radar_pool_cursors
      WHERE launch_id = ?
    `).bind(first!.launchId).first<{
      next_block: string;
      failure_count: number;
      last_error: string | null;
      retry_after_ms: number;
    }>();
    assert.equal(failed?.next_block, '100');
    assert.equal(failed?.failure_count, 1);
    assert.equal(failed?.last_error, 'RAT_RADAR_TEST_POOL_FAILURE');
    assert.ok((failed?.retry_after_ms ?? 0) > 30_000);

    const otherId = first!.launchId === a.launchId ? b.launchId : a.launchId;
    const other = await db.prepare(`
      SELECT next_block FROM rat_radar_pool_cursors WHERE launch_id = ?
    `).bind(otherId).first<{ next_block: string }>();
    assert.equal(other?.next_block, '106');
  } finally {
    store.close();
    db.close();
  }
});

test('Rat Radar cursor rewinds with chain evidence after reorg', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db, 5042);
  const radar = new D1RatRadarStore(db, 5042);

  try {
    const launch = await makeRadarLaunch(100n, 21);
    await store.putLaunch(launch);
    await radar.ensurePoolCursors([launch], 1_000);
    await radar.advancePoolCursor(launch.launchId, 100n, 201n, 1_001);
    await radar.putSwap(await makeRadarReceipt(launch, 180n, 1, address(901)));

    await store.rewindFromBlock(150n);

    assert.equal((await radar.listForLaunch(launch.launchId)).length, 0);
    const cursor = await radar.nextPoolCursor(200n, 2_000);
    assert.equal(cursor?.launchId, launch.launchId);
    assert.equal(cursor?.nextBlock, 150n);
  } finally {
    store.close();
    db.close();
  }
});

async function makeRadarLaunch(blockNumber: bigint, seed: number): Promise<LaunchObserved> {
  const launcher = address(100 + seed);
  const txHash = hash(BigInt(200 + seed));
  const token = address(300 + seed);
  return {
    launchId: await deriveLaunchId({ chainId: 5042, launcher, txHash, token }),
    eventId: await deriveEventId({ chainId: 5042, launcher, txHash, logIndex: seed }),
    chainId: 5042,
    blockNumber,
    blockHash: hash(blockNumber),
    observedAtMs: Number(blockNumber) * 1_000,
    source: 'ARCPAD',
    launcher,
    txHash,
    logIndex: seed,
    token,
    creator: address(400 + seed),
    pool: address(500 + seed),
    name: `Queue Radar ${seed}`,
    symbol: `QR${seed}`,
    imageUri: '',
    website: '',
    twitter: '',
    telegram: ''
  };
}

async function makeRadarReceipt(
  launch: LaunchObserved,
  blockNumber: bigint,
  logIndex: number,
  recipient: Hex
): Promise<RatRadarSwapReceipt> {
  return deriveRatRadarSwapReceipt({
    chainId: 5042,
    launchId: launch.launchId,
    pool: launch.pool,
    token: launch.token,
    token0: launch.token,
    token1: address(999),
    blockNumber,
    blockHash: hash(blockNumber),
    txHash: hash(blockNumber * 10n + BigInt(logIndex)),
    logIndex,
    sender: address(800 + logIndex),
    recipient,
    amount0: -100n,
    amount1: 50n,
    sqrtPriceX96: 1_000n,
    liquidity: 2_000n,
    tick: 5
  });
}

function address(seed: number): Hex {
  return `0x${seed.toString(16).padStart(40, '0').slice(-40)}` as Hex;
}


const outcomeAddress = (seed: number): Hex => `0x${seed.toString(16).padStart(40,'0')}`;

async function outcomeLaunch(blockNumber=10n): Promise<LaunchObserved> {
  const token=outcomeAddress(1001);
  const curve=outcomeAddress(2001);
  const txHash=hash(10_001n);
  return {
    launchId:await deriveLaunchId({
      chainId:ROBINHOOD_CHAIN_ID,
      launcher:PONS_V2_FACTORY,
      txHash,
      token,
      source:'PONS_V2'
    }),
    eventId:await deriveEventId({
      chainId:ROBINHOOD_CHAIN_ID,
      launcher:PONS_V2_FACTORY,
      txHash,
      logIndex:0,
      source:'PONS_V2'
    }),
    chainId:ROBINHOOD_CHAIN_ID,
    blockNumber,
    blockHash:hash(blockNumber),
    observedAtMs:1,
    source:'PONS_V2',
    launcher:PONS_V2_FACTORY,
    txHash,
    logIndex:0,
    token,
    creator:outcomeAddress(42),
    pool:curve,
    name:'',
    symbol:'',
    imageUri:'',
    website:'',
    twitter:'',
    telegram:''
  };
}

class FakePonsOutcomeSource implements PonsOutcomeObservationSource {
  authorityCalls=0;
  outcomeReads:bigint[]=[];
  async assertAuthority(){ this.authorityCalls+=1; }
  async getBlockPoint(blockNumber:bigint) {
    return {
      blockNumber,
      blockHash:hash(blockNumber),
      timestampMs:Number(blockNumber)*60_000
    };
  }
  async readOutcomeAt(launch:{launchId:string;token:Hex;curve:Hex},blockNumber:bigint) {
    this.outcomeReads.push(blockNumber);
    return buildPonsCurveOutcomeCapabilityReceipt({
      launch,
      observedBlock:blockNumber,
      observedBlockHash:hash(blockNumber),
      observedTimestampMs:Number(blockNumber)*60_000,
      pairToken:'0x0000000000000000000000000000000000000000',
      quoteDecimals:18,
      totalSupply:1_000_000n*10n**18n,
      graduated:false,
      quoteReserve:10n*10n**18n,
      tokenReserve:500_000n*10n**18n
    });
  }
}

test('Robinhood archive resolver accepts a raw Alchemy key or exact Robinhood endpoint only', () => {
  assert.equal(
    resolveRobinhoodArchiveRpcUrl({BINRAT_ROBINHOOD_ARCHIVE_RPC_URL:'abcdefgh'}),
    'https://robinhood-mainnet.g.alchemy.com/v2/abcdefgh'
  );
  assert.equal(
    resolveRobinhoodArchiveRpcUrl({
      BINRAT_ROBINHOOD_ARCHIVE_RPC_URL:'https://robinhood-mainnet.g.alchemy.com/v2/abcdefgh'
    }),
    'https://robinhood-mainnet.g.alchemy.com/v2/abcdefgh'
  );
  assert.throws(
    () => resolveRobinhoodArchiveRpcUrl({BINRAT_ROBINHOOD_ARCHIVE_RPC_URL:'https://evil.example/v2/abcdefgh'}),
    /PONS_OUTCOME_ARCHIVE_RPC_INVALID/
  );
  assert.throws(
    () => resolveRobinhoodArchiveRpcUrl({}),
    /MISSING_CONFIG:BINRAT_ROBINHOOD_ARCHIVE_RPC_URL/
  );
});

test('Pons outcome cycle is inert by default and does not require archive credentials', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const source=new FakePonsOutcomeSource();
  try {
    const result=await runCloudflarePonsOutcomeCycle(
      {DB:db},
      {kind:'PONS_OUTCOME_CYCLE',cycleId:'outcome-disabled',enqueuedAtMs:1_000},
      {now:()=>1_000,ponsOutcomeSource:source}
    );
    assert.deepEqual(result,{
      status:'SUCCESS',
      inserted:0,
      duplicates:0,
      pendingMaturity:0,
      alreadyPresent:0,
      launchesVisited:0
    });
    assert.equal(source.authorityCalls,0);
    assert.equal(source.outcomeReads.length,0);
  } finally { db.close(); }
});

test('healthy enabled Pons outcome cycle writes one bounded matured receipt to D1', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,ROBINHOOD_CHAIN_ID);
  const runtime=new D1RuntimeStateStore(db,ROBINHOOD_CHAIN_ID);
  const source=new FakePonsOutcomeSource();
  try {
    const launch=await outcomeLaunch();
    await store.putLaunch(launch);
    await store.commitCheckpoint({
      blockNumber:20n,
      blockHash:hash(20n),
      guardBlockNumber:null,
      guardBlockHash:null
    });
    await runtime.put({
      sourceVerified:true,
      liveCaughtUp:true,
      headBlock:22n,
      targetBlock:20n,
      observationReady:false,
      historyBackfillComplete:false,
      historyBackfillTargetBlock:null,
      lastSyncError:null,
      lastHistoryError:null,
      lastObservationError:null,
      updatedAtMs:1_000
    });

    const result=await runCloudflarePonsOutcomeCycle(
      {
        DB:db,
        BINRAT_PONS_OUTCOME_ENABLED:'true',
        BINRAT_PONS_OUTCOME_MAX_PER_CYCLE:'1'
      },
      {kind:'PONS_OUTCOME_CYCLE',cycleId:'outcome-enabled',enqueuedAtMs:1_000},
      {now:()=>1_000,ponsOutcomeSource:source}
    );
    assert.equal(result.status,'SUCCESS');
    if (result.status!=='SUCCESS') throw new Error('OUTCOME_TEST_RESULT_INVALID');
    assert.equal(result.inserted,1);
    assert.deepEqual(source.outcomeReads,[15n]);

    const row=await db.prepare(`
      SELECT horizon_ms,observed_block,status,estimated_fdv_quote_raw
      FROM pons_outcome_receipts
      WHERE launch_id=?
    `).bind(launch.launchId).first<{
      horizon_ms:number;
      observed_block:string;
      status:string;
      estimated_fdv_quote_raw:string|null;
    }>();
    assert.equal(row?.horizon_ms,300_000);
    assert.equal(row?.observed_block,'15');
    assert.equal(row?.status,'COMPLETE');
    assert.equal(row?.estimated_fdv_quote_raw,(20n*10n**18n).toString());
  } finally { store.close(); db.close(); }
});

test('caught-up Pons sync enqueues O2 only when the outcome gate is enabled', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const source=new FakePonsSource();
  const sent:BinratSyncMessage[]=[];
  let acked=0;
  try {
    await handleSyncQueueBatch({messages:[{
      body:{kind:'PONS_SYNC_CYCLE',cycleId:'pons-outcome-trigger',enqueuedAtMs:61_000},
      ack(){acked+=1;},
      retry(){throw new Error('unexpected retry');}
    }]},{
      DB:db,
      BINRAT_PONS_OUTCOME_ENABLED:'true',
      SYNC_QUEUE:{async send(body){sent.push(body);}}
    },{
      now:()=>61_500,
      ponsLaunchSource:source
    });
    assert.equal(acked,1);
    assert.deepEqual(sent.map((item)=>item.kind),['PONS_OUTCOME_CYCLE']);
  } finally { db.close(); }
});
