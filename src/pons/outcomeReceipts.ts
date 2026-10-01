import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import type { Hex } from '../core/types.js';
import { OBSERVATION_HORIZONS } from '../observations/horizons.js';
import { ROBINHOOD_CHAIN_ID } from './chain.js';
import {
  readPonsCurveOutcomeCapability,
  verifyPonsCurveOutcomeCapabilityReceipt,
  type PonsCurveOutcomeCapabilityReceipt,
  type PonsCurveOutcomeSource,
  type PonsOutcomeLaunch
} from './outcomeCapability.js';

export const PONS_OUTCOME_OBSERVATION_VERSION = 'BINRAT_PONS_OUTCOME_OBSERVATION_V1' as const;

export interface PonsOutcomeObservationLaunch extends PonsOutcomeLaunch {
  blockNumber: bigint;
  blockHash: Hex;
}

export interface PonsOutcomeBlockPoint {
  blockNumber: bigint;
  blockHash: Hex;
  timestampMs: number;
}

export interface PonsOutcomeObservationReceipt {
  observationId: string;
  observationVersion: typeof PONS_OUTCOME_OBSERVATION_VERSION;
  chainId: typeof ROBINHOOD_CHAIN_ID;
  launchId: string;
  token: Hex;
  curve: Hex;
  horizonMs: number;
  targetTimestampMs: number;
  observedBlock: bigint;
  observedBlockHash: Hex;
  observedTimestampMs: number;
  phase: PonsCurveOutcomeCapabilityReceipt['phase'];
  pairToken: Hex;
  quoteDecimals: number;
  totalSupply: bigint;
  quoteReserve: bigint | null;
  tokenReserve: bigint | null;
  estimatedFdvQuoteRaw: bigint | null;
  status: PonsCurveOutcomeCapabilityReceipt['status'];
  missing: string[];
  capabilityEvidenceDigest: string;
  evidenceDigest: string;
}

export interface PonsOutcomeObservationStore {
  getCheckpoint(): Promise<{blockNumber: bigint; blockHash: Hex} | null>;
  listCandidates(limit: number): Promise<PonsOutcomeObservationLaunch[]>;
  listForLaunch(launchId: string): Promise<PonsOutcomeObservationReceipt[]>;
  put(receipt: PonsOutcomeObservationReceipt): Promise<'INSERTED' | 'DUPLICATE'>;
}

export interface PonsOutcomeObservationSource {
  assertAuthority(): Promise<void>;
  getBlockPoint(blockNumber: bigint): Promise<PonsOutcomeBlockPoint>;
  readOutcomeAt(
    launch: PonsOutcomeLaunch,
    blockNumber: bigint
  ): Promise<PonsCurveOutcomeCapabilityReceipt>;
}

export interface PonsOutcomeObservationSyncOptions {
  maxReceiptsPerSync: number;
  horizons?: readonly {label: string; ms: number}[];
}

export interface PonsOutcomeObservationSyncReport {
  checkpointBlock: bigint | null;
  inserted: number;
  duplicates: number;
  pendingMaturity: number;
  alreadyPresent: number;
  launchesVisited: number;
}

export class CapabilityBackedPonsOutcomeObservationSource implements PonsOutcomeObservationSource {
  constructor(
    private readonly blockSource: {
      assertAuthority(): Promise<void>;
      getBlockPoint(blockNumber: bigint): Promise<PonsOutcomeBlockPoint>;
    },
    private readonly outcomeSource: PonsCurveOutcomeSource
  ) {}

  async assertAuthority(): Promise<void> {
    await this.blockSource.assertAuthority();
    await this.outcomeSource.assertAuthority();
  }

  getBlockPoint(blockNumber: bigint): Promise<PonsOutcomeBlockPoint> {
    return this.blockSource.getBlockPoint(blockNumber);
  }

  readOutcomeAt(
    launch: PonsOutcomeLaunch,
    blockNumber: bigint
  ): Promise<PonsCurveOutcomeCapabilityReceipt> {
    return readPonsCurveOutcomeCapability(this.outcomeSource, launch, blockNumber);
  }
}

