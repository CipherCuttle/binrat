import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { TelegramReplyLedger } from '../src/telegram/replyLedger.js';
import { makeRatAnswerPlan, renderRatVoice } from '../src/telegram/voice.js';

test('reply ledger persists exact answer-plan receipt and rejects changed replay', () => {
  const dir = mkdtempSync(join(tmpdir(), 'binrat-rat-ledger-'));
  const path = join(dir, 'rat.sqlite');
  try {
    const plan = makeRatAnswerPlan('BUY_BOUNDARY', 'BOUNDARY', {});
    const reply = renderRatVoice(plan);
    const first = new TelegramReplyLedger(path);
    assert.equal(first.has(123), false);
    assert.equal(first.record({
      updateId: 123,
      chatId: 456,
      intent: reply.intent,
      rendererVersion: reply.rendererVersion,
      voiceVariant: reply.voiceVariant,
      planDigest: reply.planDigest,
      replyDigest: reply.replyDigest,
      answerPlan: reply.answerPlan,
      receiptIds: reply.receiptIds,
      telegramMessageId: 789
    }), 'INSERTED');
    assert.equal(first.has(123), true);
    first.close();

    const reopened = new TelegramReplyLedger(path);
    assert.equal(reopened.has(123), true);
    assert.equal(reopened.record({
      updateId: 123,
      chatId: 456,
      intent: reply.intent,
      rendererVersion: reply.rendererVersion,
      voiceVariant: reply.voiceVariant,
      planDigest: reply.planDigest,
      replyDigest: reply.replyDigest,
      answerPlan: reply.answerPlan,
      receiptIds: reply.receiptIds,
      telegramMessageId: 789
    }), 'DUPLICATE');

    assert.throws(() => reopened.record({
      updateId: 123,
      chatId: 456,
      intent: reply.intent,
      rendererVersion: reply.rendererVersion,
      voiceVariant: reply.voiceVariant,
      planDigest: 'f'.repeat(64),
      replyDigest: reply.replyDigest,
      answerPlan: reply.answerPlan,
      receiptIds: reply.receiptIds,
      telegramMessageId: 789
    }), /TELEGRAM_REPLY_LEDGER_CONFLICT/);
    reopened.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
