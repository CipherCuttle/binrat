import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adaptLiveCreatorFile, adaptLiveFeed, adaptLiveRadar, adaptLiveReplay, adaptLiveLedger,
} from "../web-v2/src/liveAdapter.js";

const a = "0x" + "a".repeat(40);
const b = "0x" + "b".repeat(40);
const hash = "0x" + "f".repeat(64);
const id1 = "1".repeat(64);
const id2 = "2".repeat(64);
const digest = "d".repeat(64);
const copy = <T>(value: T): T => structuredClone(value);

const rawBag = {
  id: id1,
  source: "ARCPAD",
  token: a,
  symbol: "RAT",
  name: "Rats",
  blockNumber: "100",
  blockHash: hash,
  txHash: hash,
  logIndex: 1,
  reportedCreatorAddress: b,
  pool: a,
  metadata: { imageUri: "", website: "", twitter: "", telegram: "" },
  trashTrail: {
    priorLaunchCount: 1,
    coverage: "UNVERIFIED",
    prior: [{
      launchId: id2,
      token: a,
      symbol: "OLD",
      name: "Old Rats",
      blockNumber: "90",
      blockHash: hash,
      sourceFactId: "binrat-fact:5042:" + id2,
    }],
  },
  evidence: [{ state: "OBSERVED", code: "REPORTED_CREATOR", text: "Source reported it", sourceFactIds: [] as string[] }],
};
const rawFeed = {
  schemaVersion: "binrat.public-feed/0.1",
  chainId: 5042,
  asOfBlock: "120",
  asOfBlockHash: hash,
  historyCoverage: "UNVERIFIED",
  bags: [rawBag],
  receipt: {
    projectionVersion: "BINRAT_PUBLIC_PROJECTION_V0",
    chainId: 5042,
    asOfBlock: "120",
    asOfBlockHash: hash,
    historyCoverage: "UNVERIFIED",
    inputDigest: digest,
    outputDigest: digest,
    receiptId: "binrat-public:" + digest,
  },
};
const rawRadar = {
  schemaVersion: "binrat.rat-radar-watchlist/0.1",
  rankingVersion: "binrat.rat-radar-ranking/0.1",
  chainId: 5042,
  asOfBlock: "121",
  coverage: {
    historyCoverage: "UNVERIFIED",
    indexedLaunchCount: 1,
    swapReceiptCount: 2,
    acquisitionReceiptCount: 1,
    distinctRecipientAddressCount: 1,
    rankedAddressCount: 1,
    status: "PARTIAL",
  },
  method: {
    evidencedRole: "V3_SWAP_RECIPIENT",
    freeLimit: 5,
    ordering: [
      "distinctLaunchCount DESC",
      "medianFirstEntryBlockDelta ASC",
      "acquisitionReceiptCount DESC",
      "observedRecipientAddress ASC",
    ],
    identityBoundary: "Not a human identity",
    recommendationBoundary: "Not a trading recommendation",
  },
  candidates: [{
    rank: 1,
    observedRecipientAddress: a,
    distinctLaunchCount: 1,
    acquisitionReceiptCount: 1,
    medianFirstEntryBlockDelta: 1.5,
    earliestFirstEntryBlockDelta: 0,
    latestSeenBlock: "100",
    reasonCodes: ["RECURRENT_RECIPIENT_ACROSS_LAUNCHES"],
    reasons: ["Observed across one launch"],
    evidenceActivityIds: [id1],
  }],
  receipt: { receiptId: "binrat-rat-radar:" + digest, evidenceDigest: digest },
};
const rawCreator = {
  schemaVersion: "binrat.creator-file/0.1",
  chainId: 5042,
  asOfBlock: "122",
  historyCoverage: "UNVERIFIED",
  reportedCreatorAddress: b,
  indexedLaunchCount: 2,
  firstIndexedBlock: "90",
  lastIndexedBlock: "100",
  launches: [
    { ...rawBag, priorLaunchCount: 1 },
    { ...rawBag, id: id2, symbol: "OLD", name: "Old Rats", blockNumber: "90", priorLaunchCount: 0 },
  ],
  receipt: {
    projectionVersion: "BINRAT_CREATOR_FILE_V0",
    sourcePublicReceiptId: "binrat-public:" + digest,
    outputDigest: digest,
    receiptId: "binrat-creator:" + digest,
  },
};

