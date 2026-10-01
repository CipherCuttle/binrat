import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { D1PonsOutcomeObservationStore } from '../src/cloudflare/ponsOutcomeStore.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { PONS_V2_FACTORY, ROBINHOOD_CHAIN_ID } from '../src/pons/chain.js';
import {
  buildPonsCurveOutcomeCapabilityReceipt,
  type PonsCurveOutcomeCapabilityReceipt
} from '../src/pons/outcomeCapability.js';
import {
  buildPonsOutcomeObservationReceipt,
  syncPonsOutcomeObservations,
  verifyPonsOutcomeObservationReceipt,
  type PonsOutcomeObservationLaunch,
  type PonsOutcomeObservationSource
} from '../src/pons/outcomeReceipts.js';
import { D1CompatDatabase } from './support/d1Compat.js';
import { addr, hash } from './support/autonomousFixture.js';

async function launchAt(blockNumber: bigint): Promise<LaunchObserved> {
  const token=addr(Number(blockNumber)+1000);
  const curve=addr(Number(blockNumber)+2000);
  const txHash=hash(Number(blockNumber)+10000);
  return {
    launchId:await deriveLaunchId({
      chainId:ROBINHOOD_CHAIN_ID,
      launcher:PONS_V2_FACTORY,
      txHash,
      token,
      source:'PONS_V2'
    }),
    eventId:await deriveEventId({
      chainId:ROBINHOOD_CHAIN_ID,
      launcher:PONS_V2_FACTORY,
      txHash,
      logIndex:0,
      source:'PONS_V2'
    }),
    chainId:ROBINHOOD_CHAIN_ID,
    blockNumber,
    blockHash:hash(Number(blockNumber)),
    observedAtMs:1,
    source:'PONS_V2',
    launcher:PONS_V2_FACTORY,
    txHash,
    logIndex:0,
    token,
    creator:addr(42),
    pool:curve,
    name:'',
    symbol:'',
    imageUri:'',
    website:'',
    twitter:'',
    telegram:''
  };
}

async function capability(
  launch:PonsOutcomeObservationLaunch,
  blockNumber:bigint,
  blockHash=hash(Number(blockNumber))
):Promise<PonsCurveOutcomeCapabilityReceipt> {
  return buildPonsCurveOutcomeCapabilityReceipt({
    launch:{launchId:launch.launchId,token:launch.token,curve:launch.curve},
    observedBlock:blockNumber,
    observedBlockHash:blockHash,
    observedTimestampMs:Number(blockNumber)*60_000,
    pairToken:'0x0000000000000000000000000000000000000000',
    quoteDecimals:18,
    totalSupply:1_000_000n*10n**18n,
    graduated:false,
    quoteReserve:10n*10n**18n,
    tokenReserve:500_000n*10n**18n
  });
}

function sourceFor(
  mutatePoint?:(blockNumber:bigint,base:{blockNumber:bigint;blockHash:Hex;timestampMs:number})=>{blockNumber:bigint;blockHash:Hex;timestampMs:number}
):PonsOutcomeObservationSource {
  return {
    async assertAuthority() {},
    async getBlockPoint(blockNumber) {
      const base={blockNumber,blockHash:hash(Number(blockNumber)),timestampMs:Number(blockNumber)*60_000};
      return mutatePoint ? mutatePoint(blockNumber,base) : base;
    },
    async readOutcomeAt(launch,blockNumber) {
      return capability(
        {...launch,blockNumber:10n,blockHash:hash(10)},
        blockNumber
      );
    }
  };
}

async function fixture(checkpointBlock=20n) {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const launch=await launchAt(10n);
  const baseStore=new D1Store(db,ROBINHOOD_CHAIN_ID);
  await baseStore.putLaunch(launch);
  await baseStore.commitCheckpoint({
    blockNumber:checkpointBlock,
    blockHash:hash(Number(checkpointBlock)),
    guardBlockNumber:null,
    guardBlockHash:null
  });
  return {
    db,
    baseStore,
    launch:{launchId:launch.launchId,token:launch.token,curve:launch.pool,blockNumber:launch.blockNumber,blockHash:launch.blockHash},
    store:new D1PonsOutcomeObservationStore(db)
  };
}

