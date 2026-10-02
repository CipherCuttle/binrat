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
  PonsFundingLaunch,
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

async function putHealthyRuntime(db:D1CompatDatabase,nowMs:number):Promise<void> {
  await new D1RuntimeStateStore(db,4663).put({
    sourceVerified:true,
    liveCaughtUp:true,
    headBlock:120n,
    targetBlock:120n,
    observationReady:false,
    historyBackfillComplete:false,
    historyBackfillTargetBlock:null,
    lastSyncError:null,
    lastHistoryError:null,
    lastObservationError:null,
    updatedAtMs:nowMs
  });
}

function sourceFor(input:{
  launches:Map<string,{source:Hex;transferBlock:number;valueWei:bigint}|null>;
  failDeployers?:Set<string>;
}):PonsFundingSource {
  const txs=new Map<string,PonsCanonicalTransaction>();
  return {
    async assertAuthority() {},
    async getBlockPoint(blockNumber) {
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
      if (input.failDeployers?.has(deployer)) throw new Error('FIXTURE_FUNDING_LOOKUP_FAILED');
      const hit=input.launches.get(deployer);
      if (hit===undefined || hit===null) return null;
      const txHash=hash(50_000+hit.transferBlock);
      const candidate={
        from:hit.source,
        to:deployer,
        txHash,
        blockNumber:BigInt(hit.transferBlock),
        valueWei:hit.valueWei
      };
      txs.set(txHash,{
        hash:txHash,
        from:hit.source,
        to:deployer,
        valueWei:hit.valueWei,
        blockNumber:BigInt(hit.transferBlock)
      });
      return candidate;
    },
    async getTransaction(txHash) {
      const tx=txs.get(txHash);
      if (!tx) throw new Error('FIXTURE_TX_MISSING');
      return tx;
    }
  };
}

test('disabled funding runtime coexists when funding schema is absent', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  await db.exec('DROP TABLE pons_funding_scan_state; DROP TABLE pons_funding_receipts;');
  try {
    const result=await runCloudflarePonsFundingCycle(
      {DB:db,BINRAT_PONS_FUNDING_ENABLED:'false'},
      {kind:'PONS_FUNDING_CYCLE',cycleId:'disabled',enqueuedAtMs:1},
      {now:()=>1}
    );
    assert.deepEqual(result,{
      status:'SUCCESS',attempted:0,inserted:0,duplicates:0,noInbound:0,failed:0,remaining:0
    });
  } finally {
    db.close();
  }
});

test('funding runtime is one-per-cycle, preserves launch authority and keeps NONE private', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const first=launch({id:'1',block:100,token:1,pool:2,deployer:41});
  const second=launch({id:'2',block:110,token:3,pool:4,deployer:42});
  try {
    await store.putLaunch(first);
    await store.putLaunch(second);
    await store.commitCheckpoint({blockNumber:120n,blockHash:hash(120),guardBlockNumber:null,guardBlockHash:null});
    await putHealthyRuntime(db,1);
    const before=await db.prepare('SELECT launch_id,authority_json FROM launches ORDER BY launch_id')
      .all<{launch_id:string;authority_json:string}>();

    const source=sourceFor({launches:new Map([
      [second.creator,{source:addr(90),transferBlock:105,valueWei:2_000n}],
      [first.creator,null]
    ])});
    const env={
      DB:db,
      BINRAT_PONS_FUNDING_ENABLED:'true',
      BINRAT_PONS_FUNDING_MAX_PER_CYCLE:'1'
    };

    const one=await runCloudflarePonsFundingCycle(
      env,
      {kind:'PONS_FUNDING_CYCLE',cycleId:'one',enqueuedAtMs:1},
      {now:()=>1,ponsFundingSource:source}
    );
    assert.equal(one.status,'SUCCESS');
    if(one.status!=='SUCCESS') assert.fail('expected success');
    assert.deepEqual(
      {attempted:one.attempted,inserted:one.inserted,noInbound:one.noInbound},
      {attempted:1,inserted:1,noInbound:0}
    );

    const two=await runCloudflarePonsFundingCycle(
      env,
      {kind:'PONS_FUNDING_CYCLE',cycleId:'two',enqueuedAtMs:2},
      {now:()=>2,ponsFundingSource:source}
    );
    assert.equal(two.status,'SUCCESS');
    if(two.status!=='SUCCESS') assert.fail('expected success');
    assert.deepEqual(
      {attempted:two.attempted,inserted:two.inserted,noInbound:two.noInbound},
      {attempted:1,inserted:0,noInbound:1}
    );

    const receipts=await db.prepare(
      'SELECT launch_id,source_address,value_wei FROM pons_funding_receipts ORDER BY launch_id'
    ).all<{launch_id:string;source_address:string;value_wei:string}>();
    assert.deepEqual(receipts.results,[{
      launch_id:second.launchId,
      source_address:addr(90),
      value_wei:'2000'
    }]);

    const scans=await db.prepare(
      'SELECT launch_id,state FROM pons_funding_scan_state ORDER BY launch_id'
    ).all<{launch_id:string;state:string}>();
    assert.deepEqual(scans.results,[
      {launch_id:first.launchId,state:'NONE'},
      {launch_id:second.launchId,state:'FOUND'}
    ]);

    const after=await db.prepare('SELECT launch_id,authority_json FROM launches ORDER BY launch_id')
      .all<{launch_id:string;authority_json:string}>();
    assert.deepEqual(after.results,before.results);
  } finally {
    store.close();
    db.close();
  }
});

