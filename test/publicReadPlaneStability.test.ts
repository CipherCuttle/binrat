import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/cloudflare/worker.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { buildPublicSnapshot, publishPublicSnapshot, publicStatus, readPublicSnapshot } from '../src/cloudflare/publicSnapshot.js';
import { readCreatorSummary } from '../src/cloudflare/creatorSummaryReadModel.js';
import { latestPonsLaunchSnapshot } from '../src/autonomous/rats.js';
import type { D1DatabaseLike, D1PreparedStatementLike, D1ResultLike } from '../src/cloudflare/d1Types.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const NOW=Date.now();
const CHECKPOINT=200n;
const CREATOR='0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;
const hash=(value:number)=>`0x${value.toString(16).padStart(64,'0')}` as Hex;
const address=(value:number)=>`0x${value.toString(16).padStart(40,'0')}` as Hex;
const feedLaunch=(id:string)=>({launchId:id.repeat(64),token:address(7),symbol:'P',name:'Pons',blockNumber:'100',
  txHash:hash(8),deployer:CREATOR,priorLaunchCount:0,factId:`binrat-fact:4663:${id.repeat(64)}`,
  metadata:{imageUri:'',website:'',twitter:'',telegram:''}});

class CountingDb implements D1DatabaseLike {
  statements=0;
  executed:Array<{sql:string;params:unknown[]}> = [];
  failSnapshotWrite=false;
  constructor(readonly inner:D1CompatDatabase){}
  prepare(sql:string):D1PreparedStatementLike {
    const statement=this.inner.prepare(sql);
    const db=this;
    return wrap(statement,[]);
    function wrap(bound:D1PreparedStatementLike,params:unknown[]):D1PreparedStatementLike {
      return {
      bind(...values:unknown[]){return wrap(bound.bind(...values),values);},
      async first<T>(){db.statements++;db.executed.push({sql,params});return bound.first<T>();},
      async all<T>(){db.statements++;db.executed.push({sql,params});return bound.all<T>();},
      async run<T>(){
        db.statements++;
        db.executed.push({sql,params});
        if(db.failSnapshotWrite&&/INSERT INTO binrat_public_snapshots/.test(sql)) return {success:false} as D1ResultLike<T>;
        return bound.run<T>();
      }
      };
    }
  }
  async batch(statements:D1PreparedStatementLike[]){this.statements+=statements.length;return this.inner.batch(statements);}
  exec(sql:string){return this.inner.exec(sql);}
}

async function fixture(count=20) {
  const compat=new D1CompatDatabase();
  await compat.exec(D1_SCHEMA_SQL);
  const db=new CountingDb(compat);
  const store=new D1Store(db,4663);
  const runtime=new D1RuntimeStateStore(db,4663);
  await store.commitCheckpoint({blockNumber:CHECKPOINT,blockHash:hash(Number(CHECKPOINT)),guardBlockNumber:null,guardBlockHash:null});
  await runtime.put({sourceVerified:true,liveCaughtUp:true,headBlock:CHECKPOINT+2n,targetBlock:CHECKPOINT,
    observationReady:false,historyBackfillComplete:false,historyBackfillTargetBlock:null,lastSyncError:null,
    lastHistoryError:null,lastObservationError:null,updatedAtMs:NOW});
  const launches:LaunchObserved[]=[];
  for(let i=0;i<count;i++) {
    const block=100n+BigInt(i);
    const candidate:LaunchObserved={
      launchId:await deriveLaunchId({chainId:4663,launcher:address(10),txHash:hash(1000+i),token:address(2000+i),source:'PONS_V2'}),
      eventId:await deriveEventId({chainId:4663,launcher:address(10),txHash:hash(1000+i),logIndex:i,source:'PONS_V2'}),
      chainId:4663,blockNumber:block,blockHash:hash(Number(block)),observedAtMs:NOW-1000,source:'PONS_V2',
      launcher:address(10),txHash:hash(1000+i),logIndex:i,token:address(2000+i),creator:CREATOR,
      pool:address(3000+i),name:`Pons ${i}`,symbol:`P${i}`,imageUri:'',website:'',twitter:'',telegram:''
    };
    await store.putLaunch(candidate);
    await store.putProvenanceFact(await buildProvenanceFact(candidate));
    launches.push(candidate);
  }
  return {db,compat,store,runtime,launches};
}

