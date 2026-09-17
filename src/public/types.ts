import type { Hex } from '../core/types.js';

export const PUBLIC_FEED_SCHEMA_VERSION = 'binrat.public-feed/0.1' as const;
export const PUBLIC_PROJECTION_VERSION = 'BINRAT_PUBLIC_PROJECTION_V0' as const;

export type PublicCoverage = 'COMPLETE' | 'PARTIAL' | 'UNVERIFIED';
export type PublicEvidenceState = 'OBSERVED' | 'NOTED' | 'UNKNOWN';

export interface PublicEvidenceItem {
  state: PublicEvidenceState;
  code: string;
  text: string;
  sourceFactIds: string[];
}

export interface PublicTrashTrailItem {
  launchId: string;
  token: Hex;
  symbol: string;
  name: string;
  blockNumber: string;
  blockHash: Hex;
  sourceFactId: string;
}

export interface PublicBag {
  id: string;
  source: 'ARCPAD';
  token: Hex;
  symbol: string;
  name: string;
  blockNumber: string;
  blockHash: Hex;
  txHash: Hex;
  logIndex: number;
  reportedCreatorAddress: Hex;
  pool: Hex;
  metadata: {
    imageUri: string;
    website: string;
    twitter: string;
    telegram: string;
  };
  trashTrail: {
    priorLaunchCount: number;
    coverage: PublicCoverage;
    prior: PublicTrashTrailItem[];
  };
  evidence: PublicEvidenceItem[];
}

export interface PublicProjectionReceipt {
  projectionVersion: typeof PUBLIC_PROJECTION_VERSION;
  chainId: number;
  asOfBlock: string;
  asOfBlockHash: Hex;
  historyCoverage: PublicCoverage;
  inputDigest: string;
  outputDigest: string;
  receiptId: string;
}

export interface PublicFeed {
  schemaVersion: typeof PUBLIC_FEED_SCHEMA_VERSION;
  chainId: number;
  asOfBlock: string;
  asOfBlockHash: Hex;
  historyCoverage: PublicCoverage;
  bags: PublicBag[];
  receipt: PublicProjectionReceipt;
}