test('failed newest funding lookup backs off so it cannot starve the next launch', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const older=launch({id:'3',block:100,token:5,pool:6,deployer:51});
  const newer=launch({id:'4',block:110,token:7,pool:8,deployer:52});
  try {
    await store.putLaunch(older);
    await store.putLaunch(newer);
    await store.commitCheckpoint({blockNumber:120n,blockHash:hash(120),guardBlockNumber:null,guardBlockHash:null});
    await putHealthyRuntime(db,10);
    const source=sourceFor({
      launches:new Map([[older.creator,{source:addr(91),transferBlock:95,valueWei:3_000n}]]),
      failDeployers:new Set([newer.creator])
    });
    const env={
      DB:db,
      BINRAT_PONS_FUNDING_ENABLED:'true',
      BINRAT_PONS_FUNDING_MAX_PER_CYCLE:'1'
    };

    const failed=await runCloudflarePonsFundingCycle(
      env,
      {kind:'PONS_FUNDING_CYCLE',cycleId:'fail-newest',enqueuedAtMs:10},
      {now:()=>10,ponsFundingSource:source}
    );
    assert.equal(failed.status,'SUCCESS');
    if(failed.status!=='SUCCESS') assert.fail('expected success');
    assert.equal(failed.failed,1);

    const next=await runCloudflarePonsFundingCycle(
      env,
      {kind:'PONS_FUNDING_CYCLE',cycleId:'next',enqueuedAtMs:11},
      {now:()=>11,ponsFundingSource:source}
    );
    assert.equal(next.status,'SUCCESS');
    if(next.status!=='SUCCESS') assert.fail('expected success');
    assert.equal(next.inserted,1);

    const failedState=await db.prepare(
      'SELECT state,failure_count,retry_after_ms,last_error FROM pons_funding_scan_state WHERE launch_id=?'
    ).bind(newer.launchId).first<{
      state:string;failure_count:number;retry_after_ms:number;last_error:string
    }>();
    assert.equal(failedState?.state,'FAILED');
    assert.equal(failedState?.failure_count,1);
    assert.ok(Number(failedState?.retry_after_ms)>11);
    assert.equal(failedState?.last_error,'FIXTURE_FUNDING_LOOKUP_FAILED');
  } finally {
    store.close();
    db.close();
  }
});

test('enabled funding runtime requires the archive rail when no injected source exists', async () => {
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

test('funding migration is additive and idempotent', async () => {
  const db=new D1CompatDatabase();
  try {
    await db.exec('CREATE TABLE launches (launch_id TEXT PRIMARY KEY);');
    const migration=readFileSync(
      new URL('../cloudflare/migrations/20261002_pons_funding_provenance_v1.sql',import.meta.url),
      'utf8'
    );
    await db.exec(migration);
    await db.exec(migration);
    const receipt=await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='pons_funding_receipts'"
    ).first<{name:string}>();
    const scan=await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='pons_funding_scan_state'"
    ).first<{name:string}>();
    assert.equal(receipt?.name,'pons_funding_receipts');
    assert.equal(scan?.name,'pons_funding_scan_state');
  } finally {
    db.close();
  }
});
