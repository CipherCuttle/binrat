import type { Bag, PublicFeed, RadarWatchlist } from "./types.js";

/**
 * V2's LIVE boundary. DEMO fixtures intentionally have a different contract and
 * must never pass through this adapter. The backend remains evidence authority:
 * these checks validate transport/schema consistency, NOT cryptographic provenance.
 */
type JsonObject = Record<string, unknown>;

function fail(code: string): never { throw new Error(code); }
function object(value: unknown, code: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as JsonObject;
}
function array(value: unknown, code: string): unknown[] {
  if (!Array.isArray(value)) fail(code);
  return value as unknown[];
}
function text(value: unknown, code: string): string {
  if (typeof value !== "string") fail(code);
  return value as string;
}
function natural(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(code);
  return value as number;
}
function decimal(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(code);
  return value;
}
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const BLOCK = /^(0|[1-9][0-9]*)$/;
function address(value: unknown, code: string): string {
  const result = text(value, code);
  if (!ADDRESS.test(result)) fail(code);
  return result;
}
function hash(value: unknown, code: string): string {
  const result = text(value, code);
  if (!HASH.test(result)) fail(code);
  return result;
}
function digest(value: unknown, code: string): string {
  const result = text(value, code);
  if (!DIGEST.test(result)) fail(code);
  return result;
}
function block(value: unknown, code: string): string {
  const result = text(value, code);
  if (!BLOCK.test(result)) fail(code);
  return result;
}
function receiptId(value: unknown, prefix: string, code: string): string {
  const id = text(value, code);
  if (!new RegExp("^" + prefix + ":[0-9a-f]{64}$").test(id)) fail(code);
  return id;
}
function strings(value: unknown, code: string): string[] {
  return array(value, code).map((item) => text(item, code));
}
function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
function validateEvidence(value: unknown, code: string): void {
  for (const raw of array(value, code)) {
    const item = object(raw, code);
    if (!["OBSERVED", "NOTED", "UNKNOWN"].includes(String(item.state))) fail(code);
    text(item.code, code);
    text(item.text, code);
    strings(item.sourceFactIds, code);
  }
}
function validateMetadata(value: unknown, code: string): void {
  const metadata = object(value, code);
  for (const key of ["imageUri", "website", "twitter", "telegram"]) text(metadata[key], code);
}
function validateLaunch(value: unknown, checkpoint: string, code: string): JsonObject {
  const bag = object(value, code);
  if (!DIGEST.test(text(bag.id, code))) fail(code);
  address(bag.token, code);
  text(bag.symbol, code);
  text(bag.name, code);
  const launchBlock = block(bag.blockNumber, code);
  if (BigInt(launchBlock) > BigInt(checkpoint)) fail(code);
  hash(bag.blockHash, code);
  hash(bag.txHash, code);
  natural(bag.logIndex, code);
  address(bag.pool, code);
  validateMetadata(bag.metadata, code);
  validateEvidence(bag.evidence, code);
  return bag;
}

