import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/cloudflare/worker.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const CHAIN_ID = 5042;

test('Cloudflare health is instant and fail-closed before durable runtime state exists', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  try {
    const response = await worker.fetch(
      new Request('https://binrat.example/api/health'),
      { DB: db }
    );
    assert.equal(response.status, 200);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.ok, false);
    assert.equal(body.indexReady, false);
    assert.equal(body.runtimeFresh, false);
  } finally {
    db.close();
  }
});

test('Cloudflare read API projects the same durable BINRAT evidence from D1', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db, CHAIN_ID);
  const runtime = new D1RuntimeStateStore(db, CHAIN_ID);
  try {
    const launch = await makeLaunch();
    const fact = await buildProvenanceFact(launch);
    assert.equal(await store.putLaunch(launch), 'INSERTED');
    assert.equal(await store.putProvenanceFact(fact), 'INSERTED');
    await store.commitCheckpoint({
      blockNumber: launch.blockNumber,
      blockHash: launch.blockHash,
      guardBlockNumber: launch.blockNumber - 1n,
      guardBlockHash: hex64(99)
    });
    await store.setHistoricalBackfillNextBlock(launch.blockNumber + 1n);
    await runtime.put({
      sourceVerified: true,
      liveCaughtUp: true,
      headBlock: launch.blockNumber + 2n,
      targetBlock: launch.blockNumber,
      observationReady: true,
      historyBackfillComplete: false,
      historyBackfillTargetBlock: launch.blockNumber - 1n,
      lastSyncError: null,
      lastHistoryError: null,
      lastObservationError: null,
      updatedAtMs: Date.now()
    });

    const env = {
      DB: db,
      CAPABILITY_MANIFEST_JSON: JSON.stringify({
        schemaVersion: 'binrat.capability-manifest/0.1',
        capabilities: {},
        launchAuthorization: {
          status: 'BLOCKED',
          marketingAuthorized: false,
          launchAuthorized: false
        },
        invariant: 'Degen decides attention. Receipts decide truth.'
      })
    };

    const health = await worker.fetch(new Request('https://binrat.example/api/health'), env);
    const healthBody = await health.json() as Record<string, unknown>;
    assert.equal(health.status, 200);
    assert.equal(healthBody.indexReady, true);
    assert.equal(healthBody.launchCount, 1);

    const feedResponse = await worker.fetch(new Request('https://binrat.example/api/feed'), env);
    assert.equal(feedResponse.status, 200);
    const feed = await feedResponse.json() as { schemaVersion: string; bags: Array<{ id: string }> };
    assert.equal(feed.schemaVersion, 'binrat.public-feed/0.1');
    assert.equal(feed.bags[0]?.id, launch.launchId);

    const bag = await worker.fetch(new Request(`https://binrat.example/api/bag/${launch.launchId}`), env);
    assert.equal(bag.status, 200);

    const creator = await worker.fetch(
      new Request(`https://binrat.example/api/creator/${launch.creator}`),
      env
    );
    assert.equal(creator.status, 200);

    const replay = await worker.fetch(
      new Request(`https://binrat.example/api/bag/${launch.launchId}/replay`),
      env
    );
    assert.equal(replay.status, 200);
    const replayBody = await replay.json() as { schemaVersion: string; stages: Array<{ label: string }> };
    assert.equal(replayBody.schemaVersion, 'binrat.replay-bundle/0.1');
    assert.deepEqual(replayBody.stages.map((stage) => stage.label), ['LAUNCH']);

    const capabilities = await worker.fetch(new Request('https://binrat.example/api/capabilities'), env);
    assert.equal(capabilities.status, 200);
  } finally {
    store.close();
    db.close();
  }
});

test('Cloudflare read API refuses stale runtime authority even when old evidence remains durable', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db, CHAIN_ID);
  const runtime = new D1RuntimeStateStore(db, CHAIN_ID);
  try {
    const launch = await makeLaunch();
    const fact = await buildProvenanceFact(launch);
    await store.putLaunch(launch);
    await store.putProvenanceFact(fact);
    await store.commitCheckpoint({
      blockNumber: launch.blockNumber,
      blockHash: launch.blockHash,
      guardBlockNumber: null,
      guardBlockHash: null
    });
    await runtime.put({
      sourceVerified: true,
      liveCaughtUp: true,
      headBlock: launch.blockNumber + 2n,
      targetBlock: launch.blockNumber,
      observationReady: true,
      historyBackfillComplete: false,
      historyBackfillTargetBlock: null,
      lastSyncError: null,
      lastHistoryError: null,
      lastObservationError: null,
      updatedAtMs: Date.now() - 120_000
    });

    const response = await worker.fetch(
      new Request('https://binrat.example/api/feed'),
      { DB: db, BINRAT_MAX_STATUS_AGE_MS: '60000' }
    );
    assert.equal(response.status, 503);
  } finally {
    store.close();
    db.close();
  }
});

async function makeLaunch(): Promise<LaunchObserved> {
  const launcher = address(1);
  const txHash = hex64(2);
  const token = address(3);
  const launchId = await deriveLaunchId({ chainId: CHAIN_ID, launcher, txHash, token });
  const eventId = await deriveEventId({ chainId: CHAIN_ID, launcher, txHash, logIndex: 4 });
  return {
    launchId,
    eventId,
    chainId: CHAIN_ID,
    blockNumber: 100n,
    blockHash: hex64(100),
    observedAtMs: 100_000,
    source: 'ARCPAD',
    launcher,
    txHash,
    logIndex: 4,
    token,
    creator: address(5),
    pool: address(6),
    name: 'Cloud Rat',
    symbol: 'RAT',
    imageUri: '',
    website: '',
    twitter: '',
    telegram: ''
  };
}

function address(seed: number): Hex {
  return `0x${seed.toString(16).padStart(40, '0').slice(-40)}` as Hex;
}

function hex64(seed: number): Hex {
  return `0x${seed.toString(16).padStart(64, '0').slice(-64)}` as Hex;
}
