export type EvidenceState = 'OBSERVED' | 'NOTED' | 'UNKNOWN';
export type CoverageState = 'COMPLETE' | 'PARTIAL' | 'UNVERIFIED';

export interface EvidenceItem {
  state: EvidenceState;
  text: string;
}

export interface Bag {
  id: string;
  symbol: string;
  name: string;
  token: string;
  reportedCreatorAddress: string;
  blockNumber: string;
  txHash: string;
  trashTrail: {
    coverage: CoverageState;
    priorLaunchCount: number;
    prior: Array<{ id: string; symbol: string; name: string; blockNumber: string }>;
  };
  evidence: EvidenceItem[];
}

export interface PublicFeed {
  schemaVersion: 'binrat.public-feed/0.1';
  chainId: 5042;
  asOfBlock: string;
  historyCoverage: CoverageState;
  bags: Bag[];
  receipt: { receiptId: string };
}

export interface RadarCandidate {
  rank: number;
  observedRecipientAddress: string;
  distinctLaunchCount: number;
  acquisitionReceiptCount: number;
  medianFirstEntryBlockDelta: number;
  earliestFirstEntryBlockDelta: number;
  latestSeenBlock: string;
  reasons: string[];
  evidenceActivityIds: string[];
}

export interface RadarWatchlist {
  schemaVersion: 'binrat.rat-radar-watchlist/0.1';
  rankingVersion: 'binrat.rat-radar-ranking/0.1';
  chainId: 5042;
  asOfBlock: string;
  coverage: {
    historyCoverage: CoverageState;
    indexedLaunchCount: number;
    swapReceiptCount: number;
    acquisitionReceiptCount: number;
    distinctRecipientAddressCount: number;
    rankedAddressCount: number;
    status: 'NO_SWAP_EVIDENCE' | 'PARTIAL';
  };
  method: {
    evidencedRole: 'V3_SWAP_RECIPIENT';
    identityBoundary: string;
    recommendationBoundary: string;
  };
  candidates: RadarCandidate[];
  receipt: { receiptId: string; evidenceDigest: string };
}

export type RatState =
  | 'idle'
  | 'indexing'
  | 'digging'
  | 'evidence_found'
  | 'repeat_creator'
  | 'empty'
  | 'error'
  | 'receipt_verified';
