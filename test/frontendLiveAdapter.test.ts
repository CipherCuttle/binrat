import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adaptLiveCreatorFile, adaptLiveFeed, adaptLiveRadar,
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
