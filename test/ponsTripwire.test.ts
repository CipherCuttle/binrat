import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import type { WatchSource } from '../src/autonomous/source.js';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { PONS_V2_FACTORY } from '../src/pons/chain.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1CompatDatabase } from './support/d1Compat.js';
import { createPonsTripwireWatch, cancelPonsTripwireWatch, listPonsTripwireWatches,
  runPonsTripwireCycle, validatePonsTripwireEvidence, ponsTripwireTelegramTransport,
  PONS_TRIPWIRE_LIMITS } from '../src/cloudflare/ponsTripwire.js';
import { handleSyncQueueBatch, runCloudflarePonsTripwireCycle } from '../src/cloudflare/syncQueue.js';
import { capturedProduction, fixtureNow, fixtureSource, createPonsTripwireFixtureDatabase,
  seedProductionRow, publishFixture } from './support/ponsTripwireFixture.js';

const OWNER='telegram:42',CHAT=42;
const first=capturedProduction.launches[0]!,later=capturedProduction.launches[1]!;
const arming={ownerId:OWNER,chatId:CHAT,launchId:capturedProduction.openedCaseLaunchId,nowMs:fixtureNow};
const laterNow=fixtureNow+2_000;
const laterSource:WatchSource={...fixtureSource,async head(){return {chainId:4663,
  block:BigInt(later.block_number),hash:later.block_hash,timestampMs:laterNow-1_000};}};
async function arm(db:D1CompatDatabase){return createPonsTripwireWatch(db,fixtureSource,arming);}
async function mature(db:D1CompatDatabase){await seedProductionRow(db,later);
  await publishFixture(db,BigInt(later.block_number),later.block_hash,laterNow);}
async function states(db:D1CompatDatabase){return (await db.prepare('SELECT state,attempt_count,telegram_message_id FROM pons_tripwire_outbox ORDER BY created_at_ms,delivery_id').all()).results;}
const hash=(n:number)=>('0x'+n.toString(16).padStart(64,'0')) as Hex;
const address=(n:number)=>('0x'+n.toString(16).padStart(40,'0')) as Hex;
async function newLaunch(block:number,deployer=capturedProduction.deployer):Promise<LaunchObserved>{
  const base={chainId:4663,source:'PONS_V2' as const,launcher:PONS_V2_FACTORY,txHash:hash(block+100),token:address(block),logIndex:0};
  return {...base,launchId:await deriveLaunchId(base),eventId:await deriveEventId(base),blockNumber:BigInt(block),
    blockHash:hash(block),creator:deployer as Hex,pool:address(block+1),name:'',symbol:'',imageUri:'',website:'',twitter:'',telegram:'',observedAtMs:laterNow};
}
async function storeLaunch(db:D1CompatDatabase,launch:LaunchObserved){const store=new D1Store(db,4663);await store.putLaunch(launch);await store.putProvenanceFact(await buildProvenanceFact(launch));}