export async function derivePonsOutcomeObservationId(input: {
  launchId: string;
  horizonMs: number;
}): Promise<string> {
  validateHorizon(input.horizonMs);
  return sha256Hex({
    kind: PONS_OUTCOME_OBSERVATION_VERSION,
    chainId: ROBINHOOD_CHAIN_ID,
    launchId: input.launchId,
    horizonMs: input.horizonMs
  });
}

export async function buildPonsOutcomeObservationReceipt(input: {
  launch: PonsOutcomeLaunch;
  horizonMs: number;
  targetTimestampMs: number;
  capability: PonsCurveOutcomeCapabilityReceipt;
}): Promise<PonsOutcomeObservationReceipt> {
  validateHorizon(input.horizonMs);
  if (!Number.isSafeInteger(input.targetTimestampMs) || input.targetTimestampMs < 0) {
    throw new Error('PONS_OUTCOME_TARGET_TIMESTAMP_INVALID');
  }
  await verifyPonsCurveOutcomeCapabilityReceipt(input.capability);
  if (input.capability.chainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error('PONS_OUTCOME_OBSERVATION_CHAIN_MISMATCH');
  }
  if (
    input.capability.launchId !== input.launch.launchId ||
    input.capability.token.toLowerCase() !== input.launch.token.toLowerCase() ||
    input.capability.curve.toLowerCase() !== input.launch.curve.toLowerCase()
  ) {
    throw new Error('PONS_OUTCOME_OBSERVATION_LAUNCH_MISMATCH');
  }
  if (input.capability.observedTimestampMs < input.targetTimestampMs) {
    throw new Error('PONS_OUTCOME_OBSERVATION_BEFORE_TARGET');
  }

  const core: Omit<PonsOutcomeObservationReceipt, 'observationId' | 'evidenceDigest'> = {
    observationVersion: PONS_OUTCOME_OBSERVATION_VERSION,
    chainId: ROBINHOOD_CHAIN_ID,
    launchId: input.launch.launchId,
    token: input.capability.token.toLowerCase() as Hex,
    curve: input.capability.curve.toLowerCase() as Hex,
    horizonMs: input.horizonMs,
    targetTimestampMs: input.targetTimestampMs,
    observedBlock: input.capability.observedBlock,
    observedBlockHash: input.capability.observedBlockHash.toLowerCase() as Hex,
    observedTimestampMs: input.capability.observedTimestampMs,
    phase: input.capability.phase,
    pairToken: input.capability.pairToken.toLowerCase() as Hex,
    quoteDecimals: input.capability.quoteDecimals,
    totalSupply: input.capability.totalSupply,
    quoteReserve: input.capability.quoteReserve,
    tokenReserve: input.capability.tokenReserve,
    estimatedFdvQuoteRaw: input.capability.estimatedFdvQuoteRaw,
    status: input.capability.status,
    missing: [...input.capability.missing],
    capabilityEvidenceDigest: input.capability.evidenceDigest
  };
  return {
    observationId: await derivePonsOutcomeObservationId({launchId:input.launch.launchId,horizonMs:input.horizonMs}),
    ...core,
    evidenceDigest: await sha256Hex(core)
  };
}

