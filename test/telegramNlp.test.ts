import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { understandRatMessage } from '../src/telegram/nlp.js';

test('explicit commands remain highest-authority routing', () => {
  assert.deepEqual(
    understandRatMessage('/creator 0x1111111111111111111111111111111111111111'),
    {
      intent: 'CREATOR_HISTORY',
      argument: '0x1111111111111111111111111111111111111111',
      strength: 'EXPLICIT',
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

test('a bare address stays ambiguous until the public feed resolves its role', () => {
  const parsed = understandRatMessage('rat 0x1111111111111111111111111111111111111111');
  assert.equal(parsed?.intent, 'ADDRESS_LOOKUP');
  assert.equal(parsed?.strength, 'AMBIGUOUS');
});

test('replay intent extracts a strict launch id', () => {
  const parsed = understandRatMessage('rat what happened after launch aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(parsed?.intent, 'REPLAY');
  assert.equal(parsed?.argument, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
});

test('ordinary group chat without rat reference remains ignored', () => {
  assert.equal(understandRatMessage('wen moon?'), null);
  assert.equal(understandRatMessage('is this safe?'), null);
});

test('unknown rat-directed chat clarifies instead of pretending to be calibrated', () => {
  const parsed = understandRatMessage('rat glorbledorf');
  assert.equal(parsed?.intent, 'CLARIFY');
  assert.equal(parsed?.strength, 'AMBIGUOUS');
});

test('private bot conversation accepts natural language without repeating rat name', () => {
  assert.equal(understandRatMessage('what have you built?', { allowUnaddressed: true })?.intent, 'STATUS');
  assert.equal(understandRatMessage('wen token?', { allowUnaddressed: true })?.intent, 'TOKEN');
});

test('evidence questions containing sell do not become trading advice', () => {
  const parsed = understandRatMessage('rat what did this dev sell 0x1111111111111111111111111111111111111111');
  assert.equal(parsed?.intent, 'CREATOR_HISTORY');
});

type Corpus = {
  cases: Array<{
    text: string;
    allowUnaddressed: boolean;
    expectedIntent: string | null;
  }>;
};

for (const fixtureName of ['rat-intent-corpus-v0.json', 'rat-intent-holdout-v0.json']) {
  test(`${fixtureName} routes every frozen utterance as labeled`, () => {
    const fixture = JSON.parse(
      readFileSync(resolve(process.cwd(), 'test/fixtures', fixtureName), 'utf8')
    ) as Corpus;

    assert.ok(fixture.cases.length >= (fixtureName.includes('holdout') ? 30 : 100));
    for (const item of fixture.cases) {
      const parsed = understandRatMessage(item.text, { allowUnaddressed: item.allowUnaddressed });
      assert.equal(
        parsed?.intent ?? null,
        item.expectedIntent,
        `${fixtureName}: ${JSON.stringify(item.text)}`
      );
    }
  });
}
