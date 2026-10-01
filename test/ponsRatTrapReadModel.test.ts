import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1PonsOutcomeObservationStore } from '../src/cloudflare/ponsOutcomeStore.js';
import { readPonsRatTrapProjection } from '../src/cloudflare/ponsRatTrapReadModel.js';
import type { D1DatabaseLike, D1PreparedStatementLike, D1ResultLike } from '../src/cloudflare/d1Types.js';
import { buildPonsCurveOutcomeCapabilityReceipt, NATIVE_QUOTE } from '../src/pons/outcomeCapability.js';
import { buildPonsOutcomeObservationReceipt } from '../src/pons/outcomeReceipts.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const DEPLOYER='0x0000000000000000000000000000000000000042' as Hex;

function addr(n:number):Hex { return `0x${n.toString(16).padStart(40,'0')}` as Hex; }
function hash(n:number):Hex { return `0x${n.toString(16).padStart(64,'0')}` as Hex; }

function launch(input:{
  id:string; block:number; token:number; curve:number; symbol:string; deployer?:Hex; observedAtMs?:number;
}):LaunchObserved {
  return {
    launchId:input.id,
    eventId:input.id,
    chainId:4663,
    blockNumber:BigInt(input.block),
    blockHash:hash(input.block),
    observedAtMs:input.observedAtMs ?? 999_000_000,
    source:'PONS_V2',
    launcher:addr(999),
    txHash:hash(input.block+10_000),
    logIndex:0,
    token:addr(input.token),
    creator:input.deployer ?? DEPLOYER,
    pool:addr(input.curve),
    name:input.symbol,
    symbol:input.symbol,
    imageUri:'',website:'',twitter:'',telegram:''
  };
}

async function completeReceipt(value:LaunchObserved,horizonMs:number,launchTimestampMs:number,observedBlock:number,raw:bigint) {
  const capability=await buildPonsCurveOutcomeCapabilityReceipt({
    launch:{launchId:value.launchId,token:value.token,curve:value.pool},
    observedBlock:BigInt(observedBlock),
    observedBlockHash:hash(observedBlock),
    observedTimestampMs:launchTimestampMs+horizonMs,
    pairToken:NATIVE_QUOTE,
    quoteDecimals:18,
    totalSupply:10n**18n,
    graduated:false,
    quoteReserve:raw,
    tokenReserve:10n**18n
  });
  return buildPonsOutcomeObservationReceipt({
    launch:{launchId:value.launchId,token:value.token,curve:value.pool},
    horizonMs,
    targetTimestampMs:launchTimestampMs+horizonMs,
    capability
  });
}

class ReadOnlyStatement implements D1PreparedStatementLike {
  constructor(
    private readonly inner:D1PreparedStatementLike,
    private readonly onWrite:()=>never
  ) {}
  bind(...values:unknown[]):D1PreparedStatementLike { return new ReadOnlyStatement(this.inner.bind(...values),this.onWrite); }
  run<T=Record<string,unknown>>():Promise<D1ResultLike<T>> { this.onWrite(); }
  first<T=Record<string,unknown>>():Promise<T|null> { return this.inner.first<T>(); }
  all<T=Record<string,unknown>>():Promise<D1ResultLike<T>> { return this.inner.all<T>(); }
}

class StrictReadOnlyDb implements D1DatabaseLike {
  writeAttempts=0;
  constructor(private readonly inner:D1DatabaseLike) {}
  private readonly denyWrite=():never=>{ this.writeAttempts+=1; throw new Error('READ_MODEL_WRITE_ATTEMPT'); };
  prepare(sql:string):D1PreparedStatementLike { return new ReadOnlyStatement(this.inner.prepare(sql),this.denyWrite); }
  batch(_statements:D1PreparedStatementLike[]):Promise<D1ResultLike[]> { this.denyWrite(); }
  exec(_sql:string):Promise<unknown> { this.denyWrite(); }
}

