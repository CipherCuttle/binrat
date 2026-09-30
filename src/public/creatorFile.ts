import type { Hex } from '../core/types.js';
import { sha256Hex } from '../evidence/canonical.js';
import type { PublicBag, PublicCoverage, PublicEvidenceItem, PublicFeed } from './types.js';

export const CREATOR_FILE_SCHEMA_VERSION = 'binrat.creator-file/0.1' as const;
export const CREATOR_FILE_PROJECTION_VERSION = 'BINRAT_CREATOR_FILE_V0' as const;

export interface PublicCreatorLaunch {
  id: string;
  token: Hex;
  symbol: string;
  name: string;
  blockNumber: string;
  blockHash: Hex;
  txHash: Hex;
  logIndex: number;
  pool: Hex;
  metadata: PublicBag['metadata'];
  priorLaunchCount: number;
  evidence: PublicEvidenceItem[];
}

export interface PublicCreatorFileReceipt {
  projectionVersion: typeof CREATOR_FILE_PROJECTION_VERSION;
  sourcePublicReceiptId: string;
  outputDigest: string;
  receiptId: string;
}

export interface PublicCreatorFile {
  schemaVersion: typeof CREATOR_FILE_SCHEMA_VERSION;
  chainId: number;
  asOfBlock: string;
  historyCoverage: PublicCoverage;
  reportedCreatorAddress: Hex;
  indexedLaunchCount: number;
  firstIndexedBlock: string;
  lastIndexedBlock: string;
  launches: PublicCreatorLaunch[];
  receipt: PublicCreatorFileReceipt;
}

export async function projectCreatorFile(
  feed: PublicFeed,
  creatorAddress: string
): Promise<PublicCreatorFile | null> {
  const creator = normalizeCreator(creatorAddress);
  const selected = feed.bags
    .filter((bag) => bag.reportedCreatorAddress.toLowerCase() === creator)
    .sort(compareBagsAscending);

  if (selected.length === 0) return null;

  const launches = [...selected].reverse().map((bag): PublicCreatorLaunch => ({
    id: bag.id,
    token: bag.token,
    symbol: bag.symbol,
    name: bag.name,
    blockNumber: bag.blockNumber,
    blockHash: bag.blockHash,
    txHash: bag.txHash,
    logIndex: bag.logIndex,
    pool: bag.pool,
    metadata: { ...bag.metadata },
    priorLaunchCount: bag.trashTrail.priorLaunchCount,
    evidence: bag.evidence.map((item) => ({ ...item, sourceFactIds: [...item.sourceFactIds] }))
  }));

  const output = {
    schemaVersion: CREATOR_FILE_SCHEMA_VERSION,
    chainId: feed.chainId,
    asOfBlock: feed.asOfBlock,
    historyCoverage: feed.historyCoverage,
    reportedCreatorAddress: creator as Hex,
    indexedLaunchCount: selected.length,
    firstIndexedBlock: selected[0]!.blockNumber,
    lastIndexedBlock: selected[selected.length - 1]!.blockNumber,
    launches
  };
  const outputDigest = await sha256Hex(output);
  const receiptMaterial = {
    projectionVersion: CREATOR_FILE_PROJECTION_VERSION,
    sourcePublicReceiptId: feed.receipt.receiptId,
    reportedCreatorAddress: creator,
    outputDigest
  };
  const receipt: PublicCreatorFileReceipt = {
    projectionVersion: CREATOR_FILE_PROJECTION_VERSION,
    sourcePublicReceiptId: feed.receipt.receiptId,
    outputDigest,
    receiptId: `binrat-creator:${await sha256Hex(receiptMaterial)}`
  };
  return { ...output, receipt };
}

function normalizeCreator(value: string): string {
  const normalized = value.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) throw new Error('CREATOR_ADDRESS_INVALID');
  return normalized;
}

function compareBagsAscending(a: PublicBag, b: PublicBag): number {
  const ab = BigInt(a.blockNumber);
  const bb = BigInt(b.blockNumber);
  if (ab !== bb) return ab < bb ? -1 : 1;
  if (a.logIndex !== b.logIndex) return a.logIndex - b.logIndex;
  return a.id.localeCompare(b.id);
}
