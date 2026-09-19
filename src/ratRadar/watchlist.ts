import { sha256Hex } from '../evidence/canonical.js';
import type { PublicFeed } from '../public/types.js';
import type { RatRadarSwapReceipt } from './activity.js';

export const RAT_RADAR_WATCHLIST_SCHEMA_VERSION = 'binrat.rat-radar-watchlist/0.1' as const;
export const RAT_RADAR_RANKING_VERSION = 'binrat.rat-radar-ranking/0.1' as const;
export const RAT_RADAR_FREE_LIMIT = 5;

export interface RatRadarWatchCandidate {
  rank: number;
  observedRecipientAddress: string;
  independentLaunchCount: number;
  acquisitionReceiptCount: number;
  medianFirstEntryBlockDelta: number;
  earliestFirstEntryBlockDelta: number;
  latestSeenBlock: string;
  reasonCodes: string[];
  reasons: string[];
  evidenceActivityIds: string[];
}

export interface RatRadarFreeWatchlist {
  schemaVersion: typeof RAT_RADAR_WATCHLIST_SCHEMA_VERSION;
  rankingVersion: typeof RAT_RADAR_RANKING_VERSION;
  chainId: number;
  asOfBlock: string;
  coverage: {
    historyCoverage: PublicFeed['historyCoverage'];
    indexedLaunchCount: number;
    swapReceiptCount: number;
    acquisitionReceiptCount: number;
    distinctRecipientAddressCount: number;
    rankedAddressCount: number;
    status: 'NO_SWAP_EVIDENCE' | 'PARTIAL';
  };
  method: {
    evidencedRole: 'UNISWAP_V3_SWAP_RECIPIENT';
    freeLimit: number;
    ordering: [
      'independentLaunchCount DESC',
      'medianFirstEntryBlockDelta ASC',
      'acquisitionReceiptCount DESC',
      'observedRecipientAddress ASC'
    ];
    identityBoundary: string;
    recommendationBoundary: string;
  };
  candidates: RatRadarWatchCandidate[];
  receipt: {
    receiptId: string;
    evidenceDigest: string;
  };
}

interface CandidateAccumulator {
  address: string;
  acquisitions: RatRadarSwapReceipt[];
  firstByLaunch: Map<string, RatRadarSwapReceipt>;
  firstEntryDeltas: number[];
}

