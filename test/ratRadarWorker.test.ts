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

test('Cloudflare retires historical Arc Radar public routes before reading the index',async()=>{
 const db=new D1CompatDatabase();await db.exec(D1_SCHEMA_SQL);
 try {for(const path of ['/api/rat-radar/watchlist','/api/rat-radar/activity/'+ 'a'.repeat(64),'/api/rat-radar/address/'+address(91)+'/activity']) {
   const response=await worker.fetch(new Request('https://binrat.example'+path),{DB:db});assert.equal(response.status,410);
   assert.deepEqual(await response.json(),{error:'LEGACY_ARC_RADAR_RETIRED',chainId:4663,replacement:'PONS_DEPLOYER_RECURRENCE'});
 }} finally {db.close();}
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
