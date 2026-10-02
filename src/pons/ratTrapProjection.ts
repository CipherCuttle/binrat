import type { LaunchObserved, Hex } from '../core/types.js';
import { ROBINHOOD_CHAIN_ID } from './chain.js';
import { NATIVE_QUOTE } from './outcomeCapability.js';
import {
  verifyPonsOutcomeObservationReceipt,
  type PonsOutcomeObservationReceipt
} from './outcomeReceipts.js';

export const PONS_RAT_TRAP_PROJECTION_VERSION = 'BINRAT_PONS_RAT_TRAP_PROJECTION_V1' as const;
export const PONS_RAT_TRAP_HORIZONS_MS = [300_000, 3_600_000, 86_400_000] as const;

export type PonsRatTrapHorizonState = 'COMPLETE' | 'PARTIAL' | 'IMMATURE' | 'PENDING';

export interface PonsRatTrapQuoteAsset {
  kind: 'NATIVE_ETH' | 'ERC20';
  address: Hex;
  decimals: number;
}

export interface PonsRatTrapObservationProjection {
  horizonMs: number;
  state: PonsRatTrapHorizonState;
  maturityTargetTimestampMs: number;
  observationId: string | null;
  observedBlock: bigint | null;
  observedTimestampMs: number | null;
  phase: 'CURVE' | 'GRADUATED' | null;
  quoteAsset: PonsRatTrapQuoteAsset | null;
  estimatedFdvQuoteRaw: bigint | null;
  missing: string[];
  evidenceDigest: string | null;
}

export interface PonsRatTrapHighestObservedProjection {
  estimatedFdvQuoteRaw: bigint;
  quoteAsset: PonsRatTrapQuoteAsset;
  tiedHorizonsMs: number[];
  observationIds: string[];
}

export interface PonsRatTrapTokenIdentityProjection {
  identityId: string;
  name: string;
  symbol: string;
  decimals: number;
  observedBlock: bigint;
  evidenceDigest: string;
}

export interface PonsRatTrapLaunchProjection {
  launchId: string;
  token: Hex;
  curve: Hex;
  deployer: Hex;
  symbol: string;
  name: string;
  tokenIdentity: PonsRatTrapTokenIdentityProjection | null;
  launchBlock: bigint;
  launchTimestampMs: number;
  observations: PonsRatTrapObservationProjection[];
  highestObserved: PonsRatTrapHighestObservedProjection | null;
}

export interface PonsRatTrapCoverageProjection {
  horizonMs: number;
  totalLaunches: number;
  complete: number;
  partial: number;
  immature: number;
  pending: number;
}

export interface PonsRatTrapProjection {
  projectionVersion: typeof PONS_RAT_TRAP_PROJECTION_VERSION;
  chainId: typeof ROBINHOOD_CHAIN_ID;
  currentLaunchId: string;
  deployer: Hex;
  asOfBlock: bigint;
  asOfTimestampMs: number;
  previousLaunchCount: number;
  launches: PonsRatTrapLaunchProjection[];
  coverage: PonsRatTrapCoverageProjection[];
}

export interface BuildPonsRatTrapProjectionInput {
  currentLaunch: LaunchObserved;
  launches: readonly LaunchObserved[];
  receiptsByLaunch: ReadonlyMap<string, readonly PonsOutcomeObservationReceipt[]>;
  canonicalLaunchTimestampMsByLaunch: ReadonlyMap<string, number>;
  tokenIdentityByLaunch?: ReadonlyMap<string, PonsRatTrapTokenIdentityProjection>;
  asOfBlock: bigint;
  asOfTimestampMs: number;
}

