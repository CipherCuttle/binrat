import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/cloudflare/worker.js';
import { handleSyncQueueBatch } from '../src/cloudflare/syncQueue.js';
import { D1CompatDatabase } from './support/d1Compat.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { readPublicSnapshot } from '../src/cloudflare/publicSnapshot.js';
import { PONS_V2_START_BLOCK } from '../src/pons/chain.js';
const noDb = () => ({
 prepare(){throw new Error('UNEXPECTED_DATABASE_IO');},
 async batch(){throw new Error('UNEXPECTED_DATABASE_IO');},
 async exec(){throw new Error('UNEXPECTED_DATABASE_IO');}
});

test('read-only release denies expensive/privileged routes before any IO',async()=>{
 const db=noDb();
 for(const path of ['/api/feed','/api/unknown','/api/creator/0x'+'a'.repeat(40),'/api/bag/'+'a'.repeat(64)+'/replay','/__candidate/pons-bootstrap','/telegram/webhook','/api/miniapp/bootstrap']) {
  for(const method of ['GET','POST','HEAD','PUT','DELETE','OPTIONS']) {
   const response=await worker.fetch(new Request('https://local.invalid'+path,{method}),{DB:db,BINRAT_PONS_READ_ONLY:'true'});
   assert.equal(response.status,method!=='GET'?405:path==='/api/feed'?410:404);
  }
 }
});

test('read-only cron enqueues only one Pons poll without touching persistent state',async()=>{
 const messages:unknown[]=[];
 await worker.scheduled({}, {DB:noDb(),BINRAT_PONS_READ_ONLY:'true',SYNC_QUEUE:{send:async(m)=>{messages.push(m);}}});
 assert.equal(messages.length,1);assert.equal((messages[0] as {kind:string}).kind,'PONS_SYNC_CYCLE');
});

test('queued non-Pons polls are acknowledged without consuming stored Watch/outbox state or RPC',async()=>{
 let acknowledged=0;
 const kinds=['SYNC_CYCLE','OBSERVATION_CYCLE','PONS_OUTCOME_CYCLE','PONS_TOKEN_IDENTITY_CYCLE','PONS_FUNDING_CYCLE','RAT_WATCH_CYCLE','RAT_RADAR_CYCLE'];
 await handleSyncQueueBatch({messages:kinds.map(kind=>({body:{kind,cycleId:'local-'+kind,enqueuedAtMs:Date.now()},ack(){acknowledged++;},retry(){throw new Error('UNEXPECTED_RETRY');}}))},
  {DB:noDb(),BINRAT_PONS_READ_ONLY:'true',TELEGRAM_BOT_TOKEN:'LOCAL_UNUSED',BINRAT_AUTONOMOUS_RAT_ENABLED:'true'},
  {now:Date.now,externalFetch:async()=>{throw new Error('UNEXPECTED_EXTERNAL_IO');}});
 assert.equal(acknowledged,kinds.length);
});

test('bounded status and missing/invalid Case behavior remain available in read-only release',async()=>{
 const db=new D1CompatDatabase();try{
  await db.exec(D1_SCHEMA_SQL);const env={DB:db,BINRAT_PONS_READ_ONLY:'true'};
  const status=await worker.fetch(new Request('https://local.invalid/api/status'),env);assert.equal(status.status,200);assert.equal((await status.json() as {state:string}).state,'NO_VERIFIED_SNAPSHOT');
  assert.equal((await worker.fetch(new Request('https://local.invalid/api/launches/latest'),env)).status,503);
  assert.equal((await worker.fetch(new Request('https://local.invalid/api/bag/'+'a'.repeat(64)),env)).status,404);
 }finally{db.close();}
});

for(const backlog of [100n,20000n])test(`read-only queue keeps Pons advancement and bounded continuation (${backlog} blocks)`,async()=>{
 const db=new D1CompatDatabase();try{
  await db.exec(D1_SCHEMA_SQL);const store=new D1Store(db,4663);const hash=(n:bigint)=>`0x${n.toString(16).padStart(64,'0')}` as `0x${string}`;
  const checkpoint=PONS_V2_START_BLOCK+1000n;await store.commitCheckpoint({blockNumber:checkpoint,blockHash:hash(checkpoint),guardBlockNumber:null,guardBlockHash:null});
  const queued:Array<{kind:string}>=[];let acknowledged=0;const now=Date.now();
  await handleSyncQueueBatch({messages:[{body:{kind:'PONS_SYNC_CYCLE',cycleId:'local-positive-'+backlog,enqueuedAtMs:now},ack(){acknowledged++;},retry(){throw new Error('UNEXPECTED_RETRY');}}]},
   {DB:db,BINRAT_PONS_READ_ONLY:'true',BINRAT_PONS_OUTCOME_ENABLED:'true',BINRAT_PONS_TOKEN_IDENTITY_ENABLED:'true',BINRAT_PONS_FUNDING_ENABLED:'true',SYNC_QUEUE:{send:async m=>{queued.push(m);}}},
   {now:()=>now,ponsLaunchSource:{getHeadBlockNumber:async()=>checkpoint+backlog+2n,getBlockHash:async n=>hash(n),assertAuthority:async()=>{},catchUp:async()=>[]},externalFetch:async()=>{throw new Error('UNEXPECTED_EXTERNAL_IO');}});
  assert.equal(acknowledged,1);assert.ok((await store.getCheckpoint())!.blockNumber>checkpoint);
  if(backlog===100n){assert.equal((await readPublicSnapshot(db))?.checkpointBlock,(checkpoint+backlog).toString());assert.deepEqual(queued,[]);}
  else {assert.equal((await store.getCheckpoint())!.blockNumber,checkpoint+16384n);assert.equal(queued.length,1);assert.equal(queued[0]!.kind,'PONS_SYNC_CYCLE');}
 }finally{db.close();}
});
