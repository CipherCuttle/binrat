import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  inspectPonsHistoricalSource,
  loadPonsPreview,
} from "../src/pons-readonly-preview.mjs";
const read = (name) =>
  JSON.parse(
    readFileSync(
      new URL(
        "../../docs/receipts/sprint-a1-1/" + name + ".json",
        import.meta.url,
      ),
    ),
  );
const raw = read("historical-source"),
  feed = read("public-feed"),
  status = read("public-status");
const snapshot = await loadPonsPreview({
  fetchImpl: async (path) =>
    Response.json(path === "/api/status" ? status : feed),
});
// Recorded public GETs; mutations below are adverse controls, never LIVE data.
test("historical source returns only a diagnostic, never bag fields or latest-feed authority", async () => {
  const calls = [];
  const state = await inspectPonsHistoricalSource({
    id: raw.bag.id,
    snapshot,
    fetchImpl: async (path, init) => {
      calls.push([path, init.method, init.cache]);
      return Response.json(raw);
    },
  });
  assert.equal(state, "HISTORICAL_SOURCE_ONLY");
  assert.deepEqual(calls, [["/api/bag/" + raw.bag.id, "GET", "no-store"]]);
  assert.ok(!snapshot.cases.some((item) => item.id === raw.bag.id));
});
for (const [name, mutate, error] of [
  ["wrong identity", (v) => (v.bag.id = "f".repeat(64)), /PROJECTION_MISMATCH/],
  [
    "different projection",
    (v) => (v.receipt.projectionVersion = "OTHER"),
    /PROJECTION_MISMATCH/,
  ],
  [
    "upgraded history",
    (v) => (v.historyCoverage = "PARTIAL"),
    /PROJECTION_MISMATCH/,
  ],
  ["different checkpoint", (v) => (v.asOfBlock = "0"), /CHECKPOINT_MISMATCH/],
  [
    "different checkpoint hash",
    (v) => (v.receipt.asOfBlockHash = "0x" + "f".repeat(64)),
    /CHECKPOINT_MISMATCH/,
  ],
  [
    "inconsistent projection count",
    (v) => v.bag.trashTrail.priorLaunchCount++,
    /WEB_PUBLIC_BAG_INVALID/,
  ],
  [
    "invalid output digest",
    (v) => (v.receipt.outputDigest = ""),
    /PROJECTION_MISMATCH/,
  ],
])
  test(name + " is unavailable, not a verified historical Case", async () => {
    const value = structuredClone(raw);
    mutate(value);
    await assert.rejects(
      inspectPonsHistoricalSource({
        id: raw.bag.id,
        snapshot,
        fetchImpl: async () => Response.json(value),
      }),
      error,
    );
  });
test("404 and 503 never become historical source evidence", async () => {
  for (const code of [404, 503])
    await assert.rejects(
      inspectPonsHistoricalSource({
        id: raw.bag.id,
        snapshot,
        fetchImpl: async () => new Response("{}", { status: code }),
      }),
      new RegExp("HTTP_" + code),
    );
});
test("malformed identity never initiates a lookup", async () => {
  await assert.rejects(
    inspectPonsHistoricalSource({
      id: "not-an-id",
      snapshot,
      fetchImpl: () => {
        throw Error("unexpected request");
      },
    }),
    /ID_INVALID/,
  );
});
