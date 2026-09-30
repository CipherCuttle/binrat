import assert from 'node:assert/strict';
import test from 'node:test';
import { deliverFindings, enqueueFindings } from '../src/autonomous/delivery.js';
import { dig } from '../src/autonomous/evidence.js';
import { FREE_CAPACITY } from '../src/autonomous/entitlements.js';
import { mutateWatch } from '../src/autonomous/watches.js';
import { handleWorkerRequest } from '../src/cloudflare/worker.js';
import { renderAlertCard } from '../src/telegram/ui/cards.js';
import { parseCallback } from '../src/telegram/ui/callback.js';
import { autonomousFixture, CREATOR, PRINCIPAL } from './support/autonomousFixture.js';

type Fixture = Awaited<ReturnType<typeof autonomousFixture>>;

async function queuedAlert(): Promise<Fixture> {
  const f = await autonomousFixture();
  await mutateWatch(f.db, PRINCIPAL, 1000, { chainId:4663, entityType:'CREATOR', entityId:CREATOR }, 'WATCH', FREE_CAPACITY, f.now(), f.source);
  f.advance(); await f.launch(105); await f.checkpoint(105);
  assert.equal(await enqueueFindings(f.db, f.now()), 1);
  return f;
}

async function outbox(f: Fixture) {
  const row = await f.db.prepare('SELECT state,attempt_count,telegram_message_id,case_id FROM rat_v1_outbox')
    .first<{state:string;attempt_count:number;telegram_message_id:number|null;case_id:string}>();
  assert.ok(row); return row;
}

function callback(updateId:number, userId:number, chatId:number, data:string, type='private'): Request {
  return new Request('https://fixture.invalid/telegram/webhook', {
    method:'POST', headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':'fixture-secret'},
    body:JSON.stringify({update_id:updateId,callback_query:{id:`alert-${updateId}`,from:{id:userId},data,
      message:{message_id:91,chat:{id:chatId,type}}}})
  });
}

test('ALERT card is compact, factual and maps every action to an existing server-side case reference', async () => {
  const f = await autonomousFixture();
  try {
    const receipt = await dig(f.db,{chainId:4663,entityType:'CREATOR',entityId:CREATOR},f.now());
    const card = renderAlertCard(receipt,102);
    assert.equal(card.view,'ALERT'); assert.equal(card.media,'alert');
    assert.ok(Array.from(card.caption).length <= 1024);
    assert.match(card.caption,/SAME PAWS\. NEW LAUNCH\./);
    assert.match(card.caption,/One of your watched deployers is back/);
    assert.match(card.caption,/block \d+/);
    assert.doesNotMatch(card.caption,/OBSERVED:|DERIVED:|UNKNOWN:|sourceVerified|runtimeFresh/i);
    assert.doesNotMatch(card.caption,/\b(?:rug|scam|safe|buy|profitable|same human|malicious)\b/i);
    const actions = card.keyboard.flatMap(row => row.flatMap(button => 'callbackData' in button ? [parseCallback(button.callbackData)?.action] : []));
    assert.deepEqual(actions,['CASE','WHY','UNWATCH']);
  } finally { f.db.close(); }
});

test('V2 alert sends approved alert artwork with its compact keyboard and records the exact Telegram message', async () => {
  const f = await queuedAlert(); const calls:Array<{method:string;body:Record<string,unknown>}> = [];
  try {
    const api:typeof fetch = async (url,init) => {
      const method=String(url).split('/').at(-1)!; const body=JSON.parse(String(init?.body)) as Record<string,unknown>;
      calls.push({method,body});
      return Response.json({ok:true,result:{message_id:71}});
    };
    assert.equal(await deliverFindings(f.db,f.source,'fixture:token',api,f.now,{uiV2:true,enabled:true,origin:'https://binrat.example'}),1);
    assert.deepEqual(calls.map(call=>call.method),['sendPhoto']);
    assert.match(String(calls[0]!.body.photo),/assets\/telegram\/alert\.png$/);
    assert.match(String(calls[0]!.body.caption),/SAME PAWS\. NEW LAUNCH/);
    assert.match(JSON.stringify(calls[0]!.body.reply_markup),/br2:c:.*br2:y:.*br2:u:/);
    assert.deepEqual(await outbox(f),{state:'SENT',attempt_count:1,telegram_message_id:71,case_id:(await outbox(f)).case_id});
  } finally { f.db.close(); }
});

