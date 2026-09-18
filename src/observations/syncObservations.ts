import type { Hex, LaunchObserved } from '../core/types.js';
import type { LaunchStore } from '../core/ports.js';
import { buildObservationReceipt } from './identity.js';
import { OBSERVATION_HORIZONS } from './horizons.js';
import type { ObservationStore } from './store.js';
import type { LaunchObservationFacts, ObservationStatus } from './types.js';

export interface ObservationBlockPoint {
  blockNumber: bigint;
  blockHash: Hex;
  timestampMs: number;
}

export interface ObservationSource {
  getHeadBlockNumber(): Promise<bigint>;
  getBlockPoint(blockNumber: bigint): Promise<ObservationBlockPoint>;
  readObservationFacts(
    launch: LaunchObserved,
    blockNumber: bigint
  ): Promise<{ facts: LaunchObservationFacts; missing: string[] }>;
}

export interface ObservationSyncOptions {
  confirmations: bigint;
  maxObservationsPerSync: number;
  horizons?: readonly { label: string; ms: number }[];
}

export interface ObservationSyncReport {
  headBlock: bigint;
  confirmedHeadBlock: bigint | null;
  inserted: number;
  duplicates: number;
  pendingMaturity: number;
  alreadyPresent: number;
}

type IntelligenceStore = LaunchStore & ObservationStore;

export async function syncObservations(
  source: ObservationSource,
  store: IntelligenceStore,
  options: ObservationSyncOptions
): Promise<ObservationSyncReport> {
  validateOptions(options);
  const headBlock = await source.getHeadBlockNumber();
  if (headBlock < options.confirmations) {
    return { headBlock, confirmedHeadBlock: null, inserted: 0, duplicates: 0, pendingMaturity: 0, alreadyPresent: 0 };
  }
  const confirmedHeadBlock = headBlock - options.confirmations;
  const confirmedHeadPoint = await source.getBlockPoint(confirmedHeadBlock);
  const launches = [...(await store.listLaunches())].reverse();
  const horizons = [...(options.horizons ?? OBSERVATION_HORIZONS)].sort((a, b) => a.ms - b.ms);
  let remaining = options.maxObservationsPerSync;
  let inserted = 0;
  let duplicates = 0;
  let pendingMaturity = 0;
  let alreadyPresent = 0;

  for (const launch of launches) {
    if (remaining <= 0) break;
    const launchPoint = await source.getBlockPoint(launch.blockNumber);
    assertHash('OBSERVATION_LAUNCH_REORG', launch.blockNumber, launch.blockHash, launchPoint.blockHash);
    const existing = new Map(
      (await store.listObservationsForLaunch(launch.launchId))
        .map((receipt) => [receipt.horizonMs, receipt] as const)
    );

    for (const horizon of horizons) {
      if (remaining <= 0) break;
      if (existing.has(horizon.ms)) {
        alreadyPresent += 1;
        continue;
      }
      const targetTimestampMs = launchPoint.timestampMs + horizon.ms;
      if (confirmedHeadPoint.timestampMs < targetTimestampMs) {
        pendingMaturity += 1;
        continue;
      }
      const observed = await findFirstBlockAtOrAfterTimestamp(
        source,
        launch.blockNumber,
        confirmedHeadBlock,
        targetTimestampMs
      );
      if (!observed) {
        pendingMaturity += 1;
        continue;
      }
      const predecessor = observed.blockNumber > launch.blockNumber
        ? await source.getBlockPoint(observed.blockNumber - 1n)
        : null;
      if (predecessor && predecessor.timestampMs >= targetTimestampMs) {
        throw new Error(`OBSERVATION_HORIZON_NONMINIMAL:block=${observed.blockNumber}:predecessor=${predecessor.blockNumber}`);
      }

      const observedFacts = await source.readObservationFacts(launch, observed.blockNumber);
      await assertEvidenceStable(source, launch, observed, predecessor, targetTimestampMs);
      const receipt = await buildObservationReceipt({
        chainId: launch.chainId,
        launchId: launch.launchId,
        horizonMs: horizon.ms,
        targetTimestampMs,
        observedBlock: observed.blockNumber,
        observedBlockHash: observed.blockHash,
        observedTimestampMs: observed.timestampMs,
        status: observationStatus(observedFacts.facts, observedFacts.missing),
        facts: observedFacts.facts,
        missing: observedFacts.missing
      });
      const result = await store.putObservation(receipt);
      if (result === 'INSERTED') inserted += 1;
      else duplicates += 1;
      remaining -= 1;
    }
  }

  return { headBlock, confirmedHeadBlock, inserted, duplicates, pendingMaturity, alreadyPresent };
}

