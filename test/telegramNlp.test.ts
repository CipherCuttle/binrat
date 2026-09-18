import assert from 'node:assert/strict';
import test from 'node:test';
import { understandRatMessage } from '../src/telegram/nlp.js';

test('explicit commands remain highest-authority routing', () => {
  assert.deepEqual(
    understandRatMessage('/creator 0x1111111111111111111111111111111111111111'),
    {
      intent: 'CREATOR_HISTORY',
      argument: '0x1111111111111111111111111111111111111111',
      confidence: 1,
      explicitCommand: true,
      identityRiskLanguage: false
    }
  );
});

test('natural roadmap and token phrasing route locally', () => {
  assert.equal(understandRatMessage('yo rat what is next on the roadmap')?.intent, 'ROADMAP');
  assert.equal(understandRatMessage('rat wen token')?.intent, 'TOKEN');
});

test('buy language routes to a claim boundary, not token status', () => {
  assert.equal(understandRatMessage('rat should i ape this?')?.intent, 'BUY_BOUNDARY');
  assert.equal(understandRatMessage('rat wen moon')?.intent, 'BUY_BOUNDARY');
});

test('identity-risk wording with an address routes to creator evidence', () => {
  const parsed = understandRatMessage('rat did this dev rug before 0x1111111111111111111111111111111111111111');
  assert.equal(parsed?.intent, 'CREATOR_HISTORY');
  assert.equal(parsed?.identityRiskLanguage, true);
});

test('replay intent extracts a strict launch id', () => {
  const id = 'a'.repeat(64);
  const parsed = understandRatMessage(`rat what happened after launch ${id}`);
  assert.equal(parsed?.intent, 'REPLAY');
  assert.equal(parsed?.argument, id);
});

test('ordinary group chat without rat reference remains ignored', () => {
  assert.equal(understandRatMessage('wen moon?'), null);
  assert.equal(understandRatMessage('is this safe?'), null);
});

test('unknown rat-directed chat fails to clarify instead of guessing', () => {
  const parsed = understandRatMessage('rat glorbledorf');
  assert.equal(parsed?.intent, 'CLARIFY');
  assert.ok((parsed?.confidence ?? 1) < 0.5);
});


test('private bot conversation accepts natural language without repeating rat name', () => {
  assert.equal(
    understandRatMessage('what have you built?', { allowUnaddressed: true })?.intent,
    'STATUS'
  );
  assert.equal(
    understandRatMessage('wen token?', { allowUnaddressed: true })?.intent,
    'TOKEN'
  );
});

test('group-style parsing still ignores unaddressed natural language', () => {
  assert.equal(understandRatMessage('what have you built?'), null);
});

test('evidence questions containing sell do not become trading advice', () => {
  const parsed = understandRatMessage('rat what did this dev sell 0x1111111111111111111111111111111111111111');
  assert.equal(parsed?.intent, 'CREATOR_HISTORY');
});
