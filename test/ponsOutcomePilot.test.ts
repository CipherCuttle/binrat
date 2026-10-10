import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFileSync,mkdirSync } from 'node:fs';
import { outcomePilotFixture,publishFixture } from './support/outcomePilotFixture.js';
import { D1OutcomePilot,OUTCOME_DUE_SQL,outcomePilotConfigured } from '../src/cloudflare/ponsOutcomePilot.js';
import { RECENT_OUTCOME_CANDIDATES_SQL,D1PonsOutcomeObservationStore } from '../src/cloudflare/ponsOutcomeStore.js';
import { OutcomeWorkBudget } from '../src/cloudflare/ponsOutcomeBudget.js';
import { handleSyncQueueBatch,enqueuePonsOutcomeCycle,runCloudflarePonsOutcomeCycle } from '../src/cloudflare/syncQueue.js';
import { D1SyncLeaseStore } from '../src/cloudflare/syncLease.js';
import { readPublicCaseOutcomes } from '../src/cloudflare/publicCaseOutcomes.js';
import { verifyCaseOutcomes } from '../src/public/caseOutcomes.js';
import { buildPublicSnapshot,publishPublicSnapshot } from '../src/cloudflare/publicSnapshot.js';
import worker from '../src/cloudflare/worker.js';

for (const [key,value] of Object.entries({BINRAT_PONS_OUTCOME_COLLECT_AUTHORIZED:undefined,BINRAT_PONS_OUTCOME_ENABLED:'false',BINRAT_PONS_READ_ONLY:'false',BINRAT_PONS_OUTCOME_PILOT_ID:'wrong!',BINRAT_PONS_OUTCOME_MAX_PER_CYCLE:'12'})) {
  test('fails closed authorization '+key,async()=>{const f=await outcomePilotFixture();try{
    Object.assign(f.env,{[key]:value});assert.equal(outcomePilotConfigured(f.env),false);
    await enqueuePonsOutcomeCycle(f.env,f.now());assert.equal(f.messages.length,0);assert.equal(f.reads(),0);
  }finally{f.db.close();}});
}
test('wrong/missing durable authority and wrong queue pilot never reach source',async()=>{const f=await outcomePilotFixture();try{
  const message=await f.schedule();
  await f.execute({...message,outcomePilotId:'wrong'});assert.equal(f.reads(),0);
  await f.db.prepare("DELETE FROM pons_outcome_jobs").run();await f.db.prepare('DELETE FROM pons_outcome_pilots').run();
  await assert.rejects(f.schedule(),/NOT_AUTHORIZED/);
  await f.execute(message);assert.equal(f.reads(),0);
}finally{f.db.close();}});
test('other queue kinds and flags cannot bypass isolation with collector authorized',async()=>{const f=await outcomePilotFixture();try{
  Object.assign(f.env,{BINRAT_AUTONOMOUS_RAT_ENABLED:'true',BINRAT_PONS_TOKEN_IDENTITY_ENABLED:'true',BINRAT_PONS_FUNDING_ENABLED:'true'});
  let ack=0;
  await handleSyncQueueBatch({messages:['SYNC_CYCLE','OBSERVATION_CYCLE','PONS_TOKEN_IDENTITY_CYCLE','PONS_FUNDING_CYCLE','RAT_WATCH_CYCLE','RAT_RADAR_CYCLE'].map(kind=>({body:{kind,cycleId:'fixture-other',enqueuedAtMs:f.now()},ack(){ack++;},retry(){throw Error('retry');}}))},f.env,{now:f.now,externalFetch:async()=>{throw Error('network');}});
  assert.equal(ack,6);assert.equal(f.reads(),0);
}finally{f.db.close();}});
test('one cycle/receipt; repeated activation and duplicate delivery cannot multiply work',async()=>{const f=await outcomePilotFixture();try{
  const message=await f.schedule();for(let i=0;i<5;i++) await f.schedule();assert.equal(f.messages.length,1);
  assert.deepEqual(await f.execute(message),{ack:1,retry:0});assert.equal((await f.receipts()).results!.length,1);
  const reads=f.reads();assert.deepEqual(await f.execute(message),{ack:1,retry:0});assert.equal(f.reads(),reads);
  const receipts=new D1PonsOutcomeObservationStore(f.db);const [r]=await receipts.listForLaunch(f.initial.launchId);
  assert.equal(await receipts.put(r!), 'DUPLICATE');
  assert.equal((await f.db.prepare("SELECT rpc_remaining FROM pons_outcome_pilots").first<{rpc_remaining:number}>())!.rpc_remaining,120);
}finally{f.db.close();}});
test('lease contention consumes no RPC reservation and next opportunity recovers',async()=>{const f=await outcomePilotFixture();try{
  const message=await f.schedule();await new D1SyncLeaseStore(f.db).claim('binrat:pons-sync','fixture-busy',f.now(),180000);
  await f.execute(message);assert.equal(f.reads(),0);
  await new D1SyncLeaseStore(f.db).release('binrat:pons-sync','fixture-busy');
  await f.execute(message);assert.equal((await f.receipts()).results!.length,1);
}finally{f.db.close();}});
for(const stage of ['before','authority','state']) test('authorization revoked '+stage,async()=>{const f=await outcomePilotFixture();try{
  const message=await f.schedule();const revoke=()=>f.db.prepare("UPDATE pons_outcome_pilots SET enabled=0").run();
  const source={...f.source};
  if(stage==='before') await revoke();
  if(stage==='authority') source.assertAuthority=async()=>{await revoke();};
  if(stage==='state') source.readOutcomeAt=async(l,n)=>{const r=await f.source.readOutcomeAt(l,n);await revoke();return r;};
  await f.execute(message,source);assert.equal((await f.receipts()).results!.length,0);
  await assert.rejects(f.schedule(),/NOT_AUTHORIZED/);
}finally{f.db.close();}});
for(const mutate of ['runtime','checkpoint','queueAge','oldLaunch','launchTime','wrongBlock','malformed','reorg','rpcFailure']) test('adversarial '+mutate,async()=>{const f=await outcomePilotFixture();try{
  const message=await f.schedule();const source={...f.source};
  if(mutate==='runtime') await f.db.prepare('UPDATE binrat_runtime_state SET updated_at_ms=?').bind(f.now()-120001).run();
  if(mutate==='checkpoint') await f.db.prepare("UPDATE chain_checkpoints SET block_number='109'").run();
  if(mutate==='queueAge') f.advance(60001);
  if(mutate==='oldLaunch') await f.db.prepare('UPDATE pons_outcome_pilots SET start_block=100').run();
  if(mutate==='launchTime') await f.db.prepare('UPDATE pons_outcome_jobs SET launch_timestamp_ms=launch_timestamp_ms+1,due_ms=due_ms+1').run();
  if(mutate==='wrongBlock') source.getBlockPoint=async n=>({...await f.source.getBlockPoint(n),blockNumber:n+1n});
  if(mutate==='malformed') source.getBlockPoint=async n=>({...await f.source.getBlockPoint(n),timestampMs:NaN});
  if(mutate==='reorg') source.getBlockPoint=async n=>({...await f.source.getBlockPoint(n),blockHash:'0x'+'f'.repeat(64) as `0x${string}`});
  if(mutate==='rpcFailure') source.readOutcomeAt=async()=>{throw Error('PONS_OUTCOME_RPC_TIMEOUT');};
  await f.execute(message,source);assert.equal((await f.receipts()).results!.length,0);
}finally{f.db.close();}});
test('failure retries are durable, capped at two, and never self enqueue',async()=>{const f=await outcomePilotFixture();try{
  const source={...f.source,readOutcomeAt:async()=>{throw Error('PONS_OUTCOME_RPC_TIMEOUT');}};
  await f.execute(await f.schedule(),source);f.advance(60000);await f.checkpoint(111);
  await f.execute(await f.schedule(),source);assert.equal(f.messages.length,2);
  const job=await f.db.prepare("SELECT * FROM pons_outcome_jobs WHERE horizon_ms=300000").first<{state:string;attempts:number}>();
  assert.equal(job!.state,'FAILED');assert.equal(job!.attempts,2);
  f.advance(60000);await f.checkpoint(112);await f.schedule();assert.equal(f.messages.length,2);
}finally{f.db.close();}});
test('historical launches without explicit jobs never run; indexed recent job remains discoverable',async()=>{const f=await outcomePilotFixture();try{
  for(let n=1;n<30;n++) await f.launch(n);
  const p=new D1OutcomePilot(f.env,f.now);assert.equal((await p.next())!.launch_id,f.initial.launchId);
  await f.db.prepare('DELETE FROM pons_outcome_jobs').run();await f.schedule();assert.equal(f.messages.length,0);
}finally{f.db.close();}});
test('query plans require indexed SEARCH, no SCAN, GROUP or temp sort',async()=>{const f=await outcomePilotFixture();try{
  const queries=[{name:'due-job',sql:OUTCOME_DUE_SQL,params:['fixture',f.now()]},
    {name:'recent-fallback',sql:RECENT_OUTCOME_CANDIDATES_SQL,params:[2]},
    {name:'exact-launch',sql:'SELECT * FROM launches WHERE launch_id=? LIMIT 1',params:[f.initial.launchId]},
    {name:'receipts',sql:"SELECT payload_json FROM pons_outcome_receipts WHERE chain_id=4663 AND launch_id=? AND observation_version='BINRAT_PONS_OUTCOME_OBSERVATION_V1' AND horizon_ms IN (300000,3600000,86400000) ORDER BY horizon_ms LIMIT 3",params:[f.initial.launchId]}];
  const plans=[];
  for(const q of queries){const plan=(await f.db.prepare('EXPLAIN QUERY PLAN '+q.sql).bind(...q.params).all()).results!;
    const details=plan.map(x=>x.detail).join('\n');assert.match(details,/SEARCH/);assert.doesNotMatch(details,/SCAN|TEMP B-TREE/);plans.push({...q,plan});}
  mkdirSync('.artifacts/a2-2',{recursive:true});writeFileSync('.artifacts/a2-2/query-plans.json',JSON.stringify({provenance:'offline SQLite / explicit synthetic fixture',plans},null,2));
  await f.db.exec('DROP INDEX idx_pons_outcome_due');await assert.rejects(new D1OutcomePilot(f.env,f.now).next(),/no such index/);
}finally{f.db.close();}});
test('RPC attempt cap and timeout leave no continuing work',async()=>{
  const b=new OutcomeWorkBudget(Date.now,1000,2,async()=>{});let calls=0;
  try {const bounded=b.fetch(async()=>{calls++;return Response.json({});});await bounded('https://fixture.invalid',{body:JSON.stringify({method:'eth_call'})});await bounded('https://fixture.invalid',{body:JSON.stringify({method:'eth_call'})});
    await assert.rejects(bounded('https://fixture.invalid',{body:JSON.stringify({method:'eth_call'})}),/RPC_BUDGET/);assert.equal(calls,2);
  }finally{b.stop();}
  const timeout=new OutcomeWorkBudget(Date.now,20,40,async()=>{});
  try {await assert.rejects(timeout.source({assertAuthority:()=>new Promise(()=>{}),getBlockPoint:async()=>{throw Error('unexpected');},readOutcomeAt:async()=>{throw Error('unexpected');}}).assertAuthority(),/TIME_BUDGET/);}finally{timeout.stop();}
});
test('full synthetic path: launch, due jobs, three verified receipts, A2 GET and Case contract',async()=>{const f=await outcomePilotFixture();try{
  for (const [h,block] of [[300000,110],[3600000,161],[86400000,1541]]) {
    if(h>300000) {f.advance(f.origin+h+60000-f.now());await f.checkpoint(block);}
    if(h===86400000) f.setGraduated(true);
    await publishFixture(f);
    await f.execute(await f.schedule());
  }
  assert.equal((await f.receipts()).results!.length,3);
  const response=await worker.fetch(new Request('https://fixture.invalid/api/bag/'+f.current.launchId+'/evidence?include=outcomes'),f.env);
  assert.equal(response.status,200);const e=await response.json() as Awaited<ReturnType<typeof readPublicCaseOutcomes>>;assert.ok(e);
  const v=await verifyCaseOutcomes(e,f.current.launchId,e.material.caseEvidence.material.publication);
  const earlier=v.launches.find(x=>x.record.launch.launchId===f.initial.launchId)!;
  assert.deepEqual(earlier.samples.map(x=>x.horizonMs),[300000,3600000,86400000]);
  assert.equal(earlier.samples[2]!.phase,'GRADUATED');assert.deepEqual(earlier.samples[2]!.missing,['V4_POOL_STATE']);
  assert.equal(earlier.samples[2]!.estimatedFdvQuoteRaw,null);assert.equal(v.summary.earlierWithSamples,1);
  mkdirSync('.artifacts/a2-2',{recursive:true});writeFileSync('.artifacts/a2-2/integration.json',JSON.stringify({provenance:'EXPLICIT SYNTHETIC OFFLINE FIXTURE — no live intelligence',envelope:e},null,2));
}finally{f.db.close();}});