export async function verifyPonsOutcomeObservationReceipt(
  receipt: PonsOutcomeObservationReceipt
): Promise<void> {
  if (
    receipt.observationVersion !== PONS_OUTCOME_OBSERVATION_VERSION ||
    receipt.chainId !== ROBINHOOD_CHAIN_ID
  ) {
    throw new Error('PONS_OUTCOME_OBSERVATION_VERSION_INVALID');
  }
  const capability: PonsCurveOutcomeCapabilityReceipt = {
    outcomeId: await sha256Hex({
      kind: 'BINRAT_PONS_CURVE_OUTCOME_CAPABILITY_V1',
      chainId: ROBINHOOD_CHAIN_ID,
      launchId: receipt.launchId,
      observedBlock: receipt.observedBlock.toString(),
      observedBlockHash: receipt.observedBlockHash.toLowerCase()
    }),
    outcomeVersion: 'BINRAT_PONS_CURVE_OUTCOME_CAPABILITY_V1',
    chainId: ROBINHOOD_CHAIN_ID,
    launchId: receipt.launchId,
    token: receipt.token,
    curve: receipt.curve,
    observedBlock: receipt.observedBlock,
    observedBlockHash: receipt.observedBlockHash,
    observedTimestampMs: receipt.observedTimestampMs,
    phase: receipt.phase,
    pairToken: receipt.pairToken,
    quoteDecimals: receipt.quoteDecimals,
    totalSupply: receipt.totalSupply,
    quoteReserve: receipt.quoteReserve,
    tokenReserve: receipt.tokenReserve,
    estimatedFdvQuoteRaw: receipt.estimatedFdvQuoteRaw,
    status: receipt.status,
    missing: [...receipt.missing],
    evidenceDigest: receipt.capabilityEvidenceDigest
  };
  await verifyPonsCurveOutcomeCapabilityReceipt(capability);
  const rebuilt = await buildPonsOutcomeObservationReceipt({
    launch: {launchId: receipt.launchId, token: receipt.token, curve: receipt.curve},
    horizonMs: receipt.horizonMs,
    targetTimestampMs: receipt.targetTimestampMs,
    capability
  });
  if (canonicalJson(rebuilt) !== canonicalJson(receipt)) {
    throw new Error('PONS_OUTCOME_OBSERVATION_RECEIPT_INVALID');
  }
}

export async function parsePonsOutcomeObservationReceipt(
  payload: string
): Promise<PonsOutcomeObservationReceipt> {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    throw new Error('PONS_OUTCOME_OBSERVATION_RECEIPT_INVALID');
  }
  const stringFields = [
    'observationId','observationVersion','launchId','token','curve','observedBlock',
    'observedBlockHash','phase','pairToken','totalSupply','status',
    'capabilityEvidenceDigest','evidenceDigest'
  ] as const;
  if (stringFields.some((key) => typeof raw[key] !== 'string')) {
    throw new Error('PONS_OUTCOME_OBSERVATION_RECEIPT_INVALID');
  }
  if (
    raw.chainId !== ROBINHOOD_CHAIN_ID ||
    typeof raw.horizonMs !== 'number' ||
    typeof raw.targetTimestampMs !== 'number' ||
    typeof raw.observedTimestampMs !== 'number' ||
    typeof raw.quoteDecimals !== 'number' ||
    !Array.isArray(raw.missing) ||
    raw.missing.some((item) => typeof item !== 'string')
  ) {
    throw new Error('PONS_OUTCOME_OBSERVATION_RECEIPT_INVALID');
  }
  try {
    const receipt: PonsOutcomeObservationReceipt = {
      observationId: raw.observationId as string,
      observationVersion: raw.observationVersion as typeof PONS_OUTCOME_OBSERVATION_VERSION,
      chainId: ROBINHOOD_CHAIN_ID,
      launchId: raw.launchId as string,
      token: (raw.token as string).toLowerCase() as Hex,
      curve: (raw.curve as string).toLowerCase() as Hex,
      horizonMs: raw.horizonMs as number,
      targetTimestampMs: raw.targetTimestampMs as number,
      observedBlock: BigInt(raw.observedBlock as string),
      observedBlockHash: (raw.observedBlockHash as string).toLowerCase() as Hex,
      observedTimestampMs: raw.observedTimestampMs as number,
      phase: raw.phase as PonsOutcomeObservationReceipt['phase'],
      pairToken: (raw.pairToken as string).toLowerCase() as Hex,
      quoteDecimals: raw.quoteDecimals as number,
      totalSupply: BigInt(raw.totalSupply as string),
      quoteReserve: raw.quoteReserve === null ? null : BigInt(String(raw.quoteReserve)),
      tokenReserve: raw.tokenReserve === null ? null : BigInt(String(raw.tokenReserve)),
      estimatedFdvQuoteRaw: raw.estimatedFdvQuoteRaw === null ? null : BigInt(String(raw.estimatedFdvQuoteRaw)),
      status: raw.status as PonsOutcomeObservationReceipt['status'],
      missing: [...raw.missing] as string[],
      capabilityEvidenceDigest: raw.capabilityEvidenceDigest as string,
      evidenceDigest: raw.evidenceDigest as string
    };
    await verifyPonsOutcomeObservationReceipt(receipt);
    return receipt;
  } catch {
    throw new Error('PONS_OUTCOME_OBSERVATION_RECEIPT_INVALID');
  }
}

