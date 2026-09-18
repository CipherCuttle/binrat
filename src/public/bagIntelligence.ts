import { OBSERVATION_HORIZONS } from '../observations/horizons.js';
import type { LaunchObservationReceipt } from '../observations/types.js';
import { sha256Hex } from '../evidence/canonical.js';
import type { PublicBag, PublicCoverage, PublicFeed } from './types.js';

export const BAG_INTELLIGENCE_SCHEMA_VERSION = 'binrat.bag-intelligence/0.1' as const;
export const BAG_INTELLIGENCE_PROJECTION_VERSION = 'BINRAT_BAG_INTELLIGENCE_V0' as const;

export interface PublicObservationSnapshot {
  observationId: string;
  evidenceDigest: string;
  horizonMs: number;
  horizonLabel: string;
  targetTimestampMs: number;
  observedBlock: string;
  observedBlockHash: string;
  observedTimestampMs: number;
  status: LaunchObservationReceipt['status'];
  poolCodePresent: boolean | null;
  poolActiveLiquidityRaw: string | null;
  poolSqrtPriceX96: string | null;
  poolTick: number | null;
  reportedCreatorBalanceRaw: string | null;
  tokenTotalSupplyRaw: string | null;
  tokenDecimals: number | null;
  reportedCreatorShareBps: string | null;
}

export interface PublicObservedChange {
  field: 'POOL_ACTIVE_LIQUIDITY_RAW' | 'POOL_TICK' | 'REPORTED_CREATOR_BALANCE_RAW' | 'REPORTED_CREATOR_SHARE_BPS';
  fromHorizonMs: number;
  toHorizonMs: number;
  before: string;
  after: string;
  direction: 'UP' | 'DOWN' | 'SAME';
}

export interface PublicBagIntelligence {
  schemaVersion: typeof BAG_INTELLIGENCE_SCHEMA_VERSION;
  projectionVersion: typeof BAG_INTELLIGENCE_PROJECTION_VERSION;
  chainId: number;
  asOfBlock: string;
  historyCoverage: PublicCoverage;
  observationCoverage: PublicCoverage;
  bagId: string;
  token: string;
  reportedCreatorAddress: string;
  snapshots: PublicObservationSnapshot[];
  changes: PublicObservedChange[];
  receipt: {
    sourcePublicReceiptId: string;
    observationEvidenceDigests: string[];
    outputDigest: string;
    receiptId: string;
  };
}

export async function projectBagIntelligence(
  feed: PublicFeed,
  bag: PublicBag,
  observations: LaunchObservationReceipt[]
): Promise<PublicBagIntelligence> {
  const asOf = BigInt(feed.asOfBlock);
  const valid = observations
    .filter((receipt) => receipt.launchId === bag.id && receipt.chainId === feed.chainId && receipt.observedBlock <= asOf)
    .sort((a, b) => a.horizonMs - b.horizonMs || a.observationId.localeCompare(b.observationId));

  const seen = new Set<number>();
  for (const receipt of valid) {
    if (seen.has(receipt.horizonMs)) throw new Error(`PUBLIC_OBSERVATION_DUPLICATE_HORIZON:${bag.id}:${receipt.horizonMs}`);
    seen.add(receipt.horizonMs);
  }

  const snapshots = valid.map(projectSnapshot);
  const expected = new Set(OBSERVATION_HORIZONS.map((horizon) => horizon.ms));
  const observationCoverage: PublicCoverage =
    snapshots.length === 0
      ? 'UNVERIFIED'
      : snapshots.every((snapshot) => snapshot.status === 'COMPLETE') &&
          snapshots.length === expected.size &&
          snapshots.every((snapshot) => expected.has(snapshot.horizonMs))
        ? 'COMPLETE'
        : 'PARTIAL';

  const changes: PublicObservedChange[] = [];
  for (let i = 1; i < snapshots.length; i += 1) {
    changes.push(...diffSnapshots(snapshots[i - 1]!, snapshots[i]!));
  }

  const output = {
    schemaVersion: BAG_INTELLIGENCE_SCHEMA_VERSION,
    projectionVersion: BAG_INTELLIGENCE_PROJECTION_VERSION,
    chainId: feed.chainId,
    asOfBlock: feed.asOfBlock,
    historyCoverage: feed.historyCoverage,
    observationCoverage,
    bagId: bag.id,
    token: bag.token,
    reportedCreatorAddress: bag.reportedCreatorAddress,
    snapshots,
    changes
  };
  const outputDigest = await sha256Hex(output);
  const observationEvidenceDigests = valid.map((receipt) => receipt.evidenceDigest);
  const receiptMaterial = {
    projectionVersion: BAG_INTELLIGENCE_PROJECTION_VERSION,
    sourcePublicReceiptId: feed.receipt.receiptId,
    bagId: bag.id,
    observationEvidenceDigests,
    outputDigest
  };
  return {
    ...output,
    receipt: {
      sourcePublicReceiptId: feed.receipt.receiptId,
      observationEvidenceDigests,
      outputDigest,
      receiptId: `binrat-intelligence:${await sha256Hex(receiptMaterial)}`
    }
  };
}

