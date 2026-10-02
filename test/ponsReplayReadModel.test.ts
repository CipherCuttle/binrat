import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { buildPonsCurveOutcomeCapabilityReceipt, NATIVE_QUOTE } from '../src/pons/outcomeCapability.js';
import { buildPonsOutcomeObservationReceipt } from '../src/pons/outcomeReceipts.js';
import { buildPonsTokenIdentityReceipt } from '../src/pons/tokenIdentity.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1PonsOutcomeObservationStore } from '../src/cloudflare/ponsOutcomeStore.js';
import { D1PonsTokenIdentityStore } from '../src/cloudflare/ponsTokenIdentityStore.js';
import { readPonsReplaySnapshot } from '../src/cloudflare/ponsReplayReadModel.js';
import type { D1DatabaseLike, D1PreparedStatementLike, D1ResultLike } from '../src/cloudflare/d1Types.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const DEPLOYER='0x0000000000000000000000000000000000000042' as Hex;
const addr=(n:number)=>('0x'+n.toString(16).padStart(40,'0')) as Hex;
const hash=(n:number)=>('0x'+n.toString(16).padStart(64,'0')) as Hex;

function launch(id:string,block:number,token:number,curve:number):LaunchObserved {
  return {
    launchId:id,eventId:id,chainId:4663,blockNumber:BigInt(block),blockHash:hash(block),observedAtMs:block*1000,
    source:'PONS_V2',launcher:addr(999),txHash:hash(block+1000),logIndex:0,token:addr(token),creator:DEPLOYER,
    pool:addr(curve),name:'',symbol:'',imageUri:'',website:'',twitter:'',telegram:''
  };
}

class ReadOnlyStatement implements D1PreparedStatementLike {
  constructor(private readonly inner:D1PreparedStatementLike,private readonly deny:()=>never) {}
  bind(...values:unknown[]):D1PreparedStatementLike { return new ReadOnlyStatement(this.inner.bind(...values),this.deny); }
  run<T=Record<string,unknown>>():Promise<D1ResultLike<T>> { return this.deny(); }
  first<T=Record<string,unknown>>():Promise<T|null> { return this.inner.first<T>(); }
  all<T=Record<string,unknown>>():Promise<D1ResultLike<T>> { return this.inner.all<T>(); }
}

class StrictReadOnlyDb implements D1DatabaseLike {
  writeAttempts=0;
  constructor(private readonly inner:D1DatabaseLike) {}
  private readonly deny=():never=>{ this.writeAttempts+=1; throw new Error('PONS_REPLAY_WRITE_ATTEMPT'); };
  prepare(sql:string):D1PreparedStatementLike { return new ReadOnlyStatement(this.inner.prepare(sql),this.deny); }
  batch(_statements:D1PreparedStatementLike[]):Promise<D1ResultLike[]> { return this.deny(); }
  exec(_sql:string):Promise<unknown> { return this.deny(); }
}