test('actual production exact identities/digests replay one later finding; persistence, queue dedup, mock Telegram and Case return',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'pons-tripwire-')),path=join(directory,'watch.sqlite');
  let db=await createPonsTripwireFixtureDatabase(path);
  try {
    const validated=await validatePonsTripwireEvidence(db,first.launch_id,BigInt(first.block_number));
    assert.equal(validated.fact.evidenceDigest,first.evidence_digest);assert.equal(validated.fact.kind,'PONS_REPORTED_DEPLOYER');
    const watch=await arm(db);assert.equal(watch.deployer,capturedProduction.deployer);assert.equal(watch.startBlock,first.block_number);
    assert.deepEqual(await runPonsTripwireCycle(db,fixtureSource,{now:()=>fixtureNow}),{examined:0,enqueued:0,sent:0});
    db.close();db=await createPonsTripwireFixtureDatabase(path);
    assert.equal((await listPonsTripwireWatches(db,OWNER))[0]!.generation,watch.generation);
    await mature(db);
    const requests:Array<{url:string;body:any}>=[];
    const mock:typeof fetch=async(url,init)=>{requests.push({url:String(url),body:JSON.parse(String(init?.body))});
      return new Response(JSON.stringify({ok:true,result:{message_id:81}}),{status:200});};
    let acknowledgements=0,retries=0;
    const message={body:{kind:'PONS_TRIPWIRE_CYCLE',cycleId:'same-queue-delivery',enqueuedAtMs:laterNow},ack(){acknowledgements++;},retry(){retries++;}};
    const env={DB:db,BINRAT_PONS_READ_ONLY:'true',BINRAT_PONS_TRIPWIRE_ENABLED:'true',
      BINRAT_PONS_TRIPWIRE_DELIVERY_ENABLED:'true',BINRAT_PONS_TRIPWIRE_ALLOWED_USER_ID:'42',TELEGRAM_BOT_TOKEN:'offline-mock-token'};
    const deps={now:()=>laterNow,ponsTripwireSource:laterSource,externalFetch:mock};
    await handleSyncQueueBatch({messages:[message,message]},env,deps);
    assert.equal(acknowledgements,2);assert.equal(retries,0);assert.equal(requests.length,1);
    assert.equal(requests[0]!.url,'https://api.telegram.org/botoffline-mock-token/sendMessage');
    assert.equal(requests[0]!.body.chat_id,CHAT);
    assert.equal(requests[0]!.body.reply_markup.inline_keyboard[0][0].url,`https://binrat.tech/bag/${later.launch_id}`);
    assert.ok(requests[0]!.body.text.includes(later.evidence_digest));assert.ok(requests[0]!.body.text.includes(capturedProduction.deployer));
    assert.deepEqual(await states(db),[{state:'SENT',attempt_count:1,telegram_message_id:81}]);
    assert.equal(await cancelPonsTripwireWatch(db,'telegram:43',watch.generation,laterNow),false);
    assert.equal(await cancelPonsTripwireWatch(db,OWNER,watch.generation,laterNow),true);
    assert.deepEqual(await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow,deliver:async()=>{throw new Error('CANCELLED_WATCH_MUST_NOT_DELIVER');}}),{examined:0,enqueued:0,sent:0});
    assert.deepEqual((await listPonsTripwireWatches(db,OWNER)).map(item=>item.state),['CANCELLED']);
  } finally {db.close();rmSync(directory,{recursive:true,force:true});}
});

test('explicit opt-in excludes history, index lag and event time before consent',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try{
    await seedProductionRow(db,later); // Already indexed later event but public index remains behind it.
    const headAhead:WatchSource={...laterSource,async point(block){const point=await fixtureSource.point(block);return {...point,timestampMs:fixtureNow-500};}};
    const watch=await createPonsTripwireWatch(db,headAhead,arming);
    assert.equal(watch.startBlock,later.block_number);
    await publishFixture(db,BigInt(later.block_number),later.block_hash,laterNow);
    assert.equal((await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow})).enqueued,0);
    await cancelPonsTripwireWatch(db,OWNER,watch.generation,laterNow);
    // Earlier latest-head fence plus a later indexed block with old source time still cannot alert.
    const reopened=await createPonsTripwireWatch(db,laterSource,{...arming,nowMs:laterNow});
    const future=await newLaunch(Number(later.block_number)+1);await storeLaunch(db,future);
    await publishFixture(db,future.blockNumber,future.blockHash,laterNow);
    const source:WatchSource={async head(){return {chainId:4663,block:future.blockNumber,hash:future.blockHash,timestampMs:laterNow};},
      async point(block){if(block===future.blockNumber)return {hash:future.blockHash,timestampMs:fixtureNow};return laterSource.point(block);}};
    assert.equal((await runPonsTripwireCycle(db,source,{now:()=>laterNow})).enqueued,0);
    assert.equal(reopened.state,'ACTIVE');assert.deepEqual(await states(db),[]);
  }finally{db.close();}
});