export async function syncPonsOutcomeObservations(
  source: PonsOutcomeObservationSource,
  store: PonsOutcomeObservationStore,
  options: PonsOutcomeObservationSyncOptions
): Promise<PonsOutcomeObservationSyncReport> {
  validateOptions(options);
  const checkpoint = await store.getCheckpoint();
  if (!checkpoint) {
    return {
      checkpointBlock: null, inserted: 0, duplicates: 0,
      pendingMaturity: 0, alreadyPresent: 0, launchesVisited: 0
    };
  }

  await source.assertAuthority();
  const checkpointPoint = await source.getBlockPoint(checkpoint.blockNumber);
  assertHash('PONS_OUTCOME_CHECKPOINT_REORG', checkpoint.blockNumber, checkpoint.blockHash, checkpointPoint.blockHash);

  const horizons = [...(options.horizons ?? OBSERVATION_HORIZONS)].sort((a,b) => a.ms-b.ms);
  const launches = await store.listCandidates(options.maxReceiptsPerSync);
  let remaining = options.maxReceiptsPerSync;
  let inserted = 0;
  let duplicates = 0;
  let pendingMaturity = 0;
  let alreadyPresent = 0;
  let launchesVisited = 0;

  for (const launch of launches) {
    if (remaining <= 0) break;
    launchesVisited += 1;
    const existing = await store.listForLaunch(launch.launchId);
    for (const receipt of existing) await verifyPonsOutcomeObservationReceipt(receipt);
    const byHorizon = new Map(existing.map((receipt) => [receipt.horizonMs, receipt] as const));
    alreadyPresent += horizons.filter((horizon) => byHorizon.has(horizon.ms)).length;

    const launchPoint = await source.getBlockPoint(launch.blockNumber);
    assertHash('PONS_OUTCOME_LAUNCH_REORG', launch.blockNumber, launch.blockHash, launchPoint.blockHash);

    for (const horizon of horizons) {
      if (remaining <= 0) break;
      if (byHorizon.has(horizon.ms)) continue;
      const targetTimestampMs = launchPoint.timestampMs + horizon.ms;
      if (checkpointPoint.timestampMs < targetTimestampMs) {
        pendingMaturity += 1;
        continue;
      }

      const observed = await findFirstPonsOutcomeBlockAtOrAfterTimestamp(
        source,
        launch.blockNumber,
        checkpoint.blockNumber,
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
        throw new Error(`PONS_OUTCOME_HORIZON_NONMINIMAL:block=${observed.blockNumber}`);
      }

      const capability = await source.readOutcomeAt(launch, observed.blockNumber);
      if (
        capability.observedBlock !== observed.blockNumber ||
        capability.observedBlockHash.toLowerCase() !== observed.blockHash.toLowerCase() ||
        capability.observedTimestampMs !== observed.timestampMs
      ) {
        throw new Error('PONS_OUTCOME_CAPABILITY_BLOCK_BINDING_MISMATCH');
      }
      await assertBoundaryStable(source, launch, launchPoint, observed, predecessor, targetTimestampMs);
      const receipt = await buildPonsOutcomeObservationReceipt({
        launch,
        horizonMs: horizon.ms,
        targetTimestampMs,
        capability
      });
      const result = await store.put(receipt);
      if (result === 'INSERTED') inserted += 1;
      else duplicates += 1;
      remaining -= 1;
    }
  }

  return {
    checkpointBlock: checkpoint.blockNumber,
    inserted,
    duplicates,
    pendingMaturity,
    alreadyPresent,
    launchesVisited
  };
}