test('Pons horizon receipts are deterministic, maturity-bound and tamper-evident', async () => {
  const launch={
    launchId:'a'.repeat(64),
    token:addr(1),
    curve:addr(2),
    blockNumber:10n,
    blockHash:hash(10)
  };
  const cap=await capability(launch,15n);
  const first=await buildPonsOutcomeObservationReceipt({
    launch,
    horizonMs:300_000,
    targetTimestampMs:900_000,
    capability:cap
  });
  const second=await buildPonsOutcomeObservationReceipt({
    launch,
    horizonMs:300_000,
    targetTimestampMs:900_000,
    capability:cap
  });
  assert.deepEqual(first,second);
  await assert.doesNotReject(verifyPonsOutcomeObservationReceipt(first));
  await assert.rejects(
    verifyPonsOutcomeObservationReceipt({...first,estimatedFdvQuoteRaw:999n}),
    /PONS_OUTCOME/
  );
  await assert.rejects(
    buildPonsOutcomeObservationReceipt({
      launch,
      horizonMs:300_000,
      targetTimestampMs:900_001,
      capability:cap
    }),
    /PONS_OUTCOME_OBSERVATION_BEFORE_TARGET/
  );
});

test('O2 writes the first canonical block at or after maturity exactly once', async () => {
  const f=await fixture(20n);
  try {
    const first=await syncPonsOutcomeObservations(sourceFor(),f.store,{
      maxReceiptsPerSync:10,
      horizons:[{label:'5m',ms:300_000}]
    });
    assert.equal(first.inserted,1);
    assert.equal(first.pendingMaturity,0);
    const [saved]=await f.store.listForLaunch(f.launch.launchId);
    assert.ok(saved);
    assert.equal(saved.horizonMs,300_000);
    assert.equal(saved.targetTimestampMs,900_000);
    assert.equal(saved.observedBlock,15n);
    assert.equal(saved.observedTimestampMs,900_000);
    assert.equal(saved.status,'COMPLETE');
    assert.equal(saved.estimatedFdvQuoteRaw,20n*10n**18n);

    const second=await syncPonsOutcomeObservations(sourceFor(),f.store,{
      maxReceiptsPerSync:10,
      horizons:[{label:'5m',ms:300_000}]
    });
    assert.equal(second.inserted,0);
    assert.equal(second.alreadyPresent,1);
    assert.equal((await f.store.listForLaunch(f.launch.launchId)).length,1);
  } finally { f.db.close(); }
});

test('O2 never writes an immature horizon', async () => {
  const f=await fixture(14n);
  try {
    const report=await syncPonsOutcomeObservations(sourceFor(),f.store,{
      maxReceiptsPerSync:10,
      horizons:[{label:'5m',ms:300_000}]
    });
    assert.equal(report.inserted,0);
    assert.equal(report.pendingMaturity,1);
    assert.equal((await f.store.listForLaunch(f.launch.launchId)).length,0);
  } finally { f.db.close(); }
});

test('O2 fails closed if the maturity block reorgs while outcome state is read', async () => {
  const f=await fixture(20n);
  try {
    const calls=new Map<string,number>();
    const source=sourceFor((blockNumber,base)=>{
      const key=blockNumber.toString();
      const n=(calls.get(key) ?? 0)+1;
      calls.set(key,n);
      if (blockNumber===15n && n>=2) return {...base,blockHash:hash(999)};
      return base;
    });
    await assert.rejects(
      syncPonsOutcomeObservations(source,f.store,{
        maxReceiptsPerSync:10,
        horizons:[{label:'5m',ms:300_000}]
      }),
      /PONS_OUTCOME_OBSERVED_REORG_DURING_READ/
    );
    assert.equal((await f.store.listForLaunch(f.launch.launchId)).length,0);
  } finally { f.db.close(); }
});

test('append-only store rejects a divergent replay for the same launch horizon', async () => {
  const f=await fixture(20n);
  try {
    const launch=f.launch;
    const first=await buildPonsOutcomeObservationReceipt({
      launch,
      horizonMs:300_000,
      targetTimestampMs:900_000,
      capability:await capability(launch,15n)
    });
    assert.equal(await f.store.put(first),'INSERTED');
    assert.equal(await f.store.put(first),'DUPLICATE');

    const divergent=await buildPonsOutcomeObservationReceipt({
      launch,
      horizonMs:300_000,
      targetTimestampMs:900_000,
      capability:await capability(launch,16n)
    });
    assert.equal(divergent.observationId,first.observationId);
    await assert.rejects(
      f.store.put(divergent),
      /PONS_OUTCOME_OBSERVATION_CONFLICT/
    );
  } finally { f.db.close(); }
});


test('D1 rewind removes reorged Pons outcome receipts without deleting an earlier launch', async () => {
  const f=await fixture(20n);
  try {
    await syncPonsOutcomeObservations(sourceFor(),f.store,{
      maxReceiptsPerSync:10,
      horizons:[{label:'5m',ms:300_000}]
    });
    assert.equal((await f.store.listForLaunch(f.launch.launchId)).length,1);

    await f.baseStore.rewindFromBlock(15n);

    assert.equal((await f.store.listForLaunch(f.launch.launchId)).length,0);
    assert.ok(await f.baseStore.getLaunch(f.launch.launchId));
  } finally { f.db.close(); }
});