test('stale indexing, stale/wrong-chain source, changed checkpoint and watch-start reorg fail closed',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try{
    await assert.rejects(createPonsTripwireWatch(db,fixtureSource,{...arming,nowMs:fixtureNow+180_001}),/INDEX_STALE/);
    await assert.rejects(createPonsTripwireWatch(db,{...fixtureSource,async head(){return {...await fixtureSource.head(),timestampMs:fixtureNow-60_001};}},arming),/HEAD_STALE/);
    await assert.rejects(createPonsTripwireWatch(db,{...fixtureSource,async head(){return {...await fixtureSource.head(),chainId:5042};}},arming),/HEAD_STALE/);
    await assert.rejects(createPonsTripwireWatch(db,{...fixtureSource,async point(block){return {...await fixtureSource.point(block),hash:hash(9)};}},arming),/SOURCE_REORG/);
    await arm(db);await mature(db);
    const startReorg:WatchSource={...laterSource,async point(block){return block===BigInt(first.block_number)
      ?{hash:hash(3),timestampMs:fixtureNow}:laterSource.point(block);}};
    assert.equal((await runPonsTripwireCycle(db,startReorg,{now:()=>laterNow})).enqueued,0);
    assert.equal((await listPonsTripwireWatches(db,OWNER))[0]!.state,'REORG');
  }finally{db.close();}
});

test('canonical payload/digest drift, Arc role/source, other exact address and launch reorg create no notification',async()=>{
  for(const mutation of ["UPDATE launches SET source='ARCPAD' WHERE launch_id=?",
    "UPDATE launches SET creator='0x0000000000000000000000000000000000000043' WHERE launch_id=?",
    "UPDATE launches SET authority_json='{}' WHERE launch_id=?",
    "UPDATE provenance_facts SET evidence_digest='broken' WHERE launch_id=?",
    "UPDATE provenance_facts SET payload_json='{}' WHERE launch_id=?"]){
    const db=await createPonsTripwireFixtureDatabase();try{await arm(db);await mature(db);
      await db.prepare(mutation).bind(later.launch_id).run();let sends=0;
      assert.equal((await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow,deliver:async()=>++sends})).sent,0);
      assert.equal(sends,0);
    }finally{db.close();}
  }
  const db=await createPonsTripwireFixtureDatabase();try{await arm(db);await mature(db);
    const eventReorg:WatchSource={...laterSource,async point(block){return block===BigInt(later.block_number)?{hash:hash(7),timestampMs:laterNow}:laterSource.point(block);}};
    await assert.rejects(runPonsTripwireCycle(db,eventReorg,{now:()=>laterNow}),/SOURCE_REORG/);
  }finally{db.close();}
});

test('prepared notification is cancelled before delivery, and rewind cancels unsent work',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try{const watch=await arm(db);await mature(db);
    assert.equal((await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow})).enqueued,1);
    assert.deepEqual(await states(db),[{state:'PENDING',attempt_count:0,telegram_message_id:null}]);
    await cancelPonsTripwireWatch(db,OWNER,watch.generation,laterNow);
    assert.deepEqual(await states(db),[{state:'CANCELLED',attempt_count:0,telegram_message_id:null}]);
    const other=await createPonsTripwireFixtureDatabase();try{await arm(other);await mature(other);await runPonsTripwireCycle(other,laterSource,{now:()=>laterNow});
      await other.prepare('DELETE FROM launches WHERE launch_id=?').bind(later.launch_id).run();
      assert.deepEqual(await states(other),[{state:'CANCELLED',attempt_count:0,telegram_message_id:null}]);
    }finally{other.close();}
  }finally{db.close();}
});