test('read-only Rat Trap adapter joins cohort + receipts with canonical block time and performs zero writes', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const outcomeStore=new D1PonsOutcomeObservationStore(db);
  const old=launch({id:'a'.repeat(64),block:100,token:1,curve:2,symbol:'OLD'});
  const recent=launch({id:'b'.repeat(64),block:200,token:3,curve:4,symbol:'RECENT'});
  const current=launch({id:'c'.repeat(64),block:300,token:5,curve:6,symbol:'NOW'});
  const other=launch({id:'d'.repeat(64),block:90,token:7,curve:8,symbol:'OTHER',deployer:addr(777)});
  try {
    for (const value of [old,recent,current,other]) await store.putLaunch(value);
    await store.commitCheckpoint({blockNumber:400n,blockHash:hash(400),guardBlockNumber:null,guardBlockHash:null});
    await outcomeStore.put(await completeReceipt(old,300_000,1_000_000,110,2n*10n**18n));

    const points=new Map<bigint,{blockNumber:bigint;blockHash:Hex;timestampMs:number}>([
      [100n,{blockNumber:100n,blockHash:hash(100),timestampMs:1_000_000}],
      [200n,{blockNumber:200n,blockHash:hash(200),timestampMs:90_000_000}],
      [300n,{blockNumber:300n,blockHash:hash(300),timestampMs:100_000_000}],
      [400n,{blockNumber:400n,blockHash:hash(400),timestampMs:101_000_000}]
    ]);
    const readOnly=new StrictReadOnlyDb(db);
    const projection=await readPonsRatTrapProjection(
      readOnly,
      {async getBlockPoint(blockNumber){ const point=points.get(blockNumber); if(!point) throw new Error('POINT_MISSING'); return point; }},
      {currentLaunchId:current.launchId,asOfBlock:400n}
    );

    assert.equal(readOnly.writeAttempts,0);
    assert.deepEqual(projection.launches.map((item)=>item.symbol),['RECENT','OLD']);
    assert.equal(projection.launches[0]!.launchTimestampMs,90_000_000);
    assert.equal(projection.launches[1]!.launchTimestampMs,1_000_000);
    assert.equal(projection.launches[1]!.observations[0]!.state,'COMPLETE');
    assert.equal(projection.launches[1]!.observations[0]!.estimatedFdvQuoteRaw,2n*10n**18n);
    assert.equal(projection.launches[0]!.observations[2]!.state,'IMMATURE');
  } finally { store.close(); db.close(); }
});

test('read-only Rat Trap adapter fails closed on launch-block reorg', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const prior=launch({id:'1'.repeat(64),block:100,token:10,curve:11,symbol:'PRIOR'});
  const current=launch({id:'2'.repeat(64),block:200,token:12,curve:13,symbol:'NOW'});
  try {
    await store.putLaunch(prior); await store.putLaunch(current);
    await store.commitCheckpoint({blockNumber:300n,blockHash:hash(300),guardBlockNumber:null,guardBlockHash:null});
    const readOnly=new StrictReadOnlyDb(db);
    await assert.rejects(
      readPonsRatTrapProjection(
        readOnly,
        {async getBlockPoint(blockNumber){
          return {blockNumber,blockHash:blockNumber===100n?hash(999):hash(Number(blockNumber)),timestampMs:Number(blockNumber)*1000};
        }},
        {currentLaunchId:current.launchId,asOfBlock:300n}
      ),
      /PONS_RAT_TRAP_LAUNCH_REORG/
    );
    assert.equal(readOnly.writeAttempts,0);
  } finally { store.close(); db.close(); }
});

test('read-only Rat Trap adapter refuses silent cohort truncation', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const first=launch({id:'4'.repeat(64),block:100,token:20,curve:21,symbol:'ONE'});
  const second=launch({id:'5'.repeat(64),block:110,token:22,curve:23,symbol:'TWO'});
  const current=launch({id:'6'.repeat(64),block:120,token:24,curve:25,symbol:'NOW'});
  try {
    await store.putLaunch(first); await store.putLaunch(second); await store.putLaunch(current);
    await store.commitCheckpoint({blockNumber:130n,blockHash:hash(130),guardBlockNumber:null,guardBlockHash:null});
    const readOnly=new StrictReadOnlyDb(db);
    await assert.rejects(
      readPonsRatTrapProjection(
        readOnly,
        {async getBlockPoint(blockNumber){return {blockNumber,blockHash:hash(Number(blockNumber)),timestampMs:Number(blockNumber)*1000};}},
        {currentLaunchId:current.launchId,asOfBlock:130n,maxPreviousLaunches:1}
      ),
      /PONS_RAT_TRAP_COHORT_LIMIT_EXCEEDED:2/
    );
    assert.equal(readOnly.writeAttempts,0);
  } finally { store.close(); db.close(); }
});
