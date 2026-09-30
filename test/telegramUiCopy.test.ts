import assert from 'node:assert/strict';
import test from 'node:test';
import { dig } from '../src/autonomous/evidence.js';
import { discoverRats } from '../src/autonomous/rats.js';
import {
  assertPresentationCard,
  renderAlertCard,
  renderRatCard,
  TELEGRAM_NORMAL_COPY_LIMIT,
  TELEGRAM_VISIBLE_ACTION_LIMIT,
  TELEGRAM_WHY_COPY_LIMIT
} from '../src/telegram/ui/cards.js';
import { parseCallback } from '../src/telegram/ui/callback.js';
import { autonomousFixture, CREATOR } from './support/autonomousFixture.js';

function actionLabels(card: ReturnType<typeof renderRatCard>): string[] {
  return card.keyboard.flat().map(button => button.text);
}

function callbackActions(card: ReturnType<typeof renderRatCard>): string[] {
  return card.keyboard.flatMap(row => row.flatMap(button =>
    'callbackData' in button ? [parseCallback(button.callbackData)?.action ?? 'INVALID'] : []));
}

test('W0 HOME explains discovery, memory and Watch value inside the normal copy/action budget', () => {
  const card=renderRatCard({kind:'HOME'});
  assert.match(card.caption,/repeat launchers/i);
  assert.match(card.caption,/watched ones come back/i);
  assert.match(card.caption,/No vibes\. Receipts\./);
  assert.ok(Array.from(card.caption).length<=TELEGRAM_NORMAL_COPY_LIMIT);
  assert.ok(card.keyboard.flat().length<=TELEGRAM_VISIBLE_ACTION_LIMIT);
  assert.deepEqual(actionLabels(card),['Find rats','DIG','Watches','Open BINRAT']);
});

test('W0 RATS leads with one recurrence finding and hides evidence infrastructure', async () => {
  const f=await autonomousFixture();
  try {
    await f.launch(98,CREATOR); await f.launch(99,CREATOR);
    const snapshot=await discoverRats(f.db,f.now());
    assert.ok(snapshot.candidates.length>0);
    const card=renderRatCard({kind:'RATS',snapshot,candidateIndex:0});
    assert.match(card.caption,/Same paws\. Again\./);
    assert.match(card.caption,/receipts for \d+ launches? from this deployer/i);
    assert.match(card.caption,/latest block \d+/i);
    assert.doesNotMatch(card.caption,/Coverage:|OBSERVED:|DERIVED:|UNKNOWN:|sourceVerified|runtimeFresh|evidenceDigest/i);
    assert.ok(Array.from(card.caption).length<=TELEGRAM_NORMAL_COPY_LIMIT);
    assert.ok(card.keyboard.flat().length<=TELEGRAM_VISIBLE_ACTION_LIMIT);
    assert.deepEqual(callbackActions(card).slice(0,2),['CASE','WATCH']);
  } finally { f.db.close(); }
});

test('W0 CASE stays terse while WHY preserves bounded explanation and FULL receipt depth', async () => {
  const f=await autonomousFixture();
  try {
    const receipt=await dig(f.db,{chainId:4663,entityType:'CREATOR',entityId:CREATOR},f.now());
    const caseCard=renderRatCard({kind:'CASE',receipt,mode:'DIG',privateAttention:null});
    const whyCard=renderRatCard({kind:'CASE',receipt,mode:'WHY',privateAttention:null});
    assert.match(caseCard.caption,/Dug it up/);
    assert.doesNotMatch(caseCard.caption,/Coverage:|OBSERVED:|DERIVED:|UNKNOWN:|caseId|shareId/i);
    assert.deepEqual(actionLabels(caseCard),['Watch','Open Case','Why','Share']);
    assert.ok(Array.from(caseCard.caption).length<=TELEGRAM_NORMAL_COPY_LIMIT);
    assert.match(whyCard.caption,/Why this surfaced/);
    assert.match(whyCard.caption,/Known history is partial/);
    assert.ok(Array.from(whyCard.caption).length<=TELEGRAM_WHY_COPY_LIMIT);
    assert.deepEqual(actionLabels(whyCard),['Open Case','Full receipt','Back']);
    assert.ok(callbackActions(whyCard).includes('FULL'));
  } finally { f.db.close(); }
});

test('W0 Watch and error states translate internal state into Rat language', () => {
  const armed=renderRatCard({kind:'WATCH',reply:'🐀 watch armed.\n4663:CREATOR:0xabc\nFuture launches only, after block 123.'});
  assert.equal(armed.caption,"🐀 Watching these paws. ✓\nI'll squeak if this deployer launches again.");
  const error=renderRatCard({kind:'ERROR',code:'The live index is unavailable or stale. No new investigation or alert authority.'});
  assert.match(error.caption,/Pipe smells wrong/);
  assert.doesNotMatch(error.caption,/live index|authority|INDEX_|SYNC_/i);
});

test('W0 ALERT carries one event and at most three visible actions', async () => {
  const f=await autonomousFixture();
  try {
    const receipt=await dig(f.db,{chainId:4663,entityType:'CREATOR',entityId:CREATOR},f.now());
    const card=renderAlertCard(receipt,100);
    assert.match(card.caption,/SAME PAWS\. NEW LAUNCH/);
    assert.match(card.caption,/watched deployers is back/);
    assert.deepEqual(actionLabels(card),['Investigate','Why','Unwatch']);
    assert.ok(card.keyboard.flat().length<=3);
    assert.doesNotMatch(card.caption,/OBSERVED:|DERIVED:|UNKNOWN:|Coverage:|evidenceDigest/i);
  } finally { f.db.close(); }
});

test('presentation guard rejects jargon and action-wall regressions', () => {
  assert.throws(()=>assertPresentationCard({
    view:'HOME',media:'idle-neutral',caption:'sourceVerified=true',keyboard:[]
  }),/JARGON_LEAK/);
  assert.throws(()=>assertPresentationCard({
    view:'HOME',media:'idle-neutral',caption:'short',
    keyboard:[[
      {text:'1',callbackData:'x'},{text:'2',callbackData:'x'},{text:'3',callbackData:'x'},
      {text:'4',callbackData:'x'},{text:'5',callbackData:'x'}
    ]]
  }),/ACTION_BUDGET/);
});
