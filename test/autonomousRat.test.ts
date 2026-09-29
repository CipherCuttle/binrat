import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1CompatDatabase } from './support/d1Compat.js';
import { autonomousFixture, runAutonomousDemo, CREATOR, PRINCIPAL, addr, hash } from './support/autonomousFixture.js';
import { parseTarget, renderReceipt, attentionDecision, type Entity } from '../src/autonomous/model.js';
import { dig, why } from '../src/autonomous/evidence.js';
import { FreeEntitlements, FREE_CAPACITY } from '../src/autonomous/entitlements.js';
import { commandReplay, listWatches, mutateWatch, reserveDig } from '../src/autonomous/watches.js';
import { deliverFindings, enqueueFindings } from '../src/autonomous/delivery.js';
import { parseAutonomousCommand } from '../src/autonomous/telegram.js';
import { handleWorkerRequest } from '../src/cloudflare/worker.js';
import type { D1DatabaseLike, D1PreparedStatementLike } from '../src/cloudflare/d1Types.js';

const subject = ():Entity => parseTarget(CREATOR);
const count = async (db:D1CompatDatabase,table:string,where='1=1') =>
  (await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).first<{n:number}>())!.n;
const arm = async (f:Awaited<ReturnType<typeof autonomousFixture>>,id=1000,p=PRINCIPAL,target=subject()) =>
  mutateWatch(f.db,p,id,target,'WATCH',FREE_CAPACITY,f.now(),f.source);
const remove = async (f:Awaited<ReturnType<typeof autonomousFixture>>,id=1001) =>
  mutateWatch(f.db,PRINCIPAL,id,subject(),'UNWATCH',FREE_CAPACITY,f.now(),f.source);

test('DIG normalizes canonical input, rejects malformed/unsupported chain and entity',()=>{
  assert.equal(parseTarget(CREATOR.toUpperCase().replace('0X','0x')).entityId,CREATOR);
  assert.equal(parseTarget(`5042:token:${CREATOR}`).entityType,'TOKEN');
  assert.throws(()=>parseTarget('0x12'),/MALFORMED/);
  assert.throws(()=>parseTarget(`7777:CREATOR:${CREATOR}`),/UNSUPPORTED_CHAIN/);
  assert.throws(()=>parseTarget(`5042:HUMAN:${CREATOR}`),/UNSUPPORTED_ENTITY/);
  assert.equal(parseAutonomousCommand(`/watch@OtherBot ${CREATOR}`),null);
});

test('DIG creator/token/launch receipts are stable, bounded, partial and deterministic without financial judgments',async()=>{
  const f=await autonomousFixture();
  try {
    const receipt=await dig(f.db,subject(),f.now());
    assert.equal((await dig(f.db,subject(),f.now()+1)).caseId,receipt.caseId);
    for(const target of [parseTarget(`4663:TOKEN:${f.initial.token}`),parseTarget(f.initial.launchId)]) {
      assert.equal((await dig(f.db,target,f.now())).evidenceRefs[0]!.launchId,f.initial.launchId);
    }
    const text=renderReceipt(receipt,'DIG');
    assert.match(text,/Coverage: PARTIAL/); assert.match(text,/UNKNOWN: human identity, intent, safety and future outcome/);
    assert.match(text,/OBSERVED:/); assert.match(text,/DERIVED:/);
    assert.doesNotMatch(text,/\b(?:buy|sell|safe token|rug verdict|smart money|guaranteed)\b/i);
    assert.equal(receipt.timestamp.eventTime,null);
    await assert.rejects(dig(f.db,parseTarget(`5042:WALLET:${CREATOR}`),f.now()),/UNSUPPORTED_ENTITY/);
    await assert.rejects(dig(f.db,{...subject(),chainId:5042},f.now()),/INDEX_UNAVAILABLE/);
  } finally {f.db.close();}
});

