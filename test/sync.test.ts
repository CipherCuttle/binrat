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

function ponsLaunch(id: number, blockNumber: bigint): LaunchObserved {
  const suffix = id.toString(16).padStart(40, '0');
  return {
    chainId: 4663,
    blockNumber,
    blockHash: hashFor(blockNumber),
    observedAtMs: 1,
    launchId: `pons-launch-${id}`,
    eventId: `pons-event-${id}`,
    source: 'PONS_V2',
    launcher: '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e',
    txHash: `0x${(10_000 + id).toString(16).padStart(64, '0')}` as Hex,
    logIndex: 0,
    token: `0x${suffix}` as Hex,
    creator: `0x${(20_000 + id).toString(16).padStart(40, '0')}` as Hex,
    pool: `0x${(30_000 + id).toString(16).padStart(40, '0')}` as Hex,
    name: '', symbol: '', imageUri: '', website: '', twitter: '', telegram: ''
  };
}

function hashFor(blockNumber: bigint): Hex {
  return `0x${blockNumber.toString(16).padStart(64, '0')}` as Hex;
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

class CountingPonsSource implements LaunchSource {
  readonly launches: LaunchObserved[];
  readonly head = 514n;
  externalCalls = 0;
  catchUpCalls: Array<[bigint, bigint]> = [];
  private authorityVerified = false;

  constructor(launches: LaunchObserved[]) { this.launches = launches; }

  async getHeadBlockNumber() { this.externalCalls += 1; return this.head; }
  async getBlockHash(blockNumber: bigint) { this.externalCalls += 1; return hashFor(blockNumber); }
  async assertAuthority(_blockNumber: bigint) {
    if (!this.authorityVerified) {
      this.externalCalls += 2; // chain id + immutable factory code
      this.authorityVerified = true;
    }
  }
  async catchUp(fromBlock: bigint, toBlock: bigint) {
    this.externalCalls += 1; // eth_getLogs
    this.catchUpCalls.push([fromBlock, toBlock]);
    const matches = this.launches.filter((launch) => launch.blockNumber >= fromBlock && launch.blockNumber <= toBlock);
    if (new Set(matches.map((launch) => launch.blockNumber.toString())).size > 16) {
      throw new Error('PONS_LAUNCH_BLOCK_DENSITY');
    }
    return matches;
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

test('caught-up sync does not rewrite an unchanged provenance projection', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'binrat-provenance-noop-'));
  const db = join(dir, 'test.sqlite');
  try {
    const source = new FakeSource();
    source.launches = [launch('c1', '0xcccccccccccccccccccccccccccccccccccccccc', 10n, 1)];
    const store = new SqliteStore(db, chainId);
    const options = {
      startBlock: 8n,
      confirmations: 1n,
      maxBatchBlocks: 100n,
      reorgLookbackBlocks: 4n,
      pollIntervalMs: 100
    };

    await syncLaunches(source, store, options);
    const replace = store.replaceProvenanceEdges.bind(store);
    let replacements = 0;
    store.replaceProvenanceEdges = async (edges) => {
      replacements += 1;
      await replace(edges);
    };

    const second = await syncLaunches(source, store, options);
    assert.equal(second.batches, 0);
    assert.equal(replacements, 0);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Pons live sync keeps 0, 1, and 20-launch critical batches below the external-call ceiling', async () => {
  const cases: Array<{ label: string; launches: LaunchObserved[] }> = [
    { label: 'zero', launches: [] },
    { label: 'one', launches: [ponsLaunch(1, 100n)] },
    // Twenty events across ten canonical blocks model the observed live shape.
    { label: 'twenty', launches: Array.from({ length: 20 }, (_, index) => ponsLaunch(index + 1, 100n + BigInt(Math.floor(index / 2)))) }
  ];
  for (const item of cases) {
    const dir = mkdtempSync(join(tmpdir(), `binrat-pons-${item.label}-`));
    const db = join(dir, 'test.sqlite');
    try {
      const source = new CountingPonsSource(item.launches);
      await source.getHeadBlockNumber();
      await source.assertAuthority(source.head);
      const store = new SqliteStore(db, 4663);
      const report = await syncLaunches(source, store, {
        startBlock: 1n, confirmations: 1n, maxBatchBlocks: 512n,
        reorgLookbackBlocks: 32n, pollIntervalMs: 100, maxBatchesPerRun: 1
      });
      assert.equal(report.endBlock, 512n, item.label);
      assert.ok(source.externalCalls <= 35, `${item.label}: ${source.externalCalls}`);
      store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('Pons live sync narrows a dense range before checkpointing and stays under 35 external calls', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'binrat-pons-dense-'));
  const db = join(dir, 'test.sqlite');
  try {
    const source = new CountingPonsSource(Array.from({ length: 512 }, (_, index) => ponsLaunch(index + 1, BigInt(index + 1))));
    await source.getHeadBlockNumber();
    await source.assertAuthority(source.head);
    const store = new SqliteStore(db, 4663);
    const report = await syncLaunches(source, store, {
      startBlock: 1n, confirmations: 1n, maxBatchBlocks: 512n,
      reorgLookbackBlocks: 32n, pollIntervalMs: 100, maxBatchesPerRun: 1
    });
    assert.equal(report.endBlock, 16n);
    assert.equal((await store.getCheckpoint())?.blockNumber, 16n);
    assert.deepEqual(source.catchUpCalls.map(([, to]) => to), [512n, 256n, 128n, 64n, 32n, 16n]);
    assert.ok(source.externalCalls <= 35, `dense: ${source.externalCalls}`);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