test('ambiguous/malformed transport is UNKNOWN and never retried; definitive rejection is FAILED',async()=>{
  for(const response of [()=>{throw new Error('timeout');},()=>new Response('not-json',{status:200}),
    ()=>new Response(JSON.stringify({ok:true,result:{}}),{status:200}),()=>new Response(JSON.stringify({ok:false}),{status:500}),
    ()=>new Response(JSON.stringify({ok:false}),{status:400})]){
    const db=await createPonsTripwireFixtureDatabase();try{await arm(db);await mature(db);let attempts=0;
      const transport=ponsTripwireTelegramTransport('mock-token',async()=>{attempts++;return response();});
      await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow,deliver:transport});
      await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow,deliver:transport});
      assert.equal(attempts,1);assert.ok(['UNKNOWN','FAILED'].includes(String((await states(db))![0]!.state)));
    }finally{db.close();}
  }
  const db=await createPonsTripwireFixtureDatabase();try{await arm(db);await mature(db);await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow});
    await db.prepare("UPDATE pons_tripwire_outbox SET state='SENDING',attempt_count=1").run();let sent=0;
    await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow,deliver:async()=>++sent});assert.equal(sent,0);
    assert.equal((await states(db))![0]!.state,'UNKNOWN');
  }finally{db.close();}
});

test('fixed limits cap candidates/pending, watch slots and durable daily delivery budget atomically',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try{await arm(db);await mature(db);
    const base=Number(later.block_number);
    for(let i=1;i<=30;i++)await storeLaunch(db,await newLaunch(base+i));
    await publishFixture(db,BigInt(base+30),hash(base+30),laterNow);
    const source:WatchSource={async head(){return {chainId:4663,block:BigInt(base+30),hash:hash(base+30),timestampMs:laterNow};},
      async point(block){if(block>BigInt(base))return {hash:hash(Number(block)),timestampMs:fixtureNow+1000};return laterSource.point(block);}};
    let sends=0;
    const firstCycle=await runPonsTripwireCycle(db,source,{now:()=>laterNow,deliver:async()=>++sends});
    assert.equal(firstCycle.enqueued,5);assert.equal(firstCycle.sent,1);assert.ok(firstCycle.examined<=PONS_TRIPWIRE_LIMITS.candidates);
    assert.equal((await states(db))!.filter(row=>row.state==='PENDING').length,4);
    // Interval and daily allowances are durable, including after process restart.
    await db.prepare('UPDATE pons_tripwire_daily_budget SET attempts=5').run();
    await db.prepare('UPDATE pons_tripwire_watches SET next_allowed_ms=0').run();
    await runPonsTripwireCycle(db,source,{now:()=>laterNow,deliver:async()=>++sends});assert.equal(sends,1);
    const quota=(await db.prepare('SELECT attempts FROM pons_tripwire_daily_budget ORDER BY principal').all()).results;
    assert.deepEqual(quota,[{attempts:5},{attempts:5}]);
    assert.equal((await states(db))!.filter(row=>row.state==='SENDING').length,0);
    for(let i=1;i<=4;i++){
      const launch=await newLaunch(base+100+i,address(i));await storeLaunch(db,launch);
      await publishFixture(db,launch.blockNumber,launch.blockHash,laterNow);
      const armSource:WatchSource={async head(){return {chainId:4663,block:launch.blockNumber,hash:launch.blockHash,timestampMs:laterNow};},
        async point(block){return block===launch.blockNumber?{hash:launch.blockHash,timestampMs:laterNow}:source.point(block);}};
      await createPonsTripwireWatch(db,armSource,{...arming,launchId:launch.launchId,nowMs:laterNow});
    }
    const sixth=await newLaunch(base+200,address(99));await storeLaunch(db,sixth);await publishFixture(db,sixth.blockNumber,sixth.blockHash,laterNow);
    const sixthSource:WatchSource={async head(){return {chainId:4663,block:sixth.blockNumber,hash:sixth.blockHash,timestampMs:laterNow};},
      async point(){return {hash:sixth.blockHash,timestampMs:laterNow};}};
    await assert.rejects(createPonsTripwireWatch(db,sixthSource,{...arming,launchId:sixth.launchId,nowMs:laterNow}),/WATCH_LIMIT/);
  }finally{db.close();}
});