test('DIG incomplete evidence and cross-chain launch lookup fail closed',async()=>{
  const f=await autonomousFixture();
  try {
    const other=await f.launch(90,CREATOR,5042);
    await assert.rejects(dig(f.db,parseTarget(other.launchId),f.now()),/EVIDENCE_UNAVAILABLE/);
    await f.db.exec('DELETE FROM provenance_facts');
    await assert.rejects(dig(f.db,subject(),f.now()),/EVIDENCE_UNAVAILABLE/);
    await f.send(`/dig ${CREATOR}`); assert.match(f.sent.at(-1)!.text,/missing or incomplete/);
    assert.equal(await count(f.db,'rat_v1_cases'),0);
  } finally {f.db.close();}
});

test('WHY reconstructs receipts and rejects missing evidence, unknown case and tampering',async()=>{
  const f=await autonomousFixture();
  try {
    const receipt=await dig(f.db,subject(),f.now());
    assert.deepEqual(await why(f.db,receipt.caseId,f.now()),receipt);
    assert.match(renderReceipt(receipt,'WHY'),/fact: binrat-fact:4663/);
    await assert.rejects(why(f.db,'0'.repeat(64),f.now()),/RECEIPT_UNAVAILABLE/);
    await f.db.prepare('UPDATE rat_v1_cases SET receipt_json=? WHERE case_id=?')
      .bind(JSON.stringify({...receipt,epistemicClass:'DERIVED'}),receipt.caseId).run();
    await assert.rejects(why(f.db,receipt.caseId,f.now()),/RECEIPT_UNAVAILABLE/);
    await f.db.exec('DELETE FROM provenance_facts');
    await assert.rejects(why(f.db,receipt.caseId,f.now()),/EVIDENCE_UNAVAILABLE/);
  } finally {f.db.close();}
});

test('WATCH add/duplicate/list/remove/duplicate remove and webhook retry have one effect',async()=>{
  const f=await autonomousFixture();
  try {
    const request=`/watch ${CREATOR}`;
    assert.equal((await f.send(request,{updateId:200})).status,200);
    assert.equal((await f.send(request,{updateId:200})).status,200);
    assert.equal(f.sent.length,1);
    const initial=(await listWatches(f.db,PRINCIPAL))[0]!;
    await f.send(request,{updateId:201});
    assert.equal((await listWatches(f.db,PRINCIPAL))[0]!.generation,initial.generation);
    assert.equal(initial.start_block,102); // NOT lagging confirmed checkpoint 100.
    await f.send('/watches'); assert.match(f.sent.at(-1)!.text,/4663:CREATOR/);
    await f.send(`/unwatch ${CREATOR}`,{updateId:202});
    await f.send(`/unwatch ${CREATOR}`,{updateId:203});
    assert.equal((await listWatches(f.db,PRINCIPAL)).length,0);
    assert.equal(await count(f.db,'rat_v1_watches'),1);
    await f.send('/watch malformed'); assert.match(f.sent.at(-1)!.text,/Use a Robinhood address/);
  } finally {f.db.close();}
});

test('watch effects cannot replay after newer unwatch, including out-of-order delivery',async()=>{
  const f=await autonomousFixture();
  try {
    await arm(f,400); await remove(f,401); await arm(f,400);
    assert.equal((await listWatches(f.db,PRINCIPAL)).length,0);
    assert.match(await arm(f,399),/superseded/);
    await assert.rejects(commandReplay(f.db,{userId:88,chatId:88},400),/AUTHORITY_MISMATCH/);
    f.advance(); f.setHead(115); await arm(f,402);
    assert.equal((await listWatches(f.db,PRINCIPAL))[0]!.start_block,115);
  } finally {f.db.close();}
});

test('WATCH atomic quota boundary under concurrent requests; duplicates do not consume slots',async()=>{
  const f=await autonomousFixture();
  try {
    const targets:Entity[]=[];
    for(let i=1;i<=28;i++) {await f.launch(i,addr(i));targets.push(parseTarget(addr(i)));}
    await Promise.all(targets.map((target,i)=>arm(f,1000+i,PRINCIPAL,target)));
    assert.equal((await listWatches(f.db,PRINCIPAL)).length,25);
    assert.equal(await count(f.db,'rat_v1_watches','enabled=1'),25);
    await Promise.all(Array.from({length:2},(_,i)=>arm(f,2000+i,PRINCIPAL,targets[0]!)));
    assert.equal(await count(f.db,'rat_v1_watches','enabled=1'),25);
  } finally {f.db.close();}
});

