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
  const expectedStatus = input.missing.length === 0 ? 'COMPLETE' : Object.keys(input.facts).length > 0 ? 'PARTIAL' : 'UNVERIFIED';
  if (input.status !== expectedStatus) throw new Error(`OBSERVATION_STATUS_MISMATCH:expected=${expectedStatus}:actual=${input.status}`);
}

function validateHorizon(horizonMs: number): void {
  if (!Number.isInteger(horizonMs) || horizonMs <= 0) throw new Error('OBSERVATION_HORIZON_INVALID');
}
