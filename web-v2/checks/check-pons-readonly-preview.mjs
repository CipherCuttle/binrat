import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalSnapshotDigest } from "../../web/snapshot-contract.js";
import { loadPonsPreview } from "../src/pons-readonly-preview.mjs";

const launchId = "a".repeat(64);
const txHash = "0x" + "b".repeat(64);
const token = "0x" + "c".repeat(40);
const deployer = "0x" + "d".repeat(40);
const blockHash = "0x" + "e".repeat(64);
const now = 1800000000000;
async function dataset() {
  const feed = {
    schemaVersion: "binrat.latest-launches/0.1", chainId: 4663,
    sourceCheckpoint: "100", checkpointBlockHash: blockHash,
    historyCoverage: "PARTIAL",
    launches: [{
      launchId, txHash, token, deployer, blockNumber: "99",
      symbol: "TEST", name: "Test Pons Launch", priorLaunchCount: 1,
      factId: "binrat-fact:4663:" + launchId,
      metadata: { imageUri: "", website: "", twitter: "", telegram: "" },
    }],
  };
  feed.feedDigest = await canonicalSnapshotDigest(feed);
  const status = {
    schemaVersion: "binrat.public-status/0.1", state: "FRESH_VERIFIED", chainId: 4663,
    checkpointBlock: "100", checkpointBlockHash: blockHash,
    feedDigest: feed.feedDigest, verifiedAtMs: now - 1000,
    runtimeUpdatedAtMs: now - 1000, freshnessValidUntilMs: now + 30000,
    publicationVersion: 1, lastSyncError: null,
  };
  return { feed, status };
}
function mock(fetchItems, calls = []) {
  return async (path, init) => {
    calls.push([path, init.method]);
    const body = path === "/api/launches/latest" ? fetchItems.feed : fetchItems.status;
    return { ok: true, json: async () => body };
  };
}
test("verified single Pons launch and exact canonical binding", async () => {
  const data = await dataset(), calls = [];
  const result = await loadPonsPreview({ fetchImpl: mock(data, calls), now: () => now });
  assert.equal(result.freshness, "FRESH_VERIFIED");
  assert.equal(result.cases.length, 1);
  assert.equal(result.cases[0].id, launchId);
  assert.equal(result.cases[0].priorLaunches, 1);
  assert.deepEqual(calls, [["/api/launches/latest", "GET"], ["/api/status", "GET"]]);
});
test("verified empty is not unavailable", async () => {
  const data = await dataset();
  data.feed.launches = []; data.feed.feedDigest = await canonicalSnapshotDigest(data.feed);
  data.status.feedDigest = data.feed.feedDigest;
  const result = await loadPonsPreview({ fetchImpl: mock(data), now: () => now });
  assert.deepEqual(result.cases, []);
});
test("stale verified never upgrades to fresh", async () => {
  const data = await dataset();
  data.status.state = "STALE_VERIFIED"; data.status.freshnessValidUntilMs = null; data.status.lastSyncError = "RPC_DOWN";
  const result = await loadPonsPreview({ fetchImpl: mock(data), now: () => now });
  assert.equal(result.freshness, "STALE_VERIFIED");
});
test("expired fresh becomes stale, without extending TTL", async () => {
  const data = await dataset(); data.status.freshnessValidUntilMs = now - 1;
  const result = await loadPonsPreview({ fetchImpl: mock(data), now: () => now });
  assert.equal(result.freshness, "STALE_VERIFIED");
});
test("wrong chain fails closed", async () => {
  const data = await dataset(); data.feed.chainId = 5042;
  await assert.rejects(loadPonsPreview({ fetchImpl: mock(data), now: () => now }), /WEB_LATEST_LAUNCHES_INVALID/);
});
test("bad feed digest fails closed", async () => {
  const data = await dataset(); data.feed.launches[0].symbol = "CHANGED";
  await assert.rejects(loadPonsPreview({ fetchImpl: mock(data), now: () => now }), /PUBLIC_FEED_DIGEST_INVALID/);
});
test("same-height different block hash fails closed", async () => {
  const data = await dataset(); data.status.checkpointBlockHash = "0x" + "f".repeat(64);
  await assert.rejects(loadPonsPreview({ fetchImpl: mock(data), now: () => now }), /PONS_PREVIEW_BINDING_MISMATCH/);
});
test("status with no verified snapshot fails closed", async () => {
  const data = await dataset();
  data.status.state = "NO_VERIFIED_SNAPSHOT";
  for (const key of ["checkpointBlock", "checkpointBlockHash", "feedDigest", "verifiedAtMs", "publicationVersion", "freshnessValidUntilMs"]) data.status[key] = null;
  await assert.rejects(loadPonsPreview({ fetchImpl: mock(data), now: () => now }), /PONS_PREVIEW_NO_VERIFIED_SNAPSHOT/);
});
test("read error never produces a synthetic fallback", async () => {
  await assert.rejects(loadPonsPreview({ fetchImpl: async () => ({ ok: false, status: 503 }), now: () => now }), /PONS_PREVIEW_HTTP_503/);
});
test("future timestamps fail closed", async () => {
  const data = await dataset(); data.status.verifiedAtMs = now + 1000;
  await assert.rejects(loadPonsPreview({ fetchImpl: mock(data), now: () => now }), /PONS_PREVIEW_FUTURE_TIMESTAMP/);
});
test("a subsequent canonical snapshot cannot regress or change the same checkpoint", async () => {
  const initial = await dataset();
  const previous = await loadPonsPreview({ fetchImpl: mock(initial), now: () => now });
  for (const kind of ["block", "hash", "publication", "time"]) {
    const data = await dataset();
    if (kind === "block") { data.feed.sourceCheckpoint = "99"; data.status.checkpointBlock = "99"; }
    if (kind === "hash") { data.feed.checkpointBlockHash = "0x" + "f".repeat(64); data.status.checkpointBlockHash = data.feed.checkpointBlockHash; }
    if (kind === "publication") { previous.status.publicationVersion = 2; }
    if (kind === "time") { data.status.verifiedAtMs -= 1; }
    data.feed.feedDigest = await canonicalSnapshotDigest(data.feed); data.status.feedDigest = data.feed.feedDigest;
    await assert.rejects(loadPonsPreview({ fetchImpl: mock(data), now: () => now, previous }), /PONS_PREVIEW_(CHECKPOINT|PUBLICATION)_(REGRESSION|CONFLICT)/);
    previous.status.publicationVersion = 1;
  }
});
