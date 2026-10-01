import assert from 'node:assert/strict';
import test from 'node:test';
import type { LaunchObserved, Hex } from '../src/core/types.js';
import { NATIVE_QUOTE, buildPonsCurveOutcomeCapabilityReceipt } from '../src/pons/outcomeCapability.js';
import { buildPonsOutcomeObservationReceipt, type PonsOutcomeObservationReceipt } from '../src/pons/outcomeReceipts.js';
import {
  buildPonsRatTrapProjection,
  PONS_RAT_TRAP_HORIZONS_MS
} from '../src/pons/ratTrapProjection.js';

const DEPLOYER='0x0000000000000000000000000000000000000042' as Hex;

function addr(n:number):Hex {
  return `0x${n.toString(16).padStart(40,'0')}` as Hex;
}
function hash(n:number):Hex {
  return `0x${n.toString(16).padStart(64,'0')}` as Hex;
}
function launch(input:{
  launchId:string; block:number; timestampMs:number; token:number; curve:number;
  symbol:string; deployer?:Hex; logIndex?:number;
}):LaunchObserved {
  return {
    launchId:input.launchId,
    eventId:input.launchId,
    chainId:4663,
    blockNumber:BigInt(input.block),
    blockHash:hash(input.block),
    observedAtMs:input.timestampMs,
    source:'PONS_V2',
    launcher:addr(999),
    txHash:hash(input.block+1),
    logIndex:input.logIndex ?? 0,
    token:addr(input.token),
    creator:input.deployer ?? DEPLOYER,
    pool:addr(input.curve),
    name:input.symbol,
    symbol:input.symbol,
    imageUri:'',
    website:'',
    twitter:'',
    telegram:''
  };
}

async function completeReceipt(input:{
  launch:LaunchObserved;
  horizonMs:number;
  targetTimestampMs:number;
  observedBlock:number;
  observedBlockHash:Hex;
  observedTimestampMs:number;
  raw:bigint;
}):Promise<PonsOutcomeObservationReceipt> {
  const capability=await buildPonsCurveOutcomeCapabilityReceipt({
    launch:{launchId:input.launch.launchId,token:input.launch.token,curve:input.launch.pool},
    observedBlock:BigInt(input.observedBlock),
    observedBlockHash:input.observedBlockHash,
    observedTimestampMs:input.observedTimestampMs,
    pairToken:NATIVE_QUOTE,
    quoteDecimals:18,
    totalSupply:10n**18n,
    graduated:false,
    quoteReserve:input.raw,
    tokenReserve:10n**18n
  });
  return buildPonsOutcomeObservationReceipt({
    launch:{launchId:input.launch.launchId,token:input.launch.token,curve:input.launch.pool},
    horizonMs:input.horizonMs,
    targetTimestampMs:input.targetTimestampMs,
    capability
  });
}

async function partialGraduatedReceipt(input:{
  launch:LaunchObserved;
  horizonMs:number;
  targetTimestampMs:number;
  observedBlock:number;
  observedTimestampMs:number;
}):Promise<PonsOutcomeObservationReceipt> {
  const capability=await buildPonsCurveOutcomeCapabilityReceipt({
    launch:{launchId:input.launch.launchId,token:input.launch.token,curve:input.launch.pool},
    observedBlock:BigInt(input.observedBlock),
    observedBlockHash:hash(input.observedBlock),
    observedTimestampMs:input.observedTimestampMs,
    pairToken:NATIVE_QUOTE,
    quoteDecimals:18,
    totalSupply:10n**18n,
    graduated:true,
    quoteReserve:null,
    tokenReserve:null
  });
  return buildPonsOutcomeObservationReceipt({
    launch:{launchId:input.launch.launchId,token:input.launch.token,curve:input.launch.pool},
    horizonMs:input.horizonMs,
    targetTimestampMs:input.targetTimestampMs,
    capability
  });
}

test('Rat Trap preserves the live-canary flat 5m/1h/24h shape as a three-way tie', async () => {
  const prior=launch({
    launchId:'c5d9e15fe9926ac76fa8d6cbcbd8fb11dd3c260e2b251a5c17a7435a47baff40',
    block:76_720_075,
    timestampMs:1_790_791_851_000,
    token:1,
    curve:2,
    symbol:'CANARY'
  });
  const current=launch({
    launchId:'d'.repeat(64),
    block:77_700_000,
    timestampMs:1_790_900_000_000,
    token:3,
    curve:4,
    symbol:'NOW'
  });
  const raw=1_680_000_000_000_000_001n;
  const receipts=[
    await completeReceipt({
      launch:prior,horizonMs:300_000,targetTimestampMs:1_790_792_151_000,
      observedBlock:76_723_062,
      observedBlockHash:'0x0d0cec81267184f9ea40bbdd027c1883ba43ac02e90c5b022aa78aaadfd1987c',
      observedTimestampMs:1_790_792_151_000,raw
    }),
    await completeReceipt({
      launch:prior,horizonMs:3_600_000,targetTimestampMs:1_790_795_451_000,
      observedBlock:76_755_985,
      observedBlockHash:'0x02a03feb8ec571a421d9e0301235ca4b8e09bd21af6b10bce65126df0ccffddb',
      observedTimestampMs:1_790_795_451_000,raw
    }),
    await completeReceipt({
      launch:prior,horizonMs:86_400_000,targetTimestampMs:1_790_878_251_000,
      observedBlock:77_579_148,
      observedBlockHash:'0xa62cc1c2f912999839507cf3990bd81f353dcf3dacf9adac47ddd1de89a8c008',
      observedTimestampMs:1_790_878_251_000,raw
    })
  ];

  const projection=await buildPonsRatTrapProjection({
    currentLaunch:current,
    launches:[prior,current],
    receiptsByLaunch:new Map([[prior.launchId,receipts]]),
    canonicalLaunchTimestampMsByLaunch:new Map([
      [prior.launchId,1_790_791_851_000],
      [current.launchId,1_790_900_000_000]
    ]),
    asOfBlock:77_710_289n,
    asOfTimestampMs:1_790_910_000_000
  });

  assert.equal(projection.previousLaunchCount,1);
  const row=projection.launches[0]!;
  assert.deepEqual(row.observations.map((item)=>item.state),['COMPLETE','COMPLETE','COMPLETE']);
  assert.equal(row.highestObserved?.estimatedFdvQuoteRaw,raw);
  assert.deepEqual(row.highestObserved?.tiedHorizonsMs,[300_000,3_600_000,86_400_000]);
  assert.equal(row.highestObserved?.quoteAsset.kind,'NATIVE_ETH');
  assert.equal(row.highestObserved?.quoteAsset.decimals,18);
  assert.equal(projection.coverage.find((item)=>item.horizonMs===86_400_000)?.complete,1);
});