export async function findFirstPonsOutcomeBlockAtOrAfterTimestamp(
  source: Pick<PonsOutcomeObservationSource, 'getBlockPoint'>,
  lowBlock: bigint,
  highBlock: bigint,
  targetTimestampMs: number
): Promise<PonsOutcomeBlockPoint | null> {
  if (lowBlock > highBlock) return null;
  const highPoint = await source.getBlockPoint(highBlock);
  if (highPoint.timestampMs < targetTimestampMs) return null;
  let low = lowBlock;
  let high = highBlock;
  let answer = highPoint;
  while (low <= high) {
    const mid = low + ((high-low)/2n);
    const point = mid === highBlock ? highPoint : await source.getBlockPoint(mid);
    if (point.timestampMs >= targetTimestampMs) {
      answer = point;
      if (mid === 0n) break;
      high = mid-1n;
    } else {
      low = mid+1n;
    }
  }
  return answer;
}

async function assertBoundaryStable(
  source: Pick<PonsOutcomeObservationSource, 'getBlockPoint'>,
  launch: PonsOutcomeObservationLaunch,
  launchPoint: PonsOutcomeBlockPoint,
  observed: PonsOutcomeBlockPoint,
  predecessor: PonsOutcomeBlockPoint | null,
  targetTimestampMs: number
): Promise<void> {
  const launchAgain = await source.getBlockPoint(launch.blockNumber);
  assertHash('PONS_OUTCOME_LAUNCH_REORG_DURING_READ', launch.blockNumber, launchPoint.blockHash, launchAgain.blockHash);
  if (launchAgain.timestampMs !== launchPoint.timestampMs) {
    throw new Error('PONS_OUTCOME_LAUNCH_TIMESTAMP_DRIFT');
  }
  if (predecessor) {
    const predecessorAgain = await source.getBlockPoint(predecessor.blockNumber);
    assertHash(
      'PONS_OUTCOME_BOUNDARY_REORG_DURING_READ',
      predecessor.blockNumber,
      predecessor.blockHash,
      predecessorAgain.blockHash
    );
    if (predecessorAgain.timestampMs >= targetTimestampMs) {
      throw new Error(`PONS_OUTCOME_HORIZON_NONMINIMAL:block=${observed.blockNumber}`);
    }
  }
  const observedAgain = await source.getBlockPoint(observed.blockNumber);
  assertHash(
    'PONS_OUTCOME_OBSERVED_REORG_DURING_READ',
    observed.blockNumber,
    observed.blockHash,
    observedAgain.blockHash
  );
  if (observedAgain.timestampMs !== observed.timestampMs || observedAgain.timestampMs < targetTimestampMs) {
    throw new Error('PONS_OUTCOME_OBSERVED_TIMESTAMP_DRIFT');
  }
}

function validateOptions(options: PonsOutcomeObservationSyncOptions): void {
  if (
    !Number.isSafeInteger(options.maxReceiptsPerSync) ||
    options.maxReceiptsPerSync < 1 ||
    options.maxReceiptsPerSync > 100
  ) {
    throw new Error('PONS_OUTCOME_SYNC_LIMIT_INVALID');
  }
  const horizons = options.horizons ?? OBSERVATION_HORIZONS;
  if (
    horizons.length === 0 ||
    horizons.some((horizon) => !Number.isSafeInteger(horizon.ms) || horizon.ms <= 0) ||
    new Set(horizons.map((horizon) => horizon.ms)).size !== horizons.length
  ) {
    throw new Error('PONS_OUTCOME_HORIZONS_INVALID');
  }
}

function validateHorizon(horizonMs: number): void {
  if (!Number.isSafeInteger(horizonMs) || horizonMs <= 0) {
    throw new Error('PONS_OUTCOME_HORIZON_INVALID');
  }
}

function assertHash(label: string, blockNumber: bigint, expected: Hex, actual: Hex): void {
  if (expected.toLowerCase() !== actual.toLowerCase()) {
    throw new Error(`${label}:block=${blockNumber}:expected=${expected}:actual=${actual}`);
  }
}
