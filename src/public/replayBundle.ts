import { sha256Hex } from '../evidence/canonical.js';
import { OBSERVATION_HORIZONS } from '../observations/horizons.js';
import type { LaunchObservationReceipt } from '../observations/types.js';
import { projectBagIntelligence, type PublicBagIntelligence } from './bagIntelligence.js';
import { projectCreatorFile, type PublicCreatorFile } from './creatorFile.js';
import {
  PUBLIC_FEED_SCHEMA_VERSION,
  PUBLIC_PROJECTION_VERSION,
  type PublicBag,
  type PublicCoverage,
  type PublicFeed
} from './types.js';

export const REPLAY_BUNDLE_SCHEMA_VERSION = 'binrat.replay-bundle/0.1' as const;
export const REPLAY_BUNDLE_PROJECTION_VERSION = 'BINRAT_REPLAY_BUNDLE_V0' as const;

export interface PublicReplayStage {
  kind: 'LAUNCH' | 'OBSERVATION';
  label: 'LAUNCH' | '5m' | '1h' | '24h';
  status: 'OBSERVED' | LaunchObservationReceipt['status'];
  blockNumber: string;
  blockHash: string;
  targetTimestampMs: number | null;
  observedTimestampMs: number | null;
  evidenceId: string;
  evidenceDigest: string | null;
}

export interface PublicReplayBundle {
  schemaVersion: typeof REPLAY_BUNDLE_SCHEMA_VERSION;
  projectionVersion: typeof REPLAY_BUNDLE_PROJECTION_VERSION;
  chainId: number;
  asOfBlock: string;
  asOfBlockHash: string;
  historyCoverage: PublicCoverage;
  canonicalAuthority: {
    chainId: number;
    asOfBlock: string;
    asOfBlockHash: string;
    sourcePublicReceiptId: string;
  };
  coverage: {
    historyCoverage: PublicCoverage;
    observationCoverage: PublicCoverage;
    availableHorizons: Array<'5m' | '1h' | '24h'>;
    missingHorizons: Array<'5m' | '1h' | '24h'>;
  };
  boundaries: {
    noLookahead: string;
    missingEvidence: string;
    creatorIdentity: string;
    recommendation: string;
  };
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
  await verifyReplayAuthority(feed, bag);

  const creatorFile = await projectCreatorFile(feed, bag.reportedCreatorAddress);
  if (!creatorFile) throw new Error(`REPLAY_CREATOR_FILE_MISSING:${bag.id}`);
  const intelligence = await projectBagIntelligence(feed, bag, observations);
  verifyReplayChronology(intelligence);

  const stages: PublicReplayStage[] = [
    {
      kind: 'LAUNCH',
      label: 'LAUNCH',
      status: 'OBSERVED',
      blockNumber: bag.blockNumber,
      blockHash: bag.blockHash,
      targetTimestampMs: null,
      observedTimestampMs: null,
      evidenceId: feed.receipt.receiptId,
      evidenceDigest: null
    },
    ...intelligence.snapshots.map((snapshot): PublicReplayStage => ({
      kind: 'OBSERVATION',
      label: snapshot.horizonLabel as '5m' | '1h' | '24h',
      status: snapshot.status,
      blockNumber: snapshot.observedBlock,
      blockHash: snapshot.observedBlockHash,
      targetTimestampMs: snapshot.targetTimestampMs,
      observedTimestampMs: snapshot.observedTimestampMs,
      evidenceId: snapshot.observationId,
      evidenceDigest: snapshot.evidenceDigest
    }))
  ];

  const availableHorizons = intelligence.snapshots.map(
    (snapshot) => snapshot.horizonLabel as '5m' | '1h' | '24h'
  );
  const available = new Set(availableHorizons);
  const missingHorizons = OBSERVATION_HORIZONS
    .filter((horizon) => !available.has(horizon.label))
    .map((horizon) => horizon.label);

