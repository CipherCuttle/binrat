import assert from 'node:assert/strict';
import test from 'node:test';
import { handleWorkerRequest } from '../src/cloudflare/worker.js';
import { autonomousFixture } from './support/autonomousFixture.js';
import { CREATOR } from './support/autonomousFixture.js';
import { dig } from '../src/autonomous/evidence.js';
import { discoverRats } from '../src/autonomous/rats.js';
import { encodeCallback } from '../src/telegram/ui/callback.js';
import type { D1DatabaseLike } from '../src/cloudflare/d1Types.js';
import { addr } from './support/autonomousFixture.js';

function callbackRequest(updateId:number, from:number, chatId:number, type:string, data:string, secret='fixture-secret') {
  return new Request('https://fixture.invalid/telegram/webhook',{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':secret},body:JSON.stringify({update_id:updateId,callback_query:{id:`cb-${updateId}`,from:{id:from},data,message:{message_id:91,chat:{id:chatId,type},from:{id:77}}}})});
}

test('staged next webhook secret is accepted during rotation while unrelated secrets are rejected', async () => {
  const f=await autonomousFixture(); const calls:string[]=[];
  try {
    Object.assign(f.env,{BINRAT_TELEGRAM_UI_V2_ENABLED:'true',TELEGRAM_WEBHOOK_SECRET_NEXT:'next-fixture-secret'});
    const api:typeof fetch=async (url) => { const method=String(url).split('/').at(-1)!; calls.push(method);
      if(method==='answerCallbackQuery') return Response.json({ok:true,result:true});
      if(method==='editMessageCaption') return Response.json({ok:true,result:{message_id:91}});
      throw new Error('UNEXPECTED_TELEGRAM_'+method); };
    const rotated=await handleWorkerRequest(callbackRequest(879,77,77,'private','br2:h','next-fixture-secret'),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(rotated.status,200); assert.deepEqual(calls,['answerCallbackQuery','editMessageCaption']);
    const rejected=await handleWorkerRequest(callbackRequest(878,77,77,'private','br2:h','wrong-secret'),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(rejected.status,401);
  } finally { f.db.close(); }
});

test('callback acknowledgement precedes card edit and controlled actor is re-authorized', async () => {
  const f=await autonomousFixture(); const calls:string[]=[];
  try {
    Object.assign(f.env,{BINRAT_TELEGRAM_UI_V2_ENABLED:'true',BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED:'false',BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID:'77'});
    const api:typeof fetch=async (url) => { const method=String(url).split('/').at(-1)!; calls.push(method);
      if(method==='answerCallbackQuery') return Response.json({ok:true,result:true});
      if(method==='editMessageCaption') return Response.json({ok:true,result:{message_id:91}});
      throw new Error('UNEXPECTED_TELEGRAM_'+method); };
    const accepted=await handleWorkerRequest(callbackRequest(880,77,77,'private','br2:h'),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(accepted.status,200); assert.deepEqual(calls,['answerCallbackQuery','editMessageCaption']);
    calls.length=0;
    const denied=await handleWorkerRequest(callbackRequest(881,88,77,'private','br2:h'),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(denied.status,200); assert.deepEqual(calls,['answerCallbackQuery']);
    calls.length=0;
    const group=await handleWorkerRequest(callbackRequest(882,77,-100,'group','br2:h'),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(group.status,200); assert.deepEqual(calls,['answerCallbackQuery']);
  } finally { f.db.close(); }
});

test('FULL callback sends the canonical legacy receipt without truncating the card summary', async () => {
  const f=await autonomousFixture(); const calls:string[]=[];
  try {
    Object.assign(f.env,{BINRAT_TELEGRAM_UI_V2_ENABLED:'true'});
    const receipt=await dig(f.db,{chainId:4663,entityType:'CREATOR',entityId:CREATOR},f.now());
    const api:typeof fetch=async (url) => { const method=String(url).split('/').at(-1)!; calls.push(method);
      if(method==='answerCallbackQuery'||method==='editMessageCaption') return Response.json({ok:true,result:method==='editMessageCaption'?{message_id:91}:true});
      if(method==='sendMessage') return Response.json({ok:true,result:{message_id:92}});
      throw new Error('UNEXPECTED_TELEGRAM_'+method); };
    const response=await handleWorkerRequest(callbackRequest(883,77,77,'private',`br2:f:${receipt.shareId}`),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(response.status,200); assert.deepEqual(calls,['answerCallbackQuery','editMessageCaption','sendMessage']);
  } finally { f.db.close(); }
});

test('candidate whole-bot gate overrides a different autonomous tester for callbacks', async () => {
  const f=await autonomousFixture(); const calls:string[]=[];
  try {
    Object.assign(f.env,{BINRAT_TELEGRAM_UI_V2_ENABLED:'true',BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED:'false',BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID:'77',RAT_CANDIDATE_ALLOWED_USER_ID:'88'});
    const api:typeof fetch=async (url) => { calls.push(String(url).split('/').at(-1)!); return Response.json({ok:true,result:true}); };
    const response=await handleWorkerRequest(callbackRequest(884,77,77,'private','br2:r'),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(response.status,200); assert.deepEqual(calls,['answerCallbackQuery']);
    const watches=await f.db.prepare('SELECT COUNT(*) n FROM rat_v1_watches').first<{n:number}>(); assert.equal(watches?.n,0);
  } finally { f.db.close(); }
});

test('callback acknowledgement is attempted before the update ledger claim can fail', async () => {
  const f=await autonomousFixture(); const calls:string[]=[];
  const failingDb:D1DatabaseLike={
    prepare:sql=>f.db.prepare(sql),
    batch:async()=>{ throw new Error('CLAIM_FAILED'); },
    exec:sql=>f.db.exec(sql)
  };
  try {
    Object.assign(f.env,{BINRAT_TELEGRAM_UI_V2_ENABLED:'true'});
    const api:typeof fetch=async (url) => {
      const method=String(url).split('/').at(-1)!; calls.push(method);
      if(method==='answerCallbackQuery') return Response.json({ok:true,result:true});
      throw new Error('UNEXPECTED_'+method);
    };
    const response=await handleWorkerRequest(callbackRequest(8849,77,77,'private','br2:r'),{...f.env,DB:failingDb},{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(response.status,503);
    assert.deepEqual(calls,['answerCallbackQuery']);
  } finally { f.db.close(); }
});

test('callback acknowledgement happens before the D1 rate gate can fail', async () => {
  const f=await autonomousFixture(); const calls:string[]=[];
  const failingDb:D1DatabaseLike={
    prepare(sql) {
      if (sql.includes('INSERT INTO telegram_rate_windows')) {
        return {bind:()=>({run:async()=>{ throw new Error('RATE_GATE_FAILED'); }})} as unknown as ReturnType<D1DatabaseLike['prepare']>;
      }
      return f.db.prepare(sql);
    },
    batch:statements=>f.db.batch(statements),
    exec:sql=>f.db.exec(sql)
  };
  try {
    Object.assign(f.env,{BINRAT_TELEGRAM_UI_V2_ENABLED:'true'});
    const api:typeof fetch=async (url) => {
      const method=String(url).split('/').at(-1)!; calls.push(method);
      if(method==='answerCallbackQuery') return Response.json({ok:true,result:true});
      throw new Error('UNEXPECTED_'+method);
    };
    const response=await handleWorkerRequest(callbackRequest(8850,77,77,'private','br2:r'),{...f.env,DB:failingDb},{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(response.status,503);
    assert.deepEqual(calls,['answerCallbackQuery']);
  } finally { f.db.close(); }
});

test('authorized callbacks are rate-limited before RATS discovery and acknowledge the spinner', async () => {
  const f=await autonomousFixture(); const calls:string[]=[];
  try {
    Object.assign(f.env,{BINRAT_TELEGRAM_UI_V2_ENABLED:'true',TELEGRAM_MAX_MESSAGES_PER_MINUTE:'2'});
    const api:typeof fetch=async (url) => { const method=String(url).split('/').at(-1)!; calls.push(method);
      if(method==='answerCallbackQuery') return Response.json({ok:true,result:true});
      if(method==='editMessageCaption') return Response.json({ok:true,result:{message_id:91}});
      throw new Error('UNEXPECTED_'+method); };
    for (const updateId of [885,886,887]) assert.equal((await handleWorkerRequest(callbackRequest(updateId,77,77,'private','br2:r'),f.env,{now:f.now,externalFetch:api,watchSource:f.source})).status,200);
    assert.deepEqual(calls,['answerCallbackQuery','editMessageCaption','answerCallbackQuery','editMessageCaption','answerCallbackQuery']);
  } finally { f.db.close(); }
});

test('RATS page callback edits the existing message from the persisted snapshot', async () => {
  const f=await autonomousFixture(); const calls:string[]=[];
  try {
    Object.assign(f.env,{BINRAT_TELEGRAM_UI_V2_ENABLED:'true'});
    const other=addr(43); await f.launch(99); await f.launch(98,other); await f.launch(97,other);
    const snapshot=await discoverRats(f.db,f.now()); assert.equal(snapshot.candidates.length,2);
    const api:typeof fetch=async url=>{const method=String(url).split('/').at(-1)!;calls.push(method);return Response.json({ok:true,result:method==='answerCallbackQuery'?true:{message_id:91}});};
    const response=await handleWorkerRequest(callbackRequest(888,77,77,'private',encodeCallback({action:'RATS_PAGE',discoveryId:snapshot.discoveryId,index:1})),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(response.status,200); assert.deepEqual(calls,['answerCallbackQuery','editMessageCaption']);
  } finally { f.db.close(); }
});