test('read-only Replay Lab adapter excludes future identity/outcome rows and performs zero writes',async()=>{
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const identityStore=new D1PonsTokenIdentityStore(db);
  const outcomeStore=new D1PonsOutcomeObservationStore(db);
  const prior=launch('a'.repeat(64),100,1,2);
  const target=launch('b'.repeat(64),200,3,4);
  try {
    await store.putLaunch(prior);
    await store.putLaunch(target);
    await store.putProvenanceFact(await buildProvenanceFact(prior));
    await store.putProvenanceFact(await buildProvenanceFact(target));
    await store.commitCheckpoint({blockNumber:260n,blockHash:hash(260),guardBlockNumber:null,guardBlockHash:null});

    await identityStore.put(await buildPonsTokenIdentityReceipt({
      launch:{launchId:target.launchId,token:target.token},observedBlock:230n,observedBlockHash:hash(230),
      name:'Future Target Label',symbol:'FUTURE',decimals:18
    }));

    const capability=await buildPonsCurveOutcomeCapabilityReceipt({
      launch:{launchId:target.launchId,token:target.token,curve:target.pool},
      observedBlock:240n,observedBlockHash:hash(240),observedTimestampMs:11_000_000,
      pairToken:NATIVE_QUOTE,quoteDecimals:18,totalSupply:10n**18n,graduated:false,
      quoteReserve:3n*10n**18n,tokenReserve:10n**18n
    });
    await outcomeStore.put(await buildPonsOutcomeObservationReceipt({
      launch:{launchId:target.launchId,token:target.token,curve:target.pool},
      horizonMs:300_000,targetTimestampMs:10_300_000,capability
    }));

    const points=new Map<bigint,{blockNumber:bigint;blockHash:Hex;timestampMs:number}>([
      [100n,{blockNumber:100n,blockHash:hash(100),timestampMs:1_000_000}],
      [200n,{blockNumber:200n,blockHash:hash(200),timestampMs:10_000_000}],
      [210n,{blockNumber:210n,blockHash:hash(210),timestampMs:10_500_000}],
      [230n,{blockNumber:230n,blockHash:hash(230),timestampMs:10_800_000}],
      [240n,{blockNumber:240n,blockHash:hash(240),timestampMs:11_000_000}],
      [250n,{blockNumber:250n,blockHash:hash(250),timestampMs:12_000_000}],
      [260n,{blockNumber:260n,blockHash:hash(260),timestampMs:13_000_000}]
    ]);
    const blockSource={async getBlockPoint(blockNumber:bigint){
      const value=points.get(blockNumber);
      if(!value) throw new Error('POINT_MISSING:'+blockNumber.toString());
      return value;
    }};

    const readOnly=new StrictReadOnlyDb(db);
    const at210=await readPonsReplaySnapshot(readOnly,blockSource,{targetLaunchId:target.launchId,asOfBlock:210n});
    assert.equal(readOnly.writeAttempts,0);
    assert.equal(at210.targetLaunchKnown,true);
    assert.equal(at210.previousLaunches.length,1);
    assert.equal(at210.targetLaunch?.tokenIdentity,null);
    assert.equal(at210.targetLaunch?.observations[0]?.state,'PENDING');
    assert.equal(at210.targetLaunch?.observations[0]?.observationId,null);
    assert.equal(at210.targetLaunch?.provenance.state,'OBSERVED');
    assert.equal(at210.previousLaunches[0]?.provenance.state,'OBSERVED');

    const at250=await readPonsReplaySnapshot(readOnly,blockSource,{targetLaunchId:target.launchId,asOfBlock:250n});
    assert.equal(readOnly.writeAttempts,0);
    assert.equal(at250.targetLaunch?.tokenIdentity?.symbol,'FUTURE');
    assert.equal(at250.targetLaunch?.observations[0]?.state,'COMPLETE');
    assert.equal(at250.targetLaunch?.observations[0]?.observedBlock,'240');
  } finally {
    store.close();
    db.close();
  }
});

test('read model hides a launch that exists in D1 but is after the requested block',async()=>{
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const future=launch('c'.repeat(64),200,5,6);
  try {
    await store.putLaunch(future);
    await store.commitCheckpoint({blockNumber:260n,blockHash:hash(260),guardBlockNumber:null,guardBlockHash:null});
    const readOnly=new StrictReadOnlyDb(db);
    const snapshot=await readPonsReplaySnapshot(readOnly,{
      async getBlockPoint(blockNumber:bigint){
        if(blockNumber!==150n) throw new Error('FUTURE_BLOCK_READ_LEAK:'+blockNumber.toString());
        return {blockNumber,blockHash:hash(150),timestampMs:5_000_000};
      }
    },{targetLaunchId:future.launchId,asOfBlock:150n});
    assert.equal(snapshot.targetLaunchKnown,false);
    assert.equal(snapshot.targetLaunch,null);
    assert.equal(readOnly.writeAttempts,0);
  } finally {
    store.close();db.close();
  }
});


test('read model fails closed on canonical launch-block hash drift',async()=>{
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const target=launch('d'.repeat(64),200,7,8);
  try {
    await store.putLaunch(target);
    await store.commitCheckpoint({blockNumber:260n,blockHash:hash(260),guardBlockNumber:null,guardBlockHash:null});
    const readOnly=new StrictReadOnlyDb(db);
    await assert.rejects(
      readPonsReplaySnapshot(readOnly,{
        async getBlockPoint(blockNumber:bigint){
          if(blockNumber===210n) return {blockNumber,blockHash:hash(210),timestampMs:10_500_000};
          if(blockNumber===200n) return {blockNumber,blockHash:hash(999),timestampMs:10_000_000};
          throw new Error('POINT_MISSING:'+blockNumber.toString());
        }
      },{targetLaunchId:target.launchId,asOfBlock:210n}),
      /PONS_REPLAY_LAUNCH_REORG/
    );
    assert.equal(readOnly.writeAttempts,0);
  } finally {
    store.close();db.close();
  }
});
