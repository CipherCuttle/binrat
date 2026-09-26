/**
 * Research-only falsification suite for the existing Rat Radar projection.
 * It documents *current* behavior; it does not assert trader identities,
 * strategy profitability, verified real-world router labels or chain outcomes.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Hex } from '../src/core/types.js';
import type { PublicFeed } from '../src/public/types.js';
import {
  deriveRatRadarSwapReceipt,
  type RatRadarSwapReceipt
} from '../src/ratRadar/activity.js';
import { projectRatRadarFreeWatchlist } from '../src/ratRadar/watchlist.js';

interface LabLaunch {
  launchId: string;
  launchBlock: number;
  poolSeed: number;
  tokenSeed: number;
}
interface LabAcquisition {
  launchId: string;
  blockNumber: number;
  logIndex: number;
  recipientSeed: number;
}
interface LabFixture {
  schemaVersion: string;
  synthetic: boolean;
  chainId: number;
  asOfBlock: number;
  launches: LabLaunch[];
  recipientSeeds: {
    knownIntermediary: number;
    heldOutIntermediary: number;
    unclassifiedRecurring: number;
    unclassifiedOneOff: number;
  };
  evaluatorOnlyLabels: Record<string, string>;
  acquisitions: LabAcquisition[];
}

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/rat-radar-evidence-lab-v0.json', import.meta.url), 'utf8')
) as LabFixture;
assert.equal(fixture.schemaVersion, 'binrat.rat-radar-evidence-lab/0.1');
assert.equal(fixture.synthetic, true, 'NEVER use real-address labels as synthetic ground truth');
assert.equal(fixture.chainId, 5042);
assert.equal(fixture.evaluatorOnlyLabels[String(fixture.recipientSeeds.heldOutIntermediary)],
  'FIXTURE_HELD_OUT_INTERMEDIARY');

function address(seed: number): Hex {
  return ('0x' + seed.toString(16).padStart(40, '0')) as Hex;
}
function hash(seed: number): Hex {
  return ('0x' + seed.toString(16).padStart(64, '0')) as Hex;
}
function makeFeed(asOfBlock: number): PublicFeed {
  const bags: PublicFeed['bags'] = fixture.launches
    .filter((launch) => launch.launchBlock <= asOfBlock)
    .map((launch) => ({
      id: launch.launchId,
      source: 'ARCPAD',
      token: address(launch.tokenSeed),
      symbol: launch.launchId.toUpperCase(),
      name: launch.launchId,
      blockNumber: String(launch.launchBlock),
      blockHash: hash(launch.launchBlock),
      txHash: hash(launch.launchBlock + 1),
      logIndex: 0,
      reportedCreatorAddress: address(launch.launchBlock + 1000),
      pool: address(launch.poolSeed),
      metadata: { imageUri: '', website: '', twitter: '', telegram: '' },
      trashTrail: { priorLaunchCount: 0, coverage: 'UNVERIFIED', prior: [] },
      evidence: []
    }));
  return {
    schemaVersion: 'binrat.public-feed/0.1',
    chainId: fixture.chainId,
    asOfBlock: String(asOfBlock),
    asOfBlockHash: hash(asOfBlock),
    historyCoverage: 'UNVERIFIED',
    bags,
    receipt: {
      projectionVersion: 'BINRAT_PUBLIC_PROJECTION_V0',
      chainId: fixture.chainId,
      asOfBlock: String(asOfBlock),
      asOfBlockHash: hash(asOfBlock),
      historyCoverage: 'UNVERIFIED',
      inputDigest: 'a'.repeat(64),
      outputDigest: 'b'.repeat(64),
      receiptId: 'binrat-public:synthetic-lab'
    }
  };
}
async function swap(
  acquisition: LabAcquisition,
  overrides: { chainId?: number; blockHashSeed?: number; recipientSeed?: number } = {}
): Promise<RatRadarSwapReceipt> {
  const launch = fixture.launches.find((item) => item.launchId === acquisition.launchId);
  assert.ok(launch, 'fixture must reference an existing launch');
  return deriveRatRadarSwapReceipt({
    chainId: overrides.chainId ?? fixture.chainId,
    launchId: acquisition.launchId,
    pool: address(launch.poolSeed),
    token: address(launch.tokenSeed),
    token0: address(launch.tokenSeed),
    token1: address(999),
    blockNumber: BigInt(acquisition.blockNumber),
    blockHash: hash(overrides.blockHashSeed ?? acquisition.blockNumber),
    txHash: hash(acquisition.blockNumber * 1000 + acquisition.logIndex),
    logIndex: acquisition.logIndex,
    sender: address(700 + acquisition.logIndex),
    recipient: address(overrides.recipientSeed ?? acquisition.recipientSeed),
    amount0: -100n,
    amount1: 50n,
    sqrtPriceX96: 1000n,
    liquidity: 2000n,
    tick: 5
  });
}
function fixtureReceipts(): Promise<RatRadarSwapReceipt[]> {
  return Promise.all(fixture.acquisitions.map((acquisition) => swap(acquisition)));
}

test('LAB: known intermediary exclusion leaves held-out intermediary at the top', async () => {
  const receipts = await fixtureReceipts();
  const feed = makeFeed(fixture.asOfBlock);
  const known = address(fixture.recipientSeeds.knownIntermediary);
  const heldOut = address(fixture.recipientSeeds.heldOutIntermediary);
  const unclassified = address(fixture.recipientSeeds.unclassifiedRecurring);
  const baseline = await projectRatRadarFreeWatchlist(feed, receipts);
  const excludeKnown = await projectRatRadarFreeWatchlist(
    feed, receipts.filter((receipt) => receipt.recipient !== known)
  );
  // Oracle only: evaluator can inspect the synthetic held-out label;
  // the actual system is never allowed to treat this label as known.
  const oracle = await projectRatRadarFreeWatchlist(
    feed, receipts.filter((receipt) => receipt.recipient !== known && receipt.recipient !== heldOut)
  );

  assert.equal(baseline.coverage.acquisitionReceiptCount, 8);
  assert.equal(baseline.coverage.distinctRecipientAddressCount, 4);
  assert.equal(baseline.candidates[0]?.observedRecipientAddress, known);
  assert.equal(baseline.candidates[0]?.distinctLaunchCount, 3);
  assert.equal(excludeKnown.candidates[0]?.observedRecipientAddress, heldOut);
  assert.equal(excludeKnown.candidates[0]?.distinctLaunchCount, 2);
  assert.equal(oracle.candidates[0]?.observedRecipientAddress, unclassified);
  assert.equal(oracle.candidates[0]?.distinctLaunchCount, 2);

  // These are fixture-only contamination counts, NOT real-world error rates.
  console.log('RAT_RADAR_LAB_V0 ' + JSON.stringify({
    synthetic: true,
    asOfBlock: feed.asOfBlock,
    inputAcquisitions: receipts.length,
    topRecipientBaseline: baseline.candidates[0]?.observedRecipientAddress,
    topRecipientExcludeVerified: excludeKnown.candidates[0]?.observedRecipientAddress,
    topRecipientOracleOnly: oracle.candidates[0]?.observedRecipientAddress,
    knownIntermediaryTop1Before: 1,
    heldOutIntermediaryTop1AfterKnownExclusion: 1,
    implication: 'Filtering only verified intermediaries cannot resolve unknown intermediary contamination'
  }));
});

test('LAB: frozen early snapshot ignores future acquisitions and future launches', async () => {
  const receipts = await fixtureReceipts();
  const earlyFeed = makeFeed(150);
  const early = await projectRatRadarFreeWatchlist(earlyFeed, receipts);
  const onlyAvailable = await projectRatRadarFreeWatchlist(
    earlyFeed, receipts.filter((receipt) => receipt.blockNumber <= 150n)
  );
  assert.deepEqual(early, onlyAvailable);
  assert.equal(early.coverage.indexedLaunchCount, 1);
  assert.equal(early.coverage.acquisitionReceiptCount, 4);
  assert.equal(early.asOfBlock, '150');
  const middle = await projectRatRadarFreeWatchlist(makeFeed(250), receipts);
  assert.equal(middle.coverage.indexedLaunchCount, 2);
  assert.equal(middle.coverage.acquisitionReceiptCount, 7);
  assert.equal(early.candidates.find(
    (candidate) => candidate.evidenceActivityIds.some(
      (activityId) => receipts.some(
        (receipt) => receipt.activityId === activityId && receipt.blockNumber > 150n
      )
    )
  ), undefined);
});

test('LAB: cross-chain receipt is excluded without changing receipt digest', async () => {
  const receipts = await fixtureReceipts();
  const unrelatedChain = await swap(fixture.acquisitions[0]!, {
    chainId: 4663, recipientSeed: 77
  });
  const baseline = await projectRatRadarFreeWatchlist(makeFeed(360), receipts);
  const withOtherChain = await projectRatRadarFreeWatchlist(
    makeFeed(360), [...receipts, unrelatedChain]
  );
  assert.deepEqual(withOtherChain, baseline);
});

test('LAB: duplicate activity ID inflates acquisition count unless caller deduplicates', async () => {
  const receipts = await fixtureReceipts();
  const feed = makeFeed(360);
  const baseline = await projectRatRadarFreeWatchlist(feed, receipts);
  const duplicate = await projectRatRadarFreeWatchlist(feed, [...receipts, receipts[0]!]);
  assert.equal(duplicate.coverage.acquisitionReceiptCount,
    baseline.coverage.acquisitionReceiptCount + 1);
  assert.equal(duplicate.candidates[0]?.acquisitionReceiptCount,
    baseline.candidates[0]!.acquisitionReceiptCount + 1);
  assert.notEqual(duplicate.receipt.evidenceDigest, baseline.receipt.evidenceDigest);
  assert.equal(new Set(duplicate.candidates[0]?.evidenceActivityIds).size,
    baseline.candidates[0]?.evidenceActivityIds.length);
});

test('LAB: non-candidate-only swap yields PARTIAL with no ranked addresses', async () => {
  const toPool = await swap({
    launchId: 'lab-alpha', blockNumber: 110, logIndex: 8, recipientSeed: 10
  });
  const projection = await projectRatRadarFreeWatchlist(makeFeed(150), [toPool]);
  assert.equal(projection.coverage.swapReceiptCount, 1);
  assert.equal(projection.coverage.acquisitionReceiptCount, 0);
  assert.equal(projection.coverage.rankedAddressCount, 0);
  assert.deepEqual(projection.candidates, []);
  assert.equal(projection.coverage.status, 'PARTIAL');
});

test('LAB: watchlist assumes upstream canonical block validation', async () => {
  const feed = makeFeed(360);
  const orphan = await swap({
    launchId: 'lab-gamma', blockNumber: 360, logIndex: 99, recipientSeed: 52
  }, { blockHashSeed: 777 });
  assert.notEqual(orphan.blockHash, feed.asOfBlockHash);
  const projection = await projectRatRadarFreeWatchlist(feed, [orphan]);
  assert.equal(projection.candidates[0]?.observedRecipientAddress, address(52));
  assert.equal(projection.coverage.acquisitionReceiptCount, 1);
  // Deliberately documents the projection boundary, not an ingestion failure:
  // this lab bypasses the real canonical receipt store.
});
