import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1RatRadarStore } from '../src/cloudflare/ratRadarStore.js';
import {
  deriveRatRadarSwapReceipt,
  RAT_RADAR_SWAP_VERSION
} from '../src/ratRadar/activity.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const CHAIN_ID = 5042;

test('Rat Radar swap receipt preserves V3 sender and recipient without inferring one trader', async () => {
  const receipt = await deriveRatRadarSwapReceipt({
    chainId: CHAIN_ID,
    launchId: 'launch-1',
    pool: address(1),
    token: address(2),
    token0: address(3),
    token1: address(2),
    blockNumber: 110n,
    blockHash: hex64(110),
    txHash: hex64(7),
    logIndex: 3,
    sender: address(10),
    recipient: address(11),
    amount0: 1_000n,
    amount1: -500n,
    sqrtPriceX96: 123n,
    liquidity: 456n,
    tick: 7
  });

  assert.equal(receipt.version, RAT_RADAR_SWAP_VERSION);
  assert.equal(receipt.sender, address(10));
  assert.equal(receipt.recipient, address(11));
  assert.equal(receipt.launchedTokenDelta, -500n);
  assert.equal(receipt.launchedTokenFlow, 'POOL_TO_RECIPIENT');
  assert.equal(receipt.evidenceDigest.length, 64);
  assert.equal(receipt.activityId.length, 64);
});

test('Rat Radar D1 swap receipts are immutable and idempotent', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const launches = new D1Store(db, CHAIN_ID);
  const radar = new D1RatRadarStore(db, CHAIN_ID);

  try {
    const launch = await makeLaunch(100n, 1);
    await launches.putLaunch(launch);

    const input = {
      chainId: CHAIN_ID,
      launchId: launch.launchId,
      pool: launch.pool,
      token: launch.token,
      token0: launch.token,
      token1: address(222),
      blockNumber: 110n,
      blockHash: hex64(110),
      txHash: hex64(70),
      logIndex: 2,
      sender: address(20),
      recipient: address(21),
      amount0: -100n,
      amount1: 50n,
      sqrtPriceX96: 1_000n,
      liquidity: 2_000n,
      tick: 9
    };
    const first = await deriveRatRadarSwapReceipt(input);
    assert.equal(await radar.putSwap(first), 'INSERTED');
    assert.equal(await radar.putSwap(first), 'DUPLICATE');

    const changed = await deriveRatRadarSwapReceipt({ ...input, recipient: address(22) });
    await assert.rejects(() => radar.putSwap(changed), /RAT_RADAR_SWAP_IDENTITY_CONFLICT/);

    const rows = await radar.listForLaunch(launch.launchId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.recipient, address(21));
  } finally {
    launches.close();
    db.close();
  }
});

test('Rat Radar receipts after a reorg boundary are removed even for an older surviving launch', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const launches = new D1Store(db, CHAIN_ID);
  const radar = new D1RatRadarStore(db, CHAIN_ID);

  try {
    const launch = await makeLaunch(100n, 2);
    await launches.putLaunch(launch);
    const receipt = await deriveRatRadarSwapReceipt({
      chainId: CHAIN_ID,
      launchId: launch.launchId,
      pool: launch.pool,
      token: launch.token,
      token0: address(223),
      token1: launch.token,
      blockNumber: 200n,
      blockHash: hex64(200),
      txHash: hex64(80),
      logIndex: 4,
      sender: address(30),
      recipient: address(31),
      amount0: 80n,
      amount1: -160n,
      sqrtPriceX96: 3_000n,
      liquidity: 4_000n,
      tick: 11
    });
    await radar.putSwap(receipt);
    assert.equal((await radar.listForLaunch(launch.launchId)).length, 1);

    await launches.rewindFromBlock(150n);

    assert.equal((await radar.listForLaunch(launch.launchId)).length, 0);
    assert.ok(await launches.getLaunch(launch.launchId));
  } finally {
    launches.close();
    db.close();
  }
});


test('Rat Radar derives token side from pool tokens and rejects mismatched pool authority', async () => {
  await assert.rejects(
    () => deriveRatRadarSwapReceipt({
      chainId: CHAIN_ID,
      launchId: 'launch-x',
      pool: address(1),
      token: address(2),
      token0: address(3),
      token1: address(4),
      blockNumber: 10n,
      blockHash: hex64(10),
      txHash: hex64(11),
      logIndex: 0,
      sender: address(5),
      recipient: address(6),
      amount0: 1n,
      amount1: -1n,
      sqrtPriceX96: 1n,
      liquidity: 1n,
      tick: 0
    }),
    /RAT_RADAR_TOKEN_NOT_IN_POOL/
  );

  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const launches = new D1Store(db, CHAIN_ID);
  const radar = new D1RatRadarStore(db, CHAIN_ID);
  try {
    const launch = await makeLaunch(100n, 3);
    await launches.putLaunch(launch);
    const wrongPool = await deriveRatRadarSwapReceipt({
      chainId: CHAIN_ID,
      launchId: launch.launchId,
      pool: address(250),
      token: launch.token,
      token0: launch.token,
      token1: address(251),
      blockNumber: 110n,
      blockHash: hex64(110),
      txHash: hex64(111),
      logIndex: 1,
      sender: address(252),
      recipient: address(253),
      amount0: -2n,
      amount1: 1n,
      sqrtPriceX96: 2n,
      liquidity: 3n,
      tick: 1
    });
    await assert.rejects(() => radar.putSwap(wrongPool), /RAT_RADAR_LAUNCH_AUTHORITY_MISMATCH/);
  } finally {
    launches.close();
    db.close();
  }
});

async function makeLaunch(blockNumber: bigint, seed: number): Promise<LaunchObserved> {
  const launcher = address(100 + seed);
  const txHash = hex64(120 + seed);
  const token = address(140 + seed);
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
    creator: address(160 + seed),
    pool: address(180 + seed),
    name: `Radar Rat ${seed}`,
    symbol: `RR${seed}`,
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
