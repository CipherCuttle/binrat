import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { buildPonsCurveOutcomeCapabilityReceipt, NATIVE_QUOTE } from '../src/pons/outcomeCapability.js';
import { buildPonsOutcomeObservationReceipt } from '../src/pons/outcomeReceipts.js';
import { buildPonsTokenIdentityReceipt } from '../src/pons/tokenIdentity.js';
import { buildPonsPrelaunchNativeInboundReceipt } from '../src/pons/fundingProvenance.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1PonsOutcomeObservationStore } from '../src/cloudflare/ponsOutcomeStore.js';
import { D1PonsTokenIdentityStore } from '../src/cloudflare/ponsTokenIdentityStore.js';
import { D1PonsFundingStore } from '../src/cloudflare/ponsFundingStore.js';
import { readBinratPonsCase } from '../src/cloudflare/ponsCaseReadModel.js';
import type { D1DatabaseLike, D1PreparedStatementLike, D1ResultLike } from '../src/cloudflare/d1Types.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const DEPLOYER='0x0000000000000000000000000000000000000042' as Hex;
const OTHER_DEPLOYER='0x0000000000000000000000000000000000000043' as Hex;
const FUNDER='0x0000000000000000000000000000000000000099' as Hex;
const addr=(n:number)=>('0x'+n.toString(16).padStart(40,'0')) as Hex;
const hash=(n:number)=>('0x'+n.toString(16).padStart(64,'0')) as Hex;

function launch(input:{
  id:string;
  block:number;
  token:number;
  curve:number;
  deployer?:Hex;
  name?:string;
  symbol?:string;
}):LaunchObserved {
  return {
    launchId:input.id,
    eventId:input.id,
    chainId:4663,
    blockNumber:BigInt(input.block),
    blockHash:hash(input.block),
    observedAtMs:input.block*1000,
    source:'PONS_V2',
    launcher:addr(999),
    txHash:hash(input.block+1000),
    logIndex:0,
    token:addr(input.token),
    creator:input.deployer??DEPLOYER,
    pool:addr(input.curve),
    name:input.name??'',
    symbol:input.symbol??'',
    imageUri:'',
    website:'',
    twitter:'',
    telegram:''
  };
}

class ReadOnlyStatement implements D1PreparedStatementLike {
  constructor(
    private readonly inner:D1PreparedStatementLike,
    private readonly deny:()=>never
  ) {}

  bind(...values:unknown[]):D1PreparedStatementLike {
    return new ReadOnlyStatement(this.inner.bind(...values),this.deny);
  }

  run<T=Record<string,unknown>>():Promise<D1ResultLike<T>> {
    return this.deny();
  }

  first<T=Record<string,unknown>>():Promise<T|null> {
    return this.inner.first<T>();
  }

  all<T=Record<string,unknown>>():Promise<D1ResultLike<T>> {
    return this.inner.all<T>();
  }
}

class StrictReadOnlyDb implements D1DatabaseLike {
  writeAttempts=0;

  constructor(private readonly inner:D1DatabaseLike) {}

  private readonly deny=():never=>{
    this.writeAttempts+=1;
    throw new Error('BINRAT_CASE_ADAPTER_WRITE_ATTEMPT');
  };

  prepare(sql:string):D1PreparedStatementLike {
    return new ReadOnlyStatement(this.inner.prepare(sql),this.deny);
  }

  batch(_statements:D1PreparedStatementLike[]):Promise<D1ResultLike[]> {
    return this.deny();
  }

  exec(_sql:string):Promise<unknown> {
    return this.deny();
  }
}