async function seedPublished(f:Awaited<ReturnType<typeof fixture>>,block=CHECKPOINT) {
  const snapshot=await buildPublicSnapshot({schemaVersion:'binrat.latest-launches/0.1',chainId:4663,
    sourceCheckpoint:block.toString(),checkpointBlockHash:hash(Number(block)),historyCoverage:'PARTIAL',launches:[]});
  await publishPublicSnapshot(f.db,snapshot,NOW);
  return snapshot;
}

test('status is a two-query heartbeat and distinguishes absent from stale and fresh publications',async()=>{
  const f=await fixture(0);
  try {
    f.db.statements=0;
    let response=await worker.fetch(new Request('https://binrat.example/api/status'),{DB:f.db});
    let body=await response.json() as Record<string,unknown>;
    assert.equal(body.state,'NO_VERIFIED_SNAPSHOT');
    assert.equal(f.db.statements,2);
    await seedPublished(f);
    f.db.statements=0;
    response=await worker.fetch(new Request('https://binrat.example/api/status'),{DB:f.db});
    body=await response.json() as Record<string,unknown>;
    assert.equal(body.state,'FRESH_VERIFIED');
    assert.equal(f.db.statements,2);
    assert.match(response.headers.get('cache-control')??'',/public/);
    const notModified=await worker.fetch(new Request('https://binrat.example/api/status',{
      headers:{'if-none-match':response.headers.get('etag')!}
    }),{DB:f.db});
    assert.equal(notModified.status,304);
    await f.runtime.put({sourceVerified:false,liveCaughtUp:false,headBlock:CHECKPOINT+2n,targetBlock:CHECKPOINT,
      observationReady:false,historyBackfillComplete:false,historyBackfillTargetBlock:null,lastSyncError:'RPC_TIMEOUT',
      lastHistoryError:null,lastObservationError:null,updatedAtMs:NOW+1});
    response=await worker.fetch(new Request('https://binrat.example/api/status'),{DB:f.db});
    body=await response.json() as Record<string,unknown>;
    assert.equal(body.state,'STALE_VERIFIED');
    assert.equal(body.checkpointBlock,'200');
  } finally { f.compat.close(); }
});

test('same published feed hashes identically and changed feeds hash differently',async()=>{
  const base={schemaVersion:'binrat.latest-launches/0.1' as const,chainId:4663 as const,
    sourceCheckpoint:'200',checkpointBlockHash:hash(200),historyCoverage:'PARTIAL' as const,launches:[]};
  const a=await buildPublicSnapshot(base),b=await buildPublicSnapshot(base);
  const c=await buildPublicSnapshot({...base,launches:[feedLaunch('e')]});
  assert.equal(a.feedDigest,b.feedDigest);
  assert.notEqual(a.feedDigest,c.feedDigest);
});