test('controlled activation scopes autonomous commands to one private tester and preserves legacy bot behavior',async()=>{
  const f=await autonomousFixture();
  try {
    f.env.BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED='false';
    (f.env as typeof f.env & {BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID?:string}).BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID='77';

    await f.send('/watches',{userId:77,chatId:77,updateId:7100});
    assert.match(f.sent.at(-1)!.text,/watch list \(FREE: 25\)/);

    await f.send('/watches',{userId:88,chatId:88,updateId:7101});
    assert.match(f.sent.at(-1)!.text,/no watched creator addresses yet/);
    assert.doesNotMatch(f.sent.at(-1)!.text,/FREE: 25/);

    (f.env as typeof f.env & {BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID?:string}).BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID='invalid';
    await f.send('/watches',{userId:77,chatId:77,updateId:7102});
    assert.match(f.sent.at(-1)!.text,/no watched creator addresses yet/);
  } finally {f.db.close();}
});

test('private owner isolation and webhook authentication reject groups, forged authority and callbacks',async()=>{
  const f=await autonomousFixture();
  try {
    await arm(f);
    assert.equal((await listWatches(f.db,{userId:88,chatId:88})).length,0);
    await f.send(`/unwatch ${CREATOR}`,{userId:88,chatId:77});
    await f.send(`/watch ${CREATOR}`,{userId:77,chatId:-99,type:'group'});
    assert.equal((await f.send(`/unwatch ${CREATOR}`,{secret:'wrong'})).status,401);
    assert.equal((await listWatches(f.db,PRINCIPAL)).length,1);
    assert.equal(f.sent.length,0);
  } finally {f.db.close();}
});

test('fresh watch source rejects wrong chain, stale head and missing hash',async()=>{
  const f=await autonomousFixture();
  try {
    for(const head of [
      {chainId:5042,block:102n,hash:hash(102),timestampMs:f.now()},
      {chainId:4663,block:99n,hash:hash(99),timestampMs:f.now()},
      {chainId:4663,block:102n,hash:hash(102),timestampMs:f.now()-61000},
      {chainId:4663,block:102n,hash:'',timestampMs:f.now()}
    ]) await assert.rejects(mutateWatch(f.db,PRINCIPAL,500,subject(),'WATCH',FREE_CAPACITY,f.now(),
      {...f.source,head:async()=>head}),/SOURCE_UNAVAILABLE/);
    assert.equal(await count(f.db,'rat_v1_watches'),0);
  } finally {f.db.close();}
});

test('historical/backfilled or other-chain events never masquerade as future alerts',async()=>{
  const f=await autonomousFixture();
  try {
    await arm(f); f.advance();
    await f.launch(101); await f.launch(102); await f.launch(105,CREATOR,5042);
    await f.checkpoint(105); await f.cycle();
    assert.equal(await count(f.db,'rat_v1_outbox'),0); assert.equal(f.sent.length,0);
    // Delayed ingestion alone is not evidence of event recency.
    await f.launch(99); await f.cycle(); assert.equal(f.sent.length,0);
  } finally {f.db.close();}
});

test('future event fans out shared finding once per owner; queue replay and concurrent delivery never duplicate',async()=>{
  const f=await autonomousFixture();
  try {
    await arm(f,1000); await arm(f,1001,{userId:88,chatId:88});
    f.advance(); await f.launch(105); await f.checkpoint(105);
    assert.equal(await enqueueFindings(f.db,f.now()),2);
    assert.equal(await enqueueFindings(f.db,f.now()),0);
    assert.equal(await count(f.db,'rat_v1_cases',"json_extract(receipt_json,'$.claim')='CREATOR_LAUNCH_OBSERVED'"),1);
    await Promise.all([1,2,3].map(()=>deliverFindings(f.db,f.source,'fixture:token',f.fakeFetch,f.now)));
    await f.cycle(); assert.equal(f.sent.length,2);
    assert.equal(await count(f.db,'rat_v1_outbox',"state='SENT' AND attempt_count=1 AND telegram_message_id IS NOT NULL"),2);
    assert.ok(f.sent.every(s=>s.text.startsWith('🐀 FOUND SOMETHING.')));
  } finally {f.db.close();}
});