test('Case Adapter composes real Trash Trail, Replay, and funding recurrence rails read-only',async()=>{
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);

  const store=new D1Store(db,4663);
  const outcomeStore=new D1PonsOutcomeObservationStore(db);
  const identityStore=new D1PonsTokenIdentityStore(db);
  const fundingStore=new D1PonsFundingStore(db);

  const prior=launch({
    id:'a'.repeat(64),
    block:100,
    token:1,
    curve:2,
    name:'Prior Scrap',
    symbol:'OLD'
  });
  const other=launch({
    id:'c'.repeat(64),
    block:180,
    token:5,
    curve:6,
    deployer:OTHER_DEPLOYER
  });
  const current=launch({
    id:'b'.repeat(64),
    block:200,
    token:3,
    curve:4,
    name:'Canonical Current',
    symbol:'CANON'
  });

  try {
    for(const value of [prior,other,current]) await store.putLaunch(value);
    await store.putProvenanceFact(await buildProvenanceFact(prior));
    await store.putProvenanceFact(await buildProvenanceFact(current));
    await store.commitCheckpoint({
      blockNumber:300n,
      blockHash:hash(300),
      guardBlockNumber:null,
      guardBlockHash:null
    });

    const priorCapability=await buildPonsCurveOutcomeCapabilityReceipt({
      launch:{launchId:prior.launchId,token:prior.token,curve:prior.pool},
      observedBlock:150n,
      observedBlockHash:hash(150),
      observedTimestampMs:1_400_000,
      pairToken:NATIVE_QUOTE,
      quoteDecimals:18,
      totalSupply:10n**18n,
      graduated:false,
      quoteReserve:2n*10n**18n,
      tokenReserve:10n**18n
    });
    await outcomeStore.put(await buildPonsOutcomeObservationReceipt({
      launch:{launchId:prior.launchId,token:prior.token,curve:prior.pool},
      horizonMs:300_000,
      targetTimestampMs:1_300_000,
      capability:priorCapability
    }));

    await identityStore.put(await buildPonsTokenIdentityReceipt({
      launch:{launchId:current.launchId,token:current.token},
      observedBlock:250n,
      observedBlockHash:hash(250),
      name:'Current Receipt',
      symbol:'CURR',
      decimals:18
    }));

    await fundingStore.put(await buildPonsPrelaunchNativeInboundReceipt({
      launch:{
        launchId:current.launchId,
        deployer:current.creator,
        blockNumber:current.blockNumber,
        blockHash:current.blockHash
      },
      sourceAddress:FUNDER,
      transferTxHash:hash(1900),
      transferBlock:190n,
      transferBlockHash:hash(190),
      transferTimestampMs:9_500_000,
      valueWei:3n*10n**15n
    }));
    await fundingStore.put(await buildPonsPrelaunchNativeInboundReceipt({
      launch:{
        launchId:other.launchId,
        deployer:other.creator,
        blockNumber:other.blockNumber,
        blockHash:other.blockHash
      },
      sourceAddress:FUNDER,
      transferTxHash:hash(1700),
      transferBlock:170n,
      transferBlockHash:hash(170),
      transferTimestampMs:8_500_000,
      valueWei:2n*10n**15n
    }));

    const points=new Map<bigint,{blockNumber:bigint;blockHash:Hex;timestampMs:number}>([
      [100n,{blockNumber:100n,blockHash:hash(100),timestampMs:1_000_000}],
      [150n,{blockNumber:150n,blockHash:hash(150),timestampMs:1_400_000}],
      [180n,{blockNumber:180n,blockHash:hash(180),timestampMs:8_000_000}],
      [200n,{blockNumber:200n,blockHash:hash(200),timestampMs:10_000_000}],
      [250n,{blockNumber:250n,blockHash:hash(250),timestampMs:11_000_000}],
      [300n,{blockNumber:300n,blockHash:hash(300),timestampMs:12_000_000}]
    ]);
    const calls=new Map<string,number>();
    const blockSource={
      async getBlockPoint(blockNumber:bigint){
        const key=blockNumber.toString();
        calls.set(key,(calls.get(key)??0)+1);
        const value=points.get(blockNumber);
        if(!value) throw new Error('POINT_MISSING:'+key);
        return value;
      }
    };

    const readOnly=new StrictReadOnlyDb(db);
    const model=await readBinratPonsCase(readOnly,blockSource,{
      currentLaunchId:current.launchId,
      asOfBlock:300n,
      maxPreviousLaunches:10,
      maxRelatedFundingLaunches:10
    });

    assert.equal(readOnly.writeAttempts,0);
    assert.equal(model.current.label,'$CURR');
    assert.equal(model.current.labelSource,'PERSISTED_TOKEN_IDENTITY');
    assert.equal(model.current.token,current.token);
    assert.equal(model.current.deployer,current.creator);

    assert.deepEqual(model.facts.map((item)=>item.kind),[
      'SAME_FUNDING_SOURCE',
      'PRIOR_LAUNCH_HISTORY',
      'OUTCOME_MEMORY',
      'PRELAUNCH_FUNDING_OBSERVED'
    ]);
    assert.deepEqual(model.handoffs.map((item)=>item.kind),[
      'TRASH_TRAIL',
      'REPLAY',
      'WATCH_DEPLOYER'
    ]);
    assert.equal(model.coverage.trashTrail,'AVAILABLE');
    assert.equal(model.coverage.replay,'AVAILABLE');
    assert.equal(model.coverage.funding,'POSITIVE_FACTS');

    assert.equal(calls.get('100'),1);
    assert.equal(calls.get('200'),1);
    assert.equal(calls.get('250'),1);
    assert.equal(calls.get('300'),1);
    assert.match(model.caseDigest,/^[0-9a-f]{64}$/);
  } finally {
    store.close();
    db.close();
  }
});