test("LIVE feed validation maps real prior.launchId into the native dossier shape", () => {
  const feed = adaptLiveFeed(copy(rawFeed));
  assert.equal(feed.bags[0]!.trashTrail.prior[0]!.id, id2);
  assert.equal(feed.bags[0]!.reportedCreatorAddress, b);
  assert.equal(feed.historyCoverage, "UNVERIFIED");
});
test("LIVE feed empty projection is valid without synthetic fallback", () => {
  const raw = copy(rawFeed);
  raw.bags = [];
  assert.deepEqual(adaptLiveFeed(raw).bags, []);
});
test("LIVE feed rejects forged checkpoints, future facts, incomplete prior and missing evidence fields", () => {
  for (const mutate of [
    (v: typeof rawFeed) => { v.receipt.asOfBlock = "119"; },
    (v: typeof rawFeed) => { v.bags[0]!.blockNumber = "121"; },
    (v: typeof rawFeed) => { v.bags[0]!.trashTrail.priorLaunchCount = 2; },
    (v: typeof rawFeed) => { v.bags[0]!.trashTrail.prior[0]!.launchId = "invalid"; },
    (v: typeof rawFeed) => { v.bags[0]!.evidence[0]!.sourceFactIds = null as unknown as string[]; },
    (v: typeof rawFeed) => { v.historyCoverage = "COMPLETE"; },
  ]) {
    const raw = copy(rawFeed);
    mutate(raw);
    assert.throws(() => adaptLiveFeed(raw), /PUBLIC_FEED_SCHEMA_INVALID/);
  }
});
test("LIVE Radar accepts independently checkpointed, fractionally timed receipts", () => {
  const radar = adaptLiveRadar(copy(rawRadar));
  assert.equal(radar.candidates[0]!.medianFirstEntryBlockDelta, 1.5);
  assert.equal(radar.asOfBlock, "121");
});
test("LIVE Radar rejects invalid role, sample claims, duplicate addresses and invented receipts", () => {
  for (const mutate of [
    (v: typeof rawRadar) => { v.method.evidencedRole = "CREATOR"; },
    (v: typeof rawRadar) => { v.coverage.rankedAddressCount = 2; },
    (v: typeof rawRadar) => { v.candidates[0]!.latestSeenBlock = "122"; },
    (v: typeof rawRadar) => { v.candidates[0]!.evidenceActivityIds[0] = "demo-activity"; },
    (v: typeof rawRadar) => { v.receipt.evidenceDigest = "a".repeat(64); },
    (v: typeof rawRadar) => { v.candidates.push(copy(v.candidates[0]!)); v.coverage.rankedAddressCount = 2; },
  ]) {
    const raw = copy(rawRadar);
    mutate(raw);
    assert.throws(() => adaptLiveRadar(raw), /RAT_RADAR_SCHEMA_INVALID/);
  }
});
test("Canonical Creator File includes history beyond any feed-derived subset", () => {
  const creator = adaptLiveCreatorFile(copy(rawCreator), b);
  assert.equal(creator.indexedLaunchCount, 2);
  assert.equal(creator.launches[1]!.id, id2);
  assert.equal(creator.asOfBlock, "122");
});
test("Canonical Creator File rejects mismatched address, incomplete history and false receipts", () => {
  for (const mutate of [
    (v: typeof rawCreator) => { v.indexedLaunchCount = 3; },
    (v: typeof rawCreator) => { v.reportedCreatorAddress = a; },
    (v: typeof rawCreator) => { v.launches.reverse(); },
    (v: typeof rawCreator) => { v.receipt.receiptId = "demo"; },
    (v: typeof rawCreator) => { v.launches[0]!.blockNumber = "124"; },
  ]) {
    const raw = copy(rawCreator);
    mutate(raw);
    assert.throws(() => adaptLiveCreatorFile(raw, b), /CREATOR_FILE_SCHEMA_INVALID/);
  }
});