export async function buildPonsRatTrapProjection(
  input: BuildPonsRatTrapProjectionInput
): Promise<PonsRatTrapProjection> {
  assertCurrentLaunch(input.currentLaunch);
  if (input.asOfBlock < input.currentLaunch.blockNumber) {
    throw new Error('PONS_RAT_TRAP_AS_OF_BLOCK_BEFORE_CURRENT');
  }
  const currentLaunchTimestampMs = canonicalLaunchTimestamp(
    input.currentLaunch.launchId,
    input.canonicalLaunchTimestampMsByLaunch
  );
  if (!Number.isSafeInteger(input.asOfTimestampMs) || input.asOfTimestampMs < currentLaunchTimestampMs) {
    throw new Error('PONS_RAT_TRAP_AS_OF_TIMESTAMP_BEFORE_CURRENT');
  }

  const deployer = input.currentLaunch.creator.toLowerCase() as Hex;
  const previous = input.launches
    .filter((launch) =>
      launch.chainId === ROBINHOOD_CHAIN_ID &&
      launch.source === 'PONS_V2' &&
      launch.creator.toLowerCase() === deployer &&
      launch.blockNumber <= input.asOfBlock &&
      isBeforeLaunch(launch, input.currentLaunch)
    )
    .sort(compareLaunchDesc);

  const launches: PonsRatTrapLaunchProjection[] = [];
  for (const launch of previous) {
    launches.push(await projectLaunch(
      launch,
      input.receiptsByLaunch.get(launch.launchId) ?? [],
      canonicalLaunchTimestamp(launch.launchId, input.canonicalLaunchTimestampMsByLaunch),
      input.tokenIdentityByLaunch?.get(launch.launchId) ?? null,
      input.asOfBlock,
      input.asOfTimestampMs
    ));
  }

  return {
    projectionVersion: PONS_RAT_TRAP_PROJECTION_VERSION,
    chainId: ROBINHOOD_CHAIN_ID,
    currentLaunchId: input.currentLaunch.launchId,
    deployer,
    asOfBlock: input.asOfBlock,
    asOfTimestampMs: input.asOfTimestampMs,
    previousLaunchCount: launches.length,
    launches,
    coverage: PONS_RAT_TRAP_HORIZONS_MS.map((horizonMs) => coverageFor(launches, horizonMs))
  };
}

async function projectLaunch(
  launch: LaunchObserved,
  receipts: readonly PonsOutcomeObservationReceipt[],
  canonicalLaunchTimestampMs: number,
  tokenIdentity: PonsRatTrapTokenIdentityProjection | null,
  asOfBlock: bigint,
  asOfTimestampMs: number
): Promise<PonsRatTrapLaunchProjection> {
  assertPonsLaunch(launch);

  const byHorizon = new Map<number, PonsOutcomeObservationReceipt>();
  for (const receipt of receipts) {
    if (!PONS_RAT_TRAP_HORIZONS_MS.includes(receipt.horizonMs as (typeof PONS_RAT_TRAP_HORIZONS_MS)[number])) continue;
    if (receipt.observedBlock > asOfBlock || receipt.observedTimestampMs > asOfTimestampMs) continue;

    await verifyPonsOutcomeObservationReceipt(receipt);
    if (
      receipt.launchId !== launch.launchId ||
      receipt.token.toLowerCase() !== launch.token.toLowerCase() ||
      receipt.curve.toLowerCase() !== launch.pool.toLowerCase()
    ) {
      throw new Error(`PONS_RAT_TRAP_RECEIPT_LAUNCH_MISMATCH:${launch.launchId}`);
    }
    if (byHorizon.has(receipt.horizonMs)) {
      throw new Error(`PONS_RAT_TRAP_DUPLICATE_HORIZON:${launch.launchId}:${receipt.horizonMs}`);
    }
    if (receipt.targetTimestampMs !== canonicalLaunchTimestampMs + receipt.horizonMs) {
      throw new Error(`PONS_RAT_TRAP_RECEIPT_TARGET_MISMATCH:${launch.launchId}:${receipt.horizonMs}`);
    }
    byHorizon.set(receipt.horizonMs, receipt);
  }

  const observations = PONS_RAT_TRAP_HORIZONS_MS.map((horizonMs) => {
    const receipt = byHorizon.get(horizonMs);
    const maturityTargetTimestampMs = canonicalLaunchTimestampMs + horizonMs;
    if (!receipt) {
      return {
        horizonMs,
        state: asOfTimestampMs < maturityTargetTimestampMs ? 'IMMATURE' : 'PENDING',
        maturityTargetTimestampMs,
        observationId: null,
        observedBlock: null,
        observedTimestampMs: null,
        phase: null,
        quoteAsset: null,
        estimatedFdvQuoteRaw: null,
        missing: [],
        evidenceDigest: null
      } satisfies PonsRatTrapObservationProjection;
    }

    return {
      horizonMs,
      state: receipt.status,
      maturityTargetTimestampMs: receipt.targetTimestampMs,
      observationId: receipt.observationId,
      observedBlock: receipt.observedBlock,
      observedTimestampMs: receipt.observedTimestampMs,
      phase: receipt.phase,
      quoteAsset: quoteAssetFor(receipt),
      estimatedFdvQuoteRaw: receipt.status === 'COMPLETE' ? receipt.estimatedFdvQuoteRaw : null,
      missing: [...receipt.missing],
      evidenceDigest: receipt.evidenceDigest
    } satisfies PonsRatTrapObservationProjection;
  });

  return {
    launchId: launch.launchId,
    token: launch.token.toLowerCase() as Hex,
    curve: launch.pool.toLowerCase() as Hex,
    deployer: launch.creator.toLowerCase() as Hex,
    symbol: launch.symbol,
    name: launch.name,
    tokenIdentity,
    launchBlock: launch.blockNumber,
    launchTimestampMs: canonicalLaunchTimestampMs,
    observations,
    highestObserved: highestObservedFor(observations, launch.launchId)
  };
}