test('disabled defaults and Pons read-only guard isolate every legacy/unrelated consumer',async()=>{
  const db=new D1CompatDatabase();try{let ack=0,fetches=0;const kinds=['SYNC_CYCLE','RAT_WATCH_CYCLE','RAT_RADAR_CYCLE',
    'OBSERVATION_CYCLE','PONS_OUTCOME_CYCLE','PONS_TOKEN_IDENTITY_CYCLE','PONS_FUNDING_CYCLE','PONS_TRIPWIRE_CYCLE'];
    await handleSyncQueueBatch({messages:kinds.map(kind=>({body:{kind,cycleId:kind,enqueuedAtMs:fixtureNow},ack(){ack++;},retry(){throw new Error('MUST_NOT_RETRY');}}))},
      {DB:db,BINRAT_PONS_READ_ONLY:'true',BINRAT_AUTONOMOUS_RAT_ENABLED:'true',BINRAT_PONS_OUTCOME_ENABLED:'true'},
      {now:()=>fixtureNow,externalFetch:async()=>{fetches++;throw new Error('MUST_NOT_FETCH');}});
    assert.equal(ack,kinds.length);assert.equal(fetches,0);
    assert.deepEqual(await runCloudflarePonsTripwireCycle({DB:db},{kind:'PONS_TRIPWIRE_CYCLE',cycleId:'disabled',enqueuedAtMs:fixtureNow}),{status:'SUCCESS',examined:0,enqueued:0,sent:0});
  }finally{db.close();}
});

test('additive migration matches schema and exact deployer range query uses existing bounded index',async()=>{
  const db=new D1CompatDatabase();try{
    const migration=readFileSync(new URL('../cloudflare/migrations/20261010_pons_tripwire_v1.sql',import.meta.url),'utf8');
    assert.ok(D1_SCHEMA_SQL.includes(migration));assert.ok(readFileSync(new URL('../cloudflare/schema.sql',import.meta.url),'utf8').includes(migration));
    await db.exec(D1_SCHEMA_SQL);
    const query="EXPLAIN QUERY PLAN SELECT launch_id FROM launches INDEXED BY idx_launches_chain_source_creator_block_numeric WHERE chain_id=4663 AND source='PONS_V2' AND creator=? AND CAST(block_number AS INTEGER)>=? AND CAST(block_number AS INTEGER)>? AND CAST(block_number AS INTEGER)<=? ORDER BY CAST(block_number AS INTEGER),log_index,launch_id LIMIT 20";
    const plan=(await db.prepare(query).bind(capturedProduction.deployer,85082484,85082484,85105947).all()).results;
    assert.ok(plan?.some(row=>String(row.detail).includes('SEARCH launches USING')&&String(row.detail).includes('idx_launches_chain_source_creator_block_numeric')));
  }finally{db.close();}
});

test('healthy scanner queues only dedicated opt-in tripwire poll; scanner adds no Watch RPC',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try{
    const checkpoint=BigInt(first.block_number),queued:Array<{kind:string}>=[];let watchReads=0,ack=0;
    await handleSyncQueueBatch({messages:[{body:{kind:'PONS_SYNC_CYCLE',cycleId:'tripwire-after-index',enqueuedAtMs:fixtureNow},
      ack(){ack++;},retry(){throw new Error('UNEXPECTED_RETRY');}}]},
      {DB:db,BINRAT_PONS_READ_ONLY:'true',BINRAT_PONS_TRIPWIRE_ENABLED:'true',
        BINRAT_AUTONOMOUS_RAT_ENABLED:'true',BINRAT_PONS_OUTCOME_ENABLED:'true',BINRAT_PONS_FUNDING_ENABLED:'true',
        SYNC_QUEUE:{async send(message){queued.push(message);}}},
      {now:()=>fixtureNow,ponsLaunchSource:{async getHeadBlockNumber(){return checkpoint+102n;},
        async getBlockHash(block){return block===checkpoint?first.block_hash:hash(Number(block));},
        async assertAuthority(){},async catchUp(){return [];}},
        ponsTripwireSource:{async head(){watchReads++;throw new Error('SCANNER_MUST_NOT_READ_WATCH_SOURCE');},
          async point(){watchReads++;throw new Error('SCANNER_MUST_NOT_READ_WATCH_SOURCE');}},
        externalFetch:async()=>{throw new Error('UNEXPECTED_EXTERNAL_IO');}});
    assert.equal(ack,1);assert.deepEqual(queued.map(message=>message.kind),['PONS_TRIPWIRE_CYCLE']);assert.equal(watchReads,0);
  }finally{db.close();}
});

