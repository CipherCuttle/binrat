import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/cloudflare/worker.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1RatRadarStore } from '../src/cloudflare/ratRadarStore.js';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { deriveRatRadarSwapReceipt } from '../src/ratRadar/activity.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const CHAIN_ID = 5042;

test('Cloudflare exposes a free Rat Radar watchlist and public evidence receipts at the authoritative checkpoint', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db, CHAIN_ID);
  const radar = new D1RatRadarStore(db, CHAIN_ID);
  const runtime = new D1RuntimeStateStore(db, CHAIN_ID);
  const recurrent = address(90);

  try {
    const first = await makeLaunch(100n, 1);
    const second = await makeLaunch(200n, 2);
    for (const launch of [first, second]) {
      await store.putLaunch(launch);
      await store.putProvenanceFact(await buildProvenanceFact(launch));
    }

    const firstReceipt = await makeSwap(first, 102n, 1, recurrent);
    const secondReceipt = await makeSwap(second, 205n, 1, recurrent);
    const futureReceipt = await makeSwap(first, 230n, 2, address(91));
    await radar.putSwap(firstReceipt);
    await radar.putSwap(secondReceipt);
    await radar.putSwap(futureReceipt);

    await store.commitCheckpoint({
      blockNumber: 220n,
      blockHash: hex64(220),
      guardBlockNumber: 219n,
      guardBlockHash: hex64(219)
    });
    await runtime.put({
      sourceVerified: true,
      liveCaughtUp: true,
      headBlock: 222n,
      targetBlock: 220n,
      observationReady: true,
      historyBackfillComplete: false,
      historyBackfillTargetBlock: 99n,
      lastSyncError: null,
      lastHistoryError: null,
      lastObservationError: null,
      updatedAtMs: Date.now()
    });

    const env = { DB: db };

    const response = await worker.fetch(
      new Request('https://binrat.example/api/rat-radar/watchlist'),
      env
    );
    assert.equal(response.status, 200);
    const body = await response.json() as {
      schemaVersion: string;
      coverage: {
        swapReceiptCount: number;
        acquisitionReceiptCount: number;
        distinctRecipientAddressCount: number;
      };
      method: { evidencedRole: string; identityBoundary: string; recommendationBoundary: string };
      candidates: Array<{
        observedRecipientAddress: string;
        distinctLaunchCount: number;
        evidenceActivityIds: string[];
      }>;
    };
    assert.equal(body.schemaVersion, 'binrat.rat-radar-watchlist/0.1');
    assert.equal(body.coverage.swapReceiptCount, 2);
    assert.equal(body.coverage.acquisitionReceiptCount, 2);
    assert.equal(body.coverage.distinctRecipientAddressCount, 1);
    assert.equal(body.method.evidencedRole, 'V3_SWAP_RECIPIENT');
    assert.match(body.method.identityBoundary, /not automatically a human trader/i);
    assert.match(body.method.recommendationBoundary, /not a BUY\/SELL recommendation/i);
    assert.equal(body.candidates[0]?.observedRecipientAddress, recurrent);
    assert.equal(body.candidates[0]?.distinctLaunchCount, 2);
    assert.deepEqual(
      body.candidates[0]?.evidenceActivityIds,
      [firstReceipt.activityId, secondReceipt.activityId]
    );

    const addressActivity = await worker.fetch(
      new Request(`https://binrat.example/api/rat-radar/address/${recurrent}/activity`),
      env
    );
    assert.equal(addressActivity.status, 200);
    const addressActivityBody = await addressActivity.json() as {
      activityCount: number;
      observedRecipientAddress: string;
      activities: Array<{ activityId: string }>;
      identityBoundary: string;
    };
    assert.equal(addressActivityBody.observedRecipientAddress, recurrent);
    assert.equal(addressActivityBody.activityCount, 2);
    assert.deepEqual(
      addressActivityBody.activities.map((item) => item.activityId),
      [firstReceipt.activityId, secondReceipt.activityId]
    );
    assert.match(addressActivityBody.identityBoundary, /not automatically a human trader/i);

    const activity = await worker.fetch(
      new Request(`https://binrat.example/api/rat-radar/activity/${firstReceipt.activityId}`),
      env
    );
    assert.equal(activity.status, 200);
    const activityBody = await activity.json() as {
      schemaVersion: string;
      activityId: string;
      amount0: string;
      launchedTokenDelta: string;
      recipient: string;
      identityBoundary: string;
    };
    assert.equal(activityBody.schemaVersion, 'binrat.rat-radar-activity/0.1');
    assert.equal(activityBody.activityId, firstReceipt.activityId);
    assert.equal(activityBody.amount0, '-100');
    assert.equal(activityBody.launchedTokenDelta, '-100');
    assert.equal(activityBody.recipient, recurrent);
    assert.match(activityBody.identityBoundary, /not inferred human identities/i);

    const future = await worker.fetch(
      new Request(`https://binrat.example/api/rat-radar/activity/${futureReceipt.activityId}`),
      env
    );
    assert.equal(future.status, 404);
  } finally {
    store.close();
    db.close();
  }
});

async function makeLaunch(blockNumber: bigint, seed: number): Promise<LaunchObserved> {
  const launcher = address(10 + seed);
  const txHash = hex64(20 + seed);
  const token = address(30 + seed);
  return {
    launchId: await deriveLaunchId({ chainId: CHAIN_ID, launcher, txHash, token }),
    eventId: await deriveEventId({ chainId: CHAIN_ID, launcher, txHash, logIndex: seed }),
    chainId: CHAIN_ID,
    blockNumber,
    blockHash: hex64(Number(blockNumber)),
    observedAtMs: Number(blockNumber) * 1_000,
    source: 'ARCPAD',
    launcher,
    txHash,
    logIndex: seed,
    token,
    creator: address(40 + seed),
    pool: address(50 + seed),
    name: `Radar Worker ${seed}`,
    symbol: `RW${seed}`,
    imageUri: '',
    website: '',
    twitter: '',
    telegram: ''
  };
}

async function makeSwap(
  launch: LaunchObserved,
  blockNumber: bigint,
  logIndex: number,
  recipient: Hex
) {
  return deriveRatRadarSwapReceipt({
    chainId: CHAIN_ID,
    launchId: launch.launchId,
    pool: launch.pool,
    token: launch.token,
    token0: launch.token,
    token1: address(500),
    blockNumber,
    blockHash: hex64(Number(blockNumber)),
    txHash: hex64(Number(blockNumber) * 10 + logIndex),
    logIndex,
    sender: address(70 + logIndex),
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

function hex64(seed: number): Hex {
  return `0x${seed.toString(16).padStart(64, '0').slice(-64)}` as Hex;
}
