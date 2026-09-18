import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex } from '../src/core/types.js';
import { projectCreatorFile } from '../src/public/creatorFile.js';
import type { PublicBag, PublicFeed } from '../src/public/types.js';

const creator = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;
const other = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const token = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Hex;

function bag(id: string, block: number, logIndex: number, owner: Hex): PublicBag {
  return {
    id,
    source: 'ARCPAD',
    token: token(block),
    symbol: id.toUpperCase(),
    name: `${id} name`,
    blockNumber: String(block),
    blockHash: hash(block),
    txHash: hash(block + 1000),
    logIndex,
    reportedCreatorAddress: owner,
    pool: token(block + 100),
    metadata: { imageUri: '', website: '', twitter: '', telegram: '' },
    trashTrail: { priorLaunchCount: owner === creator && block > 100 ? 1 : 0, coverage: 'UNVERIFIED', prior: [] },
    evidence: [{
      state: 'OBSERVED',
      code: 'ARCPAD_REPORTED_CREATOR',
      text: 'ArcPad reported this address on the launch event.',
      sourceFactIds: [`fact-${id}`]
    }]
  };
}

function feed(bags: PublicBag[]): PublicFeed {
  return {
    schemaVersion: 'binrat.public-feed/0.1',
    chainId: 5042,
    asOfBlock: '200',
    asOfBlockHash: hash(200),
    historyCoverage: 'UNVERIFIED',
    bags,
    receipt: {
      projectionVersion: 'BINRAT_PUBLIC_PROJECTION_V0',
      chainId: 5042,
      asOfBlock: '200',
      asOfBlockHash: hash(200),
      historyCoverage: 'UNVERIFIED',
      inputDigest: 'a'.repeat(64),
      outputDigest: 'b'.repeat(64),
      receiptId: `binrat-public:${'c'.repeat(64)}`
    }
  };
}

test('creator file is deterministic, creator-scoped, and does not upgrade history coverage', async () => {
  const a1 = bag('a1', 100, 0, creator);
  const b1 = bag('b1', 101, 0, other);
  const a2 = bag('a2', 102, 1, creator);
  const forward = await projectCreatorFile(feed([a2, b1, a1]), creator);
  const reversed = await projectCreatorFile(feed([a1, b1, a2]), creator.toUpperCase());

  assert.ok(forward);
  assert.deepEqual(forward, reversed);
  assert.equal(forward.historyCoverage, 'UNVERIFIED');
  assert.equal(forward.indexedLaunchCount, 2);
  assert.equal(forward.firstIndexedBlock, '100');
  assert.equal(forward.lastIndexedBlock, '102');
  assert.deepEqual(forward.launches.map((item) => item.id), ['a2', 'a1']);
  assert.match(forward.receipt.receiptId, /^binrat-creator:[0-9a-f]{64}$/);
  assert.equal(forward.receipt.sourcePublicReceiptId.startsWith('binrat-public:'), true);
});

test('creator file returns null when creator is absent and rejects malformed addresses', async () => {
  assert.equal(await projectCreatorFile(feed([bag('a1', 100, 0, creator)]), other), null);
  await assert.rejects(projectCreatorFile(feed([]), 'not-an-address'), /CREATOR_ADDRESS_INVALID/);
});