test('latest feed and creator summary stay bounded at one and twenty rows with canonical Pons evidence',async()=>{
  for(const count of [1,20]) {
      const f=await fixture(count);
      try {
      const arcStore=new D1Store(f.db,5042);
      const arcLaunch:LaunchObserved={
        launchId:await deriveLaunchId({chainId:5042,launcher:address(90),txHash:hash(91),token:address(92),source:'ARCPAD'}),
        eventId:await deriveEventId({chainId:5042,launcher:address(90),txHash:hash(91),logIndex:0,source:'ARCPAD'}),
        chainId:5042,blockNumber:150n,blockHash:hash(150),observedAtMs:NOW,source:'ARCPAD',launcher:address(90),
        txHash:hash(91),logIndex:0,token:address(92),creator:CREATOR,pool:address(93),name:'Arc',symbol:'ARC',
        imageUri:'',website:'',twitter:'',telegram:''
      };
      await arcStore.putLaunch(arcLaunch);
      await arcStore.putProvenanceFact(await buildProvenanceFact(arcLaunch));
      f.db.statements=0;
      const snapshot=await latestPonsLaunchSnapshot(f.db,NOW,20);
      assert.equal(snapshot.launches.length,count);
      assert.equal(snapshot.launches.some((item)=>item.symbol==='ARC'),false);
      assert.equal(f.db.statements,2);
      const latestQuery=f.db.executed.find((entry)=>entry.sql.includes('SELECT l.launch_id,l.event_id'))!;
      const plan=(await f.compat.prepare(`EXPLAIN QUERY PLAN ${latestQuery.sql}`).bind(...latestQuery.params)
        .all<{detail:string}>()).results?.map((row)=>row.detail)??[];
      assert.ok(plan.some((line)=>line.includes('idx_launches_chain_source_block_numeric')));
      assert.ok(plan.some((line)=>line.includes('idx_launches_chain_source_creator_block_numeric')));
      assert.equal(plan.some((line)=>line.includes('TEMP B-TREE')),false);
      const published=await buildPublicSnapshot({schemaVersion:'binrat.latest-launches/0.1',chainId:4663,
        ...snapshot,historyCoverage:'PARTIAL'});
      await publishPublicSnapshot(f.db,published,NOW);
      f.db.statements=0;
      const summary=await readCreatorSummary(f.db,CREATOR);
      assert.equal((summary?.launches as unknown[]).length,Math.min(4,count));
      assert.equal(f.db.statements,2);
      const summaryQuery=f.db.executed.find((entry)=>entry.sql.includes('f.payload_json AS fact_payload_json'))!;
      const summaryPlan=(await f.compat.prepare(`EXPLAIN QUERY PLAN ${summaryQuery.sql}`).bind(...summaryQuery.params)
        .all<{detail:string}>()).results?.map((row)=>row.detail)??[];
      assert.ok(summaryPlan.some((line)=>line.includes('idx_launches_chain_source_creator_block_numeric')));
      assert.equal(summaryPlan.some((line)=>line.includes('TEMP B-TREE')),false);
      f.db.statements=0;
      const creatorResponse=await worker.fetch(new Request(`https://binrat.example/api/creator/${CREATOR}/summary`),{DB:f.db});
      assert.equal(creatorResponse.status,200);
      assert.match(creatorResponse.headers.get('cache-control')??'',/public/);
      assert.equal((await creatorResponse.json() as {launches:unknown[]}).launches.length,Math.min(4,count));
      assert.equal(f.db.statements,2);
      f.db.statements=0;
      const response=await worker.fetch(new Request('https://binrat.example/api/launches/latest'),{DB:f.db});
      assert.equal(response.status,200);
      assert.ok((await response.clone().arrayBuffer()).byteLength>0);
      assert.equal((await response.json() as {launches:unknown[]}).launches.length,count);
      assert.equal(f.db.statements,1);
      assert.match(response.headers.get('cache-control')??'',/public/);
      const conditional=await worker.fetch(new Request('https://binrat.example/api/launches/latest',{
        headers:{'if-none-match':response.headers.get('etag')!}
      }),{DB:f.db});
      assert.equal(conditional.status,304);
      assert.equal(conditional.headers.get('etag'),response.headers.get('etag'));
      if(count===20) {
        const timings:number[]=[];
        let bytes=0;
        for(let i=0;i<30;i++) {
          const start=performance.now();
          const measured=await worker.fetch(new Request('https://binrat.example/api/launches/latest'),{DB:f.db});
          const body=await measured.arrayBuffer();
          timings.push(performance.now()-start);
          bytes=body.byteLength;
        }
        timings.sort((a,b)=>a-b);
        console.log('PUBLIC_READ_LOCAL_SQLITE_20_ROWS',JSON.stringify({
          rows:count,responseBytes:bytes,p50Ms:Number(timings[14]!.toFixed(3)),p95Ms:Number(timings[28]!.toFixed(3)),
          statementsPerRequest:1
        }));
      }
    } finally { f.compat.close(); }
  }
});