test('V2 alert media-off sends a text card with no artwork request, and preserves the legacy path when V2 is off', async () => {
  const f = await queuedAlert(); const calls:Array<{method:string;body:Record<string,unknown>}> = [];
  try {
    const api:typeof fetch = async (url,init) => {
      const method=String(url).split('/').at(-1)!; calls.push({method,body:JSON.parse(String(init?.body)) as Record<string,unknown>});
      return Response.json({ok:true,result:{message_id:72}});
    };
    assert.equal(await deliverFindings(f.db,f.source,'fixture:token',api,f.now,{uiV2:true,enabled:false,origin:'not-used'}),1);
    assert.deepEqual(calls.map(call=>call.method),['sendMessage']);
    assert.doesNotMatch(JSON.stringify(calls),/assets\/telegram/);
    assert.match(String(calls[0]!.body.caption ?? calls[0]!.body.text),/SAME PAWS\. NEW LAUNCH/);
    assert.ok(calls[0]!.body.reply_markup);
  } finally { f.db.close(); }

  const legacy = await queuedAlert(); const legacyCalls:Array<{method:string;body:Record<string,unknown>}> = [];
  try {
    const api:typeof fetch = async (url,init) => {
      legacyCalls.push({method:String(url).split('/').at(-1)!,body:JSON.parse(String(init?.body)) as Record<string,unknown>});
      return Response.json({ok:true,result:{message_id:73}});
    };
    assert.equal(await deliverFindings(legacy.db,legacy.source,'fixture:token',api,legacy.now,{enabled:false,origin:'not-used'}),1);
    assert.deepEqual(legacyCalls.map(call=>call.method),['sendMessage']);
    assert.match(String(legacyCalls[0]!.body.text),/^🐀 FOUND SOMETHING\./);
    assert.equal(legacyCalls[0]!.body.reply_markup,undefined);
  } finally { legacy.db.close(); }
});

test('V2 delivery distinguishes definitive media rejection from ambiguous transport and never retries UNKNOWN', async () => {
  const fallback = await queuedAlert(); const fallbackCalls:string[] = [];
  try {
    const api:typeof fetch = async url => {
      const method=String(url).split('/').at(-1)!; fallbackCalls.push(method);
      return method === 'sendPhoto'
        ? new Response(JSON.stringify({ok:false,description:'Bad Request'}),{status:400})
        : Response.json({ok:true,result:{message_id:74}});
    };
    assert.equal(await deliverFindings(fallback.db,fallback.source,'fixture:token',api,fallback.now,{uiV2:true,enabled:true,origin:'https://binrat.example'}),1);
    assert.deepEqual(fallbackCalls,['sendPhoto','sendMessage']);
    assert.equal((await outbox(fallback)).state,'SENT');
  } finally { fallback.db.close(); }

  const ambiguous = await queuedAlert(); const ambiguousCalls:string[] = [];
  try {
    const timeout:typeof fetch = async url => {
      ambiguousCalls.push(String(url).split('/').at(-1)!);
      return new Response(JSON.stringify({ok:false}),{status:503});
    };
    assert.equal(await deliverFindings(ambiguous.db,ambiguous.source,'fixture:token',timeout,ambiguous.now,{uiV2:true,enabled:true,origin:'https://binrat.example'}),0);
    assert.deepEqual(ambiguousCalls,['sendPhoto']);
    assert.deepEqual((await outbox(ambiguous)).state,'UNKNOWN');
    assert.equal(await deliverFindings(ambiguous.db,ambiguous.source,'fixture:token',async()=>{
      throw new Error('UNKNOWN_MUST_NOT_RETRY');
    },ambiguous.now,{uiV2:true,enabled:true,origin:'https://binrat.example'}),0);
  } finally { ambiguous.db.close(); }
});

