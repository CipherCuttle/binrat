import { sha256Hex } from '../evidence/canonical.js';
import type { LaunchObservationReceipt } from '../observations/types.js';
import { projectBagIntelligence, type PublicBagIntelligence } from './bagIntelligence.js';
import { projectCreatorFile, type PublicCreatorFile } from './creatorFile.js';
import type { PublicBag, PublicCoverage, PublicFeed } from './types.js';

export const REPLAY_BUNDLE_SCHEMA_VERSION = 'binrat.replay-bundle/0.1' as const;
export const REPLAY_BUNDLE_PROJECTION_VERSION = 'BINRAT_REPLAY_BUNDLE_V0' as const;

export interface PublicReplayStage {
  kind: 'LAUNCH' | 'OBSERVATION';
  label: 'LAUNCH' | '5m' | '1h' | '24h';
  status: 'OBSERVED' | LaunchObservationReceipt['status'];
  blockNumber: string;
  blockHash: string;
  observedTimestampMs: number | null;
  evidenceDigest: string | null;
}

export interface PublicReplayBundle {
  schemaVersion: typeof REPLAY_BUNDLE_SCHEMA_VERSION;
  projectionVersion: typeof REPLAY_BUNDLE_PROJECTION_VERSION;
  chainId: number;
  asOfBlock: string;
  historyCoverage: PublicCoverage;
  launch: PublicBag;
  creatorFile: PublicCreatorFile;
  intelligence: PublicBagIntelligence;
  stages: PublicReplayStage[];
  receipt: {
    sourcePublicReceiptId: string;
    creatorFileReceiptId: string;
    intelligenceReceiptId: string;
    observationEvidenceDigests: string[];
    outputDigest: string;
    receiptId: string;
  };
}

export async function projectReplayBundle(
  feed: PublicFeed,
  bag: PublicBag,
  observations: LaunchObservationReceipt[]
): Promise<PublicReplayBundle> {
  if (!feed.bags.some((item) => item.id === bag.id)) {
    throw new Error(`REPLAY_BAG_NOT_IN_FEED:${bag.id}`);
  }

  const creatorFile = await projectCreatorFile(feed, bag.reportedCreatorAddress);
  if (!creatorFile) throw new Error(`REPLAY_CREATOR_FILE_MISSING:${bag.id}`);
  const intelligence = await projectBagIntelligence(feed, bag, observations);

  const stages: PublicReplayStage[] = [
    {
      kind: 'LAUNCH',
      label: 'LAUNCH',
      status: 'OBSERVED',
      blockNumber: bag.blockNumber,
      blockHash: bag.blockHash,
      observedTimestampMs: null,
      evidenceDigest: null
    },
    ...intelligence.snapshots.map((snapshot): PublicReplayStage => ({
      kind: 'OBSERVATION',
      label: snapshot.horizonLabel as '5m' | '1h' | '24h',
      status: snapshot.status,
      blockNumber: snapshot.observedBlock,
      blockHash: snapshot.observedBlockHash,
      observedTimestampMs: snapshot.observedTimestampMs,
      evidenceDigest: snapshot.evidenceDigest
    }))
  ];

  const output = {
    schemaVersion: REPLAY_BUNDLE_SCHEMA_VERSION,
    projectionVersion: REPLAY_BUNDLE_PROJECTION_VERSION,
    chainId: feed.chainId,
    asOfBlock: feed.asOfBlock,
    historyCoverage: feed.historyCoverage,
    launch: bag,
    creatorFile,
    intelligence,
    stages
  };
  const outputDigest = await sha256Hex(output);
  const receiptMaterial = {
    projectionVersion: REPLAY_BUNDLE_PROJECTION_VERSION,
    sourcePublicReceiptId: feed.receipt.receiptId,
    creatorFileReceiptId: creatorFile.receipt.receiptId,
    intelligenceReceiptId: intelligence.receipt.receiptId,
    observationEvidenceDigests: intelligence.receipt.observationEvidenceDigests,
    outputDigest
  };
  return {
    ...output,
    receipt: {
      ...receiptMaterial,
      receiptId: `binrat-replay:${await sha256Hex(receiptMaterial)}`
    }
  };
}