function projectSnapshot(receipt: LaunchObservationReceipt): PublicObservationSnapshot {
  const supply = receipt.facts.tokenTotalSupply;
  const creator = receipt.facts.creatorTokenBalance;
  const shareBps =
    supply !== undefined && supply > 0n && creator !== undefined
      ? (creator * 10_000n) / supply
      : null;
  return {
    observationId: receipt.observationId,
    evidenceDigest: receipt.evidenceDigest,
    horizonMs: receipt.horizonMs,
    horizonLabel: OBSERVATION_HORIZONS.find((item) => item.ms === receipt.horizonMs)?.label ?? `${receipt.horizonMs}ms`,
    targetTimestampMs: receipt.targetTimestampMs,
    observedBlock: receipt.observedBlock.toString(),
    observedBlockHash: receipt.observedBlockHash,
    observedTimestampMs: receipt.observedTimestampMs,
    status: receipt.status,
    poolCodePresent: receipt.facts.poolCodePresent ?? null,
    poolActiveLiquidityRaw: receipt.facts.poolActiveLiquidity?.toString() ?? null,
    poolSqrtPriceX96: receipt.facts.poolSqrtPriceX96?.toString() ?? null,
    poolTick: receipt.facts.poolTick ?? null,
    reportedCreatorBalanceRaw: creator?.toString() ?? null,
    tokenTotalSupplyRaw: supply?.toString() ?? null,
    tokenDecimals: receipt.facts.tokenDecimals ?? null,
    reportedCreatorShareBps: shareBps?.toString() ?? null
  };
}

function diffSnapshots(before: PublicObservationSnapshot, after: PublicObservationSnapshot): PublicObservedChange[] {
  const changes: PublicObservedChange[] = [];
  pushBigIntChange(changes, 'POOL_ACTIVE_LIQUIDITY_RAW', before, after, before.poolActiveLiquidityRaw, after.poolActiveLiquidityRaw);
  pushNumberChange(changes, 'POOL_TICK', before, after, before.poolTick, after.poolTick);
  pushBigIntChange(changes, 'REPORTED_CREATOR_BALANCE_RAW', before, after, before.reportedCreatorBalanceRaw, after.reportedCreatorBalanceRaw);
  pushBigIntChange(changes, 'REPORTED_CREATOR_SHARE_BPS', before, after, before.reportedCreatorShareBps, after.reportedCreatorShareBps);
  return changes;
}

function pushBigIntChange(
  target: PublicObservedChange[],
  field: PublicObservedChange['field'],
  before: PublicObservationSnapshot,
  after: PublicObservationSnapshot,
  left: string | null,
  right: string | null
): void {
  if (left === null || right === null) return;
  const a = BigInt(left);
  const b = BigInt(right);
  target.push({
    field,
    fromHorizonMs: before.horizonMs,
    toHorizonMs: after.horizonMs,
    before: left,
    after: right,
    direction: b > a ? 'UP' : b < a ? 'DOWN' : 'SAME'
  });
}

function pushNumberChange(
  target: PublicObservedChange[],
  field: PublicObservedChange['field'],
  before: PublicObservationSnapshot,
  after: PublicObservationSnapshot,
  left: number | null,
  right: number | null
): void {
  if (left === null || right === null) return;
  target.push({
    field,
    fromHorizonMs: before.horizonMs,
    toHorizonMs: after.horizonMs,
    before: String(left),
    after: String(right),
    direction: right > left ? 'UP' : right < left ? 'DOWN' : 'SAME'
  });
}
