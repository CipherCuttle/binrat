import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import type { D1DatabaseLike } from '../src/cloudflare/d1Types.js';
import { handleWorkerRequest } from '../src/cloudflare/worker.js';
import { encodeCallback } from '../src/telegram/ui/callback.js';
import { consumeExactDigPrompt, loadActiveDigPrompt, replaceDigPrompt } from '../src/telegram/ui/prompts.js';
import { D1CompatDatabase } from './support/d1Compat.js';
import { CREATOR, autonomousFixture } from './support/autonomousFixture.js';

interface Call { method:string; body:Record<string,unknown> }

function uiEnv(f:Awaited<ReturnType<typeof autonomousFixture>>) {
  return Object.assign(f.env,{
    BINRAT_TELEGRAM_UI_V2_ENABLED:'true',
    BINRAT_TELEGRAM_MEDIA_ENABLED:(f.env as {BINRAT_TELEGRAM_MEDIA_ENABLED?:string}).BINRAT_TELEGRAM_MEDIA_ENABLED ?? 'false',
    BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED:'true',
    CAPABILITY_MANIFEST_JSON:JSON.stringify({schemaVersion:'binrat.capability-manifest/0.1',capabilities:{telegramRatV0:{engineeringStatus:'BUILDING',publicStatus:'NOT_PUBLIC_LIVE_AUTHORIZED'}},launchAuthorization:{status:'BLOCKED',marketingAuthorized:false,launchAuthorized:false,tokenState:'NOT_LAUNCHED'},invariant:'Degen decides attention. Receipts decide truth.'})
  });
}

function telegram(calls:Call[], options:{rejectPrompt?:boolean; ambiguousPrompt?:boolean; failFinalEdit?:boolean}={}) {
  let promptId=800;
  return async (input:RequestInfo|URL, init?:RequestInit):Promise<Response> => {
    const method=String(input).split('/').at(-1)!;
    const body=JSON.parse(String(init?.body ?? '{}')) as Record<string,unknown>;
    calls.push({method,body});
    if (method === 'sendMessage' && body.reply_markup && options.rejectPrompt) return Response.json({ok:false,description:'Bad Request'},{status:400});
    if (method === 'sendMessage' && body.reply_markup && options.ambiguousPrompt) return Response.json({ok:false},{status:500});
    // MEDIA OFF cards in this fixture are text messages, so Telegram definitively
    // rejects a caption edit before the client falls back to editMessageText.
    if (method === 'editMessageCaption') return Response.json({ok:false,description:'Bad Request: message is not a photo'},{status:400});
    if (method === 'editMessageText' && options.failFinalEdit && /CASE/.test(String(body.text))) return Response.json({ok:false},{status:500});
    return Response.json({ok:true,result:{message_id:method === 'sendMessage' && body.reply_markup ? promptId++ : 700}});
  };
}