test('ambiguous Telegram network response is held UNKNOWN and never resent',async()=>{
  const f=await autonomousFixture();
  try {
    await arm(f);f.advance();await f.launch(105);await f.checkpoint(105);
    let sends=0;
    await f.cycle(async()=>{sends++;throw new Error('accepted by Telegram but connection lost');});
    await f.cycle(async()=>{sends++;return Response.json({ok:true,result:{message_id:1}});});
    assert.equal(sends,1);assert.equal(await count(f.db,'rat_v1_outbox',"state='UNKNOWN' AND attempt_count=1"),1);
  } finally {f.db.close();}
});

test('unwatch cancels queued work and suppresses the next future event',async()=>{
  const f=await autonomousFixture();
  try {
    await arm(f); f.advance();await f.launch(105);await f.checkpoint(105);await enqueueFindings(f.db,f.now());
    await remove(f);await f.cycle(); f.advance();await f.launch(110);await f.checkpoint(110);await f.cycle();
    assert.equal(f.sent.length,0);assert.equal(await count(f.db,'rat_v1_outbox',"state='CANCELLED'"),1);
  } finally {f.db.close();}
});

test('rewind cancels pending work; sent receipts survive but WHY fails when canonical evidence disappears',async()=>{
  const f=await autonomousFixture();
  try {
    await arm(f); f.advance();const future=await f.launch(105);await f.checkpoint(105);
    await enqueueFindings(f.db,f.now());await f.store.rewindFromBlock(105n);
    assert.equal(await count(f.db,'rat_v1_outbox',"state='CANCELLED'"),1);
    await f.checkpoint(100);await f.cycle();assert.equal(f.sent.length,0);
    f.advance();await f.launch(110);await f.checkpoint(110);await f.cycle();
    const outbox=await f.db.prepare("SELECT case_id FROM rat_v1_outbox WHERE state='SENT'").first<{case_id:string}>();
    assert.ok(outbox);await f.store.rewindFromBlock(110n);await f.checkpoint(100);
    await assert.rejects(why(f.db,outbox.case_id,f.now()),/EVIDENCE_UNAVAILABLE/);
    assert.equal(await count(f.db,'rat_v1_outbox',"state='SENT'"),1);
    assert.ok(future.launchId);
  } finally {f.db.close();}
});

test('boundary reorg suspends watch; event reorg blocks delivery',async()=>{
  for(const changedBlock of [102,105]) {
    const f=await autonomousFixture();
    try {
      await arm(f);f.advance();await f.launch(105);await f.checkpoint(110);
      f.replacedHashes.set(changedBlock,hash(999));await f.cycle();
      assert.equal(f.sent.length,0);
      if(changedBlock===102) assert.equal((await listWatches(f.db,PRINCIPAL)).length,0);
    } finally {f.db.close();}
  }
});

test('stale or failed runtime never authorizes DIG, watch or an alert',async()=>{
  const f=await autonomousFixture();
  try {
    await arm(f);f.advance();await f.launch(105);await f.checkpoint(105);f.advance(180001);
    await assert.rejects(dig(f.db,subject(),f.now()),/INDEX_UNAVAILABLE/);
    assert.equal((await f.cycle()).retry,1);assert.equal(f.sent.length,0);
  } finally {f.db.close();}
});

test('FREE capacity is independent of any HOLDER claim; metering is atomic and replay-safe',async()=>{
  const f=await autonomousFixture();
  try {
    assert.deepEqual(await new FreeEntitlements().resolve({...PRINCIPAL,profile:'HOLDER'} as typeof PRINCIPAL),FREE_CAPACITY);
    const before=await dig(f.db,subject(),f.now());
    const results=await Promise.all(Array.from({length:40},(_,i)=>reserveDig(f.db,PRINCIPAL,5000+i,f.now(),FREE_CAPACITY)));
    assert.equal(results.filter(Boolean).length,30);
    assert.equal(await reserveDig(f.db,PRINCIPAL,5000,f.now(),FREE_CAPACITY),true);
    assert.equal(await reserveDig(f.db,{userId:88,chatId:88},5000,f.now(),FREE_CAPACITY),false);
    assert.deepEqual(await dig(f.db,subject(),f.now()),before);
    assert.equal(attentionDecision(false,true),'IGNORE');assert.equal(attentionDecision(true,false),'REMEMBER');
    assert.equal(attentionDecision(true,true),'ALERT');
  } finally {f.db.close();}
});

