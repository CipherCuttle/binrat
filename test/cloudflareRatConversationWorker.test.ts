import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { handleWorkerRequest } from '../src/cloudflare/worker.js';
import { D1TelegramLedger } from '../src/cloudflare/telegramLedger.js';
import { loadRatBanterTurns, loadRatMemory } from '../src/cloudflare/ratConversation.js';
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
      RAT_AI_TRIAL_EXPIRES_AT_MS: String(now + 7 * 86_400_000),
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

test('private candidate bot ignores everybody except the explicitly allowed DM sender', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const sent: string[] = [];
    const env = {
      ...base, DB: db, RAT_CONVERSATION_ENABLED: 'true',
      RAT_CANDIDATE_ALLOWED_USER_ID: '123'
    };
    const deps = { now: () => now, externalFetch: sender(sent) };
    const group = await handleWorkerRequest(
      request(920, '/help', -300, 123, 'supergroup'), env, deps
    );
    assert.equal(group.status, 200);
    assert.equal((await new D1TelegramLedger(db).get(920))?.state, 'IGNORED');
    const otherUser = await handleWorkerRequest(
      request(921, '/help', 321, 456), env, deps
    );
    assert.equal(otherUser.status, 200);
    assert.equal((await new D1TelegramLedger(db).get(921))?.state, 'IGNORED');
    assert.equal(sent.length, 0);

    const allowed = await handleWorkerRequest(request(922, '/help'), env, deps);
    assert.equal(allowed.status, 200);
    assert.equal((await new D1TelegramLedger(db).get(922))?.state, 'REPLIED');
    assert.equal(sent.length, 1);
  } finally { db.close(); }
});

test('paid-account model quota is never spent by group chatter', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    let called = 0; const sent: string[] = [];
    const env = { ...base, DB: db, RAT_AI_ENABLED: 'true',
      RAT_CONVERSATION_ENABLED: 'true',
      RAT_AI_TRIAL_EXPIRES_AT_MS: String(now + 86_400_000),
      AI: { run: async () => { called++; return {
        response: '{"kind":"BANTER","text":"lurking in the bin."}'
      }; } }
    };
    const response = await handleWorkerRequest(
      request(932, 'rat hello rat, do you nap?', -100, 123, 'supergroup'),
      env, { now: () => now, externalFetch: sender(sent) }
    );
    assert.equal(response.status, 200);
    assert.equal(called, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM rat_ai_daily_budget')
      .first<{ n: number }>())?.n, 0);
  } finally { db.close(); }
});

test('expired live trial stops all model calls without breaking deterministic Telegram replies', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    let inferenceCount = 0; const sent: string[] = [];
    const env = { ...base, DB: db, RAT_AI_ENABLED: 'true',
      RAT_CONVERSATION_ENABLED: 'true',
      RAT_AI_TRIAL_EXPIRES_AT_MS: String(now - 1),
      AI: { run: async () => { inferenceCount++; return {
        response: '{"kind":"BANTER","text":"sleeping in the bin."}'
      }; } }
    };
    const response = await handleWorkerRequest(request(931, 'hello rat, do you nap?'), env,
      { now: () => now, externalFetch: sender(sent) });
    assert.equal(response.status, 200);
    assert.equal(inferenceCount, 0);
    assert.match(sent[0] ?? '', /didn.t catch the scent/);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM rat_ai_daily_budget')
      .first<{ n: number }>())?.n, 0);
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


