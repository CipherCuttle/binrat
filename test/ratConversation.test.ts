import assert from 'node:assert/strict';
import test from 'node:test';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import {
  RAT_AI_GLOBAL_DAILY_LIMIT, RAT_AI_GATEWAY, RAT_AI_MODEL, RAT_AI_USER_DAILY_LIMIT,
  entityFromUnderstanding, forgetRatBanterTurns, forgetRatMemory, generateRatBanter,
  isRatBanterEligible, loadRatBanterTurns, loadRatMemory, pruneRatConversation,
  reserveRatAiCall, resolveRatFollowup, saveRatBanterTurn, saveRatMemory, validateRatBanter
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
    assert.equal(resolveRatFollowup('  /status that same launch?', memory), '  /status that same launch?');
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

test('D1 admission enforces 10/user/day, 30/global/day and UTC rollover', async () => {
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

test('concurrent D1 admissions cannot exceed either quota', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const oneUser = await Promise.all(Array.from({ length: 30 }, (_, i) =>
      reserveRatAiCall(db, i + 1, 333, now)));
    assert.equal(oneUser.filter(Boolean).length, RAT_AI_USER_DAILY_LIMIT);
    const manyUsers = await Promise.all(Array.from({ length: 200 }, (_, i) =>
      reserveRatAiCall(db, 1, i + 1000, now)));
    assert.equal(manyUsers.filter(Boolean).length,
      RAT_AI_GLOBAL_DAILY_LIMIT - RAT_AI_USER_DAILY_LIMIT);
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
  assert.equal(validateRatBanter({ response: '{"kind":"BANTER","text":"BINRAT is live today."}' }), null);
  assert.equal(validateRatBanter({ response: '{"kind":"BANTER","text":"we are partnering with a major team."}' }), null);
  assert.equal(validateRatBanter({ response: 'Sure! I promise the moon' }), null);
  let calls = 0;
  let model = '';
  const result = await generateRatBanter({ run: async (id, input, options) => {
    assert.deepEqual(options, {gateway: {id: RAT_AI_GATEWAY, skipCache: true}});
    calls++; model = id;
    assert.equal(input.max_completion_tokens, 160);
    assert.equal(input.stream, false);
    assert.deepEqual(input.chat_template_kwargs, { enable_thinking: false });
    assert.match(input.messages[1]!.content, /previous turn/i);
    return { choices: [{ message: { content: '{"kind":"BANTER","text":"found some crumbs."}' } }] };
  } }, 'hello rat', 'previous turn');
  assert.equal(result, '🐀 found some crumbs.');
  assert.equal(calls, 1);
  assert.equal(model, RAT_AI_MODEL);
});


test('private smalltalk keeps only three recent exchanges, isolates users and expires in 30m', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const turns = [
      "Oi rat, don't eat my cheese.",
      'The fridge is guarded by a hamster called Boris.',
      "Fine. Negotiate with him.",
      "What's his name again?"
    ];
    for (let i = 0; i < turns.length; i++) {
      await saveRatBanterTurn(db, 51, 81, 300 + i, now + i, turns[i]!, '🐀 not admitting anything.');
    }
    await saveRatBanterTurn(db, 51, 81, 303, now + 3, 'duplicate', 'duplicate');
    const read = await loadRatBanterTurns(db, 51, 81, now + 100);
    assert.equal(read.length, 3, 'oldest of four exchanges is excluded from prompt');
    assert.equal(read[0]?.userText, turns[1]);
    assert.equal(read[2]?.userText, turns[3]);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM rat_smalltalk_turns')
      .first<{ n: number }>())?.n, 3, 'D1 physically retains no more than three turns');
    assert.equal(await loadRatBanterTurns(db, 51, 82, now + 100).then(x=>x.length), 0);
    assert.equal(await loadRatBanterTurns(db, 52, 81, now + 100).then(x=>x.length), 0);
    assert.deepEqual(await loadRatBanterTurns(db, 51, 81, now + 30 * 60_000 + 4), []);
    await pruneRatConversation(db, now + 30 * 60_000 + 4);
    const count = await db.prepare('SELECT COUNT(*) AS n FROM rat_smalltalk_turns')
      .first<{ n: number }>();
    assert.equal(count?.n, 0, 'cron physically clears expired turns');
  } finally { db.close(); }
});

test('private chat deletion is scoped and excludes obvious credentials', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    await saveRatBanterTurn(db, 51, 81, 400, now, 'my password is bad', '🐀 no');
    await saveRatBanterTurn(db, 51, 81, 401, now, 'my hamster is Boris', '🐀 yes');
    await saveRatBanterTurn(db, 51, 82, 402, now, 'hi rat', '🐀 hi');
    assert.equal((await loadRatBanterTurns(db, 51, 81, now)).length, 1);
    await forgetRatBanterTurns(db, 51, 81);
    assert.deepEqual(await loadRatBanterTurns(db, 51, 81, now), []);
    assert.equal((await loadRatBanterTurns(db, 51, 82, now)).length, 1);
  } finally { db.close(); }
});

test('Boris roleplay remains smalltalk but explicit roadmap is evidence-only', async () => {
  const banter = "Boris says you're banned. What's your next move?";
  const understood = understandRatMessage(banter, { allowUnaddressed: true });
  assert.equal(understood?.intent, 'ROADMAP', 'free-text parser initially interprets next as roadmap');
  assert.equal(isRatBanterEligible(banter, understood), false, 'no contextual override without memory');
  assert.equal(isRatBanterEligible(banter, understood, true), true, 'active roleplay disambiguates next move');
  assert.equal(isRatBanterEligible('/roadmap', understandRatMessage('/roadmap'), true), false);
  assert.equal(isRatBanterEligible("Boris: what's next for the BINRAT project?",
    understandRatMessage("Boris: what's next for the BINRAT project?", { allowUnaddressed: true }), true), false);
});

test('AI receives Boris from prior user messages, not from the bot or hardcoded prompt', async () => {
  let observed: Array<{ role: string; content: string }> = [];
  const previous = [
    { userText: 'The fridge is guarded by a hamster named Boris. Negotiate with him.',
      botReply: '🐀 I know a rat who negotiates with teeth.' },
    { userText: "What's the hamster's name again?",
      botReply: '🐀 I only know a suspiciously well-dressed hamster.' }
  ];
  const out = await generateRatBanter({ run: async (_model, input) => {
    observed = input.messages;
    return { response: '{"kind":"BANTER","text":"Boris is still guarding the cheese."}' };
  } }, "Boris says you're banned. What's your next move?", previous[1]!.botReply, previous);
  assert.equal(out, '🐀 Boris is still guarding the cheese.');
  assert.equal(observed[0]?.role, 'system');
  assert.doesNotMatch(observed[0]?.content ?? '', /Boris/);
  assert.deepEqual(observed.slice(1).map(m=>m.role), [
    'user','assistant','user','assistant','user'
  ]);
  assert.match(observed[1]?.content ?? '', /hamster named Boris/);
  assert.match(observed[5]?.content ?? '', /next move/);
});