test('additive migration repeats on deployed schema; missing migration fails closed',async()=>{
  const migration=readFileSync(new URL('../cloudflare/migrations/20260929_autonomous_rat_v1.sql',import.meta.url),'utf8');
  const db=new D1CompatDatabase();
  try {
    const old=D1_SCHEMA_SQL.replace(migration.trim(),'');
    assert.notEqual(old,D1_SCHEMA_SQL);await db.exec(old);
    await assert.rejects(listWatches(db,PRINCIPAL),/no such table/);
    await db.exec(migration);await db.exec(migration);
    assert.deepEqual(await listWatches(db,PRINCIPAL),[]);
  } finally {db.close();}
});

test('H1: identical WATCH is a no-op and leaves UNWATCH available at exhaustion',async()=>{
  const f=await autonomousFixture();
  try {
    let heads=0;
    const source={...f.source,head:async()=>{heads++;return f.source.head();}};
    for(let i=0;i<30;i++) await mutateWatch(f.db,PRINCIPAL,3000+i,subject(),'WATCH',FREE_CAPACITY,f.now(),source);
    await mutateWatch(f.db,PRINCIPAL,3030,subject(),'WATCH',FREE_CAPACITY,f.now(),source);
    assert.equal(heads,1);assert.equal(await count(f.db,'rat_v1_dig_requests'),1);
    await remove(f,4000);assert.equal((await listWatches(f.db,PRINCIPAL)).length,0);
    await f.send(`/watch ${CREATOR}`,{updateId:4001});assert.match(f.sent.at(-1)!.text,/watch armed/);
  } finally {f.db.close();}
});

test('H1: global cap gates concurrent WATCH principals before RPC',async()=>{
  const f=await autonomousFixture();
  try {
    const capacity={...FREE_CAPACITY,globalDigsPerDay:2};let heads=0;
    const source={...f.source,head:async()=>{heads++;return f.source.head();}};
    const results=await Promise.allSettled(Array.from({length:8},(_,i)=>mutateWatch(f.db,
      {userId:100+i,chatId:100+i},5000+i,subject(),'WATCH',capacity,f.now(),source)));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,2);assert.equal(heads,2);
    assert.equal(await count(f.db,'rat_v1_dig_requests'),2);
  } finally {f.db.close();}
});

test('H2: delayed event above a stale head but before opt-in never alerts; invalid times fail closed',async()=>{
  for(const eventTime of ['PAST','EQUAL','MALFORMED','FUTURE'] as const) {
    const f=await autonomousFixture();
    try {
      const creation=f.now();await arm(f);f.advance();await f.launch(105);await f.checkpoint(110);
      f.blockTimes.set(105,eventTime==='PAST'?creation-1000:eventTime==='EQUAL'?creation:
        eventTime==='MALFORMED'?Number.NaN:f.now()+16000);
      await f.cycle();assert.equal(f.sent.length,0);
      assert.equal(await count(f.db,'rat_v1_outbox',"state='CANCELLED' AND attempt_count=0"),1);
    } finally {f.db.close();}
  }
});

