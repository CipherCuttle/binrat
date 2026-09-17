import assert from 'node:assert/strict';
import { buildShareCardModel, buildSharePostText, SHARE_CARD_MODES, SHARE_CARD_VERSION } from '../web/share-card.js';

const fixture = {
  mode: 'FIXTURE',
  symbol: '$RANCID',
  reportedCreatorAddress: '0xa71b000000000000000000000000000000000001',
  priorLaunches: 8,
  coverage: 'PARTIAL',
  note: 'same address. ninth bag.',
  receipt: 'receipt_fixture_rancid_001'
};

const card = buildShareCardModel(fixture);
assert.equal(card.version, SHARE_CARD_VERSION);
assert.ok(SHARE_CARD_MODES.includes(card.mode));
assert.equal(card.mode, 'FIXTURE');
assert.equal(card.creatorShort, '0xa71b…0001');
assert.equal(card.priorLaunches, 8);
assert.equal(card.coverage, 'PARTIAL');
assert.equal(card.stamp, 'FIXTURE // NOT LIVE EVIDENCE');

const post = buildSharePostText(fixture);
assert.match(post, /HOT GARBAGE/);
assert.match(post, /ArcPad-reported creator/);
assert.match(post, /prior indexed bags in this fixture: 8/);
assert.match(post, /FIXTURE \/\/ NOT LIVE EVIDENCE/);

for (const prohibited of ['BUY', 'SELL', 'SAFE', 'RUG', 'SCAM', 'GUARANTEED']) {
  assert.equal(post.toUpperCase().includes(prohibited), false, `SHARE_POST_PROHIBITED:${prohibited}`);
}

const malformed = buildShareCardModel({ mode: 'FIXTURE', symbol: '', reportedCreatorAddress: 'nope', priorLaunches: -3, coverage: 'MAGIC' });
assert.equal(malformed.reportedCreatorAddress, '0x0000000000000000000000000000000000000000');
assert.equal(malformed.priorLaunches, 0);
assert.equal(malformed.coverage, 'UNVERIFIED');

console.log('BINRAT share-card invariants: PASS');

const live = { ...fixture, mode: 'LIVE', coverage: 'UNVERIFIED' };
assert.equal(buildShareCardModel(live).stamp, 'LIVE // PUBLIC PROJECTION');
assert.match(buildSharePostText(live), /prior indexed bags: 8/);
assert.ok(!buildSharePostText(live).includes('fixture'));
assert.throws(() => buildShareCardModel({ ...fixture, mode: 'OTHER' }));
