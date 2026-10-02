import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import { runCloudflarePonsFundingCycle } from '../src/cloudflare/syncQueue.js';
import type {
  PonsCanonicalTransaction,
  PonsExternalNativeInboundCandidate,
  PonsFundingBlockPoint,
  PonsFundingSource
} from '../src/pons/fundingProvenance.js';
import { D1CompatDatabase } from './support/d1Compat.js';

function addr(n:number):Hex {
  return `0x${n.toString(16).padStart(40,'0')}` as Hex;
}
function hash(n:number):Hex {
  return `0x${n.toString(16).padStart(64,'0')}` as Hex;
}
function launch(input:{id:string;block:number;token:number;pool:number;deployer:number}):LaunchObserved {
  return {
    launchId:input.id.repeat(64),
    eventId:input.id.repeat(64),
    chainId:4663,
    blockNumber:BigInt(input.block),
    blockHash:hash(input.block),
    observedAtMs:999_000_000,
    source:'PONS_V2',
    launcher:addr(999),
    txHash:hash(input.block+10_000),
    logIndex:0,
    token:addr(input.token),
    creator:addr(input.deployer),
    pool:addr(input.pool),
    name:'',
    symbol:'',
    imageUri:'',
    website:'',
    twitter:'',
    telegram:''
  };
}

async function putHealthyRuntime(db:D1CompatDatabase,now:number):Promise<void> {
  await new D1RuntimeStateStore(db,4663).put({
    sourceVerified:true,
    liveCaughtUp:true,
    headBlock:120n,
    targetBlock:120n,
    observationReady:true,
    historyBackfillComplete:false,
    historyBackfillTargetBlock:null,
    lastSyncError:null,
    lastHistoryError:null,
    lastObservationError:null,
    updatedAtMs:now
  });
}

function sourceFor(input:Map<string,{source:Hex;transferBlock:number;valueWei:bigint}|null>):PonsFundingSource {
  return {
    async assertAuthority() {},
    async getBlockPoint(blockNumber:bigint):Promise<PonsFundingBlockPoint> {
      return {
        blockNumber,
        blockHash:hash(Number(blockNumber)),
        timestampMs:Number(blockNumber)*1000
      };
    },
    async findLatestExternalNativeInbound(
      deployer:Hex,
      _throughBlockInclusive:bigint
    ):Promise<PonsExternalNativeInboundCandidate|null> {
      const item=input.get(deployer);
      if (item===undefined) throw new Error('FIXTURE_DEPLOYER_UNKNOWN');
      if (item===null) return null;
      return {
        from:item.source,
        to:deployer,
        txHash:hash(item.transferBlock+50_000),
        blockNumber:BigInt(item.transferBlock),
        valueWei:item.valueWei
      };
    },
    async getTransaction(txHash:Hex):Promise<PonsCanonicalTransaction> {
      for (const [deployer,item] of input) {
        if (!item) continue;
        const expected=hash(item.transferBlock+50_000);
        if (expected===txHash) {
          return {
            hash:expected,
            from:item.source,
            to:deployer as Hex,
            valueWei:item.valueWei,
            blockNumber:BigInt(item.transferBlock)
          };
        }
      }
      throw new Error('FIXTURE_TX_UNKNOWN');
    }
  };
}

test('disabled funding runtime never touches funding schema', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  await db.exec('DROP TABLE pons_funding_receipts; DROP TABLE pons_funding_scan_state;');
  try {
    const result=await runCloudflarePonsFundingCycle(
      {DB:db,BINRAT_PONS_FUNDING_ENABLED:'false'},
      {kind:'PONS_FUNDING_CYCLE',cycleId:'disabled',enqueuedAtMs:1},
      {now:()=>1}
    );
    assert.deepEqual(result,{
      status:'SUCCESS',attempted:0,inserted:0,duplicates:0,noMatch:0,remaining:0
    });
  } finally {
    db.close();
  }
});

test('funding runtime obeys one-launch cycle bound and preserves launch authority', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const older=launch({id:'1',block:100,token:1,pool:2,deployer:10});
  const newer=launch({id:'2',block:110,token:3,pool:4,deployer:11});
  try {
    await store.putLaunch(older);
    await store.putLaunch(newer);
    await store.commitCheckpoint({
      blockNumber:120n,blockHash:hash(120),guardBlockNumber:null,guardBlockHash:null
    });
    await putHealthyRuntime(db,1);
    const before=await db.prepare('SELECT launch_id,authority_json FROM launches ORDER BY launch_id')
      .all<{launch_id:string;authority_json:string}>();

    const funding=new Map<string,{source:Hex;transferBlock:number;valueWei:bigint}|null>([
      [older.creator,{source:addr(90),transferBlock:90,valueWei:1000n}],
      [newer.creator,{source:addr(91),transferBlock:105,valueWei:2000n}]
    ]);
    const env={
      DB:db,
      BINRAT_PONS_FUNDING_ENABLED:'true',
      BINRAT_PONS_FUNDING_MAX_PER_CYCLE:'1'
    };

    const first=await runCloudflarePonsFundingCycle(
      env,
      {kind:'PONS_FUNDING_CYCLE',cycleId:'one',enqueuedAtMs:1},
      {now:()=>1,ponsFundingSource:sourceFor(funding)}
    );
    assert.equal(first.status,'SUCCESS');
    if(first.status!=='SUCCESS') assert.fail('expected success');
    assert.deepEqual(
      {attempted:first.attempted,inserted:first.inserted,noMatch:first.noMatch,remaining:first.remaining},
      {attempted:1,inserted:1,noMatch:0,remaining:1}
    );

    const countOne=await db.prepare('SELECT COUNT(*) AS n FROM pons_funding_receipts')
      .first<{n:number}>();
    assert.equal(Number(countOne?.n),1);

    const second=await runCloudflarePonsFundingCycle(
      env,
      {kind:'PONS_FUNDING_CYCLE',cycleId:'two',enqueuedAtMs:2},
      {now:()=>2,ponsFundingSource:sourceFor(funding)}
    );
    assert.equal(second.status,'SUCCESS');
    if(second.status!=='SUCCESS') assert.fail('expected success');
    assert.equal(second.inserted,1);
    assert.equal(second.remaining,0);

    const after=await db.prepare('SELECT launch_id,authority_json FROM launches ORDER BY launch_id')
      .all<{launch_id:string;authority_json:string}>();
    assert.deepEqual(after.results,before.results);
  } finally {
    store.close();
    db.close();
  }
});

