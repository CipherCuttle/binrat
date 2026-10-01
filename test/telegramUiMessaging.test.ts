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
