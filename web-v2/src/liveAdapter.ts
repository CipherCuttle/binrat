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


/** On-demand LIVE Replay. Nested source receipts and checkpoint relationships
 * are checked, but this browser adapter does not independently hash the entire
 * canonical projection. Never describe structural validation as chain proof. */
import type { ReplayHorizon, ReplayStage } from "./evidenceIntegrity.js";

export interface LiveReplayBundle {
  asOfBlock: string;
  historyCoverage: "UNVERIFIED";
  observationCoverage: "COMPLETE" | "PARTIAL" | "UNVERIFIED";
  stages: Record<ReplayHorizon, ReplayStage>;
  receipt: { receiptId: string; sourcePublicReceiptId: string };
}

export function adaptLiveReplay(value: unknown, requestedBagId: string): LiveReplayBundle {
  const code = "REPLAY_BUNDLE_SCHEMA_INVALID";
  const bundle = object(value, code);
  if (!DIGEST.test(requestedBagId) || bundle.schemaVersion !== "binrat.replay-bundle/0.1" ||
      bundle.projectionVersion !== "BINRAT_REPLAY_BUNDLE_V0" || bundle.chainId !== 5042 ||
      bundle.historyCoverage !== "UNVERIFIED") fail(code);
  const checkpoint = block(bundle.asOfBlock, code);
  const checkpointHash = hash(bundle.asOfBlockHash, code);
  const authority = object(bundle.canonicalAuthority, code);
  const sourceReceipt = receiptId(authority.sourcePublicReceiptId, "binrat-public", code);
  if (authority.chainId !== 5042 || authority.asOfBlock !== checkpoint ||
      String(authority.asOfBlockHash).toLowerCase() !== checkpointHash.toLowerCase()) fail(code);

  const launch = validateLaunch(bundle.launch, checkpoint, code);
  if (launch.id !== requestedBagId || launch.source !== "ARCPAD") fail(code);
  const creatorAddress = address(launch.reportedCreatorAddress, code);
  const creator = object(bundle.creatorFile, code);
  if (creator.schemaVersion !== "binrat.creator-file/0.1" || creator.chainId !== 5042 ||
      creator.asOfBlock !== checkpoint || creator.historyCoverage !== "UNVERIFIED" ||
      !sameAddress(address(creator.reportedCreatorAddress, code), creatorAddress) ||
      natural(creator.indexedLaunchCount, code) < 1) fail(code);
  const creatorLaunches = array(creator.launches, code);
  if (creatorLaunches.length !== creator.indexedLaunchCount ||
      !creatorLaunches.some((item) => object(item, code).id === requestedBagId)) fail(code);
  const creatorReceiptData = object(creator.receipt, code);
  const creatorReceipt = receiptId(creatorReceiptData.receiptId, "binrat-creator", code);
  if (creatorReceiptData.sourcePublicReceiptId !== sourceReceipt) fail(code);

  const intelligence = object(bundle.intelligence, code);
  if (intelligence.schemaVersion !== "binrat.bag-intelligence/0.1" ||
      intelligence.chainId !== 5042 || intelligence.bagId !== requestedBagId ||
      intelligence.asOfBlock !== checkpoint ||
      !sameAddress(address(intelligence.reportedCreatorAddress, code), creatorAddress) ||
      !sameAddress(address(intelligence.token, code), address(launch.token, code))) fail(code);
  const intelligenceReceipt = object(intelligence.receipt, code);
  const intelId = receiptId(intelligenceReceipt.receiptId, "binrat-intelligence", code);
  if (intelligenceReceipt.sourcePublicReceiptId !== sourceReceipt) fail(code);

  const coverage = object(bundle.coverage, code);
  if (coverage.historyCoverage !== "UNVERIFIED" ||
      !["COMPLETE", "PARTIAL", "UNVERIFIED"].includes(String(coverage.observationCoverage)) ||
      coverage.observationCoverage !== intelligence.observationCoverage) fail(code);
  const validHorizons: ReplayHorizon[] = ["5m", "1h", "24h"];
  const available = strings(coverage.availableHorizons, code);
  const missing = strings(coverage.missingHorizons, code);
  if (available.length + missing.length !== 3 ||
      new Set([...available, ...missing]).size !== 3 ||
      [...available, ...missing].some((h) => !validHorizons.includes(h as ReplayHorizon)) ||
      validHorizons.filter((h) => available.includes(h)).join(",") !== available.join(",") ||
      validHorizons.filter((h) => missing.includes(h)).join(",") !== missing.join(",")) fail(code);

  const stagesRaw = array(bundle.stages, code);
  const snapshots = array(intelligence.snapshots, code);
  if (stagesRaw.length !== available.length + 1 || snapshots.length !== available.length) fail(code);
  const first = object(stagesRaw[0], code);
  if (first.kind !== "LAUNCH" || first.label !== "LAUNCH" || first.status !== "OBSERVED" ||
      first.blockNumber !== launch.blockNumber ||
      String(first.blockHash).toLowerCase() !== String(launch.blockHash).toLowerCase() ||
      first.evidenceId !== sourceReceipt || first.evidenceDigest !== null ||
      first.targetTimestampMs !== null || first.observedTimestampMs !== null) fail(code);
  const stages: LiveReplayBundle["stages"] = {
    LAUNCH: { state: "COMPLETE", value: "BLOCK " + (launch.blockNumber as string),
      note: "Source-indexed launch at the Replay bundle's own checkpoint. This is not a maturity or safety verdict." },
    "5m": { state: "MISSING", value: "NO OBSERVATION RECEIPT", note: "No validated +5m observation is included in this Replay bundle." },
    "1h": { state: "MISSING", value: "NO OBSERVATION RECEIPT", note: "No validated +1h observation is included in this Replay bundle." },
    "24h": { state: "MISSING", value: "NO OBSERVATION RECEIPT", note: "No validated +24h observation is included in this Replay bundle." },
  };
  const evidenceDigests: string[] = [];
  let priorTarget = -1;
  let priorObserved = -1;
  let priorBlock = BigInt(launch.blockNumber as string);
  for (const [index, horizon] of available.entries()) {
    const stage = object(stagesRaw[index + 1], code);
    const snapshot = object(snapshots[index], code);
    const stageBlock = block(stage.blockNumber, code);
    const stageHash = hash(stage.blockHash, code);
    const observationId = digest(stage.evidenceId, code);
    const evidenceDigest = digest(stage.evidenceDigest, code);
    const target = natural(stage.targetTimestampMs, code);
    const observed = natural(stage.observedTimestampMs, code);
    if (target > 8_640_000_000_000_000 || observed > 8_640_000_000_000_000) fail(code);
    if (stage.kind !== "OBSERVATION" || stage.label !== horizon ||
        !["COMPLETE", "PARTIAL", "UNVERIFIED"].includes(String(stage.status)) ||
        observed < target || target <= priorTarget || observed < priorObserved ||
        BigInt(stageBlock) < priorBlock || BigInt(stageBlock) > BigInt(checkpoint) ||
        snapshot.horizonLabel !== horizon || snapshot.status !== stage.status ||
        snapshot.observationId !== observationId || snapshot.evidenceDigest !== evidenceDigest ||
        snapshot.observedBlock !== stageBlock ||
        String(snapshot.observedBlockHash).toLowerCase() !== stageHash.toLowerCase() ||
        snapshot.targetTimestampMs !== target || snapshot.observedTimestampMs !== observed) fail(code);
    stages[horizon as ReplayHorizon] = {
      state: stage.status as ReplayStage["state"],
      value: "OBSERVED BLOCK " + stageBlock,
      note: "Target " + new Date(target).toISOString() + " / observed " +
        new Date(observed).toISOString() + ". Evidence digest " + evidenceDigest +
        ". This stage is bounded to its own observation receipt.",
    };
    evidenceDigests.push(evidenceDigest);
    priorTarget = target;
    priorObserved = observed;
    priorBlock = BigInt(stageBlock);
  }
  const expectedCoverage = available.length === 0 ? "UNVERIFIED" :
    available.length === 3 && available.every((h) => stages[h as ReplayHorizon].state === "COMPLETE")
      ? "COMPLETE" : "PARTIAL";
  if (coverage.observationCoverage !== expectedCoverage) fail(code);
  const receipt = object(bundle.receipt, code);
  if (receipt.sourcePublicReceiptId !== sourceReceipt ||
      receipt.creatorFileReceiptId !== creatorReceipt ||
      receipt.intelligenceReceiptId !== intelId ||
      receipt.projectionVersion !== "BINRAT_REPLAY_BUNDLE_V0" ||
      strings(receipt.observationEvidenceDigests, code).join(",") !== evidenceDigests.join(",") ||
      strings(intelligenceReceipt.observationEvidenceDigests, code).join(",") !== evidenceDigests.join(",")) fail(code);
  digest(receipt.outputDigest, code);
  const replayReceiptId = receiptId(receipt.receiptId, "binrat-replay", code);
  return {
    asOfBlock: checkpoint,
    historyCoverage: "UNVERIFIED",
    observationCoverage: coverage.observationCoverage as LiveReplayBundle["observationCoverage"],
    stages,
    receipt: { receiptId: replayReceiptId, sourcePublicReceiptId: sourceReceipt },
  };
}