test('no-match creates private scan state but never a funding evidence receipt', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const value=launch({id:'3',block:100,token:5,pool:6,deployer:12});
  try {
    await store.putLaunch(value);
    await store.commitCheckpoint({
      blockNumber:120n,blockHash:hash(120),guardBlockNumber:null,guardBlockHash:null
    });
    await putHealthyRuntime(db,123);

    const result=await runCloudflarePonsFundingCycle(
      {
        DB:db,
        BINRAT_PONS_FUNDING_ENABLED:'true',
        BINRAT_PONS_FUNDING_MAX_PER_CYCLE:'1'
      },
      {kind:'PONS_FUNDING_CYCLE',cycleId:'no-match',enqueuedAtMs:1},
      {now:()=>123,ponsFundingSource:sourceFor(new Map([[value.creator,null]]))}
    );
    assert.equal(result.status,'SUCCESS');
    if(result.status!=='SUCCESS') assert.fail('expected success');
    assert.deepEqual(
      {attempted:result.attempted,inserted:result.inserted,noMatch:result.noMatch,remaining:result.remaining},
      {attempted:1,inserted:0,noMatch:1,remaining:0}
    );

    const receipts=await db.prepare('SELECT COUNT(*) AS n FROM pons_funding_receipts')
      .first<{n:number}>();
    assert.equal(Number(receipts?.n),0);
    const scan=await db.prepare(
      'SELECT status,checked_at_ms FROM pons_funding_scan_state WHERE launch_id=?'
    ).bind(value.launchId).first<{status:string;checked_at_ms:number}>();
    assert.deepEqual(scan,{status:'NO_MATCH',checked_at_ms:123});
  } finally {
    store.close();
    db.close();
  }
});

test('funding runtime performs zero provider work when current Pons runtime is not authoritative', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  let providerCalls=0;
  const source:PonsFundingSource={
    async assertAuthority(){providerCalls+=1;},
    async getBlockPoint(){providerCalls+=1; throw new Error('SHOULD_NOT_RUN');},
    async findLatestExternalNativeInbound(){providerCalls+=1; throw new Error('SHOULD_NOT_RUN');},
    async getTransaction(){providerCalls+=1; throw new Error('SHOULD_NOT_RUN');}
  };
  try {
    await new D1RuntimeStateStore(db,4663).put({
      sourceVerified:true,
      liveCaughtUp:false,
      headBlock:120n,
      targetBlock:120n,
      observationReady:false,
      historyBackfillComplete:false,
      historyBackfillTargetBlock:null,
      lastSyncError:'PONS_TEST_UNHEALTHY',
      lastHistoryError:null,
      lastObservationError:null,
      updatedAtMs:1
    });
    const result=await runCloudflarePonsFundingCycle(
      {DB:db,BINRAT_PONS_FUNDING_ENABLED:'true'},
      {kind:'PONS_FUNDING_CYCLE',cycleId:'unhealthy',enqueuedAtMs:1},
      {now:()=>1,ponsFundingSource:source}
    );
    assert.deepEqual(result,{
      status:'SUCCESS',attempted:0,inserted:0,duplicates:0,noMatch:0,remaining:0
    });
    assert.equal(providerCalls,0);
  } finally {
    db.close();
  }
});

test('enabled funding runtime requires archive Alchemy rail without injected source', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  try {
    await putHealthyRuntime(db,1);
    const result=await runCloudflarePonsFundingCycle(
      {DB:db,BINRAT_PONS_FUNDING_ENABLED:'true'},
      {kind:'PONS_FUNDING_CYCLE',cycleId:'archive-required',enqueuedAtMs:1},
      {now:()=>1}
    );
    assert.equal(result.status,'RETRY');
    if(result.status!=='RETRY') assert.fail('expected retry');
    assert.match(result.code,/MISSING_CONFIG|PONS_/);
  } finally {
    db.close();
  }
});

test('funding migration is additive and idempotent against a pre-funding schema', async () => {
  const db=new D1CompatDatabase();
  try {
    await db.exec('CREATE TABLE launches (launch_id TEXT PRIMARY KEY);');
    const migration=readFileSync(
      new URL('../cloudflare/migrations/20261002_pons_funding_provenance_v1.sql',import.meta.url),
      'utf8'
    );
    await db.exec(migration);
    await db.exec(migration);
    const receiptTable=await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='pons_funding_receipts'"
    ).first<{name:string}>();
    const scanTable=await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='pons_funding_scan_state'"
    ).first<{name:string}>();
    const sourceIndex=await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_pons_funding_source'"
    ).first<{name:string}>();
    assert.equal(receiptTable?.name,'pons_funding_receipts');
    assert.equal(scanTable?.name,'pons_funding_scan_state');
    assert.equal(sourceIndex?.name,'idx_pons_funding_source');
  } finally {
    db.close();
  }
});
