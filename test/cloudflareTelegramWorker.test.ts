import assert from 'node:assert/strict';
import test from 'node:test';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1TelegramLedger } from '../src/cloudflare/telegramLedger.js';
import { handleWorkerRequest } from '../src/cloudflare/worker.js';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { buildObservationReceipt } from '../src/observations/identity.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const manifest = JSON.stringify({
  schemaVersion: 'binrat.capability-manifest/0.1',
  capabilities: {
    telegramRatV0: {
      engineeringStatus: 'BUILDING',
      publicStatus: 'NOT_PUBLIC_LIVE_AUTHORIZED'
    }
  },
  launchAuthorization: {
    status: 'BLOCKED',
    marketingAuthorized: false,
    launchAuthorized: false,
    tokenState: 'NOT_LAUNCHED'
  },
  invariant: 'Degen decides attention. Receipts decide truth.'
});

test('Cloudflare Telegram webhook authenticates and durably ignores while replies are disabled', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  try {
    const env = {
      DB: db,
      TELEGRAM_BOT_TOKEN: '123:secret',
      TELEGRAM_WEBHOOK_SECRET: 'hook-secret',
      TELEGRAM_REPLIES_ENABLED: 'false'
    };
    const response = await handleWorkerRequest(
      telegramRequest(10, '/status', 'hook-secret'),
      env,
      { externalFetch: failFetch, now: () => 1_000 }
    );
    assert.equal(response.status, 200);
    const row = await new D1TelegramLedger(db).get(10);
    assert.equal(row?.state, 'IGNORED');

    const duplicate = await handleWorkerRequest(
      telegramRequest(10, '/status', 'hook-secret'),
      env,
      { externalFetch: failFetch, now: () => 1_001 }
    );
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json() as Record<string, unknown>).duplicate, true);
  } finally {
    db.close();
  }
});

test('Cloudflare Telegram Rat resolves /status locally and persists reply receipt', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db, 5042);
  const runtime = new D1RuntimeStateStore(db, 5042);
  try {
    const launch = await makeLaunch();
    await store.putLaunch(launch);
    await store.putProvenanceFact(await buildProvenanceFact(launch));
    await store.commitCheckpoint({
      blockNumber: launch.blockNumber,
      blockHash: launch.blockHash,
      guardBlockNumber: null,
      guardBlockHash: null
    });
    await runtime.put({
      sourceVerified: true,
      liveCaughtUp: true,
      headBlock: launch.blockNumber + 2n,
      targetBlock: launch.blockNumber,
      observationReady: true,
      historyBackfillComplete: false,
      historyBackfillTargetBlock: launch.blockNumber - 1n,
      lastSyncError: null,
      lastHistoryError: null,
      lastObservationError: null,
      updatedAtMs: Date.now()
    });

    let sentText = '';
    const telegramFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      if (!url.includes('/sendMessage')) throw new Error(`UNEXPECTED_EXTERNAL_FETCH:${url}`);
      const body = JSON.parse(String(init?.body ?? '{}')) as { text?: string };
      sentText = body.text ?? '';
      return new Response(JSON.stringify({ ok: true, result: { message_id: 77 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };

    const response = await handleWorkerRequest(
      telegramRequest(11, '/status', 'hook-secret'),
      {
        DB: db,
        CAPABILITY_MANIFEST_JSON: manifest,
        TELEGRAM_BOT_TOKEN: '123:secret',
        TELEGRAM_WEBHOOK_SECRET: 'hook-secret',
        TELEGRAM_REPLIES_ENABLED: 'true'
      },
      { externalFetch: telegramFetch, now: () => Date.now() }
    );
    assert.equal(response.status, 200);
    assert.match(sentText, /index: READY/);
    assert.match(sentText, /launches indexed: 1/);

    const row = await new D1TelegramLedger(db).get(11);
    assert.equal(row?.state, 'REPLIED');
    assert.equal(row?.telegramMessageId, 77);
    assert.ok(row?.planDigest);
  } finally {
    store.close();
    db.close();
  }
});

test('Cloudflare Telegram rejects the wrong webhook secret before claiming update', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  try {
    const response = await handleWorkerRequest(
      telegramRequest(12, '/status', 'wrong'),
      {
        DB: db,
        TELEGRAM_BOT_TOKEN: '123:secret',
        TELEGRAM_WEBHOOK_SECRET: 'right',
        TELEGRAM_REPLIES_ENABLED: 'true'
      },
      { externalFetch: failFetch, now: () => 1_000 }
    );
    assert.equal(response.status, 401);
    assert.equal(await new D1TelegramLedger(db).get(12), null);
  } finally {
    db.close();
  }
});