export async function projectRatRadarFreeWatchlist(
  feed: PublicFeed,
  receipts: readonly RatRadarSwapReceipt[],
  limit = RAT_RADAR_FREE_LIMIT
): Promise<RatRadarFreeWatchlist> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('RAT_RADAR_FREE_LIMIT_INVALID');
  }
  const asOfBlock = BigInt(feed.asOfBlock);
  const launchBlocks = new Map(feed.bags.map((bag) => [bag.id, BigInt(bag.blockNumber)]));
  const bounded = receipts.filter((receipt) => (
    receipt.chainId === feed.chainId &&
    receipt.blockNumber <= asOfBlock &&
    launchBlocks.has(receipt.launchId)
  ));

  const acquisitions = bounded.filter((receipt) => (
    receipt.launchedTokenFlow === 'POOL_TO_RECIPIENT' &&
    receipt.launchedTokenDelta < 0n
  ));

  const byAddress = new Map<string, CandidateAccumulator>();
  for (const receipt of acquisitions) {
    const launchBlock = launchBlocks.get(receipt.launchId)!;
    if (receipt.blockNumber < launchBlock) continue;
    const address = receipt.recipient.toLowerCase();
    let candidate = byAddress.get(address);
    if (!candidate) {
      candidate = {
        address,
        acquisitions: [],
        firstByLaunch: new Map(),
        firstEntryDeltas: []
      };
      byAddress.set(address, candidate);
    }
    candidate.acquisitions.push(receipt);
    const existing = candidate.firstByLaunch.get(receipt.launchId);
    if (
      !existing ||
      receipt.blockNumber < existing.blockNumber ||
      (receipt.blockNumber === existing.blockNumber && receipt.logIndex < existing.logIndex)
    ) {
      candidate.firstByLaunch.set(receipt.launchId, receipt);
    }
  }

  const ranked = [...byAddress.values()].map((candidate) => {
    const firstEntries = [...candidate.firstByLaunch.values()]
      .sort(compareReceiptOrder);
    candidate.firstEntryDeltas = firstEntries.map((receipt) => {
      const launchBlock = launchBlocks.get(receipt.launchId)!;
      return safeNumber(receipt.blockNumber - launchBlock);
    }).sort((a, b) => a - b);

    const independentLaunchCount = firstEntries.length;
    const acquisitionReceiptCount = candidate.acquisitions.length;
    const medianFirstEntryBlockDelta = median(candidate.firstEntryDeltas);
    const earliestFirstEntryBlockDelta = candidate.firstEntryDeltas[0] ?? 0;
    const latestSeenBlock = candidate.acquisitions.reduce(
      (latest, receipt) => receipt.blockNumber > latest ? receipt.blockNumber : latest,
      0n
    );
    const reasonCodes = [
      independentLaunchCount > 1 ? 'RECURRENT_RECIPIENT_ACROSS_LAUNCHES' : 'OBSERVED_RECIPIENT',
      'FIRST_ENTRY_TIMING_MEASURED',
      acquisitionReceiptCount > independentLaunchCount ? 'REPEATED_ACQUISITION_ACTIVITY' : 'ACQUISITION_ACTIVITY'
    ];
    const reasons = [
      independentLaunchCount === 1
        ? 'Observed as the launched-token recipient in 1 indexed launch.'
        : `Observed as the launched-token recipient across ${independentLaunchCount} independent indexed launches.`,
      `Median first recipient-side acquisition: ${formatNumber(medianFirstEntryBlockDelta)} blocks after indexed launch.`,
      `${acquisitionReceiptCount} launched-token acquisition receipt${acquisitionReceiptCount === 1 ? '' : 's'} observed.`
    ];

    return {
      rank: 0,
      observedRecipientAddress: candidate.address,
      independentLaunchCount,
      acquisitionReceiptCount,
      medianFirstEntryBlockDelta,
      earliestFirstEntryBlockDelta,
      latestSeenBlock: latestSeenBlock.toString(),
      reasonCodes,
      reasons,
      evidenceActivityIds: candidate.acquisitions
        .slice()
        .sort(compareReceiptOrder)
        .slice(0, 8)
        .map((receipt) => receipt.activityId)
    } satisfies RatRadarWatchCandidate;
  }).sort((a, b) => (
    b.independentLaunchCount - a.independentLaunchCount ||
    a.medianFirstEntryBlockDelta - b.medianFirstEntryBlockDelta ||
    b.acquisitionReceiptCount - a.acquisitionReceiptCount ||
    a.observedRecipientAddress.localeCompare(b.observedRecipientAddress)
  )).slice(0, limit).map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  const distinctRecipientAddressCount = byAddress.size;
  const authority = {
    schemaVersion: RAT_RADAR_WATCHLIST_SCHEMA_VERSION,
    rankingVersion: RAT_RADAR_RANKING_VERSION,
    chainId: feed.chainId,
    asOfBlock: feed.asOfBlock,
    coverage: {
      historyCoverage: feed.historyCoverage,
      indexedLaunchCount: feed.bags.length,
      swapReceiptCount: bounded.length,
      acquisitionReceiptCount: acquisitions.length,
      distinctRecipientAddressCount,
      rankedAddressCount: ranked.length,
      status: bounded.length === 0 ? 'NO_SWAP_EVIDENCE' as const : 'PARTIAL' as const
    },
    method: {
      evidencedRole: 'UNISWAP_V3_SWAP_RECIPIENT' as const,
      freeLimit: limit,
      ordering: [
        'independentLaunchCount DESC',
        'medianFirstEntryBlockDelta ASC',
        'acquisitionReceiptCount DESC',
        'observedRecipientAddress ASC'
      ] as RatRadarFreeWatchlist['method']['ordering'],
      identityBoundary: 'An observed recipient address is not automatically a human trader identity.',
      recommendationBoundary: 'Ranking describes observed recurrence and timing; it is not a BUY/SELL recommendation.'
    },
    candidates: ranked
  };
  const evidenceDigest = await sha256Hex(authority);
  return {
    ...authority,
    receipt: {
      receiptId: `binrat-rat-radar:${evidenceDigest}`,
      evidenceDigest
    }
  };
}

function compareReceiptOrder(a: RatRadarSwapReceipt, b: RatRadarSwapReceipt): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
  if (a.logIndex !== b.logIndex) return a.logIndex - b.logIndex;
  return a.activityId.localeCompare(b.activityId);
}

function safeNumber(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('RAT_RADAR_BLOCK_DELTA_INVALID');
  }
  return Number(value);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 1
    ? values[middle]!
    : (values[middle - 1]! + values[middle]!) / 2;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