test('HTTP mutation fence rejects absent, expired and replaced lease ownership; duplicate keeps original boundary',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try{
    const leaseName='pons_tripwire:mutation:telegram:42',ownerToken='owner-token';
    const mutationFence={leaseName,ownerToken,now:()=>fixtureNow};
    await assert.rejects(createPonsTripwireWatch(db,fixtureSource,{...arming,mutationFence}),/BUSY/);
    await db.prepare('INSERT INTO binrat_sync_leases(lease_name,owner_token,lease_until_ms,updated_at_ms) VALUES (?,?,?,?)')
      .bind(leaseName,ownerToken,fixtureNow-1,fixtureNow-2).run();
    await assert.rejects(createPonsTripwireWatch(db,fixtureSource,{...arming,mutationFence}),/BUSY/);
    await db.prepare('UPDATE binrat_sync_leases SET owner_token=?,lease_until_ms=? WHERE lease_name=?')
      .bind('new-owner-token',fixtureNow+90_000,leaseName).run();
    await assert.rejects(createPonsTripwireWatch(db,fixtureSource,{...arming,mutationFence}),/BUSY/);
    assert.deepEqual(await listPonsTripwireWatches(db,OWNER),[]);
    const watch=await createPonsTripwireWatch(db,fixtureSource,{...arming,mutationFence:{...mutationFence,ownerToken:'new-owner-token'}});
    assert.equal(watch.state,'ACTIVE');
    assert.equal((await createPonsTripwireWatch(db,fixtureSource,arming)).generation,watch.generation);
    await cancelPonsTripwireWatch(db,OWNER,watch.generation,fixtureNow);
    await assert.rejects(createPonsTripwireWatch(db,fixtureSource,{...arming,mutationFence}),/BUSY/);
    assert.equal((await listPonsTripwireWatches(db,OWNER))[0]!.state,'CANCELLED');
  }finally{db.close();}
});

test('queue pilot owner authorization is required and rotated owners cannot consume old Watches or pending alerts',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try {
    await arm(db);await mature(db);
    const message={kind:'PONS_TRIPWIRE_CYCLE' as const,cycleId:'owner-gate',enqueuedAtMs:laterNow};
    let reads=0,sends=0;
    const deps={now:()=>laterNow,ponsTripwireSource:{...laterSource,async head(){reads++;return laterSource.head();}},externalFetch:(async()=>{sends++;throw new Error('MUST_NOT_SEND');}) as typeof fetch};
    const env={DB:db,BINRAT_PONS_READ_ONLY:'true',BINRAT_PONS_TRIPWIRE_ENABLED:'true',BINRAT_PONS_TRIPWIRE_DELIVERY_ENABLED:'true',TELEGRAM_BOT_TOKEN:'mock'};
    for(const allowed of [undefined,'0','invalid','9007199254740992']) {
      const report=await runCloudflarePonsTripwireCycle({...env,BINRAT_PONS_TRIPWIRE_ALLOWED_USER_ID:allowed},message,deps);
      assert.equal(report.status,'SUCCESS');assert.ok('paused' in report);assert.equal(reads,0);assert.equal(sends,0);
    }
    assert.deepEqual(await runCloudflarePonsTripwireCycle({...env,BINRAT_PONS_TRIPWIRE_ALLOWED_USER_ID:'43'},message,deps),{status:'SUCCESS',examined:0,enqueued:0,sent:0});
    assert.deepEqual(await states(db),[]);
    await runCloudflarePonsTripwireCycle({...env,BINRAT_PONS_TRIPWIRE_ALLOWED_USER_ID:'42',BINRAT_PONS_TRIPWIRE_DELIVERY_ENABLED:'false'},message,deps);
    assert.equal((await states(db))![0]!.state,'PENDING');assert.equal(sends,0);
    await runCloudflarePonsTripwireCycle({...env,BINRAT_PONS_TRIPWIRE_ALLOWED_USER_ID:'43'},message,deps);
    assert.equal((await states(db))![0]!.state,'PENDING');assert.equal(sends,0);
    await db.prepare('UPDATE pons_tripwire_watches SET chat_id=43').run();
    await runCloudflarePonsTripwireCycle({...env,BINRAT_PONS_TRIPWIRE_ALLOWED_USER_ID:'42'},message,deps);
    assert.equal(sends,0);assert.equal((await states(db))![0]!.state,'PENDING');
  }finally{db.close();}
});