/** Preserve the native V2 presentation type while normalizing prior.launchId -> prior.id. */
export function adaptLiveFeed(value: unknown): PublicFeed {
  const code = "PUBLIC_FEED_SCHEMA_INVALID";
  const feed = object(value, code);
  if (feed.schemaVersion !== "binrat.public-feed/0.1" || feed.chainId !== 5042 ||
      feed.historyCoverage !== "UNVERIFIED") fail(code);
  const checkpoint = block(feed.asOfBlock, code);
  const checkpointHash = hash(feed.asOfBlockHash, code);
  const receipt = object(feed.receipt, code);
  if (receipt.projectionVersion !== "BINRAT_PUBLIC_PROJECTION_V0" ||
      receipt.chainId !== 5042 || receipt.asOfBlock !== checkpoint ||
      String(receipt.asOfBlockHash).toLowerCase() !== checkpointHash.toLowerCase() ||
      receipt.historyCoverage !== "UNVERIFIED") fail(code);
  digest(receipt.inputDigest, code);
  digest(receipt.outputDigest, code);
  receiptId(receipt.receiptId, "binrat-public", code);
  const seen = new Set<string>();
  const bags: Bag[] = array(feed.bags, code).map((raw) => {
    const bag = validateLaunch(raw, checkpoint, code);
    if (bag.source !== "ARCPAD") fail(code);
    const id = bag.id as string;
    if (seen.has(id)) fail(code);
    seen.add(id);
    address(bag.reportedCreatorAddress, code);
    const trail = object(bag.trashTrail, code);
    if (trail.coverage !== "UNVERIFIED") fail(code);
    const count = natural(trail.priorLaunchCount, code);
    const prior = array(trail.prior, code).map((rawPrior) => {
      const p = object(rawPrior, code);
      const launchId = text(p.launchId, code);
      if (!DIGEST.test(launchId)) fail(code);
      address(p.token, code);
      text(p.symbol, code);
      text(p.name, code);
      const priorBlock = block(p.blockNumber, code);
      if (BigInt(priorBlock) > BigInt(bag.blockNumber as string)) fail(code);
      hash(p.blockHash, code);
      text(p.sourceFactId, code);
      return {
        id: launchId,
        symbol: p.symbol as string,
        name: p.name as string,
        blockNumber: priorBlock,
      };
    });
    if (count !== prior.length) fail(code);
    return {
      id,
      symbol: bag.symbol as string,
      name: bag.name as string,
      token: bag.token as string,
      reportedCreatorAddress: bag.reportedCreatorAddress as string,
      blockNumber: bag.blockNumber as string,
      txHash: bag.txHash as string,
      trashTrail: { coverage: "UNVERIFIED", priorLaunchCount: count, prior },
      evidence: (bag.evidence as JsonObject[]).map((item) => ({
        state: item.state as "OBSERVED" | "NOTED" | "UNKNOWN",
        text: item.text as string,
      })),
    };
  });
  return {
    schemaVersion: "binrat.public-feed/0.1",
    chainId: 5042,
    asOfBlock: checkpoint,
    historyCoverage: "UNVERIFIED",
    bags,
    receipt: { receiptId: receipt.receiptId as string },
  };
}

export function adaptLiveRadar(value: unknown): RadarWatchlist {
  const code = "RAT_RADAR_SCHEMA_INVALID";
  const radar = object(value, code);
  if (radar.schemaVersion !== "binrat.rat-radar-watchlist/0.1" ||
      radar.rankingVersion !== "binrat.rat-radar-ranking/0.1" ||
      radar.chainId !== 5042) fail(code);
  const checkpoint = block(radar.asOfBlock, code);
  const coverage = object(radar.coverage, code);
  if (coverage.historyCoverage !== "UNVERIFIED" ||
      !["NO_SWAP_EVIDENCE", "PARTIAL"].includes(String(coverage.status))) fail(code);
  for (const key of ["indexedLaunchCount", "swapReceiptCount", "acquisitionReceiptCount",
                     "distinctRecipientAddressCount", "rankedAddressCount"]) natural(coverage[key], code);
  if ((coverage.rankedAddressCount as number) > (coverage.distinctRecipientAddressCount as number) ||
      (coverage.acquisitionReceiptCount as number) > (coverage.swapReceiptCount as number)) fail(code);
  const method = object(radar.method, code);
  if (method.evidencedRole !== "V3_SWAP_RECIPIENT" || natural(method.freeLimit, code) !== 5) fail(code);
  if (JSON.stringify(method.ordering) !== JSON.stringify([
    "distinctLaunchCount DESC", "medianFirstEntryBlockDelta ASC",
    "acquisitionReceiptCount DESC", "observedRecipientAddress ASC",
  ])) fail(code);
  text(method.identityBoundary, code);
  text(method.recommendationBoundary, code);
  const candidates = array(radar.candidates, code);
  if (candidates.length > 5 || candidates.length !== coverage.rankedAddressCount) fail(code);
  const seen = new Set<string>();
  for (const [index, raw] of candidates.entries()) {
    const candidate = object(raw, code);
    if (candidate.rank !== index + 1) fail(code);
    const recipient = address(candidate.observedRecipientAddress, code).toLowerCase();
    if (seen.has(recipient)) fail(code);
    seen.add(recipient);
    natural(candidate.distinctLaunchCount, code);
    natural(candidate.acquisitionReceiptCount, code);
    decimal(candidate.medianFirstEntryBlockDelta, code);
    decimal(candidate.earliestFirstEntryBlockDelta, code);
    if (BigInt(block(candidate.latestSeenBlock, code)) > BigInt(checkpoint)) fail(code);
    strings(candidate.reasonCodes, code);
    strings(candidate.reasons, code);
    if (candidate.reasons && (candidate.reasons as string[]).length === 0) fail(code);
    for (const id of strings(candidate.evidenceActivityIds, code)) if (!DIGEST.test(id)) fail(code);
  }
  const receipt = object(radar.receipt, code);
  const evidenceDigest = digest(receipt.evidenceDigest, code);
  if (receipt.receiptId !== "binrat-rat-radar:" + evidenceDigest) fail(code);
  return radar as unknown as RadarWatchlist;
}