async function callback(f:Awaited<ReturnType<typeof autonomousFixture>>, fetchImpl:typeof fetch, updateId:number, cardId=600, userId=77, db?:D1DatabaseLike) {
  return handleWorkerRequest(new Request('https://fixture.invalid/telegram/webhook',{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':'fixture-secret'},body:JSON.stringify({update_id:updateId,callback_query:{id:`cb-${updateId}`,from:{id:userId},data:encodeCallback({action:'DIG_PROMPT'}),message:{message_id:cardId,chat:{id:userId,type:'private'}}}})}),{...uiEnv(f),...(db ? {DB:db} : {})},{now:f.now,externalFetch:fetchImpl,watchSource:f.source});
}
async function reply(f:Awaited<ReturnType<typeof autonomousFixture>>, fetchImpl:typeof fetch, updateId:number, text:string, promptId:number, options:{userId?:number;chatId?:number;type?:string;replyId?:number;db?:D1DatabaseLike}={}) {
  const userId=options.userId ?? 77,chatId=options.chatId ?? userId;
  return handleWorkerRequest(new Request('https://fixture.invalid/telegram/webhook',{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':'fixture-secret'},body:JSON.stringify({update_id:updateId,message:{message_id:701,chat:{id:chatId,type:options.type ?? 'private'},from:{id:userId},text,reply_to_message:{message_id:options.replyId ?? promptId}}})}),{...uiEnv(f),...(options.db ? {DB:options.db} : {})},{now:f.now,externalFetch:fetchImpl,watchSource:f.source});
}
async function digCount(f:Awaited<ReturnType<typeof autonomousFixture>>) { return (await f.db.prepare('SELECT COUNT(*) AS n FROM rat_v1_dig_requests').first<{n:number}>())!.n; }

test('DIG callback acknowledges first, creates one exact ForceReply, and media OFF never uses artwork', async () => {
  const f=await autonomousFixture(); const calls:Call[]=[];
  try {
    const response=await callback(f,telegram(calls) as typeof fetch,1000);
    assert.equal(response.status,200);
    assert.equal(calls[0]!.method,'answerCallbackQuery');
    assert.ok(calls.findIndex(c=>c.method==='editMessageText') < calls.findIndex(c=>c.method==='sendMessage'));
    assert.deepEqual(calls.find(c=>c.method==='sendMessage')!.body.reply_markup,{force_reply:true,input_field_placeholder:'Deployer address'});
    assert.equal((await loadActiveDigPrompt(f.db,77,77,f.now()))?.promptMessageId,800);
    assert.equal(calls.some(c=>JSON.stringify(c.body).includes('/assets/telegram/')),false);
  } finally {f.db.close();}
});

test('only a same-principal exact reply executes DIG once; ordinary text and malformed input do not spend a DIG', async () => {
  const f=await autonomousFixture(); const calls:Call[]=[]; const fetchImpl=telegram(calls) as typeof fetch;
  try {
    await callback(f,fetchImpl,1010);
    await reply(f,fetchImpl,1011,'hello rat',800,{replyId:799});
    assert.equal(await digCount(f),0);
    await reply(f,fetchImpl,1012,'not an address',800);
    assert.equal(await digCount(f),0);
    assert.equal((await loadActiveDigPrompt(f.db,77,77,f.now()))?.promptMessageId,800);
    await reply(f,fetchImpl,1013,CREATOR,800);
    assert.equal(await digCount(f),1);
    assert.equal(await loadActiveDigPrompt(f.db,77,77,f.now()),null);
    await reply(f,fetchImpl,1014,CREATOR,800);
    assert.equal(await digCount(f),1);
    assert.equal(calls.filter(c=>c.method==='editMessageText' && /RUMMAGING/.test(String(c.body.text))).length,1);
  } finally {f.db.close();}
});

test('wrong user/chat/group and expired prompt cannot consume a DIG', async () => {
  const f=await autonomousFixture(); const calls:Call[]=[]; const fetchImpl=telegram(calls) as typeof fetch;
  try {
    await callback(f,fetchImpl,1020);
    await reply(f,fetchImpl,1021,CREATOR,800,{userId:88,chatId:88});
    await reply(f,fetchImpl,1022,CREATOR,800,{userId:77,chatId:-100,type:'group'});
    assert.equal(await digCount(f),0);
    f.advance(5*60_000+1);
    await reply(f,fetchImpl,1023,CREATOR,800);
    assert.equal(await digCount(f),0);
    assert.equal(await loadActiveDigPrompt(f.db,77,77,f.now()),null);
  } finally {f.db.close();}
});

test('a second DIG deterministically supersedes the first prompt and final card edit failure cannot re-execute', async () => {
  const f=await autonomousFixture(); const calls:Call[]=[]; const fetchImpl=telegram(calls,{failFinalEdit:true}) as typeof fetch;
  try {
    await callback(f,fetchImpl,1030,600);
    await callback(f,fetchImpl,1031,600);
    assert.equal((await loadActiveDigPrompt(f.db,77,77,f.now()))?.promptMessageId,801);
    await reply(f,fetchImpl,1032,CREATOR,800);
    assert.equal(await digCount(f),0);
    assert.equal((await reply(f,fetchImpl,1033,CREATOR,801)).status,503);
    assert.equal(await digCount(f),1);
    assert.equal((await reply(f,fetchImpl,1033,CREATOR,801)).status,200);
    assert.equal(await digCount(f),1);
  } finally {f.db.close();}
});

test('definitive and ambiguous prompt sends create no state or research authority', async () => {
  for (const options of [{rejectPrompt:true},{ambiguousPrompt:true}]) {
    const f=await autonomousFixture(); const calls:Call[]=[];
    try {
      const response=await callback(f,telegram(calls,options) as typeof fetch,1040);
      assert.equal(response.status,200);
      assert.equal(await loadActiveDigPrompt(f.db,77,77,f.now()),null);
      assert.equal(await digCount(f),0);
      assert.equal(calls.filter(c=>c.method==='sendMessage').length,1);
    } finally {f.db.close();}
  }
});

test('Telegram-success/D1-prompt-receipt failure terminally makes the visible prompt inert', async () => {
  const f=await autonomousFixture(); const calls:Call[]=[];
  const failingDb: D1DatabaseLike={
    prepare(sql) {
      if (sql.includes('INSERT INTO rat_ui_prompts')) return {bind:()=>({run:async()=>{ throw new Error('D1_PROMPT_WRITE'); }})} as unknown as ReturnType<D1DatabaseLike['prepare']>;
      return f.db.prepare(sql);
    }, batch:s=>f.db.batch(s), exec:s=>f.db.exec(s)
  };
  try {
    const response=await callback(f,telegram(calls) as typeof fetch,1045,600,77,failingDb);
    assert.equal(response.status,200);
    assert.equal(calls.filter(c=>c.method==='sendMessage').length,1);
    assert.equal(await loadActiveDigPrompt(f.db,77,77,f.now()),null);
    assert.equal(await digCount(f),0);
  } finally {f.db.close();}
});

test('a prompt receipt fences a replay when callback ledger completion fails after Telegram success', async () => {
  const f=await autonomousFixture(); const calls:Call[]=[]; let failLedger=true;
  const flakyLedgerDb: D1DatabaseLike={
    prepare(sql) {
      if (failLedger && sql.includes("UPDATE telegram_update_receipts") && sql.includes("state = 'REPLIED'")) {
        return {bind:()=>({run:async()=>{ throw new Error('D1_LEDGER_WRITE'); }})} as unknown as ReturnType<D1DatabaseLike['prepare']>;
      }
      return f.db.prepare(sql);
    }, batch:s=>f.db.batch(s), exec:s=>f.db.exec(s)
  };
  try {
    assert.equal((await callback(f,telegram(calls) as typeof fetch,1048,600,77,flakyLedgerDb)).status,503);
    assert.equal(calls.filter(c=>c.method==='sendMessage').length,1);
    assert.equal((await loadActiveDigPrompt(f.db,77,77,f.now()))?.sourceUpdateId,1048);
    failLedger=false;
    assert.equal((await callback(f,telegram(calls) as typeof fetch,1048,600,77,flakyLedgerDb)).status,200);
    assert.equal(calls.filter(c=>c.method==='sendMessage').length,1);
  } finally {f.db.close();}
});

test('newer DIG prompt wins when an older callback is retried after its ledger write failed', async () => {
  const f=await autonomousFixture(); const calls:Call[]=[]; const fetchImpl=telegram(calls) as typeof fetch;
  let failLedger=true;
  const flakyLedgerDb: D1DatabaseLike={
    prepare(sql) {
      if (failLedger && sql.includes("UPDATE telegram_update_receipts") && sql.includes("state = 'REPLIED'")) {
        return {bind:()=>({run:async()=>{ throw new Error('D1_LEDGER_WRITE'); }})} as unknown as ReturnType<D1DatabaseLike['prepare']>;
      }
      return f.db.prepare(sql);
    }, batch:s=>f.db.batch(s), exec:s=>f.db.exec(s)
  };
  try {
    // A created prompt 800 but its terminal ledger write failed, so Telegram may retry A.
    assert.equal((await callback(f,fetchImpl,1060,600,77,flakyLedgerDb)).status,503);
    assert.equal((await loadActiveDigPrompt(f.db,77,77,f.now()))?.sourceUpdateId,1060);
    failLedger=false;
    // B legitimately replaces A with prompt 801.
    assert.equal((await callback(f,fetchImpl,1061,600,77,flakyLedgerDb)).status,200);
    assert.equal((await loadActiveDigPrompt(f.db,77,77,f.now()))?.promptMessageId,801);
    assert.equal((await loadActiveDigPrompt(f.db,77,77,f.now()))?.sourceUpdateId,1061);
    // Retry A: no third ForceReply, and B remains authoritative.
    assert.equal((await callback(f,fetchImpl,1060,600,77,flakyLedgerDb)).status,200);
    assert.equal(calls.filter(c=>c.method==='sendMessage').length,2);
    assert.equal((await loadActiveDigPrompt(f.db,77,77,f.now()))?.promptMessageId,801);
    assert.equal((await loadActiveDigPrompt(f.db,77,77,f.now()))?.sourceUpdateId,1061);
    await reply(f,fetchImpl,1062,CREATOR,800);
    assert.equal(await digCount(f),0);
    await reply(f,fetchImpl,1063,CREATOR,801);
    assert.equal(await digCount(f),1);
  } finally {f.db.close();}
});

test('media ON edits inquisitive → digging → CASE, while final ledger failure cannot re-execute DIG', async () => {
  const f=await autonomousFixture(); const calls:Call[]=[]; const fetchImpl=telegram(calls) as typeof fetch;
  let failLedger=false;
  const ledgerFailingDb: D1DatabaseLike={
    prepare(sql) {
      if (failLedger && sql.includes("UPDATE telegram_update_receipts") && sql.includes("state = 'REPLIED'")) {
        return {bind:()=>({run:async()=>{ throw new Error('D1_LEDGER_WRITE'); }})} as unknown as ReturnType<D1DatabaseLike['prepare']>;
      }
      return f.db.prepare(sql);
    }, batch:s=>f.db.batch(s), exec:s=>f.db.exec(s)
  };
  try {
    const env=uiEnv(f); env.BINRAT_TELEGRAM_MEDIA_ENABLED='true';
    await callback(f,fetchImpl,1050,600,77,ledgerFailingDb);
    failLedger=true;
    assert.equal((await reply(f,fetchImpl,1051,CREATOR,800,{db:ledgerFailingDb})).status,503);
    assert.equal(await digCount(f),1);
    failLedger=false;
    assert.equal((await reply(f,fetchImpl,1051,CREATOR,800)).status,200);
    assert.equal(await digCount(f),1);
    const mediaEdits=calls.filter(c=>c.method==='editMessageMedia').map(c=>String((c.body.media as {caption?:string}|undefined)?.caption));
    assert.ok(mediaEdits.some(text=>text.includes('GIVE ME A DEPLOYER ADDRESS')));
    assert.ok(mediaEdits.some(text=>text.includes('RUMMAGING')));
    assert.ok(mediaEdits.some(text=>text.includes('CASE')));
  } finally {f.db.close();}
});

test('prompt storage is additive, rerunnable, private, expires, and DELETE RETURNING is one-use', async () => {
  const migration=readFileSync(new URL('../cloudflare/migrations/20260930_telegram_ui_v2_prompts.sql',import.meta.url),'utf8');
  const db=new D1CompatDatabase();
  try {
    const old=D1_SCHEMA_SQL.replace(migration.trim(),'');
    await db.exec(old);
    await assert.rejects(loadActiveDigPrompt(db,77,77,1_000),/no such table/);
    await db.exec(migration); await db.exec(migration);
    assert.equal(await replaceDigPrompt(db,{chatId:77,userId:77,sourceUpdateId:101,cardMessageId:6,promptMessageId:7,createdAtMs:1_000}),'APPLIED');
    assert.equal(await replaceDigPrompt(db,{chatId:77,userId:77,sourceUpdateId:100,cardMessageId:8,promptMessageId:8,createdAtMs:1_001}),'STALE');
    assert.equal((await loadActiveDigPrompt(db,77,77,1_001))?.sourceUpdateId,101);
    assert.equal(await replaceDigPrompt(db,{chatId:77,userId:77,sourceUpdateId:102,cardMessageId:9,promptMessageId:9,createdAtMs:1_002}),'APPLIED');
    assert.equal((await loadActiveDigPrompt(db,77,77,1_002))?.sourceUpdateId,102);
    await replaceDigPrompt(db,{chatId:77,userId:77,sourceUpdateId:103,cardMessageId:6,promptMessageId:7,createdAtMs:1_000});
    assert.equal((await consumeExactDigPrompt(db,77,77,7,1_000))?.cardMessageId,6);
    assert.equal(await consumeExactDigPrompt(db,77,77,7,1_000),null);
    await replaceDigPrompt(db,{chatId:77,userId:77,sourceUpdateId:2,cardMessageId:6,promptMessageId:8,createdAtMs:1_000});
    assert.equal(await loadActiveDigPrompt(db,77,77,1_000+5*60_000),null);
  } finally {db.close();}
});