test('Rat Trap keeps PARTIAL, MISSING and IMMATURE rows visible instead of filtering them out', async () => {
  const old=launch({
    launchId:'a'.repeat(64),block:100,timestampMs:1_000_000,token:10,curve:11,symbol:'OLD'
  });
  const recent=launch({
    launchId:'b'.repeat(64),block:200,timestampMs:90_000_000,token:12,curve:13,symbol:'RECENT'
  });
  const current=launch({
    launchId:'c'.repeat(64),block:300,timestampMs:100_000_000,token:14,curve:15,symbol:'NOW'
  });
  const old5m=await partialGraduatedReceipt({
    launch:old,horizonMs:300_000,targetTimestampMs:1_300_000,observedBlock:110,observedTimestampMs:1_300_000
  });

  const projection=await buildPonsRatTrapProjection({
    currentLaunch:current,
    launches:[old,recent,current],
    receiptsByLaunch:new Map([[old.launchId,[old5m]]]),
    canonicalLaunchTimestampMsByLaunch:new Map([
      [old.launchId,1_000_000],
      [recent.launchId,90_000_000],
      [current.launchId,100_000_000]
    ]),
    asOfBlock:300n,
    asOfTimestampMs:100_000_000
  });

  assert.deepEqual(projection.launches.map((item)=>item.symbol),['RECENT','OLD']);
  const recentRow=projection.launches[0]!;
  const oldRow=projection.launches[1]!;
  assert.deepEqual(recentRow.observations.map((item)=>item.state),['MISSING','MISSING','IMMATURE']);
  assert.deepEqual(oldRow.observations.map((item)=>item.state),['PARTIAL','MISSING','MISSING']);
  assert.equal(oldRow.highestObserved,null);
  assert.deepEqual(oldRow.observations[0]!.missing,['V4_POOL_STATE']);

  const day=projection.coverage.find((item)=>item.horizonMs===86_400_000)!;
  assert.equal(day.totalLaunches,2);
  assert.equal(day.immature,1);
  assert.equal(day.missing,1);
});

test('Rat Trap is point-in-time safe and excludes future launches and future receipts', async () => {
  const prior=launch({
    launchId:'1'.repeat(64),block:100,timestampMs:999_000_000,token:20,curve:21,symbol:'PRIOR'
  });
  const current=launch({
    launchId:'2'.repeat(64),block:200,timestampMs:999_000_001,token:22,curve:23,symbol:'CURRENT'
  });
  const futureSamePaws=launch({
    launchId:'3'.repeat(64),block:250,timestampMs:999_000_002,token:24,curve:25,symbol:'FUTURE'
  });
  const otherPaws=launch({
    launchId:'4'.repeat(64),block:90,timestampMs:999_000_003,token:26,curve:27,symbol:'OTHER',deployer:addr(777)
  });
  const receiptAfterAsOf=await completeReceipt({
    launch:prior,horizonMs:300_000,targetTimestampMs:1_300_000,
    observedBlock:210,observedBlockHash:hash(210),observedTimestampMs:2_100_000,raw:9n*10n**18n
  });

  const projection=await buildPonsRatTrapProjection({
    currentLaunch:current,
    launches:[prior,current,futureSamePaws,otherPaws],
    receiptsByLaunch:new Map([[prior.launchId,[receiptAfterAsOf]]]),
    canonicalLaunchTimestampMsByLaunch:new Map([
      [prior.launchId,1_000_000],
      [current.launchId,2_000_000],
      [futureSamePaws.launchId,3_000_000],
      [otherPaws.launchId,900_000]
    ]),
    asOfBlock:205n,
    asOfTimestampMs:2_050_000
  });

  assert.deepEqual(projection.launches.map((item)=>item.symbol),['PRIOR']);
  assert.equal(projection.launches[0]!.observations[0]!.state,'MISSING');
  assert.equal(projection.launches[0]!.launchTimestampMs,1_000_000);
  assert.equal(projection.launches[0]!.highestObserved,null);
});

test('Rat Trap exposes exactly the canonical three initial horizons', () => {
  assert.deepEqual([...PONS_RAT_TRAP_HORIZONS_MS],[300_000,3_600_000,86_400_000]);
});
