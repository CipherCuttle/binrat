import type { Hex } from '../core/types.js';

export const OBSERVATION_VERSION = 'BINRAT_OBSERVATION_V1' as const;

export type ObservationStatus = 'COMPLETE' | 'PARTIAL' | 'UNVERIFIED';

export interface LaunchObservationFacts {
  poolCodePresent?: boolean;
  poolActiveLiquidity?: bigint;
  poolSqrtPriceX96?: bigint;
  poolTick?: number;
  creatorTokenBalance?: bigint;
  tokenTotalSupply?: bigint;
  tokenDecimals?: number;
}

export interface LaunchObservationReceipt {
  observationId: string;
  observationVersion: typeof OBSERVATION_VERSION;
  chainId: number;
  launchId: string;
  horizonMs: number;
  targetTimestampMs: number;
  observedBlock: bigint;
  observedBlockHash: Hex;
  observedTimestampMs: number;
  status: ObservationStatus;
  facts: LaunchObservationFacts;
  missing: string[];
  evidenceDigest: string;
}
