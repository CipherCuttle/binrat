import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex } from '../src/core/types.js';
import { buildObservationReceipt } from '../src/observations/identity.js';
import { projectReplayBundle } from '../src/public/replayBundle.js';
import type { PublicBag, PublicFeed } from '../src/public/types.js';

const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const creator = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;
const bag: PublicBag = {
  id: 'replay-bag',
  source: 'ARCPAD',
  token: '0x1000000000000000000000000000000000000001',
  symbol: 'RPLY',
  name: 'Replay Bag',
  blockNumber: '100',
  blockHash: hash(100),
  txHash: hash(1000),
  logIndex: 0,
  reportedCreatorAddress: creator,
  pool: '0x2000000000000000000000000000000000000002',
  metadata: { imageUri: '', website: '', twitter: '', telegram: '' },
  trashTrail: { priorLaunchCount: 0, coverage: 'UNVERIFIED', prior: [] },
  evidence: [{
    state: 'OBSERVED',
    code: 'ARCPAD_REPORTED_CREATOR',
    text: 'ArcPad reported this address on the launch event.',
    sourceFactIds: ['fact-replay']
  }]
};
const feed: PublicFeed = {
  schemaVersion: 'binrat.public-feed/0.1',
  chainId: 5042,
  asOfBlock: '1000',
  asOfBlockHash: hash(1000),
  historyCoverage: 'UNVERIFIED',
  bags: [bag],
  receipt: {
    projectionVersion: 'BINRAT_PUBLIC_PROJECTION_V0',
    chainId: 5042,
    asOfBlock: '1000',
    asOfBlockHash: hash(1000),
    historyCoverage: 'UNVERIFIED',
    inputDigest: 'a'.repeat(64),
    outputDigest: 'b'.repeat(64),
    receiptId: `binrat-public:${'c'.repeat(64)}`
  }
};

async function observation(horizonMs: number, block: number) {
  return buildObservationReceipt({
    chainId: 5042,
    launchId: bag.id,
    horizonMs,
    targetTimestampMs: horizonMs,
    observedBlock: BigInt(block),
    observedBlockHash: hash(block),
    observedTimestampMs: horizonMs + 1,
    status: 'COMPLETE',
    facts: {
      poolCodePresent: true,
      poolActiveLiquidity: BigInt(block),
      poolSqrtPriceX96: BigInt(block * 10),
      poolTick: block,
      creatorTokenBalance: BigInt(1000 - block),
      tokenTotalSupply: 1000n,
      tokenDecimals: 18
    },
    missing: []
  });
}

test('replay bundle deterministically composes launch, creator file, and frozen observation stages', async () => {
  const five = await observation(300_000, 110);
  const hour = await observation(3_600_000, 120);
  const day = await observation(86_400_000, 130);

  const forward = await projectReplayBundle(feed, bag, [five, hour, day]);
  const reversed = await projectReplayBundle(feed, bag, [day, hour, five]);

  assert.deepEqual(forward, reversed);
  assert.deepEqual(forward.stages.map((stage) => stage.label), ['LAUNCH', '5m', '1h', '24h']);
  assert.equal(forward.creatorFile.reportedCreatorAddress, creator);
  assert.equal(forward.intelligence.observationCoverage, 'COMPLETE');
  assert.deepEqual(forward.receipt.observationEvidenceDigests, forward.intelligence.receipt.observationEvidenceDigests);
  assert.match(forward.receipt.receiptId, /^binrat-replay:[0-9a-f]{64}$/);
});

test('replay bundle fails closed when nested observation evidence is tampered', async () => {
  const five = await observation(300_000, 110);
  await assert.rejects(
    projectReplayBundle(feed, bag, [{ ...five, evidenceDigest: '0'.repeat(64) }]),
    /OBSERVATION_INTEGRITY_MISMATCH/
  );
});