test('review regression: source authority corruption is terminal',async()=>{const f=await outcomePilotFixture();try{
  const message=await f.schedule();await f.db.prepare("UPDATE launches SET pool=? WHERE launch_id=?").bind('0x'+'f'.repeat(40),f.initial.launchId).run();
  await f.execute(message);assert.equal(f.reads(),0);assert.equal((await f.receipts()).results!.length,0);
  assert.equal((await f.db.prepare("SELECT state FROM pons_outcome_jobs WHERE horizon_ms=300000").first<{state:string}>())!.state,'FAILED');
}finally{f.db.close();}});
test('review regression: corrupt persisted columns cannot count as an existing observation',async()=>{const f=await outcomePilotFixture();try{
  await f.execute(await f.schedule());await f.db.prepare("UPDATE pons_outcome_receipts SET observed_block='999'").run();
  await assert.rejects(new D1PonsOutcomeObservationStore(f.db).listForLaunch(f.initial.launchId),/STORED_BINDING_INVALID/);
}finally{f.db.close();}});
test('review regression: accounting failure still releases both writer leases',async()=>{const f=await outcomePilotFixture();try{
  const message=await f.schedule();const db=f.env.DB;
  f.env.DB={...db,exec:s=>db.exec(s),batch:s=>db.batch(s),prepare(sql){
    if(sql.startsWith('UPDATE pons_outcome_pilots SET rpc_remaining=rpc_remaining+')) throw Error('FIXTURE_ACCOUNTING_FAILURE');
    return db.prepare(sql);
  }};
  await assert.rejects(runCloudflarePonsOutcomeCycle(f.env,message,{now:f.now,ponsOutcomeSource:f.source}),/FIXTURE_ACCOUNTING_FAILURE/);
  assert.equal((await f.db.prepare('SELECT * FROM binrat_sync_leases').all()).results!.length,0);
  const reads=f.reads();f.env.DB=db;await f.execute(message);assert.equal(f.reads(),reads);
}finally{f.db.close();}});
test('review regression: same delivery concurrent consumers cannot release another writer lease',async()=>{const f=await outcomePilotFixture();try{
  const message=await f.schedule();let entered!:()=>void,release!:()=>void;
  const gate=new Promise<void>(r=>{release=r;});const started=new Promise<void>(r=>{entered=r;});
  const source={...f.source,assertAuthority:async()=>{entered();await gate;}};
  const first=f.execute(message,source);await started;await f.execute(message);
  assert.equal((await f.db.prepare('SELECT * FROM binrat_sync_leases').all()).results!.length,2);
  release();await first;assert.equal((await f.receipts()).results!.length,1);
}finally{f.db.close();}});
test('review regression: unknown RPC methods and batches consume no external requests',async()=>{
  const b=new OutcomeWorkBudget(Date.now,1000,40,async()=>{});let calls=0;
  try {const bounded=b.fetch(async()=>{calls++;return Response.json({});});
    for(const body of [{method:'eth_getLogs'},[{method:'eth_call'}],{method:'eth_sendRawTransaction'}]) {
      await assert.rejects(bounded('https://fixture.invalid',{body:JSON.stringify(body)}),/RPC_METHOD_INVALID/);
    }assert.equal(calls,0);
  }finally{b.stop();}
});
test('realistic 10 blocks/second boundary fits fixed RPC cap for each horizon (synthetic)',async()=>{
  const {syncPonsOutcomeObservations}=await import('../src/pons/outcomeReceipts.js');
  const {buildPonsCurveOutcomeCapabilityReceipt}=await import('../src/pons/outcomeCapability.js');
  for (const h of [300000,3600000,86400000]) {
    const f=await outcomePilotFixture();const b=new OutcomeWorkBudget(Date.now,15000,40,async()=>{});
    try {
      const target=100n+BigInt(h/100),checkpoint=target+10n;
      f.advance(f.origin+h+1000-f.now());await f.checkpoint(Number(checkpoint));
      const job={pilot_id:'fixture',launch_id:f.initial.launchId,horizon_ms:h,launch_timestamp_ms:f.origin,due_ms:f.origin+h,attempts:0};
      const owner='fixture-rpc-proof';await new D1SyncLeaseStore(f.db).claim('binrat:pons-sync',owner,f.now(),180000);
      await new D1SyncLeaseStore(f.db).claim('binrat:pons-outcome',owner,f.now(),180000);
      const bounded=b.fetch(async()=>Response.json({result:'FIXTURE'}));
      const rpc=(method:string)=>bounded('https://fixture.invalid',{body:JSON.stringify({method})});
      const source={
        assertAuthority:async()=>{for(const method of ['eth_chainId','eth_getCode','eth_chainId','eth_getCode'])await rpc(method);},
        getBlockPoint:async(n:bigint)=>{await rpc('eth_getBlockByNumber');return{blockNumber:n,blockHash:'0x'+n.toString(16).padStart(64,'0') as `0x${string}`,timestampMs:f.origin+Number(n-100n)*100};},
        readOutcomeAt:async(l:{launchId:string;token:`0x${string}`;curve:`0x${string}`},n:bigint)=>{
          // Worst CURVE branch: two state block headers, six core/reserve calls, quote decimals.
          for(let i=0;i<2;i++)await rpc('eth_getBlockByNumber');for(let i=0;i<7;i++)await rpc('eth_call');
          return buildPonsCurveOutcomeCapabilityReceipt({launch:l,observedBlock:n,observedBlockHash:'0x'+n.toString(16).padStart(64,'0') as `0x${string}`,
            observedTimestampMs:f.origin+Number(n-100n)*100,pairToken:'0x'+'0'.repeat(40) as `0x${string}`,quoteDecimals:18,totalSupply:1000000n,
            graduated:false,quoteReserve:10n,tokenReserve:500000n});
        }
      };
      const report=await syncPonsOutcomeObservations(b.source(source),await new D1OutcomePilot(f.env,f.now).store(job,()=>b.check(),owner),
        {maxReceiptsPerSync:1,horizons:[{label:'fixture',ms:h}],expectedLaunchTimestampMs:f.origin});
      assert.equal(report.inserted,1);assert.ok(b.rpcCalls<=40);
      mkdirSync('.artifacts/a2-2',{recursive:true});
      const file='.artifacts/a2-2/rpc-'+h+'.json';writeFileSync(file,JSON.stringify({provenance:'SYNTHETIC 10 blocks/second, worst CURVE quote-decimals RPC branch; no provider calls',horizonMs:h,rpcCalls:b.rpcCalls,cap:40}));
    }finally{b.stop();f.db.close();}
  }
});

