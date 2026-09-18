import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex } from '../src/core/types.js';
import { buildObservationReceipt } from '../src/observations/identity.js';
import { projectBagIntelligence } from '../src/public/bagIntelligence.js';
import type { PublicBag, PublicFeed } from '../src/public/types.js';

const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const token = '0x1000000000000000000000000000000000000001' as Hex;
const creator = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;
const bag: PublicBag = {
  id: 'bag-intelligence-test',
  source: 'ARCPAD',
  token,
  symbol: 'INT',
  name: 'Intelligence',
  blockNumber: '100',
  blockHash: hash(100),
  txHash: hash(1000),
  logIndex: 0,
  reportedCreatorAddress: creator,
  pool: '0x2000000000000000000000000000000000000002',
  metadata: { imageUri: '', website: '', twitter: '', telegram: '' },
  trashTrail: { priorLaunchCount: 0, coverage: 'UNVERIFIED', prior: [] },
  evidence: []
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

async function receipt(horizonMs: number, block: number, liquidity: bigint, creatorBalance: bigint) {
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
      poolActiveLiquidity: liquidity,
      poolSqrtPriceX96: liquidity * 10n,
      poolTick: Number(liquidity),
      creatorTokenBalance: creatorBalance,
      tokenTotalSupply: 1000n,
      tokenDecimals: 18
    },
    missing: []
  });
}

test('bag intelligence projects factual snapshots and deterministic changes without upgrading history coverage', async () => {
  const five = await receipt(300_000, 110, 10n, 100n);
  const hour = await receipt(3_600_000, 120, 8n, 50n);
  const day = await receipt(86_400_000, 130, 8n, 50n);

  const projected = await projectBagIntelligence(feed, bag, [day, five, hour]);
  assert.equal(projected.historyCoverage, 'UNVERIFIED');
  assert.equal(projected.observationCoverage, 'COMPLETE');
  assert.deepEqual(projected.snapshots.map((item) => item.horizonLabel), ['5m', '1h', '24h']);
  assert.equal(projected.snapshots[0]?.reportedCreatorShareBps, '1000');
  assert.equal(projected.snapshots[1]?.reportedCreatorShareBps, '500');
  assert.equal(
    projected.changes.find((item) => item.field === 'REPORTED_CREATOR_SHARE_BPS' && item.toHorizonMs === 3_600_000)?.direction,
    'DOWN'
  );
  assert.match(projected.receipt.receiptId, /^binrat-intelligence:[0-9a-f]{64}$/);
});

test('future observations are excluded and incomplete horizon coverage stays partial', async () => {
  const five = await receipt(300_000, 110, 10n, 100n);
  const future = await receipt(3_600_000, 2000, 8n, 50n);
  const projected = await projectBagIntelligence(feed, bag, [future, five]);
  assert.equal(projected.snapshots.length, 1);
  assert.equal(projected.observationCoverage, 'PARTIAL');
});