test('cancellation wins atomic delivery admission, while an already admitted attempt cannot be recalled or replayed',async()=>{
  for(const beforeAdmission of [true,false]) {
    const db=await createPonsTripwireFixtureDatabase();try {
      const watch=await arm(db);await mature(db);await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow});
      let sends=0;
      const originalBatch=db.batch.bind(db);let intercept=beforeAdmission;
      db.batch=async statements=>{
        if(intercept) {intercept=false;await cancelPonsTripwireWatch(db,OWNER,watch.generation,laterNow);}
        return originalBatch(statements);
      };
      await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow,deliver:async()=>{
        sends++;await cancelPonsTripwireWatch(db,OWNER,watch.generation,laterNow);return 99;
      }});
      assert.equal(sends,beforeAdmission?0:1);
      assert.equal((await listPonsTripwireWatches(db,OWNER))[0]!.state,'CANCELLED');
      await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow,deliver:async()=>++sends});
      assert.equal(sends,beforeAdmission?0:1);
    }finally{db.close();}
  }
});

test('crash after successful mock send before receipt write becomes UNKNOWN without a second delivery',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try {
    await arm(db);await mature(db);let sends=0;
    const originalPrepare=db.prepare.bind(db);
    db.prepare=sql=>{
      if(sql.startsWith('UPDATE pons_tripwire_outbox SET state=?,telegram_message_id=?')) throw new Error('SIMULATED_CRASH_AFTER_SEND');
      return originalPrepare(sql);
    };
    await assert.rejects(runPonsTripwireCycle(db,laterSource,{now:()=>laterNow,deliver:async()=>{sends++;return 101;}}),/SIMULATED_CRASH_AFTER_SEND/);
    assert.equal((await states(db))![0]!.state,'SENDING');
    db.prepare=originalPrepare;
    await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow,deliver:async()=>++sends});
    assert.equal(sends,1);assert.equal((await states(db))![0]!.state,'UNKNOWN');
  }finally{db.close();}
});

test('migration applies twice over the prior production schema without changing legacy rows',async()=>{
  const db=new D1CompatDatabase();try {
    const migration=readFileSync(new URL('../cloudflare/migrations/20261010_pons_tripwire_v1.sql',import.meta.url),'utf8');
    await db.exec(D1_SCHEMA_SQL.slice(0,D1_SCHEMA_SQL.indexOf(migration)));
    await seedProductionRow(db,first);
    const before=await db.prepare('SELECT * FROM launches WHERE launch_id=?').bind(first.launch_id).first();
    await db.exec(migration);await db.exec(migration);
    assert.deepEqual(await db.prepare('SELECT * FROM launches WHERE launch_id=?').bind(first.launch_id).first(),before);
    assert.equal((await validatePonsTripwireEvidence(db,first.launch_id,BigInt(first.block_number))).fact.evidenceDigest,first.evidence_digest);
  }finally{db.close();}
});
