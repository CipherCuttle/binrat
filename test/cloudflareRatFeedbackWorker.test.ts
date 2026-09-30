import assert from 'node:assert/strict';
import test from 'node:test';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { handleWorkerRequest } from '../src/cloudflare/worker.js';
import { D1TelegramLedger } from '../src/cloudflare/telegramLedger.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const now = Date.UTC(2026, 8, 25, 12);
const envBase = {
  TELEGRAM_REPLIES_ENABLED: 'true',
  RAT_FEEDBACK_ENABLED: 'true',
  TELEGRAM_BOT_TOKEN: '123:secret',
  TELEGRAM_WEBHOOK_SECRET: 'hook-secret'
};
function request(id: number, text: string, chatId = 321, userId = 123, type = 'private'): Request {
  return new Request('https://binrat.example/telegram/webhook', {
    method: 'POST', headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': 'hook-secret'
    },
    body: JSON.stringify({ update_id: id, message: {
      message_id: id, from: { id: userId }, chat: { id: chatId, type }, text
    } })
  });
}
function sender(sent: string[], fail = false): typeof fetch {
  return async (input, init) => {
    assert.match(String(input), /\/sendMessage$/);
    if (fail) throw new Error('SIMULATED_TELEGRAM_DOWN');
    const body = JSON.parse(String(init?.body ?? '{}')) as { text: string };
    sent.push(body.text);
    return new Response(JSON.stringify({ ok: true, result: { message_id: sent.length } }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  };
}

test('DM feedback stores consented text and replies with a durable D1 receipt', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const sent: string[] = [];
    const env = { DB: db, ...envBase };
    const reply = await handleWorkerRequest(
      request(951, '/feedback idea: save radar filters'), env,
      { now: () => now, externalFetch: sender(sent) }
    );
    assert.equal(reply.status, 200);
    assert.match(sent[0] ?? '', /receipt #951.+saved/);
    const ledger = await new D1TelegramLedger(db).get(951);
    assert.equal(ledger?.state, 'REPLIED');
    assert.equal(ledger?.answerPlanJson, null);
    const entry = await db.prepare('SELECT kind,body,user_id FROM rat_feedback WHERE update_id=?')
      .bind(951).first<{ kind: string; body: string; user_id: number }>();
    assert.deepEqual(entry, { kind: 'IDEA', body: 'save radar filters', user_id: 123 });
    assert.equal((await handleWorkerRequest(
      request(951, '/feedback idea: save radar filters'), env,
      { now: () => now, externalFetch: sender(sent) }
    )).status, 200);
    assert.equal(sent.length, 1, 'webhook deduplication must avoid double replies');
  } finally { db.close(); }
});

test('feedback is default-off and non-explicit messages never enter the feedback table', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const env = { DB: db, ...envBase, TELEGRAM_REPLIES_ENABLED: 'false' };
    const a = await handleWorkerRequest(request(952, '/feedback idea: save radar filters'),
      env, { now: () => now, externalFetch: sender([]) });
    assert.equal(a.status, 200);
    assert.equal((await db.prepare('SELECT * FROM rat_feedback').all()).results?.length, 0);
  } finally { db.close(); }
});

test('private-only feedback refuses to store group posts and confirms privacy help', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const sent: string[] = [];
    const env = { DB: db, ...envBase };
    const group = await handleWorkerRequest(
      request(953, '/feedback bug: never copy public group messages', -100, 124, 'supergroup'),
      env, { now: () => now, externalFetch: sender(sent) }
    );
    assert.equal(group.status, 200);
    assert.match(sent[0] ?? '', /DM me/);
    assert.equal((await db.prepare('SELECT * FROM rat_feedback').all()).results?.length, 0);
    await handleWorkerRequest(request(954, '/feedback'), env,
      { now: () => now, externalFetch: sender(sent) });
    assert.match(sent[1] ?? '', /90 days/);
    assert.match(sent[1] ?? '', /3 submissions/);
  } finally { db.close(); }
});

test('inbox is private to the configured owner DM and never leaks through group replies', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const sent: string[] = [];
    const env = { DB: db, ...envBase, RAT_FEEDBACK_ADMIN_USER_ID: '999' };
    const deps = { now: () => now, externalFetch: sender(sent) };
    await handleWorkerRequest(request(970, '/feedback bug: the radar filter breaks'), env, deps);
    await handleWorkerRequest(request(971, '/feedback inbox', 321, 123), env, deps);
    assert.match(sent[1] ?? '', /private to the BINRAT operator/);
    assert.doesNotMatch(sent[1] ?? '', /radar filter breaks/);
    await handleWorkerRequest(request(972, '/feedback inbox', -100, 999, 'supergroup'), env, deps);
    assert.match(sent[2] ?? '', /DM me/);
    assert.doesNotMatch(sent[2] ?? '', /radar filter breaks/);
    await handleWorkerRequest(request(973, '/feedback inbox', 999, 999), env, deps);
    assert.match(sent[3] ?? '', /#970 \[BUG\]/);
    assert.match(sent[3] ?? '', /radar filter breaks/);
    assert.doesNotMatch(sent[3] ?? '', /123/, 'the admin inbox does not reveal user IDs');
  } finally { db.close(); }
});

test('failed Telegram ACK does not duplicate or charge twice when Telegram retries', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const env = { DB: db, ...envBase };
    const first = await handleWorkerRequest(request(955, '/feedback bug: drawer broken'), env,
      { now: () => now, externalFetch: sender([], true) });
    assert.equal(first.status, 503);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM rat_feedback')
      .first<{ n: number }>())?.n, 1);
    const sent: string[] = [];
    const retry = await handleWorkerRequest(request(955, '/feedback bug: drawer broken'), env,
      { now: () => now + 1_000, externalFetch: sender(sent) });
    assert.equal(retry.status, 200);
    assert.match(sent[0] ?? '', /receipt #955/);
    const budget = await db.prepare(
      "SELECT attempts FROM rat_feedback_budget WHERE principal='USER:123'"
    ).first<{ attempts: number }>();
    assert.equal(budget?.attempts, 1);
  } finally { db.close(); }
});

test('a user can delete only their own feedback from all prior chats', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const env = { DB: db, ...envBase };
    const sent: string[] = [];
    const deps = { now: () => now, externalFetch: sender(sent) };
    await handleWorkerRequest(request(956, '/feedback idea: make the rat blink'), env, deps);
    await handleWorkerRequest(request(957, '/feedback bug: filter is broken', 422, 222), env, deps);
    await handleWorkerRequest(request(958, '/feedback delete'), env, deps);
    assert.match(sent.at(-1) ?? '', /deleted 1 stored feedback/);
    const rows = await db.prepare('SELECT user_id FROM rat_feedback')
      .all<{ user_id: number }>();
    assert.deepEqual(rows.results, [{ user_id: 222 }]);
  } finally { db.close(); }
});
