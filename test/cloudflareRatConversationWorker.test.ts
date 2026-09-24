import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { handleWorkerRequest } from '../src/cloudflare/worker.js';
import { D1TelegramLedger } from '../src/cloudflare/telegramLedger.js';
import { loadRatMemory } from '../src/cloudflare/ratConversation.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const manifest = JSON.stringify({
  schemaVersion: 'binrat.capability-manifest/0.1',
  capabilities: {},
  launchAuthorization: {
    status: 'BLOCKED', marketingAuthorized: false,
    launchAuthorized: false, tokenState: 'NOT_LAUNCHED'
  },
  invariant: 'Degen decides attention. Receipts decide truth.'
});
const base = {
  CAPABILITY_MANIFEST_JSON: manifest,
  TELEGRAM_BOT_TOKEN: '123:secret',
  TELEGRAM_WEBHOOK_SECRET: 'hook-secret',
  TELEGRAM_REPLIES_ENABLED: 'true'
};
const now = Date.UTC(2026, 8, 25, 5);
const creator = '0x' + 'ab'.repeat(20);
function request(id: number, text: string, chatId = 321, userId = 123, type = 'private'): Request {
  return new Request('https://binrat.example/telegram/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'hook-secret' },
    body: JSON.stringify({ update_id: id, message: {
      message_id: id, from: { id: userId }, chat: { id: chatId, type }, text
    } })
  });
}
function sender(sent: string[]): typeof fetch {
  return async (input, init) => {
    assert.match(String(input), /sendMessage$/);
    const body = JSON.parse(String(init?.body ?? '{}')) as { text: string };
    sent.push(body.text);
    return new Response(JSON.stringify({ ok: true, result: { message_id: sent.length } }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  };
}
test('default-off AI never calls model, even if binding is present', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    let called = 0; const sent: string[] = [];
    const env = { ...base, DB: db, AI: { run: async () => { called++; return {}; } } };
    const response = await handleWorkerRequest(request(901, 'hello rat, do you nap?'), env,
      { now: () => now, externalFetch: sender(sent) });
    assert.equal(response.status, 200);
    assert.equal(called, 0);
    assert.match(sent[0] ?? '', /didn.t catch the scent/);
    assert.equal(await loadRatMemory(db, 321, 123, now), null);
  } finally { db.close(); }
});

test('AI is opt-in, consumes D1 reservation once, records digest not raw user text', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    let called = 0; const sent: string[] = [];
    const env = { ...base, DB: db,
      RAT_CONVERSATION_ENABLED: 'true', RAT_AI_ENABLED: 'true',
      AI: { run: async () => { called++; return {
        choices: [{ message: { content: '{"kind":"BANTER","text":"the bin never sleeps."}' } }]
      }; } }
    };
    const response = await handleWorkerRequest(request(902, 'hello rat, do you nap?'), env,
      { now: () => now, externalFetch: sender(sent) });
    assert.equal(response.status, 200);
    assert.equal(called, 1);
    assert.equal(sent[0], '🐀 the bin never sleeps.');
    const receipt = await new D1TelegramLedger(db).get(902);
    assert.equal(receipt?.state, 'REPLIED');
    assert.equal(receipt?.replyDigest, createHash('sha256').update(sent[0]!).digest('hex'));
    assert.equal(receipt?.answerPlanJson, null);
    const memory = await loadRatMemory(db, 321, 123, now);
    assert.equal(memory?.lastBotReply, sent[0]);
    const duplicate = await handleWorkerRequest(request(902, 'hello rat, do you nap?'), env,
      { now: () => now, externalFetch: sender(sent) });
    assert.equal(duplicate.status, 200);
    assert.equal(called, 1);
    await handleWorkerRequest(request(903, '/forget'), env,
      { now: () => now, externalFetch: sender(sent) });
    assert.equal(await loadRatMemory(db, 321, 123, now), null);
  } finally { db.close(); }
});

test('remembered creator works only for the same user; group unaddressed is silent', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const sent: string[] = [];
    const env = { ...base, DB: db, RAT_CONVERSATION_ENABLED: 'true' };
    const first = await handleWorkerRequest(request(904, '/creator ' + creator), env,
      { now: () => now, externalFetch: sender(sent) });
    assert.equal(first.status, 200);
    assert.equal((await loadRatMemory(db, 321, 123, now))?.value, creator);
    await handleWorkerRequest(request(905, 'and its previous launches?'), env,
      { now: () => now + 2000, externalFetch: sender(sent) });
    const second = await new D1TelegramLedger(db).get(905);
    assert.equal(second?.state, 'REPLIED');
    assert.match(second?.answerPlanJson ?? '', /CREATOR_HISTORY/);
    const separate = await handleWorkerRequest(request(906, 'and its previous launches?', 321, 456), env,
      { now: () => now + 3000, externalFetch: sender(sent) });
    assert.equal(separate.status, 200);
    assert.match((await new D1TelegramLedger(db).get(906))?.answerPlanJson ?? '', /CLARIFY/);
    const silent = await handleWorkerRequest(request(907, 'and its previous launches?', -100, 123, 'supergroup'),
      env, { now: () => now + 4000, externalFetch: sender(sent) });
    assert.equal(silent.status, 200);
    assert.equal((await new D1TelegramLedger(db).get(907))?.state, 'IGNORED');
  } finally { db.close(); }
});

test('AI unavailable or out of budget falls back without disabling the deterministic Rat', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const sent: string[] = [];
    const env = { ...base, DB: db, RAT_AI_ENABLED: 'true',
      AI: { run: async () => { throw new Error('MODEL_UNAVAILABLE'); } }
    };
    const response = await handleWorkerRequest(request(908, 'hello rat, do you nap?'), env,
      { now: () => now, externalFetch: sender(sent) });
    assert.equal(response.status, 200);
    assert.match(sent[0] ?? '', /didn.t catch the scent/);
  } finally { db.close(); }
});
