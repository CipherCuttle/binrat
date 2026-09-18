import assert from 'node:assert/strict';
import test from 'node:test';
import { ARCPAD_START_BLOCK } from '../src/arc/chain.js';
import type { LaunchSource } from '../src/core/ports.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import { D1SyncLeaseStore } from '../src/cloudflare/syncLease.js';
import {
  runCloudflareSyncCycle,
  type BinratSyncMessage
} from '../src/cloudflare/syncQueue.js';
import type {
  ObservationBlockPoint,
  ObservationSource
} from '../src/observations/syncObservations.js';
import type { LaunchObservationFacts } from '../src/observations/types.js';
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
    assert.equal(state?.observationReady, true);

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
