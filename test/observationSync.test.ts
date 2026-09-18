import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import type { ObservationBlockPoint, ObservationSource } from '../src/observations/syncObservations.js';
import { findFirstBlockAtOrAfterTimestamp, syncObservations } from '../src/observations/syncObservations.js';
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
  async getHeadBlockNumber() { return this.head; }
  async getBlockPoint(blockNumber: bigint): Promise<ObservationBlockPoint> {
    return { blockNumber, blockHash: hash(blockNumber), timestampMs: Number(blockNumber) * 60_000 };
  }
  async readObservationFacts(_launch: LaunchObserved, blockNumber: bigint): Promise<LaunchObservationFacts> {
    return {
      poolCodePresent: true,
      poolActiveLiquidity: blockNumber * 10n,
      poolSqrtPriceX96: blockNumber * 100n,
      poolTick: Number(blockNumber),
      creatorTokenBalance: 1_000n - blockNumber,
      tokenTotalSupply: 1_000n,
      tokenDecimals: 18
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