  const output = {
    schemaVersion: REPLAY_BUNDLE_SCHEMA_VERSION,
    projectionVersion: REPLAY_BUNDLE_PROJECTION_VERSION,
    chainId: feed.chainId,
    asOfBlock: feed.asOfBlock,
    asOfBlockHash: feed.asOfBlockHash,
    historyCoverage: feed.historyCoverage,
    canonicalAuthority: {
      chainId: feed.chainId,
      asOfBlock: feed.asOfBlock,
      asOfBlockHash: feed.asOfBlockHash,
      sourcePublicReceiptId: feed.receipt.receiptId
    },
    coverage: {
      historyCoverage: feed.historyCoverage,
      observationCoverage: intelligence.observationCoverage,
      availableHorizons,
      missingHorizons
    },
    boundaries: {
      noLookahead: 'Only evidence observed at or before the canonical as-of block is included; later evidence is omitted.',
      missingEvidence: 'Missing observation horizons remain missing and are never interpolated or synthesized.',
      creatorIdentity: 'The reported creator address is protocol evidence and is not automatically a human identity.',
      recommendation: 'Replay is evidence presentation, not a trading recommendation or safety judgment.'
    },
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

function verifyReplayChronology(intelligence: PublicBagIntelligence): void {
  let launchTimestampMs: number | null = null;
  let priorTargetTimestampMs = -1;
  let priorObservedTimestampMs = -1;
  let priorObservedBlock = -1n;
  for (const snapshot of intelligence.snapshots) {
    const candidateLaunchTimestampMs = snapshot.targetTimestampMs - snapshot.horizonMs;
    if (launchTimestampMs === null) launchTimestampMs = candidateLaunchTimestampMs;
    if (
      candidateLaunchTimestampMs !== launchTimestampMs ||
      snapshot.targetTimestampMs <= priorTargetTimestampMs ||
      snapshot.observedTimestampMs < priorObservedTimestampMs ||
      BigInt(snapshot.observedBlock) < priorObservedBlock
    ) throw new Error(`REPLAY_OBSERVATION_CHRONOLOGY_MISMATCH:${intelligence.bagId}`);
    priorTargetTimestampMs = snapshot.targetTimestampMs;
    priorObservedTimestampMs = snapshot.observedTimestampMs;
    priorObservedBlock = BigInt(snapshot.observedBlock);
  }
}

async function verifyReplayAuthority(feed: PublicFeed, bag: PublicBag): Promise<void> {
  if (
    feed.schemaVersion !== PUBLIC_FEED_SCHEMA_VERSION ||
    feed.receipt.projectionVersion !== PUBLIC_PROJECTION_VERSION ||
    feed.chainId !== feed.receipt.chainId ||
    feed.asOfBlock !== feed.receipt.asOfBlock ||
    feed.asOfBlockHash.toLowerCase() !== feed.receipt.asOfBlockHash.toLowerCase() ||
    feed.historyCoverage !== feed.receipt.historyCoverage ||
    !/^(0|[1-9][0-9]*)$/.test(feed.asOfBlock) ||
    !/^0x[0-9a-f]{64}$/.test(feed.asOfBlockHash) ||
    !/^[0-9a-f]{64}$/.test(feed.receipt.inputDigest) ||
    !/^[0-9a-f]{64}$/.test(feed.receipt.outputDigest)
  ) throw new Error('REPLAY_PUBLIC_AUTHORITY_MISMATCH');

  const outputDigest = await sha256Hex({
    schemaVersion: feed.schemaVersion,
    chainId: feed.chainId,
    asOfBlock: feed.asOfBlock,
    asOfBlockHash: feed.asOfBlockHash,
    historyCoverage: feed.historyCoverage,
    bags: feed.bags
  });
  if (outputDigest !== feed.receipt.outputDigest) {
    throw new Error('REPLAY_PUBLIC_OUTPUT_INTEGRITY_MISMATCH');
  }
  const receiptId = `binrat-public:${await sha256Hex({
    projectionVersion: feed.receipt.projectionVersion,
    chainId: feed.receipt.chainId,
    asOfBlock: BigInt(feed.receipt.asOfBlock),
    asOfBlockHash: feed.receipt.asOfBlockHash,
    historyCoverage: feed.receipt.historyCoverage,
    inputDigest: feed.receipt.inputDigest,
    outputDigest: feed.receipt.outputDigest
  })}`;
  if (receiptId !== feed.receipt.receiptId) {
    throw new Error('REPLAY_PUBLIC_RECEIPT_INTEGRITY_MISMATCH');
  }

  const canonicalBag = feed.bags.find((item) => item.id === bag.id);
  if (!canonicalBag) throw new Error(`REPLAY_BAG_NOT_IN_FEED:${bag.id}`);
  if (await sha256Hex(canonicalBag) !== await sha256Hex(bag)) {
    throw new Error(`REPLAY_LAUNCH_AUTHORITY_MISMATCH:${bag.id}`);
  }
}
