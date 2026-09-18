import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { LaunchSource } from '../src/core/ports.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { syncHistoricalLaunches } from '../src/indexer/syncHistoricalLaunches.js';
import { SqliteStore } from '../src/store/sqliteStore.js';

const chainId = 5042;
const hash = (n: bigint) => `0x${n.toString(16).padStart(64, '0')}` as Hex;

function launchAt(blockNumber: bigint): LaunchObserved {
  return {
    chainId,
    blockNumber,
    blockHash: hash(blockNumber),
    observedAtMs: 1,
    launchId: 'history-launch-2',
    eventId: 'history-event-2',
    source: 'ARCPAD',
    launcher: '0x24196cd6e534cfce8f480b53e70809b68ea86f29',
    txHash: hash(200n),
    logIndex: 0,
    token: '0x1000000000000000000000000000000000000001',
    creator: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    pool: '0x2000000000000000000000000000000000000002',
    name: 'History Bag',
    symbol: 'HIST',
    imageUri: '',
    website: '',
    twitter: '',
    telegram: ''
  };
}

class FakeHistorySource implements LaunchSource {
  catchUpCalls = 0;
  async getHeadBlockNumber() { return 20n; }
  async getBlockHash(blockNumber: bigint) { return hash(blockNumber); }
  async assertAuthority(_blockNumber: bigint) {}
  async catchUp(fromBlock: bigint, toBlock: bigint) {
    this.catchUpCalls += 1;
    const item = launchAt(2n);
    return item.blockNumber >= fromBlock && item.blockNumber <= toBlock ? [item] : [];
  }
}

test('historical backfill resumes independently without moving the live checkpoint', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'binrat-history-backfill-'));
  const store = new SqliteStore(join(dir, 'test.sqlite'), chainId);
  try {
    await store.commitCheckpoint({
      blockNumber: 20n,
      blockHash: hash(20n),
      guardBlockNumber: 18n,
      guardBlockHash: hash(18n)
    });
    const source = new FakeHistorySource();

    const first = await syncHistoricalLaunches(source, store, {
      startBlock: 1n,
      endBlock: 5n,
      maxBatchBlocks: 2n
    });
    assert.equal(first.scannedStartBlock, 1n);
    assert.equal(first.scannedEndBlock, 2n);
    assert.equal(first.nextBlock, 3n);
    assert.equal(first.inserted, 1);
    assert.equal(first.complete, false);
    assert.equal(await store.getHistoricalBackfillNextBlock(), 3n);
    assert.equal((await store.getCheckpoint())?.blockNumber, 20n);

    const second = await syncHistoricalLaunches(source, store, {
      startBlock: 1n,
      endBlock: 5n,
      maxBatchBlocks: 2n
    });
    assert.equal(second.scannedStartBlock, 3n);
    assert.equal(second.scannedEndBlock, 4n);
    assert.equal(second.nextBlock, 5n);

    const third = await syncHistoricalLaunches(source, store, {
      startBlock: 1n,
      endBlock: 5n,
      maxBatchBlocks: 2n
    });
    assert.equal(third.scannedStartBlock, 5n);
    assert.equal(third.scannedEndBlock, 5n);
    assert.equal(third.nextBlock, 6n);
    assert.equal(third.complete, true);

    const calls = source.catchUpCalls;
    const done = await syncHistoricalLaunches(source, store, {
      startBlock: 1n,
      endBlock: 5n,
      maxBatchBlocks: 2n
    });
    assert.equal(done.scannedStartBlock, null);
    assert.equal(done.complete, true);
    assert.equal(source.catchUpCalls, calls);
    assert.equal((await store.listLaunches()).length, 1);
    assert.equal((await store.listProvenanceFacts()).length, 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('historical cursor does not advance when the batch boundary changes during read', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'binrat-history-reorg-'));
  const store = new SqliteStore(join(dir, 'test.sqlite'), chainId);
  try {
    class ReorgSource extends FakeHistorySource {
      calls = 0;
      override async catchUp(_fromBlock: bigint, _toBlock: bigint) {
        this.catchUpCalls += 1;
        return [];
      }
      override async getBlockHash(blockNumber: bigint) {
        if (blockNumber !== 2n) return hash(blockNumber);
        this.calls += 1;
        return this.calls === 1 ? hash(2n) : hash(999n);
      }
    }
    await assert.rejects(
      syncHistoricalLaunches(new ReorgSource(), store, {
        startBlock: 1n,
        endBlock: 2n,
        maxBatchBlocks: 2n
      }),
      /HISTORY_REORG_DURING_READ/
    );
    assert.equal(await store.getHistoricalBackfillNextBlock(), null);
    assert.equal((await store.listLaunches()).length, 0);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