export async function findFirstBlockAtOrAfterTimestamp(
  source: Pick<ObservationSource, 'getBlockPoint'>,
  lowBlock: bigint,
  highBlock: bigint,
  targetTimestampMs: number
): Promise<ObservationBlockPoint | null> {
  if (lowBlock > highBlock) return null;
  const highPoint = await source.getBlockPoint(highBlock);
  if (highPoint.timestampMs < targetTimestampMs) return null;

  let low = lowBlock;
  let high = highBlock;
  let answer = highPoint;
  while (low <= high) {
    const mid = low + ((high - low) / 2n);
    const point = mid === highBlock ? highPoint : await source.getBlockPoint(mid);
    if (point.timestampMs >= targetTimestampMs) {
      answer = point;
      if (mid === 0n) break;
      high = mid - 1n;
    } else {
      low = mid + 1n;
    }
  }
  return answer;
}

async function assertEvidenceStable(
  source: Pick<ObservationSource, 'getBlockPoint'>,
  launch: LaunchObserved,
  observed: ObservationBlockPoint,
  predecessor: ObservationBlockPoint | null,
  targetTimestampMs: number
): Promise<void> {
  const launchAgain = await source.getBlockPoint(launch.blockNumber);
  assertHash('OBSERVATION_LAUNCH_REORG', launch.blockNumber, launch.blockHash, launchAgain.blockHash);

  if (predecessor) {
    const predecessorAgain = await source.getBlockPoint(predecessor.blockNumber);
    assertHash('OBSERVATION_REORG_DURING_BOUNDARY_READ', predecessor.blockNumber, predecessor.blockHash, predecessorAgain.blockHash);
    if (predecessorAgain.timestampMs >= targetTimestampMs) {
      throw new Error(`OBSERVATION_HORIZON_NONMINIMAL:block=${observed.blockNumber}:predecessor=${predecessor.blockNumber}`);
    }
  }

  const observedAgain = await source.getBlockPoint(observed.blockNumber);
  assertHash('OBSERVATION_REORG_DURING_READ', observed.blockNumber, observed.blockHash, observedAgain.blockHash);
  if (observedAgain.timestampMs < targetTimestampMs) {
    throw new Error(`OBSERVATION_HORIZON_BEFORE_TARGET:block=${observed.blockNumber}`);
  }
}

function observationStatus(facts: LaunchObservationFacts, missing: readonly string[]): ObservationStatus {
  if (missing.length === 0) return 'COMPLETE';
  return Object.keys(facts).length > 0 ? 'PARTIAL' : 'UNVERIFIED';
}

function assertHash(label: string, blockNumber: bigint, expected: Hex, actual: Hex): void {
  if (expected.toLowerCase() !== actual.toLowerCase()) {
    throw new Error(`${label}:block=${blockNumber}:expected=${expected}:actual=${actual}`);
  }
}

function validateOptions(options: ObservationSyncOptions): void {
  if (options.confirmations < 0n) throw new Error('confirmations must be >= 0');
  if (!Number.isInteger(options.maxObservationsPerSync) || options.maxObservationsPerSync < 1 || options.maxObservationsPerSync > 10_000) {
    throw new Error('maxObservationsPerSync must be an integer in [1,10000]');
  }
  const horizons = options.horizons ?? OBSERVATION_HORIZONS;
  if (horizons.length === 0 || horizons.some((horizon) => !Number.isInteger(horizon.ms) || horizon.ms <= 0)) {
    throw new Error('observation horizons must be positive integer milliseconds');
  }
  if (new Set(horizons.map((horizon) => horizon.ms)).size !== horizons.length) {
    throw new Error('observation horizons must be unique');
  }
}