test('finite pilot budgets stop admission instead of replenishing after restart',async()=>{const f=await outcomePilotFixture();try{
  await f.db.prepare('UPDATE pons_outcome_pilots SET rpc_remaining=39').run();await f.schedule();assert.equal(f.messages.length,0);
  await f.db.prepare('UPDATE pons_outcome_pilots SET rpc_remaining=120,cycles_remaining=0').run();await f.schedule();assert.equal(f.messages.length,0);
}finally{f.db.close();}});
test('production Pons success schedules one authorized outcome and no other feature',async()=>{const f=await outcomePilotFixture();try{
  const {PONS_V2_START_BLOCK}=await import('../src/pons/chain.js');const base=PONS_V2_START_BLOCK+1000n;
  await f.checkpoint(Number(base));f.messages.length=0;
  await handleSyncQueueBatch({messages:[{body:{kind:'PONS_SYNC_CYCLE',cycleId:'fixture-success',enqueuedAtMs:f.now()},ack(){},retry(){throw Error('unexpected indexing retry');}}]},f.env,
    {now:f.now,ponsLaunchSource:{getHeadBlockNumber:async()=>base+102n,getBlockHash:async n=>'0x'+n.toString(16).padStart(64,'0') as `0x${string}`,assertAuthority:async()=>{},catchUp:async()=>[]}});
  assert.equal(f.messages.length,1);assert.equal(f.messages[0]!.kind,'PONS_OUTCOME_CYCLE');assert.equal(f.messages[0]!.outcomePilotId,'fixture');
  // The queue poll only admits the job. Runner authority/source checks remain mandatory.
}finally{f.db.close();}});
