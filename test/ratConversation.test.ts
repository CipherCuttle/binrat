import assert from 'node:assert/strict';
import test from 'node:test';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import {
  RAT_AI_GLOBAL_DAILY_LIMIT, RAT_AI_MODEL, RAT_AI_USER_DAILY_LIMIT,
  entityFromUnderstanding, forgetRatMemory, generateRatBanter, isRatBanterEligible,
  loadRatMemory, pruneRatConversation, reserveRatAiCall, resolveRatFollowup, saveRatMemory, validateRatBanter
} from '../src/cloudflare/ratConversation.js';
import { understandRatMessage } from '../src/telegram/nlp.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const creator = '0x' + 'ab'.repeat(20);
const launch = 'cd'.repeat(32);
const now = Date.UTC(2026, 8, 25, 5);

test('memory resolves only explicit, role-safe references and expires after 30m', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  try {
    const understood = understandRatMessage('/creator ' + creator, { allowUnaddressed: true });
    const entity = entityFromUnderstanding(understood);
    assert.deepEqual(entity, { kind: 'CREATOR', value: creator });
    await saveRatMemory(db, 7, 42, now, '🐀 found the creator file.', entity, null);
    const memory = await loadRatMemory(db, 7, 42, now + 1_000);
    assert.ok(memory);
    assert.equal(resolveRatFollowup('and its previous launches?', memory), '/creator ' + creator);
    assert.equal(resolveRatFollowup('/status', memory), '/status');
    assert.equal(resolveRatFollowup('what about 0x' + '1'.repeat(40), memory), 'what about 0x' + '1'.repeat(40));
    assert.equal(await loadRatMemory(db, 7, 43, now), null, 'other group member never inherits context');
    assert.equal(await loadRatMemory(db, 8, 42, now), null, 'other chat never inherits context');
    assert.equal(await loadRatMemory(db, 7, 42, now + 30 * 60_000 + 1), null);
    await saveRatMemory(db, 7, 42, now, '🐀 reply', entity, null);
    await forgetRatMemory(db, 7, 42);
    assert.equal(await loadRatMemory(db, 7, 42, now), null);
  } finally { db.close(); }
});

test('launch followups reference the exact previous ID, not a guessed token', () => {
  const memory = { kind: 'LAUNCH' as const, value: launch, lastBotReply: '🐀 found it', expiresAtMs: now + 1000 };
  assert.equal(resolveRatFollowup('rat show its receipt', memory), '/receipt ' + launch);
  assert.equal(resolveRatFollowup('rat replay it', memory), '/replay ' + launch);
  assert.equal(resolveRatFollowup('that same launch?', memory), '/bag ' + launch);
  assert.equal(resolveRatFollowup('show someone else', memory), 'show someone else');
  assert.equal(entityFromUnderstanding(understandRatMessage(creator, { allowUnaddressed: true })), null,
    'bare EVM address must not become remembered creator');
});

test('D1 admission enforces 10/user/day, 120/global/day and UTC rollover', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  try {
    for (let i = 0; i < RAT_AI_USER_DAILY_LIMIT; i++) {
      assert.equal(await reserveRatAiCall(db, 1, 100, now), true);
    }
    assert.equal(await reserveRatAiCall(db, 1, 100, now), false);
    assert.equal(await reserveRatAiCall(db, 999, 100, now), false, 'user quota applies across chats');
    assert.equal(await reserveRatAiCall(db, 1, 101, now), true);
    // User-denied requests never consume global slots.
    let admitted = 11;
    for (let i = 0; i < 200; i++) {
      const allowed = await reserveRatAiCall(db, 2, i + 1000, now);
      if (allowed) admitted++;
    }
    assert.equal(admitted, RAT_AI_GLOBAL_DAILY_LIMIT);
    assert.equal(await reserveRatAiCall(db, 9, 9999, now), false);
    assert.equal(await reserveRatAiCall(db, 1, 100, now + 86_400_000), true);
    await pruneRatConversation(db, now + 3 * 86_400_000);
    const old = await db.prepare('SELECT attempts FROM rat_ai_daily_budget WHERE day_utc=?')
      .bind(Math.floor(now / 86_400_000)).first();
    assert.equal(old, null);
  } finally { db.close(); }
});

test('AI only handles innocuous unclassified chat and rejects factual-looking output', async () => {
  assert.equal(isRatBanterEligible('hello rat, do you sleep?', understandRatMessage(
    'hello rat, do you sleep?', { allowUnaddressed: true })), true);
  assert.equal(isRatBanterEligible('rat is this token safe?', understandRatMessage(
    'rat is this token safe?', { allowUnaddressed: true })), false);
  assert.equal(isRatBanterEligible('/status', understandRatMessage('/status')), false);
  assert.equal(validateRatBanter({ response: '{"kind":"BANTER","text":"the pipes are noisy tonight."}' }),
    '🐀 the pipes are noisy tonight.');
  assert.equal(validateRatBanter({ response: '{"kind":"BANTER","text":"buy this token now."}' }), null);
  assert.equal(validateRatBanter({ response: '{"kind":"BANTER","text":"verified partnership with someone"}' }), null);
  assert.equal(validateRatBanter({ response: 'Sure! I promise the moon' }), null);
  let calls = 0;
  let model = '';
  const result = await generateRatBanter({ run: async (id, input) => {
    calls++; model = id;
    assert.equal(input.max_completion_tokens, 250);
    assert.equal(input.stream, false);
    assert.match(input.messages[1]!.content, /previous turn/i);
    return { choices: [{ message: { content: '{"kind":"BANTER","text":"found some crumbs."}' } }] };
  } }, 'hello rat', 'previous turn');
  assert.equal(result, '🐀 found some crumbs.');
  assert.equal(calls, 1);
  assert.equal(model, RAT_AI_MODEL);
});