const rawReplay = {
  schemaVersion: "binrat.replay-bundle/0.1",
  projectionVersion: "BINRAT_REPLAY_BUNDLE_V0",
  chainId: 5042,
  asOfBlock: "122",
  asOfBlockHash: hash,
  historyCoverage: "UNVERIFIED",
  canonicalAuthority: {
    chainId: 5042,
    asOfBlock: "122",
    asOfBlockHash: hash,
    sourcePublicReceiptId: "binrat-public:" + digest,
  },
  coverage: {
    historyCoverage: "UNVERIFIED",
    observationCoverage: "PARTIAL",
    availableHorizons: ["5m"],
    missingHorizons: ["1h", "24h"],
  },
  launch: rawBag,
  creatorFile: rawCreator,
  intelligence: {
    schemaVersion: "binrat.bag-intelligence/0.1",
    chainId: 5042,
    asOfBlock: "122",
    bagId: id1,
    token: a,
    reportedCreatorAddress: b,
    observationCoverage: "PARTIAL",
    snapshots: [{
      horizonLabel: "5m",
      status: "COMPLETE",
      observationId: id2,
      evidenceDigest: digest,
      observedBlock: "110",
      observedBlockHash: hash,
      targetTimestampMs: 1_700_000_300_000,
      observedTimestampMs: 1_700_000_300_001,
    }],
    receipt: {
      sourcePublicReceiptId: "binrat-public:" + digest,
      observationEvidenceDigests: [digest],
      receiptId: "binrat-intelligence:" + digest,
    },
  },
  stages: [{
    kind: "LAUNCH",
    label: "LAUNCH",
    status: "OBSERVED",
    blockNumber: "100",
    blockHash: hash,
    targetTimestampMs: null as number | null,
    observedTimestampMs: null as number | null,
    evidenceId: "binrat-public:" + digest,
    evidenceDigest: null as string | null,
  }, {
    kind: "OBSERVATION",
    label: "5m",
    status: "COMPLETE",
    blockNumber: "110",
    blockHash: hash,
    targetTimestampMs: 1_700_000_300_000 as number | null,
    observedTimestampMs: 1_700_000_300_001 as number | null,
    evidenceId: id2,
    evidenceDigest: digest as string | null,
  }],
  receipt: {
    projectionVersion: "BINRAT_REPLAY_BUNDLE_V0",
    sourcePublicReceiptId: "binrat-public:" + digest,
    creatorFileReceiptId: "binrat-creator:" + digest,
    intelligenceReceiptId: "binrat-intelligence:" + digest,
    observationEvidenceDigests: [digest],
    outputDigest: digest,
    receiptId: "binrat-replay:" + digest,
  },
};

const rawLedger = {
  schemaVersion: "binrat.dumpster-ledger/0.1",
  projectionVersion: "BINRAT_DUMPSTER_LEDGER_V0",
  chainId: 5042,
  accountingState: "PRE_LAUNCH_AUTHORITIES_CONFIGURED",
  tokenState: "NOT_LAUNCHED",
  launchAuthorization: "BLOCKED",
  marketingAuthorized: false,
  configuredAuthorities: {
    status: "OWNER_SELECTED_PRE_LAUNCH",
    custodyEvidence: "OWNER_DECLARATION_ONLY",
    onChainRoleProof: "NOT_YET_AVAILABLE",
    launchMechanicsReceiptDigest: "aff37d6d82cced00a34284453c0327bb51e5624b5761b621264f55602e8245e6",
    treasury: { role: "TREASURY", address: "0xab063A9b53a2Ab832a941aE5890ea05c1672339D" },
    projectFeeRecipient: { role: "PROJECT_FEE_RECIPIENT", address: "0xba5Ee49734b50Cf62d0B538584fbaC0eFFB79866" },
  },
  fundingAuthority: {
    status: "PRELAUNCH_AUTHORITIES_CONFIGURED",
    accountingEnabled: false,
    tokenAddress: null,
    creatorFeeRecipients: [] as string[],
    treasuryAddresses: [] as string[],
    effectiveFromBlock: null as string | null,
    configVersion: null as string | null,
    categoryPolicyVersion: null as string | null,
  },
  totals: {
    entryCount: 0, inflowEntryCount: 0, outflowEntryCount: 0,
    tokenInflowsRaw: "0", tokenOutflowsRaw: "0", byAsset: [] as object[],
  },
  entries: [] as object[],
  coverage: { status: "NO_TOKEN_OBSERVATIONS_AVAILABLE", fromBlock: null, throughBlock: null },
  observedDataAvailability: {
    tokenAddress: "NOT_YET_AVAILABLE", launchBlock: "NOT_YET_AVAILABLE",
    launchTransaction: "NOT_YET_AVAILABLE", tokenRelatedInflows: "NOT_YET_AVAILABLE",
    tokenRelatedOutflows: "NOT_YET_AVAILABLE",
  },
  utilityStatus: { source: "CAPABILITY_MANIFEST", shipped: [], building: [], planned: [] },
  awaitingCanonicalAuthority: ["TOKEN_CONTRACT_ADDRESS"],
  explanation: "No funding observations.",
  evidenceBoundary: "Zero entries are not a zero balance.",
  receipt: { manifestDigest: digest, entryEvidenceDigests: [] as string[], outputDigest: digest,
    receiptId: "binrat-dumpster-ledger:" + digest },
};

