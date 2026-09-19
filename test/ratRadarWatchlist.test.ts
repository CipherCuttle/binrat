import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex } from '../src/core/types.js';
import type { PublicFeed } from '../src/public/types.js';
import { deriveRatRadarSwapReceipt } from '../src/ratRadar/activity.js';
import { projectRatRadarFreeWatchlist } from '../src/ratRadar/watchlist.js';

test('Rat Radar free watchlist ranks recurrence before one-off early timing and exposes reasons', async () => {
  const feed = makeFeed();
  const recurrent = address(50);
  const oneOff = address(51);

  const receipts = [
    await swap('launch-a', address(10), address(20), 102n, 1, recurrent),
    await swap('launch-b', address(11), address(21), 207n, 1, recurrent),
    await swap('launch-a', address(10), address(20), 101n, 2, oneOff),
    await swap('launch-a', address(10), address(20), 103n, 3, oneOff)
  ];

  const watchlist = await projectRatRadarFreeWatchlist(feed, receipts);

  assert.equal(watchlist.schemaVersion, 'binrat.rat-radar-watchlist/0.1');
  assert.equal(watchlist.rankingVersion, 'binrat.rat-radar-ranking/0.1');
  assert.equal(watchlist.method.evidencedRole, 'UNISWAP_V3_SWAP_RECIPIENT');
  assert.match(watchlist.method.identityBoundary, /not automatically a human trader/i);
  assert.match(watchlist.method.recommendationBoundary, /not a BUY\/SELL recommendation/i);

  assert.equal(watchlist.candidates[0]?.observedRecipientAddress, recurrent);
  assert.equal(watchlist.candidates[0]?.distinctLaunchCount, 2);
  assert.equal(watchlist.candidates[0]?.acquisitionReceiptCount, 2);
  assert.equal(watchlist.candidates[0]?.medianFirstEntryBlockDelta, 4.5);
  assert.equal(watchlist.candidates[0]?.earliestFirstEntryBlockDelta, 2);
  assert.ok(watchlist.candidates[0]?.reasonCodes.includes('RECURRENT_RECIPIENT_ACROSS_LAUNCHES'));
  assert.equal(watchlist.candidates[0]?.evidenceActivityIds.length, 2);

  assert.equal(watchlist.candidates[1]?.observedRecipientAddress, oneOff);
  assert.equal(watchlist.candidates[1]?.distinctLaunchCount, 1);
  assert.equal(watchlist.coverage.acquisitionReceiptCount, 4);
  assert.equal(watchlist.coverage.distinctRecipientAddressCount, 2);
  assert.equal(watchlist.coverage.status, 'PARTIAL');
  assert.match(watchlist.receipt.receiptId, /^binrat-rat-radar:[0-9a-f]{64}$/);
});

test('Rat Radar free watchlist is explicitly empty when no swap evidence exists', async () => {
  const watchlist = await projectRatRadarFreeWatchlist(makeFeed(), []);
  assert.equal(watchlist.coverage.status, 'NO_SWAP_EVIDENCE');
  assert.equal(watchlist.coverage.swapReceiptCount, 0);
  assert.deepEqual(watchlist.candidates, []);
});

function makeFeed(): PublicFeed {
  return {
    schemaVersion: 'binrat.public-feed/0.1',
    chainId: 5042,
    asOfBlock: '300',
    asOfBlockHash: hex64(300),
    historyCoverage: 'UNVERIFIED',
    bags: [
      bag('launch-a', address(10), address(20), 100n),
      bag('launch-b', address(11), address(21), 200n),
      bag('launch-c', address(12), address(22), 300n)
    ],
    receipt: {
      projectionVersion: 'BINRAT_PUBLIC_PROJECTION_V0',
      chainId: 5042,
      asOfBlock: '300',
      asOfBlockHash: hex64(300),
      historyCoverage: 'UNVERIFIED',
      inputDigest: 'a'.repeat(64),
      outputDigest: 'b'.repeat(64),
      receiptId: 'binrat-public:test'
    }
  };
}

function bag(id: string, pool: Hex, token: Hex, blockNumber: bigint): PublicFeed['bags'][number] {
  return {
    id,
    source: 'ARCPAD',
    token,
    symbol: id.toUpperCase(),
    name: id,
    blockNumber: blockNumber.toString(),
    blockHash: hex64(Number(blockNumber)),
    txHash: hex64(Number(blockNumber) + 1),
    logIndex: 0,
    reportedCreatorAddress: address(Number(blockNumber) + 2),
    pool,
    metadata: { imageUri: '', website: '', twitter: '', telegram: '' },
    trashTrail: { priorLaunchCount: 0, coverage: 'UNVERIFIED', prior: [] },
    evidence: []
  };
}

async function swap(
  launchId: string,
  pool: Hex,
  token: Hex,
  blockNumber: bigint,
  logIndex: number,
  recipient: Hex
) {
  return deriveRatRadarSwapReceipt({
    chainId: 5042,
    launchId,
    pool,
    token,
    token0: token,
    token1: address(999),
    blockNumber,
    blockHash: hex64(Number(blockNumber)),
    txHash: hex64(Number(blockNumber) * 10 + logIndex),
    logIndex,
    sender: address(700 + logIndex),
    recipient,
    amount0: -100n,
    amount1: 50n,
    sqrtPriceX96: 1_000n,
    liquidity: 2_000n,
    tick: 5
  });
}

function address(seed: number): Hex {
  return `0x${seed.toString(16).padStart(40, '0').slice(-40)}` as Hex;
}

function hex64(seed: number): Hex {
  return `0x${seed.toString(16).padStart(64, '0').slice(-64)}` as Hex;
}
