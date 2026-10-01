import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeCallback, parseCallback, TELEGRAM_CALLBACK_MAX_BYTES } from '../src/telegram/ui/callback.js';
import { assertV2Caption, renderRatCard } from '../src/telegram/ui/cards.js';
import { dig } from '../src/autonomous/evidence.js';
import { autonomousFixture, CREATOR } from './support/autonomousFixture.js';
import { discoverRats, loadRatsSnapshot } from '../src/autonomous/rats.js';
import { addr } from './support/autonomousFixture.js';

test('Telegram V2 callbacks are versioned, strict and bounded by UTF-8 bytes', async () => {
  const f=await autonomousFixture();
  try {
    const receipt=await dig(f.db,{chainId:4663,entityType:'CREATOR',entityId:CREATOR},f.now());
    const encoded=encodeCallback({action:'WATCH',shareId:receipt.shareId});
    assert.ok(new TextEncoder().encode(encoded).byteLength<=TELEGRAM_CALLBACK_MAX_BYTES);
    assert.deepEqual(parseCallback(encoded),{action:'WATCH',shareId:receipt.shareId});
    assert.equal(parseCallback('br1:a:'+receipt.shareId),null);
    assert.equal(parseCallback('br2:a:forged'),null);
    assert.equal(parseCallback('br2:a:'+receipt.shareId+'x'),null);
  } finally { f.db.close(); }
});

test('RATS pages use a compact persisted snapshot reference with bounded next and previous cards', async () => {
  const f=await autonomousFixture();
  try {
    const other=addr(43);
    await f.launch(99,CREATOR); await f.launch(98,other); await f.launch(97,other);
    const snapshot=await discoverRats(f.db,f.now());
    assert.equal(snapshot.candidates.length,2);
    const first=renderRatCard({kind:'RATS',snapshot,candidateIndex:0});
    assert.match(first.caption,/Fresh repeat 1\/2 · newest first/);
    const firstPageButtons=first.keyboard.flat().filter(button=>'callbackData' in button && ['Newer','Older'].includes(button.text));
    assert.deepEqual(firstPageButtons.map(button=>button.text),['Older']);
    const nextData=(firstPageButtons[0] as {callbackData:string}).callbackData;
    assert.deepEqual(parseCallback(nextData),{action:'RATS_PAGE',discoveryId:snapshot.discoveryId,index:1});
    assert.ok(new TextEncoder().encode(nextData).byteLength<=TELEGRAM_CALLBACK_MAX_BYTES);
    const loaded=await loadRatsSnapshot(f.db,snapshot.discoveryId,f.now());
    const second=renderRatCard({kind:'RATS',snapshot:loaded,candidateIndex:1});
    assert.match(second.caption,/Fresh repeat 2\/2 · newest first/);
    const secondPageButtons=second.keyboard.flat().filter(button=>'callbackData' in button && ['Newer','Older'].includes(button.text));
    assert.deepEqual(secondPageButtons.map(button=>button.text),['Newer']);
    const previousData=(secondPageButtons[0] as {callbackData:string}).callbackData;
    assert.deepEqual(parseCallback(previousData),{action:'RATS_PAGE',discoveryId:snapshot.discoveryId,index:0});
    assert.equal(parseCallback(encodeCallback({action:'RATS_PAGE',discoveryId:snapshot.discoveryId,index:9}))?.action,'RATS_PAGE');
    await f.db.prepare('UPDATE rat_v11_pons_discovery_snapshots SET expires_at_ms=? WHERE discovery_id=?').bind(f.now()-1,snapshot.discoveryId).run();
    await assert.rejects(loadRatsSnapshot(f.db,snapshot.discoveryId,f.now()),/DISCOVERY_UNAVAILABLE/);
    await assert.rejects(loadRatsSnapshot(f.db,'0'.repeat(64),f.now()),/DISCOVERY_UNAVAILABLE/);
  } finally { f.db.close(); }
});

test('V2 card captions fail closed instead of truncating canonical evidence', async () => {
  assert.throws(()=>assertV2Caption('🐀'.repeat(1025)),/CAPTION_TOO_LARGE/);
  const f=await autonomousFixture();
  try {
    const receipt=await dig(f.db,{chainId:4663,entityType:'CREATOR',entityId:CREATOR},f.now());
    const card=renderRatCard({kind:'CASE',receipt,mode:'DIG',privateAttention:null});
    assert.ok(Array.from(card.caption).length<=1024);
    assert.match(card.caption,/CASE FILE/);
    assert.doesNotMatch(card.caption,/UNKNOWN:|coverage|checkpoint|sourceVerified|runtimeFresh/i);
  } finally { f.db.close(); }
});