test("LIVE Replay maps separately checkpointed launch and stored observation; missing horizons remain missing", () => {
  const replay = adaptLiveReplay(copy(rawReplay), id1);
  assert.equal(replay.stages.LAUNCH.value, "BLOCK 100");
  assert.equal(replay.stages["5m"].state, "COMPLETE");
  assert.match(replay.stages["5m"].note, /Evidence digest/);
  assert.equal(replay.stages["1h"].state, "MISSING");
  assert.equal(replay.stages["24h"].state, "MISSING");
  assert.equal(replay.asOfBlock, "122");
  assert.equal(replay.receipt.receiptId, "binrat-replay:" + digest);
});

test("LIVE Replay with no stored observations never invents 5m, 1h or 24h stages", () => {
  const raw = copy(rawReplay);
  raw.coverage.availableHorizons = [];
  raw.coverage.missingHorizons = ["5m", "1h", "24h"];
  raw.coverage.observationCoverage = "UNVERIFIED";
  raw.intelligence.observationCoverage = "UNVERIFIED";
  raw.intelligence.snapshots = [];
  raw.intelligence.receipt.observationEvidenceDigests = [];
  raw.receipt.observationEvidenceDigests = [];
  raw.stages = [raw.stages[0]!];
  const replay = adaptLiveReplay(raw, id1);
  assert.equal(replay.stages.LAUNCH.state, "COMPLETE");
  assert.deepEqual(["5m", "1h", "24h"].map((h) => replay.stages[h as "5m" | "1h" | "24h"].state),
    ["MISSING", "MISSING", "MISSING"]);
});

test("LIVE Replay rejects misattributed bag, future blocks, divergent receipts, forged chronology and fabricated horizons", () => {
  for (const mutate of [
    (v: typeof rawReplay) => { v.launch.id = id2; },
    (v: typeof rawReplay) => { v.intelligence.reportedCreatorAddress = a; },
    (v: typeof rawReplay) => { v.creatorFile.receipt.sourcePublicReceiptId = "binrat-public:" + "e".repeat(64); },
    (v: typeof rawReplay) => { v.coverage.observationCoverage = "COMPLETE"; },
    (v: typeof rawReplay) => { v.canonicalAuthority.asOfBlock = "121"; },
    (v: typeof rawReplay) => { v.stages[1]!.blockNumber = "123"; },
    (v: typeof rawReplay) => { v.stages[1]!.evidenceDigest = "e".repeat(64); },
    (v: typeof rawReplay) => { v.stages[1]!.observedTimestampMs = 1_700_000_299_999; },
    (v: typeof rawReplay) => { v.coverage.availableHorizons.push("24h"); },
    (v: typeof rawReplay) => { v.coverage.missingHorizons.push("5m"); },
    (v: typeof rawReplay) => { v.receipt.intelligenceReceiptId = "binrat-intelligence:" + "e".repeat(64); },
    (v: typeof rawReplay) => { v.receipt.receiptId = "demo-replay"; },
  ]) {
    const raw = copy(rawReplay);
    mutate(raw);
    assert.throws(() => adaptLiveReplay(raw, id1), /REPLAY_BUNDLE_SCHEMA_INVALID/);
  }
});

test("LIVE Ledger displays only production prelaunch declarations and fails closed on money or role spoofing", () => {
  const ledger = adaptLiveLedger(copy(rawLedger));
  assert.equal(ledger.tokenState, "NOT_LAUNCHED");
  assert.equal(ledger.launchAuthorization, "BLOCKED");
  assert.equal(ledger.coverage, "NO_TOKEN_OBSERVATIONS_AVAILABLE");
  for (const mutate of [
    (v: typeof rawLedger) => { v.tokenState = "LAUNCHED"; },
    (v: typeof rawLedger) => { v.fundingAuthority.accountingEnabled = true; },
    (v: typeof rawLedger) => { v.totals.entryCount = 1; },
    (v: typeof rawLedger) => { v.configuredAuthorities.treasury.address = a; },
    (v: typeof rawLedger) => { v.configuredAuthorities.custodyEvidence = "PROVEN"; },
    (v: typeof rawLedger) => { v.receipt.receiptId = "synthetic"; },
  ]) {
    const raw = copy(rawLedger);
    mutate(raw);
    assert.throws(() => adaptLiveLedger(raw), /DUMPSTER_LEDGER_SCHEMA_INVALID/);
  }
});
