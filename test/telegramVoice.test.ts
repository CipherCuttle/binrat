import assert from 'node:assert/strict';
import test from 'node:test';
import { makeRatAnswerPlan, renderRatVoice } from '../src/telegram/voice.js';

function statusPlan(launchCount = 3) {
  return makeRatAnswerPlan('STATUS', 'DIGGING', {
    index: 'READY',
    launchCount,
    checkpointBlock: '123',
    history: 'IN PROGRESS / UNVERIFIED',
    observations: 'READY',
    telegramStatus: 'BUILDING'
  }, [], [], ['/api/health']);
}

test('voice and answer-plan receipt are deterministic for the same factual plan', () => {
  const first = renderRatVoice(statusPlan());
  const second = renderRatVoice(statusPlan());
  assert.equal(first.text, second.text);
  assert.equal(first.voiceVariant, second.voiceVariant);
  assert.equal(first.replyDigest, second.replyDigest);
  assert.equal(first.planDigest, second.planDigest);
  assert.deepEqual(first.answerPlan, second.answerPlan);
});

test('changing a fact changes both the plan and reply digest', () => {
  const first = renderRatVoice(statusPlan(3));
  const second = renderRatVoice(statusPlan(4));
  assert.notEqual(first.planDigest, second.planDigest);
  assert.notEqual(first.replyDigest, second.replyDigest);
});

test('buy boundary has personality but does not issue a recommendation', () => {
  const reply = renderRatVoice(makeRatAnswerPlan('BUY_BOUNDARY', 'BOUNDARY', {}));
  assert.match(reply.text, /do not predict candles/i);
  assert.doesNotMatch(reply.text, /you should buy/i);
});

test('creator voice preserves human-identity boundary', () => {
  const receipt='binrat-creator:' + 'a'.repeat(64);
  const reply = renderRatVoice(makeRatAnswerPlan('CREATOR_HISTORY', 'SMELLS_FAMILIAR', {
    creator: '0x1111111111111111111111111111111111111111',
    indexedLaunchCount: 4,
    firstIndexedBlock: '100',
    lastIndexedBlock: '400',
    historyCoverage: 'UNVERIFIED',
    receipt,
    identityRiskLanguage: true
  }, [receipt]));
  assert.match(reply.text, /not proof of common human identity/i);
  assert.match(reply.text, /not a criminal record/i);
  assert.doesNotMatch(reply.text, /is a scammer/i);
});

test('ambiguous address voice does not silently call a token or pool a creator', () => {
  const reply = renderRatVoice(makeRatAnswerPlan('ADDRESS_LOOKUP', 'NEUTRAL', {
    address: '0x1111111111111111111111111111111111111111',
    role: 'AMBIGUOUS',
    roles: 'REPORTED_CREATOR, TOKEN'
  }));
  assert.match(reply.text, /multiple meanings/i);
  assert.match(reply.text, /token, pool, or creator/i);
});
