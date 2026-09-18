import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { LaunchSource } from '../src/core/ports.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { syncLaunches } from '../src/indexer/syncLaunches.js';
import { SqliteStore } from '../src/store/sqliteStore.js';

const chainId = 5042;
const hashes = new Map<bigint, Hex>();
for (let block = 1n; block <= 20n; block++) hashes.set(block, `0x${block.toString(16).padStart(64, '0')}` as Hex);

function launch(id: string, creator: Hex, blockNumber: bigint, logIndex: number): LaunchObserved {
  return {
    chainId, blockNumber, blockHash: hashes.get(blockNumber)!, observedAtMs: 1,
    launchId: id, eventId: `event-${id}`, source: 'ARCPAD', launcher: '0x24196cd6e534cfce8f480b53e70809b68ea86f29',
    txHash: `0x${(1000 + logIndex + Number(blockNumber)).toString(16).padStart(64, '0')}` as Hex,
    logIndex, token: `0x${id.padStart(40, '0')}` as Hex, creator, pool: `0x${(`f${id}`).padStart(40, '0')}` as Hex,
    name: id, symbol: id.toUpperCase(), imageUri: '', website: '', twitter: '', telegram: ''
  };
}

class FakeSource implements LaunchSource {
  head = 15n;
  launches: LaunchObserved[] = [];
  async getHeadBlockNumber() { return this.head; }
  async getBlockHash(blockNumber: bigint) { return hashes.get(blockNumber)!; }
  async assertAuthority(_blockNumber: bigint) {}
  async catchUp(fromBlock: bigint, toBlock: bigint) {
    return this.launches.filter((item) => item.blockNumber >= fromBlock && item.blockNumber <= toBlock);
  }
}

test('sync is idempotent and repairs shallow reorg from guard', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'binrat-'));
  const db = join(dir, 'test.sqlite');
  try {
    const source = new FakeSource();
    source.launches = [
      launch('a1', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 10n, 1),
      launch('a2', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 12n, 1)
    ];
    const store = new SqliteStore(db, chainId);
    const options = { startBlock: 8n, confirmations: 1n, maxBatchBlocks: 100n, reorgLookbackBlocks: 4n, pollIntervalMs: 100 };

    const first = await syncLaunches(source, store, options);
    assert.equal(first.inserted, 2);
    assert.equal((await store.listProvenanceFacts()).length, 2);

    const second = await syncLaunches(source, store, options);
    assert.equal(second.inserted, 0);
    assert.equal(second.batches, 0);

    const oldCheckpoint = await store.getCheckpoint();
    if (!oldCheckpoint) throw new Error('checkpoint missing');
    hashes.set(oldCheckpoint.blockNumber, `0x${'ff'.repeat(32)}` as Hex);
    const repaired = await syncLaunches(source, store, options);
    assert.equal(repaired.reorgRewindFrom, oldCheckpoint.guardBlockNumber! + 1n);
    assert.equal((await store.listProvenanceFacts()).length, 2);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test('sync can be hard-bounded to one batch for queue execution', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'binrat-bounded-sync-'));
  const db = join(dir, 'test.sqlite');
  try {
    const source = new FakeSource();
    source.head = 15n;
    const store = new SqliteStore(db, chainId);
    const options = {
      startBlock: 8n,
      confirmations: 1n,
      maxBatchBlocks: 2n,
      reorgLookbackBlocks: 4n,
      pollIntervalMs: 100,
      maxBatchesPerRun: 1
    };

    const first = await syncLaunches(source, store, options);
    assert.equal(first.batches, 1);
    assert.equal(first.startBlock, 8n);
    assert.equal(first.endBlock, 9n);
    assert.equal((await store.getCheckpoint())?.blockNumber, 9n);

    const second = await syncLaunches(source, store, options);
    assert.equal(second.batches, 1);
    assert.equal(second.startBlock, 10n);
    assert.equal(second.endBlock, 11n);
    assert.equal((await store.getCheckpoint())?.blockNumber, 11n);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
