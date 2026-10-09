import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadHistoricalCase } from "../src/historicalCase.js";
import { loadPonsPreview } from "../src/pons-readonly-preview.mjs";
const envelope = JSON.parse(
  readFileSync(
    "docs/receipts/sprint-a1-2-contract/old-case-envelope.json",
    "utf8",
  ),
);
const capture = JSON.parse(
  readFileSync(
    "docs/receipts/sprint-a1-2-contract/production-records.json",
    "utf8",
  ),
);
const feed = JSON.parse(capture.snapshot.snapshot_json);
const pub = envelope.material.publication;
const status = {
  schemaVersion: "binrat.public-status/0.1",
  state: "STALE_VERIFIED",
  ...pub,
  runtimeUpdatedAtMs: null,
  lastSyncError: null,
  freshnessValidUntilMs: null,
};
const snapshot = await loadPonsPreview({
  fetchImpl: async (path) =>
    Response.json(path === "/api/status" ? status : feed),
});
test("complete validator yields source-bound historical item with own bounded count and no feed digest", async () => {
  const result = await loadHistoricalCase({
    id: capture.caseId,
    snapshot,
    fetchImpl: async () => Response.json(envelope),
  });
  assert.equal(result.item.priorLaunches, 19);
  assert.equal(result.item.id, capture.caseId);
  assert.equal("feedDigest" in result.item, false);
  assert.equal(result.envelope.digest, envelope.digest);
  assert.equal(snapshot.freshness, "STALE_VERIFIED");
});
test("stream byte bound does not trust content-length", async () => {
  for (const response of [
    () => new Response("x".repeat(65537)),
    () => new Response("{}", { headers: { "content-length": "65537" } }),
  ])
    await assert.rejects(
      loadHistoricalCase({
        id: capture.caseId,
        snapshot,
        fetchImpl: async () => response(),
      }),
      /PAYLOAD_LIMIT/,
    );
});
test("503 and missing proof do not produce a historical item", async () => {
  await assert.rejects(
    loadHistoricalCase({
      id: capture.caseId,
      snapshot,
      fetchImpl: async () => new Response("{}", { status: 503 }),
    }),
    /HTTP_503/,
  );
  await assert.rejects(
    loadHistoricalCase({
      id: capture.caseId,
      snapshot,
      fetchImpl: async () => Response.json({}),
    }),
    /CASE_EVIDENCE/,
  );
});