test('Case Adapter falls back to canonical launch label without inventing a token identity receipt',async()=>{
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const current=launch({
    id:'d'.repeat(64),
    block:200,
    token:7,
    curve:8,
    name:'Canonical Only',
    symbol:'CANON'
  });

  try {
    await store.putLaunch(current);
    await store.putProvenanceFact(await buildProvenanceFact(current));
    await store.commitCheckpoint({
      blockNumber:220n,
      blockHash:hash(220),
      guardBlockNumber:null,
      guardBlockHash:null
    });

    const points=new Map<bigint,{blockNumber:bigint;blockHash:Hex;timestampMs:number}>([
      [200n,{blockNumber:200n,blockHash:hash(200),timestampMs:10_000_000}],
      [220n,{blockNumber:220n,blockHash:hash(220),timestampMs:10_100_000}]
    ]);
    const readOnly=new StrictReadOnlyDb(db);
    const model=await readBinratPonsCase(readOnly,{
      async getBlockPoint(blockNumber:bigint){
        const value=points.get(blockNumber);
        if(!value) throw new Error('POINT_MISSING:'+blockNumber.toString());
        return value;
      }
    },{
      currentLaunchId:current.launchId,
      asOfBlock:220n
    });

    assert.equal(readOnly.writeAttempts,0);
    assert.equal(model.current.label,'$CANON');
    assert.equal(model.current.labelSource,'CANONICAL_LAUNCH');
    assert.deepEqual(model.facts,[]);
    assert.deepEqual(model.handoffs,[{
      kind:'REPLAY',
      label:'REPLAY THIS MOMENT',
      available:true,
      targetLaunchId:current.launchId,
      targetAddress:null
    }]);
    assert.equal(model.coverage.funding,'NO_POSITIVE_FACT');
  } finally {
    store.close();
    db.close();
  }
});


test('Case Adapter treats an undeployed funding rail as NOT_PROVIDED rather than negative evidence',async()=>{
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const current=launch({
    id:'e'.repeat(64),
    block:200,
    token:9,
    curve:10,
    name:'No Funding Rail Yet',
    symbol:'NOFUND'
  });

  try {
    await store.putLaunch(current);
    await store.putProvenanceFact(await buildProvenanceFact(current));
    await store.commitCheckpoint({
      blockNumber:220n,
      blockHash:hash(220),
      guardBlockNumber:null,
      guardBlockHash:null
    });
    await db.exec('DROP TABLE pons_funding_receipts;');

    const points=new Map<bigint,{blockNumber:bigint;blockHash:Hex;timestampMs:number}>([
      [200n,{blockNumber:200n,blockHash:hash(200),timestampMs:10_000_000}],
      [220n,{blockNumber:220n,blockHash:hash(220),timestampMs:10_100_000}]
    ]);
    const readOnly=new StrictReadOnlyDb(db);
    const model=await readBinratPonsCase(readOnly,{
      async getBlockPoint(blockNumber:bigint){
        const value=points.get(blockNumber);
        if(!value) throw new Error('POINT_MISSING:'+blockNumber.toString());
        return value;
      }
    },{
      currentLaunchId:current.launchId,
      asOfBlock:220n
    });

    assert.equal(readOnly.writeAttempts,0);
    assert.equal(model.coverage.funding,'NOT_PROVIDED');
    assert.deepEqual(model.facts,[]);
    assert.doesNotMatch(JSON.stringify(model.facts),/NOT FUNDED|NO FUNDING|UNFUNDED/i);
  } finally {
    store.close();
    db.close();
  }
});