/** This V2 release only supports the explicit pre-launch public Ledger shape.
 * A new live accounting schema must have a separately reviewed adapter. */
export interface LiveLedger {
  accountingState: "PRE_LAUNCH_AUTHORITIES_CONFIGURED" | "FAIL_CLOSED";
  tokenState: "NOT_LAUNCHED";
  launchAuthorization: "BLOCKED";
  treasury: string;
  projectFeeRecipient: string;
  coverage: "NO_TOKEN_OBSERVATIONS_AVAILABLE" | "FAIL_CLOSED";
  explanation: string;
  evidenceBoundary: string;
  receiptId: string;
}

export function adaptLiveLedger(value: unknown): LiveLedger {
  const code = "DUMPSTER_LEDGER_SCHEMA_INVALID";
  const ledger = object(value, code);
  if (ledger.schemaVersion !== "binrat.dumpster-ledger/0.1" ||
      ledger.projectionVersion !== "BINRAT_DUMPSTER_LEDGER_V0" || ledger.chainId !== 5042 ||
      !["PRE_LAUNCH_AUTHORITIES_CONFIGURED", "FAIL_CLOSED"].includes(String(ledger.accountingState)) ||
      ledger.tokenState !== "NOT_LAUNCHED" || ledger.launchAuthorization !== "BLOCKED" ||
      ledger.marketingAuthorized !== false) fail(code);
  const authority = object(ledger.configuredAuthorities, code);
  const treasury = object(authority.treasury, code);
  const fee = object(authority.projectFeeRecipient, code);
  if (authority.status !== "OWNER_SELECTED_PRE_LAUNCH" ||
      authority.custodyEvidence !== "OWNER_DECLARATION_ONLY" ||
      authority.onChainRoleProof !== "NOT_YET_AVAILABLE" ||
      digest(authority.launchMechanicsReceiptDigest, code) !== "aff37d6d82cced00a34284453c0327bb51e5624b5761b621264f55602e8245e6" ||
      treasury.role !== "TREASURY" || fee.role !== "PROJECT_FEE_RECIPIENT" ||
      !sameAddress(address(treasury.address, code), "0xab063A9b53a2Ab832a941aE5890ea05c1672339D") ||
      !sameAddress(address(fee.address, code), "0xba5Ee49734b50Cf62d0B538584fbaC0eFFB79866")) fail(code);
  const funding = object(ledger.fundingAuthority, code);
  if (funding.accountingEnabled !== false || ![
    "PRELAUNCH_AUTHORITIES_CONFIGURED", "TREASURY_AUTHORITY_NOT_CONFIGURED",
    "TREASURY_AUTHORITY_INVALID", "FUNDING_OBSERVATION_SOURCE_NOT_IMPLEMENTED",
  ].includes(String(funding.status)) || funding.tokenAddress !== null ||
      array(funding.creatorFeeRecipients, code).length !== 0 ||
      array(funding.treasuryAddresses, code).length !== 0 ||
      funding.effectiveFromBlock !== null || funding.configVersion !== null ||
      funding.categoryPolicyVersion !== null ||
      (ledger.accountingState === "PRE_LAUNCH_AUTHORITIES_CONFIGURED") !==
        (funding.status === "PRELAUNCH_AUTHORITIES_CONFIGURED")) fail(code);
  const totals = object(ledger.totals, code);
  if ([totals.entryCount, totals.inflowEntryCount, totals.outflowEntryCount].some((n) => natural(n, code) !== 0) ||
      totals.tokenInflowsRaw !== "0" || totals.tokenOutflowsRaw !== "0" ||
      array(totals.byAsset, code).length !== 0 || array(ledger.entries, code).length !== 0) fail(code);
  const coverage = object(ledger.coverage, code);
  if (coverage.status !== (ledger.accountingState === "PRE_LAUNCH_AUTHORITIES_CONFIGURED"
    ? "NO_TOKEN_OBSERVATIONS_AVAILABLE" : "FAIL_CLOSED") ||
      coverage.fromBlock !== null || coverage.throughBlock !== null) fail(code);
  const observed = object(ledger.observedDataAvailability, code);
  for (const key of ["tokenAddress", "launchBlock", "launchTransaction", "tokenRelatedInflows", "tokenRelatedOutflows"])
    if (observed[key] !== "NOT_YET_AVAILABLE") fail(code);
  const utility = object(ledger.utilityStatus, code);
  if (utility.source !== "CAPABILITY_MANIFEST") fail(code);
  for (const group of ["shipped", "building", "planned"])
    for (const item of array(utility[group], code)) {
      const state = object(item, code);
      for (const field of ["capability", "engineeringStatus", "deploymentStatus", "publicStatus"])
        text(state[field], code);
    }
  strings(ledger.awaitingCanonicalAuthority, code);
  const receipt = object(ledger.receipt, code);
  digest(receipt.manifestDigest, code);
  digest(receipt.outputDigest, code);
  if (array(receipt.entryEvidenceDigests, code).length !== 0) fail(code);
  const id = receiptId(receipt.receiptId, "binrat-dumpster-ledger", code);
  return {
    accountingState: ledger.accountingState as LiveLedger["accountingState"],
    tokenState: "NOT_LAUNCHED",
    launchAuthorization: "BLOCKED",
    treasury: treasury.address as string,
    projectFeeRecipient: fee.address as string,
    coverage: coverage.status as LiveLedger["coverage"],
    explanation: text(ledger.explanation, code),
    evidenceBoundary: text(ledger.evidenceBoundary, code),
    receiptId: id,
  };
}