export interface LiveCreatorLaunch {
  id: string;
  symbol: string;
  name: string;
  token: string;
  blockNumber: string;
  txHash: string;
  priorLaunchCount: number;
}
export interface LiveCreatorFile {
  chainId: 5042;
  asOfBlock: string;
  historyCoverage: "UNVERIFIED";
  reportedCreatorAddress: string;
  indexedLaunchCount: number;
  firstIndexedBlock: string;
  lastIndexedBlock: string;
  launches: LiveCreatorLaunch[];
  receipt: { receiptId: string; sourcePublicReceiptId: string };
}
export function adaptLiveCreatorFile(value: unknown, requestedAddress: string): LiveCreatorFile {
  const code = "CREATOR_FILE_SCHEMA_INVALID";
  const creator = object(value, code);
  if (!ADDRESS.test(requestedAddress) || creator.schemaVersion !== "binrat.creator-file/0.1" ||
      creator.chainId !== 5042 || creator.historyCoverage !== "UNVERIFIED" ||
      !sameAddress(address(creator.reportedCreatorAddress, code), requestedAddress)) fail(code);
  const checkpoint = block(creator.asOfBlock, code);
  const count = natural(creator.indexedLaunchCount, code);
  const firstBlock = block(creator.firstIndexedBlock, code);
  const lastBlock = block(creator.lastIndexedBlock, code);
  const launches = array(creator.launches, code);
  if (count === 0 || count !== launches.length) fail(code);
  const seen = new Set<string>();
  let preceding = BigInt(checkpoint) + 1n;
  for (const raw of launches) {
    const launch = validateLaunch(raw, checkpoint, code);
    natural(launch.priorLaunchCount, code);
    if (seen.has(launch.id as string) || BigInt(launch.blockNumber as string) > preceding) fail(code);
    preceding = BigInt(launch.blockNumber as string);
    seen.add(launch.id as string);
  }
  if (firstBlock !== (launches[launches.length - 1] as JsonObject).blockNumber ||
      lastBlock !== (launches[0] as JsonObject).blockNumber) fail(code);
  const receipt = object(creator.receipt, code);
  if (receipt.projectionVersion !== "BINRAT_CREATOR_FILE_V0") fail(code);
  receiptId(receipt.receiptId, "binrat-creator", code);
  receiptId(receipt.sourcePublicReceiptId, "binrat-public", code);
  digest(receipt.outputDigest, code);
  return {
    chainId: 5042,
    asOfBlock: checkpoint,
    historyCoverage: "UNVERIFIED",
    reportedCreatorAddress: creator.reportedCreatorAddress as string,
    indexedLaunchCount: count,
    firstIndexedBlock: firstBlock,
    lastIndexedBlock: lastBlock,
    launches: launches.map((item) => {
      const launch = item as JsonObject;
      return {
        id: launch.id as string,
        symbol: launch.symbol as string,
        name: launch.name as string,
        token: launch.token as string,
        blockNumber: launch.blockNumber as string,
        txHash: launch.txHash as string,
        priorLaunchCount: launch.priorLaunchCount as number,
      };
    }),
    receipt: {
      receiptId: receipt.receiptId as string,
      sourcePublicReceiptId: receipt.sourcePublicReceiptId as string,
    },
  };
}
