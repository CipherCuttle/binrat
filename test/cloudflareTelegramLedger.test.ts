import assert from 'node:assert/strict';
import test from 'node:test';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1TelegramLedger } from '../src/cloudflare/telegramLedger.js';
import { makeRatAnswerPlan, renderRatVoice } from '../src/telegram/voice.js';
import { D1CompatDatabase } from './support/d1Compat.js';

test('D1 Telegram claim lease is durable and retryable', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const ledger = new D1TelegramLedger(db);
  try {
    assert.equal(await ledger.claim(1, 1_000), 'CLAIMED');
    assert.equal(await ledger.claim(1, 1_001), 'BUSY');
    await ledger.release(1);
    assert.equal(await ledger.claim(1, 1_002), 'CLAIMED');
    await ledger.completeIgnored(1, 'IGNORED', 1_003);
    assert.equal(await ledger.claim(1, 1_004), 'SEEN');
  } finally {
    db.close();
  }
});

test('expired D1 Telegram claim can be reclaimed', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const ledger = new D1TelegramLedger(db);
  try {
    assert.equal(await ledger.claim(2, 1_000, 1_000), 'CLAIMED');
    assert.equal(await ledger.claim(2, 2_001, 1_000), 'CLAIMED');
  } finally {
    db.close();
  }
});

test('D1 Telegram reply receipt persists typed answer plan without user text', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const ledger = new D1TelegramLedger(db);
  try {
    const reply = renderRatVoice(makeRatAnswerPlan('HELP', 'RUMMAGING', {}));
    assert.equal(await ledger.claim(3, 1_000), 'CLAIMED');
    assert.equal(await ledger.completeReply({
      updateId: 3,
      chatId: 99,
      intent: reply.intent,
      rendererVersion: reply.rendererVersion,
      voiceVariant: reply.voiceVariant,
      planDigest: reply.planDigest,
      replyDigest: reply.replyDigest,
      answerPlan: reply.answerPlan,
      receiptIds: reply.receiptIds,
      telegramMessageId: 7
    }, 1_001), 'INSERTED');

    const stored = await ledger.get(3);
    assert.equal(stored?.state, 'REPLIED');
    assert.equal(stored?.planDigest, reply.planDigest);
    assert.equal(stored?.replyDigest, reply.replyDigest);
    assert.equal(stored?.telegramMessageId, 7);
    assert.deepEqual(JSON.parse(stored!.answerPlanJson!), reply.answerPlan);
    assert.doesNotMatch(stored!.answerPlanJson!, /raw user message/i);
  } finally {
    db.close();
  }
});

test('D1 Telegram rate gate is shared durable state', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const ledger = new D1TelegramLedger(db);
  try {
    assert.equal(await ledger.allowChat(42, 2, 60_000, 1_000), true);
    assert.equal(await ledger.allowChat(42, 2, 60_000, 1_001), true);
    assert.equal(await ledger.allowChat(42, 2, 60_000, 1_002), false);
    assert.equal(await ledger.allowChat(42, 2, 60_000, 61_001), true);
  } finally {
    db.close();
  }
});