test('Boris DM regression: user-named hamster survives followups, next move stays fictional, /roadmap remains factual', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const sent: string[] = [];
    const prompts: Array<Array<{role:string;content:string}>> = [];
    const env = { ...base, DB: db, RAT_CONVERSATION_ENABLED: 'true',
      RAT_AI_ENABLED: 'true', RAT_AI_TRIAL_EXPIRES_AT_MS: String(now + 7 * 86_400_000),
      AI: { run: async (_model: string, input: {messages:Array<{role:string;content:string}>}) => {
        prompts.push(input.messages);
        const replies = [
          'I shall claim the cheese.',
          'I negotiate with teeth.',
          'The hamster is Boris.',
          'I tunnel under the fridge.'
        ];
        return { response: JSON.stringify({
          kind: 'BANTER', text: replies[prompts.length - 1] ?? 'Still hungry.'
        }) };
      } }
    };
    const deps = { now: () => now, externalFetch: sender(sent) };
    for (const [id, text] of [
      [980, 'Oi rat, I caught you stealing cheese from my fridge.'],
      [981, 'My fridge is guarded by a hamster named Boris. Negotiate with him.'],
      [982, "What's the hamster's name again?"],
      [983, "Boris says you're banned. What's your next move?"]
    ] as const) {
      const result = await handleWorkerRequest(request(id, text), env, deps);
      assert.equal(result.status, 200, 'real webhook route must remain available');
      const receipt = await new D1TelegramLedger(db).get(id);
      assert.equal(receipt?.state, 'REPLIED');
      assert.equal(receipt?.answerPlanJson, null, 'small talk must never invent a factual plan');
    }
    assert.equal(prompts.length, 4);
    assert.match(prompts[2]?.map(m=>m.content).join(' ') ?? '', /hamster named Boris/);
    assert.match(prompts[3]?.map(m=>m.content).join(' ') ?? '', /hamster named Boris/);
    assert.match(sent[2] ?? '', /Boris/);
    assert.match(sent[3] ?? '', /tunnel under the fridge/);
    assert.doesNotMatch(sent[3] ?? '', /Intelligence V1|launch authorization/);
    assert.equal((await loadRatBanterTurns(db, 321, 123, now)).length, 3);

    const roadmap = await handleWorkerRequest(request(984, '/roadmap'), env, deps);
    assert.equal(roadmap.status, 200);
    assert.equal(prompts.length, 4, 'explicit roadmap never spends AI');
    assert.match(sent[4] ?? '', /Intelligence V1/);
    assert.match((await new D1TelegramLedger(db).get(984))?.answerPlanJson ?? '', /ROADMAP/);

    const forgotten = await handleWorkerRequest(request(985, '/forget'), env, deps);
    assert.equal(forgotten.status, 200);
    assert.deepEqual(await loadRatBanterTurns(db, 321, 123, now), []);
    assert.equal(await loadRatMemory(db, 321, 123, now), null);
    assert.match(sent[5] ?? '', /context cleared/);
  } finally { db.close(); }
});

test('private banter memory is never shared with another sender or group', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const sent: string[] = []; const contexts: string[] = [];
    const env = { ...base, DB: db, RAT_CONVERSATION_ENABLED: 'true',
      RAT_AI_ENABLED: 'true', RAT_AI_TRIAL_EXPIRES_AT_MS: String(now + 7 * 86_400_000),
      AI: { run: async (_model: string, input: {messages:Array<{content:string}>}) => {
        contexts.push(input.messages.map(m=>m.content).join('\n'));
        return {response: '{"kind":"BANTER","text":"the cheese is mine."}'};
      } }
    };
    const deps = { now: () => now, externalFetch: sender(sent) };
    await handleWorkerRequest(request(990,'My hamster is called Crumbly.'),env,deps);
    await handleWorkerRequest(request(991,'Hello, stranger.',321,456),env,deps);
    assert.equal(contexts.length,2);
    assert.doesNotMatch(contexts[1]??'',/Crumbly/);
    assert.deepEqual(await loadRatBanterTurns(db,321,456,now),[
      {userText:'Hello, stranger.',botReply:'🐀 the cheese is mine.'}
    ]);
    await handleWorkerRequest(request(992,'rat hello from a group',-100,123,'supergroup'),env,deps);
    assert.equal(contexts.length,2,'no group AI calls or group raw user-message storage');
    assert.deepEqual(await loadRatBanterTurns(db,-100,123,now),[]);
  } finally { db.close(); }
});