function highestObservedFor(
  observations: readonly PonsRatTrapObservationProjection[],
  launchId: string
): PonsRatTrapHighestObservedProjection | null {
  const qualified = observations.filter((item) =>
    item.state === 'COMPLETE' &&
    item.estimatedFdvQuoteRaw !== null &&
    item.quoteAsset !== null &&
    item.observationId !== null
  );
  if (!qualified.length) return null;

  const firstAsset = qualified[0]!.quoteAsset!;
  for (const item of qualified.slice(1)) {
    if (!sameQuoteAsset(firstAsset, item.quoteAsset!)) {
      throw new Error(`PONS_RAT_TRAP_QUOTE_ASSET_DRIFT:${launchId}`);
    }
  }

  let highest = qualified[0]!.estimatedFdvQuoteRaw!;
  for (const item of qualified.slice(1)) {
    if (item.estimatedFdvQuoteRaw! > highest) highest = item.estimatedFdvQuoteRaw!;
  }
  const tied = qualified.filter((item) => item.estimatedFdvQuoteRaw === highest);

  return {
    estimatedFdvQuoteRaw: highest,
    quoteAsset: firstAsset,
    tiedHorizonsMs: tied.map((item) => item.horizonMs),
    observationIds: tied.map((item) => item.observationId!)
  };
}

function coverageFor(
  launches: readonly PonsRatTrapLaunchProjection[],
  horizonMs: number
): PonsRatTrapCoverageProjection {
  const states = launches.map((launch) => launch.observations.find((item) => item.horizonMs === horizonMs)?.state);
  return {
    horizonMs,
    totalLaunches: launches.length,
    complete: states.filter((state) => state === 'COMPLETE').length,
    partial: states.filter((state) => state === 'PARTIAL').length,
    immature: states.filter((state) => state === 'IMMATURE').length,
    pending: states.filter((state) => state === 'PENDING').length
  };
}

function quoteAssetFor(receipt: PonsOutcomeObservationReceipt): PonsRatTrapQuoteAsset {
  return {
    kind: receipt.pairToken.toLowerCase() === NATIVE_QUOTE ? 'NATIVE_ETH' : 'ERC20',
    address: receipt.pairToken.toLowerCase() as Hex,
    decimals: receipt.quoteDecimals
  };
}

function sameQuoteAsset(a: PonsRatTrapQuoteAsset, b: PonsRatTrapQuoteAsset): boolean {
  return a.kind === b.kind && a.address === b.address && a.decimals === b.decimals;
}

function assertCurrentLaunch(launch: LaunchObserved): void {
  assertPonsLaunch(launch);
}

function assertPonsLaunch(launch: LaunchObserved): void {
  if (launch.chainId !== ROBINHOOD_CHAIN_ID || launch.source !== 'PONS_V2') {
    throw new Error('PONS_RAT_TRAP_LAUNCH_SCOPE_INVALID');
  }
}

function canonicalLaunchTimestamp(
  launchId: string,
  timestamps: ReadonlyMap<string, number>
): number {
  const timestampMs = timestamps.get(launchId);
  if (!Number.isSafeInteger(timestampMs) || timestampMs! < 0) {
    throw new Error(`PONS_RAT_TRAP_LAUNCH_TIMESTAMP_MISSING:${launchId}`);
  }
  return timestampMs!;
}

function isBeforeLaunch(candidate: LaunchObserved, current: LaunchObserved): boolean {
  if (candidate.blockNumber !== current.blockNumber) return candidate.blockNumber < current.blockNumber;
  if (candidate.logIndex !== current.logIndex) return candidate.logIndex < current.logIndex;
  return candidate.launchId < current.launchId;
}

function compareLaunchDesc(a: LaunchObserved, b: LaunchObserved): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? -1 : 1;
  if (a.logIndex !== b.logIndex) return b.logIndex - a.logIndex;
  return b.launchId.localeCompare(a.launchId);
}
