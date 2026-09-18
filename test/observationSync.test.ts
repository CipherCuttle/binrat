import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import type { ObservationBlockPoint, ObservationSource } from '../src/observations/syncObservations.js';
import { findFirstBlockAtOrAfterTimestamp, syncObservations } from '../src/observations/syncObservations.js';
import { buildObservationReceipt } from '../src/observations/identity.js';
import type { LaunchObservationFacts } from '../src/observations/types.js';
import { SqliteStore } from '../src/store/sqliteStore.js';

const chainId = 5042;
const hash = (n: bigint) => `0x${n.toString(16).padStart(64, '0')}` as Hex;

function launch(blockNumber: bigint): LaunchObserved {
  return {
    chainId,
    blockNumber,
    blockHash: hash(blockNumber),
    observedAtMs: 1,
    launchId: 'launch-sync-observation',
    eventId: 'event-sync-observation',
    source: 'ARCPAD',
    launcher: '0x24196cd6e534cfce8f480b53e70809b68ea86f29',
    txHash: hash(999n),
    logIndex: 0,
    token: '0x1000000000000000000000000000000000000001',
    creator: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    pool: '0x2000000000000000000000000000000000000002',
    name: 'Observation Sync',
    symbol: 'OBSYNC',
    imageUri: '',
    website: '',
    twitter: '',
    telegram: ''
  };
}

class FakeObservationSource implements ObservationSource {
  head = 40n;
  blockPointCalls: bigint[] = [];
  async getHeadBlockNumber() { return this.head; }
  async getBlockPoint(blockNumber: bigint): Promise<ObservationBlockPoint> {
    this.blockPointCalls.push(blockNumber);
    return { blockNumber, blockHash: hash(blockNumber), timestampMs: Number(blockNumber) * 60_000 };
  }
  async readObservationFacts(_launch: LaunchObserved, blockNumber: bigint): Promise<{ facts: LaunchObservationFacts; missing: string[] }> {
    return {
      facts: {
        poolCodePresent: true,
        poolActiveLiquidity: blockNumber * 10n,
        poolSqrtPriceX96: blockNumber * 100n,
        poolTick: Number(blockNumber),
        creatorTokenBalance: 1_000n - blockNumber,
        tokenTotalSupply: 1_000n,
        tokenDecimals: 18
      },
      missing: []
    };
  }
}

test('binary search returns the first block at or after target timestamp', async () => {
  const source = new FakeObservationSource();
  const point = await findFirstBlockAtOrAfterTimestamp(source, 10n, 30n, 15 * 60_000 + 1);
  assert.equal(point?.blockNumber, 16n);
});

test('sync reconstructs matured horizons once and leaves immature horizons pending', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'binrat-observation-sync-'));
  const store = new SqliteStore(join(dir, 'test.sqlite'), chainId);
  try {
    const item = launch(10n);
    await store.putLaunch(item);
    const source = new FakeObservationSource();

    const first = await syncObservations(source, store, {
      confirmations: 1n,
      maxObservationsPerSync: 10,
      horizons: [
        { label: '5m', ms: 300_000 },
        { label: '1h', ms: 3_600_000 }
      ]
    });
    assert.equal(first.inserted, 1);
    assert.equal(first.pendingMaturity, 1);

    const receipts = await store.listObservationsForLaunch(item.launchId);
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0]?.horizonMs, 300_000);
    assert.equal(receipts[0]?.observedBlock, 15n);
    assert.equal(receipts[0]?.facts.poolActiveLiquidity, 150n);

    const second = await syncObservations(source, store, {
      confirmations: 1n,
      maxObservationsPerSync: 10,
      horizons: [{ label: '5m', ms: 300_000 }]
    });
    assert.equal(second.inserted, 0);
    assert.equal(second.alreadyPresent, 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sync fails closed when launch block hash no longer matches canonical chain', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'binrat-observation-reorg-'));
  const store = new SqliteStore(join(dir, 'test.sqlite'), chainId);
  try {
    const item = launch(10n);
    await store.putLaunch(item);
    class ReorgSource extends FakeObservationSource {
      override async getBlockPoint(blockNumber: bigint) {
        const point = await super.getBlockPoint(blockNumber);
        return blockNumber === 10n ? { ...point, blockHash: hash(9999n) } : point;
      }
    }
    await assert.rejects(
      syncObservations(new ReorgSource(), store, {
        confirmations: 1n,
        maxObservationsPerSync: 1,
        horizons: [{ label: '5m', ms: 300_000 }]
      }),
      /OBSERVATION_LAUNCH_REORG/
    );
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});


test('sync persists partial receipts instead of treating unsupported evidence as success or aborting the horizon', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'binrat-observation-partial-'));
  const store = new SqliteStore(join(dir, 'test.sqlite'), chainId);
  try {
    const item = launch(10n);
    await store.putLaunch(item);
    class PartialSource extends FakeObservationSource {
      override async readObservationFacts(_launch: LaunchObserved, blockNumber: bigint) {
        return {
          facts: {
            poolCodePresent: true,
            creatorTokenBalance: 1_000n - blockNumber,
            tokenTotalSupply: 1_000n
          },
          missing: ['POOL_SLOT0', 'POOL_LIQUIDITY', 'TOKEN_DECIMALS']
        };
      }
    }

    const report = await syncObservations(new PartialSource(), store, {
      confirmations: 1n,
      maxObservationsPerSync: 1,
      horizons: [{ label: '5m', ms: 300_000 }]
    });
    assert.equal(report.inserted, 1);

    const [receipt] = await store.listObservationsForLaunch(item.launchId);
    assert.equal(receipt?.status, 'PARTIAL');
    assert.deepEqual(receipt?.missing, ['POOL_SLOT0', 'POOL_LIQUIDITY', 'TOKEN_DECIMALS']);
    assert.equal(receipt?.facts.poolCodePresent, true);
    assert.equal(receipt?.facts.poolActiveLiquidity, undefined);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});


test('fully observed launches do not trigger per-launch historical RPC scans', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'binrat-observation-rpc-bound-'));
  const store = new SqliteStore(join(dir, 'test.sqlite'), chainId);
  try {
    const item = launch(10n);
    await store.putLaunch(item);
    const horizons = [
      { label: '5m', ms: 300_000 },
      { label: '1h', ms: 3_600_000 },
      { label: '24h', ms: 86_400_000 }
    ];
    for (let i = 0; i < horizons.length; i += 1) {
      const horizon = horizons[i]!;
      const targetTimestampMs = 600_000 + horizon.ms;
      const receipt = await buildObservationReceipt({
        chainId,
        launchId: item.launchId,
        horizonMs: horizon.ms,
        targetTimestampMs,
        observedBlock: BigInt(20 + i),
        observedBlockHash: hash(BigInt(20 + i)),
        observedTimestampMs: targetTimestampMs + 1,
        status: 'COMPLETE',
        facts: { poolCodePresent: true },
        missing: []
      });
      await store.putObservation(receipt);
    }

    const source = new FakeObservationSource();
    const report = await syncObservations(source, store, {
      confirmations: 1n,
      maxObservationsPerSync: 10,
      horizons
    });

    assert.equal(report.inserted, 0);
    assert.equal(report.alreadyPresent, 3);
    assert.equal(source.blockPointCalls.includes(item.blockNumber), false);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
