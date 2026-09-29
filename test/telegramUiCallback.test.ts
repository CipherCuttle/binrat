import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeCallback, parseCallback, TELEGRAM_CALLBACK_MAX_BYTES } from '../src/telegram/ui/callback.js';
import { assertV2Caption, renderRatCard } from '../src/telegram/ui/cards.js';
import { dig } from '../src/autonomous/evidence.js';
import { autonomousFixture, CREATOR } from './support/autonomousFixture.js';

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

test('V2 card captions fail closed instead of truncating canonical evidence', async () => {
  assert.throws(()=>assertV2Caption('🐀'.repeat(1025)),/CAPTION_TOO_LARGE/);
  const f=await autonomousFixture();
  try {
    const receipt=await dig(f.db,{chainId:4663,entityType:'CREATOR',entityId:CREATOR},f.now());
    const card=renderRatCard({kind:'CASE',receipt,mode:'DIG',privateAttention:null});
    assert.ok(Array.from(card.caption).length<=1024);
    assert.match(card.caption,/UNKNOWN: identity, intent, safety and future outcome/);
  } finally { f.db.close(); }
});
