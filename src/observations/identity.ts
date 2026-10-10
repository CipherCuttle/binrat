import { sha256Hex } from '../evidence/canonical.js';
import { OBSERVATION_VERSION, type LaunchObservationReceipt } from './types.js';

export type LaunchObservationInput = Omit<
  LaunchObservationReceipt,
  'observationId' | 'observationVersion' | 'evidenceDigest'
>;

export async function deriveObservationId(input: {
  launchId: string;
  horizonMs: number;
}): Promise<string> {
  validateHorizon(input.horizonMs);
  return sha256Hex({
    kind: OBSERVATION_VERSION,
    launchId: input.launchId,
    horizonMs: input.horizonMs
  });
}

export async function buildObservationReceipt(
  input: LaunchObservationInput
): Promise<LaunchObservationReceipt> {
  validateInput(input);
  const observationId = await deriveObservationId(input);
  const withoutDigest = {
    observationId,
    observationVersion: OBSERVATION_VERSION,
    ...input,
    observedBlockHash: input.observedBlockHash.toLowerCase()
  };
  const evidenceDigest = await sha256Hex(withoutDigest);
  return {
    ...withoutDigest,
    observedBlockHash: withoutDigest.observedBlockHash as LaunchObservationReceipt['observedBlockHash'],
    evidenceDigest
  };
}

function validateInput(input: LaunchObservationInput): void {
  if (!Number.isInteger(input.chainId) || input.chainId <= 0) throw new Error('OBSERVATION_CHAIN_ID_INVALID');
  validateHorizon(input.horizonMs);
  if (!Number.isFinite(input.targetTimestampMs) || input.targetTimestampMs < 0) throw new Error('OBSERVATION_TARGET_TIMESTAMP_INVALID');
  if (input.observedBlock < 0n) throw new Error('OBSERVATION_BLOCK_INVALID');
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.observedBlockHash)) throw new Error('OBSERVATION_BLOCK_HASH_INVALID');
  if (!Number.isFinite(input.observedTimestampMs) || input.observedTimestampMs < input.targetTimestampMs) {
    throw new Error('OBSERVATION_TIMESTAMP_BEFORE_TARGET');
  }
  if (!Array.isArray(input.missing) || input.missing.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new Error('OBSERVATION_MISSING_INVALID');
  }
  validateFactCoverage(input.facts, input.missing);
  const expectedStatus = input.missing.length === 0 ? 'COMPLETE' : Object.keys(input.facts).length > 0 ? 'PARTIAL' : 'UNVERIFIED';
  if (input.status !== expectedStatus) throw new Error(`OBSERVATION_STATUS_MISMATCH:expected=${expectedStatus}:actual=${input.status}`);
}

const OBSERVATION_MISSING_CODES = new Set([
  'POOL_CODE',
  'POOL_SLOT0',
  'POOL_LIQUIDITY',
  'CREATOR_BALANCE',
  'TOKEN_TOTAL_SUPPLY',
  'TOKEN_DECIMALS'
]);

function validateFactCoverage(
  facts: LaunchObservationInput['facts'],
  missingItems: readonly string[]
): void {
  const missing = new Set(missingItems);
  if (missing.size !== missingItems.length) throw new Error('OBSERVATION_MISSING_DUPLICATE');
  for (const code of missing) {
    if (!OBSERVATION_MISSING_CODES.has(code)) throw new Error(`OBSERVATION_MISSING_CODE_UNSUPPORTED:${code}`);
  }

  requireCoverage('POOL_CODE', facts.poolCodePresent !== undefined, missing);
  const hasSqrt = facts.poolSqrtPriceX96 !== undefined;
  const hasTick = facts.poolTick !== undefined;
  if (hasSqrt !== hasTick) throw new Error('OBSERVATION_SLOT0_FACT_INCOMPLETE');
  requireCoverage('POOL_SLOT0', hasSqrt && hasTick, missing);
  requireCoverage('POOL_LIQUIDITY', facts.poolActiveLiquidity !== undefined, missing);
  requireCoverage('CREATOR_BALANCE', facts.creatorTokenBalance !== undefined, missing);
  requireCoverage('TOKEN_TOTAL_SUPPLY', facts.tokenTotalSupply !== undefined, missing);
  requireCoverage('TOKEN_DECIMALS', facts.tokenDecimals !== undefined, missing);

  if (
    facts.poolCodePresent === false &&
    (facts.poolActiveLiquidity !== undefined || facts.poolSqrtPriceX96 !== undefined || facts.poolTick !== undefined)
  ) {
    throw new Error('OBSERVATION_POOL_FACTS_WITHOUT_CODE');
  }
}

function requireCoverage(code: string, present: boolean, missing: ReadonlySet<string>): void {
  if (present === missing.has(code)) {
    throw new Error(`OBSERVATION_FACT_COVERAGE_MISMATCH:${code}`);
  }
}

function validateHorizon(horizonMs: number): void {
  if (!Number.isInteger(horizonMs) || horizonMs <= 0) throw new Error('OBSERVATION_HORIZON_INVALID');
}


export async function verifyObservationReceipt(receipt: LaunchObservationReceipt): Promise<void> {
  if (receipt.observationVersion !== OBSERVATION_VERSION) {
    throw new Error(`OBSERVATION_VERSION_MISMATCH:${receipt.observationVersion}`);
  }
  const rebuilt = await buildObservationReceipt({
    chainId: receipt.chainId,
    launchId: receipt.launchId,
    horizonMs: receipt.horizonMs,
    targetTimestampMs: receipt.targetTimestampMs,
    observedBlock: receipt.observedBlock,
    observedBlockHash: receipt.observedBlockHash,
    observedTimestampMs: receipt.observedTimestampMs,
    status: receipt.status,
    facts: receipt.facts,
    missing: receipt.missing
  });
  if (rebuilt.observationId !== receipt.observationId || rebuilt.evidenceDigest !== receipt.evidenceDigest) {
    throw new Error(`OBSERVATION_INTEGRITY_MISMATCH:${receipt.observationId}`);
  }
}