test('canonical provenance mismatch and reorg checkpoint mismatch block publication and retain the old snapshot',async()=>{
  const f=await fixture(1);
  try {
    const initial=await latestPonsLaunchSnapshot(f.db,NOW,20);
    const published=await buildPublicSnapshot({schemaVersion:'binrat.latest-launches/0.1',chainId:4663,
      ...initial,historyCoverage:'PARTIAL'});
    await publishPublicSnapshot(f.db,published,NOW);
    const launchId=f.launches[0]!.launchId;
    await f.db.prepare("UPDATE provenance_facts SET payload_json='{}' WHERE launch_id=?").bind(launchId).run();
    await assert.rejects(latestPonsLaunchSnapshot(f.db,NOW,20),/LATEST_LAUNCHES_UNAVAILABLE/);
    await f.store.commitCheckpoint({blockNumber:CHECKPOINT+1n,blockHash:hash(Number(CHECKPOINT+1n)),
      guardBlockNumber:null,guardBlockHash:null});
    await assert.rejects(latestPonsLaunchSnapshot(f.db,NOW,20),/LATEST_LAUNCHES_UNAVAILABLE/);
    assert.equal((await readPublicSnapshot(f.db))?.feedDigest,published.feedDigest);
  } finally { f.compat.close(); }
});

test('failed publication leaves old verified snapshot intact and a sync failure labels it stale',async()=>{
  const f=await fixture(1);
  try {
    const previous=await seedPublished(f);
    const next=await buildPublicSnapshot({schemaVersion:'binrat.latest-launches/0.1',chainId:4663,
      sourceCheckpoint:'201',checkpointBlockHash:hash(201),historyCoverage:'PARTIAL',launches:[feedLaunch('f')]});
    f.db.failSnapshotWrite=true;
    await assert.rejects(publishPublicSnapshot(f.db,next,NOW+1),/PUBLIC_SNAPSHOT_PUBLICATION_FAILED/);
    f.db.failSnapshotWrite=false;
    assert.equal((await readPublicSnapshot(f.db))?.feedDigest,previous.feedDigest);
    await f.runtime.put({sourceVerified:false,liveCaughtUp:false,headBlock:202n,targetBlock:200n,
      observationReady:false,historyBackfillComplete:false,historyBackfillTargetBlock:null,lastSyncError:'RPC_429',
      lastHistoryError:null,lastObservationError:null,updatedAtMs:NOW+2});
    const status=await publicStatus(f.db,NOW+2,180_000);
    assert.equal(status.state,'STALE_VERIFIED');
    const latest=await readPublicSnapshot(f.db);
    assert.equal(latest?.feedDigest,previous.feedDigest);
  } finally { f.compat.close(); }
});

test('creator summary never returns more than four verified 4663 launches',async()=>{
  const f=await fixture(8);
  try {
    await seedPublished(f);
    f.db.statements=0;
    const summary=await readCreatorSummary(f.db,CREATOR);
    assert.equal((summary?.launches as unknown[]).length,4);
    assert.equal(f.db.statements,2);
    assert.equal((summary?.chainId),4663);
    assert.equal((summary?.coverage as {olderLaunchesOmitted:boolean}).olderLaunchesOmitted,true);
  } finally { f.compat.close(); }
});

test('private holder responses keep no-store and corrupted snapshots fail closed',async()=>{
  const f=await fixture(0);
  try {
    const privateResponse=await worker.fetch(new Request('https://binrat.example/api/holder/challenge',{
      method:'POST',headers:{'content-type':'application/json'},body:'{}'
    }),{DB:f.db});
    assert.equal(privateResponse.headers.get('cache-control'),'no-store');
    const snapshot=await seedPublished(f);
    await f.db.prepare('UPDATE binrat_public_snapshots SET feed_digest=? WHERE chain_id=4663').bind('0'.repeat(64)).run();
    await assert.rejects(readPublicSnapshot(f.db),/PUBLIC_SNAPSHOT_DIGEST_INVALID/);
    assert.notEqual(snapshot.feedDigest,'0'.repeat(64));
  } finally { f.compat.close(); }
});
