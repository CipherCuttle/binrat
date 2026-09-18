import assert from 'node:assert/strict';
import test from 'node:test';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact, projectProvenanceEdges } from '../src/intelligence/provenance.js';
import { buildObservationReceipt } from '../src/observations/identity.js';
import { SqliteStore } from '../src/store/sqliteStore.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const CHAIN_ID = 5042;

test('D1Store matches SqliteStore for canonical BINRAT persistence semantics', async () => {
  const sqlite = new SqliteStore(':memory:', CHAIN_ID);
  const d1db = new D1CompatDatabase();
  await d1db.exec(D1_SCHEMA_SQL);
  const d1 = new D1Store(d1db, CHAIN_ID);

  try {
    const first = await makeLaunch(100n, 1, 11);
    const second = await makeLaunch(120n, 2, 12);

    assert.equal(await sqlite.putLaunch(first), 'INSERTED');
    assert.equal(await d1.putLaunch(first), 'INSERTED');
    assert.equal(await sqlite.putLaunch(first), 'DUPLICATE');
    assert.equal(await d1.putLaunch(first), 'DUPLICATE');

    await assert.rejects(
      () => sqlite.putLaunch({ ...first, symbol: 'CONFLICT' }),
      /LAUNCH_IDENTITY_CONFLICT/
    );
    await assert.rejects(
      () => d1.putLaunch({ ...first, symbol: 'CONFLICT' }),
      /LAUNCH_IDENTITY_CONFLICT/
    );

    assert.equal(await sqlite.putLaunch(second), 'INSERTED');
    assert.equal(await d1.putLaunch(second), 'INSERTED');
    assert.deepEqual(await d1.listLaunches(), await sqlite.listLaunches());

    const firstFact = await buildProvenanceFact(first);
    const secondFact = await buildProvenanceFact(second);
    for (const [left, right] of [[sqlite, d1] as const]) {
      assert.equal(await left.putProvenanceFact(firstFact), 'INSERTED');
      assert.equal(await right.putProvenanceFact(firstFact), 'INSERTED');
      assert.equal(await left.putProvenanceFact(firstFact), 'DUPLICATE');
      assert.equal(await right.putProvenanceFact(firstFact), 'DUPLICATE');
    }

    assert.equal(await sqlite.putProvenanceFact(secondFact), 'INSERTED');
    assert.equal(await d1.putProvenanceFact(secondFact), 'INSERTED');
    const edges = await projectProvenanceEdges([firstFact, secondFact]);
    await sqlite.replaceProvenanceEdges(edges);
    await d1.replaceProvenanceEdges(edges);

    assert.deepEqual(await d1.listProvenanceFacts(), await sqlite.listProvenanceFacts());
    assert.deepEqual(await d1.listProvenanceEdges(), await sqlite.listProvenanceEdges());

    const observation = await buildObservationReceipt({
      chainId: CHAIN_ID,
      launchId: first.launchId,
      horizonMs: 300_000,
      targetTimestampMs: 1_000_000,
      observedBlock: 110n,
      observedBlockHash: hex64(99),
      observedTimestampMs: 1_000_500,
      status: 'COMPLETE',
      facts: {
        poolCodePresent: true,
        poolActiveLiquidity: 123n,
        poolSqrtPriceX96: 456n,
        poolTick: 7,
        creatorTokenBalance: 8n,
        tokenTotalSupply: 1_000n,
        tokenDecimals: 18
      },
      missing: []
    });
    assert.equal(await sqlite.putObservation(observation), 'INSERTED');
    assert.equal(await d1.putObservation(observation), 'INSERTED');
    assert.equal(await sqlite.putObservation(observation), 'DUPLICATE');
    assert.equal(await d1.putObservation(observation), 'DUPLICATE');
    assert.deepEqual(
      await d1.listObservationsForLaunch(first.launchId),
      await sqlite.listObservationsForLaunch(first.launchId)
    );

    const checkpoint = {
      blockNumber: 130n,
      blockHash: hex64(130),
      guardBlockNumber: 129n,
      guardBlockHash: hex64(129)
    };
    await sqlite.commitCheckpoint(checkpoint);
    await d1.commitCheckpoint(checkpoint);
    assert.deepEqual(await d1.getCheckpoint(), await sqlite.getCheckpoint());

    await sqlite.setHistoricalBackfillNextBlock(90n);
    await d1.setHistoricalBackfillNextBlock(90n);
    assert.equal(await d1.getHistoricalBackfillNextBlock(), await sqlite.getHistoricalBackfillNextBlock());

    assert.deepEqual(await d1.readPublicProjectionState(), await sqlite.readPublicProjectionState());

    await sqlite.rewindFromBlock(115n);
    await d1.rewindFromBlock(115n);
    assert.deepEqual(await d1.listLaunches(), await sqlite.listLaunches());
    assert.deepEqual(await d1.listProvenanceFacts(), await sqlite.listProvenanceFacts());
    assert.deepEqual(await d1.getCheckpoint(), await sqlite.getCheckpoint());
    assert.equal(await d1.getHistoricalBackfillNextBlock(), await sqlite.getHistoricalBackfillNextBlock());
  } finally {
    sqlite.close();
    d1.close();
    d1db.close();
  }
});

test('D1 historical batch conflict aborts without advancing durable cursor', async () => {
  const d1db = new D1CompatDatabase();
  await d1db.exec(D1_SCHEMA_SQL);
  const d1 = new D1Store(d1db, CHAIN_ID);
  try {
    const launch = await makeLaunch(100n, 1, 21);
    assert.equal(await d1.putLaunch(launch), 'INSERTED');
    await d1.setHistoricalBackfillNextBlock(50n);

    const conflicting = { ...launch, symbol: 'MUTATED' };
    const fact = await buildProvenanceFact(conflicting);
    const edges = await projectProvenanceEdges([fact]);

    await assert.rejects(
      () => d1.commitHistoricalBackfillBatch([conflicting], [fact], edges, 101n)
    );
    assert.equal(await d1.getHistoricalBackfillNextBlock(), 50n);
    assert.equal((await d1.getLaunch(launch.launchId))?.symbol, launch.symbol);
  } finally {
    d1.close();
    d1db.close();
  }
});

async function makeLaunch(blockNumber: bigint, logIndex: number, seed: number): Promise<LaunchObserved> {
  const launcher = address(seed) as Hex;
  const txHash = hex64(seed + 100);
  const token = address(seed + 200) as Hex;
  const launchId = await deriveLaunchId({ chainId: CHAIN_ID, launcher, txHash, token });
  const eventId = await deriveEventId({ chainId: CHAIN_ID, launcher, txHash, logIndex });
  return {
    launchId,
    eventId,
    chainId: CHAIN_ID,
    blockNumber,
    blockHash: hex64(Number(blockNumber)),
    observedAtMs: Number(blockNumber) * 1000,
    source: 'ARCPAD',
    launcher,
    txHash,
    logIndex,
    token,
    creator: address(seed + 300) as Hex,
    pool: address(seed + 400) as Hex,
    name: `Bag ${seed}`,
    symbol: `B${seed}`,
    imageUri: '',
    website: '',
    twitter: '',
    telegram: ''
  };
}

function address(seed: number): string {
  return `0x${seed.toString(16).padStart(40, '0').slice(-40)}`;
}

function hex64(seed: number): Hex {
  return `0x${seed.toString(16).padStart(64, '0').slice(-64)}` as Hex;
}
