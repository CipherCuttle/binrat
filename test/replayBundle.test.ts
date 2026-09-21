import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex } from '../src/core/types.js';
import { sha256Hex } from '../src/evidence/canonical.js';
import { buildObservationReceipt } from '../src/observations/identity.js';
import { projectReplayBundle } from '../src/public/replayBundle.js';
import {
  PUBLIC_FEED_SCHEMA_VERSION,
  PUBLIC_PROJECTION_VERSION,
  type PublicBag,
  type PublicFeed
} from '../src/public/types.js';

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

test('launch-only replay is explicit about missing evidence and partial historical coverage', async () => {
  const feed = await makeFeed();
  const replay = await projectReplayBundle(feed, bag, []);

  assert.deepEqual(replay.stages.map((stage) => stage.label), ['LAUNCH']);
  assert.deepEqual(replay.coverage.availableHorizons, []);
  assert.deepEqual(replay.coverage.missingHorizons, ['5m', '1h', '24h']);
  assert.equal(replay.coverage.observationCoverage, 'UNVERIFIED');
  assert.equal(replay.coverage.historyCoverage, 'UNVERIFIED');
  assert.equal(replay.canonicalAuthority.asOfBlockHash, feed.asOfBlockHash);
  assert.equal(replay.stages[0]?.evidenceId, feed.receipt.receiptId);
  assert.match(replay.boundaries.noLookahead, /canonical as-of block/);
  assert.match(replay.boundaries.missingEvidence, /never interpolated or synthesized/);
});

test('replay bundle deterministically composes launch, creator file, and frozen observation stages', async () => {
  const feed = await makeFeed();
  const five = await observation(300_000, 110);
  const hour = await observation(3_600_000, 120);
  const day = await observation(86_400_000, 130);

  const forward = await projectReplayBundle(feed, bag, [five, hour, day]);
  const reversed = await projectReplayBundle(feed, bag, [day, hour, five]);

  assert.deepEqual(forward, reversed);
  assert.deepEqual(forward.stages.map((stage) => stage.label), ['LAUNCH', '5m', '1h', '24h']);
  assert.deepEqual(forward.coverage.availableHorizons, ['5m', '1h', '24h']);
  assert.deepEqual(forward.coverage.missingHorizons, []);
  assert.equal(forward.creatorFile.reportedCreatorAddress, creator);
  assert.equal(forward.intelligence.observationCoverage, 'COMPLETE');
  assert.deepEqual(forward.receipt.observationEvidenceDigests, forward.intelligence.receipt.observationEvidenceDigests);
  assert.deepEqual(
    forward.stages.slice(1).map((stage) => stage.evidenceId),
    forward.intelligence.snapshots.map((snapshot) => snapshot.observationId)
  );
  assert.ok(forward.stages.slice(1).every((stage) => stage.targetTimestampMs !== null));
  assert.doesNotMatch(JSON.stringify(forward), /\b(?:BUY|SELL|SAFE|RUG)\b/);
  assert.match(forward.receipt.receiptId, /^binrat-replay:[0-9a-f]{64}$/);
});

test('future and missing observation stages do not leak into replay', async () => {
  const feed = await makeFeed(125);
  const five = await observation(300_000, 110);
  const hour = await observation(3_600_000, 120);
  const futureDay = await observation(86_400_000, 130);

  const noFuture = await projectReplayBundle(feed, bag, [futureDay, hour, five]);
  assert.deepEqual(noFuture.stages.map((stage) => stage.label), ['LAUNCH', '5m', '1h']);
  assert.deepEqual(noFuture.coverage.missingHorizons, ['24h']);
  assert.equal(noFuture.stages.some((stage) => stage.blockNumber === '130'), false);

  const missingHour = await projectReplayBundle(await makeFeed(), bag, [five, futureDay]);
  assert.deepEqual(missingHour.stages.map((stage) => stage.label), ['LAUNCH', '5m', '24h']);
  assert.deepEqual(missingHour.coverage.missingHorizons, ['1h']);
  assert.equal(missingHour.coverage.observationCoverage, 'PARTIAL');
});

test('replay bundle fails closed when nested observation evidence is tampered', async () => {
  const feed = await makeFeed();
  const five = await observation(300_000, 110);
  await assert.rejects(
    projectReplayBundle(feed, bag, [{ ...five, evidenceDigest: '0'.repeat(64) }]),
    /OBSERVATION_INTEGRITY_MISMATCH/
  );
});

test('replay rejects inconsistent maturation timing', async () => {
  const feed = await makeFeed();
  const five = await observation(300_000, 110);
  const inconsistentHour = await buildObservationReceipt({
    chainId: 5042,
    launchId: bag.id,
    horizonMs: 3_600_000,
    targetTimestampMs: 3_600_001,
    observedBlock: 120n,
    observedBlockHash: hash(120),
    observedTimestampMs: 3_600_001,
    status: 'COMPLETE',
    facts: {
      poolCodePresent: true,
      poolActiveLiquidity: 120n,
      poolSqrtPriceX96: 1200n,
      poolTick: 120,
      creatorTokenBalance: 880n,
      tokenTotalSupply: 1000n,
      tokenDecimals: 18
    },
    missing: []
  });
  await assert.rejects(
    projectReplayBundle(feed, bag, [five, inconsistentHour]),
    /REPLAY_OBSERVATION_CHRONOLOGY_MISMATCH/
  );
});

test('replay rejects mismatched launch identity and canonical feed authority', async () => {
  const feed = await makeFeed();
  await assert.rejects(
    projectReplayBundle(feed, { ...bag, id: 'different-launch' }, []),
    /REPLAY_BAG_NOT_IN_FEED/
  );
  await assert.rejects(
    projectReplayBundle(feed, { ...bag, blockHash: hash(101) }, []),
    /REPLAY_LAUNCH_AUTHORITY_MISMATCH/
  );
  await assert.rejects(
    projectReplayBundle({ ...feed, asOfBlockHash: hash(999) }, bag, []),
    /REPLAY_PUBLIC_AUTHORITY_MISMATCH/
  );
  await assert.rejects(
    projectReplayBundle({
      ...feed,
      receipt: { ...feed.receipt, receiptId: `binrat-public:${'0'.repeat(64)}` }
    }, bag, []),
    /REPLAY_PUBLIC_RECEIPT_INTEGRITY_MISMATCH/
  );
});

async function makeFeed(asOfBlock = 1000): Promise<PublicFeed> {
  const asOfBlockHash = hash(asOfBlock);
  const output = {
    schemaVersion: PUBLIC_FEED_SCHEMA_VERSION,
    chainId: 5042,
    asOfBlock: String(asOfBlock),
    asOfBlockHash,
    historyCoverage: 'UNVERIFIED' as const,
    bags: [bag]
  };
  const inputDigest = 'a'.repeat(64);
  const outputDigest = await sha256Hex(output);
  const receiptMaterial = {
    projectionVersion: PUBLIC_PROJECTION_VERSION,
    chainId: output.chainId,
    asOfBlock: BigInt(output.asOfBlock),
    asOfBlockHash,
    historyCoverage: output.historyCoverage,
    inputDigest,
    outputDigest
  };
  return {
    ...output,
    receipt: {
      projectionVersion: PUBLIC_PROJECTION_VERSION,
      chainId: output.chainId,
      asOfBlock: output.asOfBlock,
      asOfBlockHash,
      historyCoverage: output.historyCoverage,
      inputDigest,
      outputDigest,
      receiptId: `binrat-public:${await sha256Hex(receiptMaterial)}`
    }
  };
}
