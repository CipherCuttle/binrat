import assert from 'node:assert/strict';
import test from 'node:test';
import { dig } from '../src/autonomous/evidence.js';
import { discoverRats } from '../src/autonomous/rats.js';
import { createPublicShareReceipt } from '../src/autonomous/share.js';
import { parseCallback } from '../src/telegram/ui/callback.js';
import { renderRatCard } from '../src/telegram/ui/cards.js';
import { autonomousFixture, CREATOR } from './support/autonomousFixture.js';

const JARGON = /sourceVerified|runtimeFresh|authority_json|checkpointBlock|evidenceDigest|SYNC_[A-Z_]+|Coverage:|UNKNOWN:|OBSERVED:|DERIVED:/i;

function primaryActions(card: ReturnType<typeof renderRatCard>): number {
  return card.keyboard[0]?.filter(button=>'callbackData' in button || 'webAppUrl' in button).length ?? 0;
}

function watchRows(count:number) {
  return Array.from({length:count},(_,index)=>({
    user_id:77,chat_id:77,chain_id:4663,entity_type:'CREATOR' as const,
    entity_id:`0x${(index+1).toString(16).padStart(40,'0')}`,
    generation:`generation-${index}`,enabled:1,start_block:100+index,
    start_hash:`0x${(index+1).toString(16).padStart(64,'0')}`,
    created_at_ms:1_700_000_000_000+index,last_update_id:1000+index,
    policy:'CREATOR_RECURRENCE_V1' as const
  }));
}

test('WATCHES card discloses truncation and legacy migration state, with a direct full-list handoff', () => {
  const card=renderRatCard({kind:'WATCHLIST',watches:watchRows(7),legacyWatchCount:2});
  assert.equal(card.view,'WATCHLIST');
  assert.match(card.caption,/WATCHING 7 SETS OF PAWS/);
  assert.equal((card.caption.match(/^• /gm) ?? []).length,5);
  assert.match(card.caption,/\+ 2 more active watches in the full list/);
  assert.match(card.caption,/2 legacy watches are not active here; re-arm explicitly on Pons 4663/);
  const full=(card.keyboard[0]![0] as {webAppUrl:string}).webAppUrl;
  assert.match(full,/\?view=watches$/);

  const legacyOnly=renderRatCard({kind:'WATCHLIST',watches:[],legacyWatchCount:1});
  assert.equal(legacyOnly.view,'WATCHLIST');
  assert.match(legacyOnly.caption,/No active V1 watches/);
  assert.match(legacyOnly.caption,/1 legacy watch is not active here/);
});

test('historical Arc CASE cards expose evidence but never a dead Watch action', async () => {
  const f=await autonomousFixture();
  try {
    const receipt=await dig(f.db,{chainId:4663,entityType:'CREATOR',entityId:CREATOR},f.now());
    const historical={...receipt,chainId:5042};
    const card=renderRatCard({kind:'CASE',receipt:historical,mode:'DIG',privateAttention:null});
    const actions=card.keyboard.flatMap(row=>row.flatMap(button=>'callbackData' in button ? [parseCallback(button.callbackData)?.action] : []));
    assert.ok(actions.includes('WHY'));
    assert.equal(actions.includes('WATCH'),false);

    const error=renderRatCard({kind:'ERROR',code:'Live watches are available only on Robinhood/Pons 4663. Arc 5042 remains historical evidence only.'});
    assert.match(error.caption,/OLD TRAIL ONLY/);
    assert.match(error.caption,/Live watches run on Pons 4663/);
    assert.doesNotMatch(error.caption,/PIPE SMELLS WRONG/);
  } finally { f.db.close(); }
});

test('V2 error cards preserve fail-closed reason classes instead of collapsing to a generic pipe error', () => {
  const cases:Array<[string,RegExp]> = [
    ['The live index is unavailable or stale. No new investigation or alert authority.',/INDEX WENT COLD/],
    ['A fresh canonical Robinhood boundary could not be verified. Watch was not added.',/PONS HEAD NOT VERIFIED/],
    ['That Rat snapshot is unavailable or expired.',/THAT RAT PAGE EXPIRED/],
    ['Discovery receipts are unavailable. No rats invented.',/RAT RECEIPTS UNAVAILABLE/],
    ['Discovery receipts could not be saved. No rats invented.',/RAT SNAPSHOT NOT SAVED/],
    ['Discovery retention is unavailable. No rats invented.',/RAT SNAPSHOT NOT SAVED/]
  ];
  for (const [code,expected] of cases) {
    const card=renderRatCard({kind:'ERROR',code});
    assert.match(card.caption,expected);
    assert.doesNotMatch(card.caption,/PIPE SMELLS WRONG/);
  }
});

test('V2 scout cards lead with one factual finding and keep infrastructure vocabulary out of level one', async () => {
  const f=await autonomousFixture();
  try {
    await f.launch(99,CREATOR); await f.checkpoint(100);
    const receipt=await dig(f.db,{chainId:4663,entityType:'CREATOR',entityId:CREATOR},f.now());
    const snapshot=await discoverRats(f.db,f.now());
    const cards=[
      renderRatCard({kind:'HOME'}),
      renderRatCard({kind:'RATS',snapshot,candidateIndex:0}),
      renderRatCard({kind:'CASE',receipt,mode:'DIG',privateAttention:null}),
      renderRatCard({kind:'CASE',receipt,mode:'WHY',privateAttention:null}),
      renderRatCard({kind:'WATCH',reply:'🐀 watch armed. 4663:CREATOR:0xdead. Future launches only, after block 101.'}),
      renderRatCard({kind:'WATCHLIST',watches:[],legacyWatchCount:0}),
      renderRatCard({kind:'ERROR',code:'INDEX_UNAVAILABLE'})
    ];
    for (const card of cards) {
      assert.doesNotMatch(card.caption,JARGON,card.view);
      assert.ok(primaryActions(card)<=2,`${card.view} primary actions`);
    }
    assert.match(cards[0]!.caption,/Catch repeat launchers early/);
    assert.match(cards[1]!.caption,/SAME PAWS/);
    assert.match(cards[1]!.caption,/2 LAUNCHES INDEXED/);
    assert.match(cards[1]!.caption,/Latest: \$FIXTURE · block 100/);
    assert.match(cards[1]!.caption,/2 retained receipts/);
    assert.match(cards[2]!.caption,/found .* launches from this reported deployer/i);
    assert.match(cards[3]!.caption,/WHY I NOTICED/);
    assert.match(cards[4]!.caption,/WATCHING THESE PAWS/);
    assert.match(cards[5]!.caption,/NOTHING IN THE BIN/);
    assert.match(cards[6]!.caption,/PIPE SMELLS WRONG/);

    const publicReceipt=await createPublicShareReceipt(f.db,receipt.caseId,f.now());
    const opened=renderRatCard({kind:'OPEN_RECEIPT',receipt:publicReceipt});
    assert.equal(parseCallback((opened.keyboard[0]![0] as {callbackData:string}).callbackData)?.action,'FULL');
  } finally { f.db.close(); }
});