function telegramRequest(updateId: number, text: string, secret: string): Request {
  return new Request('https://binrat.example/telegram/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': secret
    },
    body: JSON.stringify({
      update_id: updateId,
      message: {
        message_id: 1,
        chat: { id: 123, type: 'private' },
        text
      }
    })
  });
}

const failFetch: typeof fetch = async (input) => {
  throw new Error(`UNEXPECTED_EXTERNAL_FETCH:${String(input)}`);
};

async function makeLaunch(): Promise<LaunchObserved> {
  const launcher = address(1);
  const txHash = hex64(2);
  const token = address(3);
  const launchId = await deriveLaunchId({ chainId: 5042, launcher, txHash, token });
  const eventId = await deriveEventId({ chainId: 5042, launcher, txHash, logIndex: 4 });
  return {
    launchId,
    eventId,
    chainId: 5042,
    blockNumber: 100n,
    blockHash: hex64(100),
    observedAtMs: 100_000,
    source: 'ARCPAD',
    launcher,
    txHash,
    logIndex: 4,
    token,
    creator: address(5),
    pool: address(6),
    name: 'Cloud Rat',
    symbol: 'RAT',
    imageUri: '',
    website: '',
    twitter: '',
    telegram: ''
  };
}

function address(seed: number): Hex {
  return `0x${seed.toString(16).padStart(40, '0').slice(-40)}` as Hex;
}

function hex64(seed: number): Hex {
  return `0x${seed.toString(16).padStart(64, '0').slice(-64)}` as Hex;
}


test('candidate /scout updates the same canonical rat photo with verified 14-day results, without AI', async () => {
  const db=new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,5042);
  const runtime=new D1RuntimeStateStore(db,5042);
  try {
    const now=Date.now();
    const launch=await makeLaunch();
    await store.putLaunch(launch);
    await store.putProvenanceFact(await buildProvenanceFact(launch));
    const verifiedLaunchTimestamp=now-86_400_000;
    await store.putObservation(await buildObservationReceipt({
      chainId:5042, launchId:launch.launchId, horizonMs:300_000,
      targetTimestampMs:verifiedLaunchTimestamp+300_000,
      observedBlock:101n,observedBlockHash:hex64(101),
      observedTimestampMs:verifiedLaunchTimestamp+301_000,
      status:'UNVERIFIED',facts:{},
      missing:['POOL_CODE','POOL_SLOT0','POOL_LIQUIDITY',
        'CREATOR_BALANCE','TOKEN_TOTAL_SUPPLY','TOKEN_DECIMALS']
    }));
    await store.commitCheckpoint({
      blockNumber:102n,blockHash:hex64(102),
      guardBlockNumber:null,guardBlockHash:null
    });
    await runtime.put({
      sourceVerified:true,liveCaughtUp:true,headBlock:103n,targetBlock:102n,
      observationReady:true,historyBackfillComplete:false,
      historyBackfillTargetBlock:99n,lastSyncError:null,
      lastHistoryError:null,lastObservationError:null,updatedAtMs:now
    });
    let inferenceCalls=0;
    const calls:Array<{method:string;body:Record<string,unknown>}>=[];
    const fetchMock:typeof fetch=async(input,init)=>{
      const uri=String(input);
      const method=uri.endsWith('/sendPhoto')?'sendPhoto':
        uri.endsWith('/editMessageCaption')?'editMessageCaption':'UNEXPECTED';
      assert.notEqual(method,'UNEXPECTED','Scout must not call the AI, sendMessage or arbitrary endpoints');
      const body=JSON.parse(String(init?.body??'{}')) as Record<string,unknown>;
      calls.push({method,body});
      return new Response(JSON.stringify({ok:true,result:{message_id:777}}),{
        status:200,headers:{'content-type':'application/json'}
      });
    };
    const env={
      DB:db,CAPABILITY_MANIFEST_JSON:manifest,
      TELEGRAM_BOT_TOKEN:'123:secret',TELEGRAM_WEBHOOK_SECRET:'hook-secret',
      TELEGRAM_REPLIES_ENABLED:'true',RAT_SCOUT_ENABLED:'true',
      RAT_CONVERSATION_ENABLED:'true',RAT_AI_ENABLED:'true',
      AI:{run:async()=>{inferenceCalls++;return {};}}
    };
    const response=await handleWorkerRequest(
      telegramRequest(2221,'Show me the latest wallets worth following','hook-secret'),
      env,{externalFetch:fetchMock,now:()=>now}
    );
    assert.equal(response.status,200);
    assert.deepEqual(calls.map(x=>x.method),['sendPhoto','editMessageCaption']);
    assert.equal(inferenceCalls,0);
    assert.match(String(calls[0]?.body.photo??''),/\/assets\/binrat-hero\.webp$/);
    assert.match(String(calls[0]?.body.caption??''),/DIGGING/);
    assert.equal(calls[1]?.body.message_id,777);
    assert.match(String(calls[1]?.body.caption??''),new RegExp(launch.creator));
    assert.match(String(calls[1]?.body.caption??''),/MC: unavailable/);
    assert.match(String(calls[1]?.body.caption??''),/History: UNVERIFIED/);
    const markup=calls[1]?.body.reply_markup as {inline_keyboard:Array<Array<{url:string}>>};
    assert.match(markup.inline_keyboard[0]?.[0]?.url??'',/\/api\/creator\/0x/);
    const record=await new D1TelegramLedger(db).get(2221);
    assert.equal(record?.state,'REPLIED');
    assert.equal(record?.telegramMessageId,777);
    const duplicate=await handleWorkerRequest(
      telegramRequest(2221,'Show me the latest wallets worth following','hook-secret'),
      env,{externalFetch:fetchMock,now:()=>now}
    );
    assert.equal(duplicate.status,200);
    assert.equal(calls.length,2,'recorded duplicate never sends an extra photo');
  }finally{store.close();db.close();}
});

