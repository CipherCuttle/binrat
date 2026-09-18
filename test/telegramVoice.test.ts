import assert from 'node:assert/strict';
import test from 'node:test';
import { renderRatVoice, type RatAnswerPlan } from '../src/telegram/voice.js';

function basePlan(overrides: Partial<RatAnswerPlan> = {}): RatAnswerPlan {
  return {
    schemaVersion: 'binrat.rat-answer-plan/0.1',
    intent: 'STATUS',
    mood: 'DIGGING',
    facts: {
      index: 'READY',
      launchCount: 3,
      checkpointBlock: '123',
      history: 'IN PROGRESS / UNVERIFIED',
      observations: 'READY',
      telegramStatus: 'BUILDING'
    },
    receiptIds: [],
    caveats: [],
    sourceRefs: ['/api/health'],
    ...overrides
  };
}

test('voice is deterministic for the same factual plan', () => {
  const first = renderRatVoice(basePlan());
  const second = renderRatVoice(basePlan());
  assert.equal(first.text, second.text);
  assert.equal(first.voiceVariant, second.voiceVariant);
  assert.equal(first.replyDigest, second.replyDigest);
});

test('changing a fact changes the replay digest', () => {
  const first = renderRatVoice(basePlan());
  const second = renderRatVoice(basePlan({ facts: { ...basePlan().facts, launchCount: 4 } }));
  assert.notEqual(first.replyDigest, second.replyDigest);
});

test('buy boundary has personality but does not issue a recommendation', () => {
  const reply = renderRatVoice(basePlan({
    intent: 'BUY_BOUNDARY',
    mood: 'BOUNDARY',
    facts: {}
  }));
  assert.match(reply.text, /do not predict candles/i);
  assert.doesNotMatch(reply.text, /you should buy/i);
});

test('creator voice preserves human-identity boundary', () => {
  const receipt='binrat-creator:' + 'a'.repeat(64);
  const reply = renderRatVoice(basePlan({
    intent: 'CREATOR_HISTORY',
    mood: 'SMELLS_FAMILIAR',
    facts: {
      creator: '0x1111111111111111111111111111111111111111',
      indexedLaunchCount: 4,
      firstIndexedBlock: '100',
      lastIndexedBlock: '400',
      historyCoverage: 'UNVERIFIED',
      receipt,
      identityRiskLanguage: true
    },
    receiptIds: [receipt]
  }));
  assert.match(reply.text, /not proof of common human identity/i);
  assert.match(reply.text, /not a criminal record/i);
  assert.doesNotMatch(reply.text, /is a scammer/i);
});