test('V2 final text rejection is FAILED, while a text transport ambiguity is UNKNOWN', async () => {
  const rejected = await queuedAlert();
  try {
    assert.equal(await deliverFindings(rejected.db,rejected.source,'fixture:token',async()=>
      new Response(JSON.stringify({ok:false,description:'Forbidden'}),{status:403}),rejected.now,
      {uiV2:true,enabled:false,origin:'not-used'}),0);
    assert.equal((await outbox(rejected)).state,'FAILED');
  } finally { rejected.db.close(); }

  const ambiguous = await queuedAlert();
  try {
    assert.equal(await deliverFindings(ambiguous.db,ambiguous.source,'fixture:token',async()=>
      new Response(JSON.stringify({ok:false}),{status:500}),ambiguous.now,
      {uiV2:true,enabled:false,origin:'not-used'}),0);
    assert.equal((await outbox(ambiguous)).state,'UNKNOWN');
  } finally { ambiguous.db.close(); }
});

test('alert callbacks re-authorize and use existing CASE/WHY/SHARE/UNWATCH paths without a DIG reservation', async () => {
  const f = await queuedAlert(); const captions:string[] = [];
  try {
    const row = await outbox(f);
    const receipt = await f.db.prepare('SELECT share_id FROM rat_v1_cases WHERE case_id=?').bind(row.case_id).first<{share_id:string}>();
    assert.ok(receipt);
    Object.assign(f.env,{BINRAT_TELEGRAM_UI_V2_ENABLED:'true'});
    const api:typeof fetch = async (url,init) => {
      const method=String(url).split('/').at(-1)!;
      if (method === 'answerCallbackQuery') return Response.json({ok:true,result:true});
      if (method === 'editMessageCaption') { captions.push(String((JSON.parse(String(init?.body)) as {caption?:string}).caption)); return Response.json({ok:true,result:true}); }
      throw new Error(`UNEXPECTED_TELEGRAM_${method}`);
    };
    const before = (await f.db.prepare('SELECT COUNT(*) AS n FROM rat_v1_dig_requests').first<{n:number}>())!.n;
    for (const [updateId, action] of [[8001,'CASE'],[8002,'WHY'],[8003,'SHARE'],[8004,'UNWATCH'],[8005,'UNWATCH']] as const) {
      const data = {CASE:'c',WHY:'y',SHARE:'s',UNWATCH:'u'}[action];
      const response = await handleWorkerRequest(callback(updateId,77,77,`br2:${data}:${receipt.share_id}`),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
      assert.equal(response.status,200);
    }
    const after = (await f.db.prepare('SELECT COUNT(*) AS n FROM rat_v1_dig_requests').first<{n:number}>())!.n;
    assert.equal(after,before); // CASE is reconstruction, not a new DIG.
    assert.ok(captions.some(caption=>/Matched your watch after it was armed/.test(caption)));\n    assert.ok(captions.some(caption=>/Why I squeaked/.test(caption)));
    assert.ok(captions.some(caption=>/Public evidence only/.test(caption)));
    assert.equal((await f.db.prepare('SELECT enabled FROM rat_v1_watches WHERE user_id=77 AND chat_id=77').first<{enabled:number}>())?.enabled,0);
    const publicRow = await f.db.prepare('SELECT receipt_json FROM rat_v11_pons_public_receipts WHERE case_id=?').bind(row.case_id).first<{receipt_json:string}>();
    assert.ok(publicRow); assert.doesNotMatch(publicRow.receipt_json,/watch_start_block|watch_created_at_ms|event_timestamp_ms|"user_id"|"chat_id"/);

    Object.assign(f.env,{BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED:'false',BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID:'77'});
    const denied = await handleWorkerRequest(callback(8006,88,77,`br2:y:${receipt.share_id}`),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(denied.status,200);
    const group = await handleWorkerRequest(callback(8007,77,-100,`br2:u:${receipt.share_id}`,'group'),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(group.status,200);
  } finally { f.db.close(); }
});