test('recipient scout is explicitly pending and never masquerades as an active wallet alert',async()=>{
  const db=new D1CompatDatabase();await db.exec(D1_SCHEMA_SQL);
  try{
    const output:string[]=[];
    const mock:typeof fetch=async(input,init)=>{
      assert.match(String(input),/\/sendMessage$/);
      const body=JSON.parse(String(init?.body??'{}')) as {text:string};
      output.push(body.text);
      return new Response(JSON.stringify({ok:true,result:{message_id:18}}),{status:200});
    };
    const env={DB:db,CAPABILITY_MANIFEST_JSON:manifest,TELEGRAM_BOT_TOKEN:'123:secret',
      TELEGRAM_WEBHOOK_SECRET:'hook-secret',TELEGRAM_REPLIES_ENABLED:'true',
      RAT_SCOUT_ENABLED:'true'};
    const response=await handleWorkerRequest(
      telegramRequest(2222,'/scout buyers','hook-secret'),env,
      {externalFetch:mock,now:Date.now}
    );
    assert.equal(response.status,200);
    assert.match(output[0]??'',/NOT|not|needs verified/);
    assert.doesNotMatch(output[0]??'',/watch armed|alerts enabled/);
  }finally{db.close();}
});


test('failed Scout caption edit retries the SAME Telegram photo rather than sending a duplicate',async()=>{
  const db=new D1CompatDatabase();await db.exec(D1_SCHEMA_SQL);
  try{
    let photoCalls=0,editCalls=0;
    const now=Date.now();
    const fetchMock:typeof fetch=async(input)=>{
      const url=String(input);
      if(url.endsWith('/sendPhoto')){
        photoCalls++;
        return new Response(JSON.stringify({ok:true,result:{message_id:999}}),{status:200});
      }
      if(url.endsWith('/editMessageCaption')){
        editCalls++;
        return editCalls===1
          ? new Response(JSON.stringify({ok:false}),{status:502})
          : new Response(JSON.stringify({ok:true,result:{message_id:999}}),{status:200});
      }
      throw new Error('UNEXPECTED_FETCH:'+url);
    };
    const env={DB:db,TELEGRAM_BOT_TOKEN:'123:secret',
      TELEGRAM_WEBHOOK_SECRET:'hook-secret',TELEGRAM_REPLIES_ENABLED:'true',
      RAT_SCOUT_ENABLED:'true'};
    const request=telegramRequest(2500,'/scout','hook-secret');
    const deps={externalFetch:fetchMock,now:()=>now};
    const failed=await handleWorkerRequest(request.clone(),env,deps);
    assert.equal(failed.status,503);
    const staged=await db.prepare('SELECT telegram_message_id AS id FROM rat_scout_progress WHERE update_id=?')
      .bind(2500).first<{id:number}>();
    assert.equal(staged?.id,999);
    assert.equal(photoCalls,1);
    const recovered=await handleWorkerRequest(request.clone(),env,deps);
    assert.equal(recovered.status,200);
    assert.equal(photoCalls,1,'retry reuses original photo ID');
    assert.equal(editCalls,2);
    assert.equal((await new D1TelegramLedger(db).get(2500))?.telegramMessageId,999);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM rat_scout_progress')
      .first<{n:number}>())?.n,0);
  }finally{db.close();}
});