test('H2: future event time is recorded and private watch timing is owner-only',async()=>{
  const f=await autonomousFixture();
  try {
    const creation=f.now();await arm(f);f.advance();await f.launch(105);await f.checkpoint(105);await f.cycle();
    const receipt=await f.db.prepare('SELECT case_id,event_timestamp_ms,watch_created_at_ms FROM rat_v1_outbox')
      .first<{case_id:string;event_timestamp_ms:number;watch_created_at_ms:number}>();
    assert.ok(receipt);assert.equal(receipt.watch_created_at_ms,creation);assert.ok(receipt.event_timestamp_ms>creation);
    await f.send(`/why ${receipt.case_id}`);assert.match(f.sent.at(-1)!.text,/event time > watch creation/);
    await f.send(`/why ${receipt.case_id}`,{userId:88});
    assert.doesNotMatch(f.sent.at(-1)!.text,/private attention|watch creation|user.?77/);
    assert.match(f.sent.at(-1)!.text,/OBSERVED:/);
  } finally {f.db.close();}
});

test('crash after Telegram success before receipt commit stays SENDING and cannot resend',async()=>{
  const f=await autonomousFixture();
  try {
    await arm(f);f.advance();await f.launch(105);await f.checkpoint(105);await enqueueFindings(f.db,f.now());
    const failing=(s:D1PreparedStatementLike):D1PreparedStatementLike=>({
      bind:(...values)=>failing(s.bind(...values)),run:async()=>{throw new Error('SIMULATED_D1_RECEIPT_FAILURE');},
      first:()=>s.first(),all:()=>s.all()
    });
    const db:D1DatabaseLike={
      prepare:(sql)=>sql.includes('SET state=?,telegram_message_id=?')?failing(f.db.prepare(sql)):f.db.prepare(sql),
      batch:(statements)=>f.db.batch(statements),exec:(sql)=>f.db.exec(sql)
    };
    await assert.rejects(deliverFindings(db,f.source,'fixture:token',f.fakeFetch,f.now),/SIMULATED_D1/);
    assert.equal(await count(f.db,'rat_v1_outbox',"state='SENDING' AND attempt_count=1"),1);
    await f.cycle();assert.equal(f.sent.length,1);
  } finally {f.db.close();}
});

test('callback updates are ignored and disabled S1 does not consume its watches',async()=>{
  const f=await autonomousFixture();
  try {
    const response=await handleWorkerRequest(new Request('https://fixture.invalid/telegram/webhook',{
      method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':'fixture-secret'},
      body:JSON.stringify({update_id:9090,callback_query:{id:'forged',from:{id:77},data:`watch:${CREATOR}`}})
    }),f.env,{now:f.now,externalFetch:f.fakeFetch,watchSource:f.source});
    assert.equal(response.status,200);assert.equal(await count(f.db,'rat_v1_watches'),0);
    await arm(f);f.advance();await f.launch(105);await f.checkpoint(105);
    f.env.BINRAT_AUTONOMOUS_RAT_ENABLED='false';await f.cycle();
    assert.equal(f.sent.length,0);assert.equal(await count(f.db,'rat_v1_outbox'),0);
  } finally {f.db.close();}
});

test('five-reference receipt rendering fits Telegram without truncating evidence',async()=>{
  const f=await autonomousFixture();
  try {
    for(let block=90;block<95;block++)await f.launch(block);
    const receipt=await dig(f.db,subject(),f.now());assert.equal(receipt.evidenceRefs.length,5);
    for(const mode of ['DIG','WHY','ALERT'] as const) assert.ok(renderReceipt(receipt,mode).length<4096);
  } finally {f.db.close();}
});

test('deterministic DIG → WATCH → future ALERT → WHY demo closes replay and unwatch invariants',async()=>{
  const {f,caseId}=await runAutonomousDemo();
  try {
    assert.equal(f.sent.filter(m=>m.text.startsWith('🐀 FOUND SOMETHING.')).length,1);
    assert.equal(await count(f.db,'rat_v1_outbox',"attention='ALERT' AND state='SENT' AND attempt_count=1"),1);
    assert.equal(await count(f.db,'rat_v1_cases',"json_extract(receipt_json,'$.claim')='CREATOR_LAUNCH_OBSERVED'"),1);
    assert.match(f.sent.find(m=>m.text.includes('receipts, not guesses'))!.text,/DERIVED \(private attention\)/);
    assert.ok(f.sent.some(m=>m.text.includes(caseId)));
    if(process.env.BINRAT_PRINT_FIXTURE==='true') console.log(f.transcript.join('\n\n'));
  } finally {f.db.close();}
});
