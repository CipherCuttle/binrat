import assert from "node:assert/strict";
import { test } from "node:test";
import { settleIndependentSlices } from "../web-v2/src/independentSlices.js";

test("Radar transport or validation error never suppresses a valid public Feed", async () => {
  const result = await settleIndependentSlices(
    async () => ({ asOfBlock: "100", bags: ["real"] }),
    async () => { throw new Error("RAT_RADAR_SCHEMA_INVALID"); },
  );
  assert.deepEqual(result.feed, { asOfBlock: "100", bags: ["real"] });
  assert.equal(result.radar, null);
  assert.equal(result.feedError, null);
  assert.equal(result.radarError, "RAT_RADAR_SCHEMA_INVALID");
});

test("Feed failure never erases independently validated Radar or invents a common checkpoint", async () => {
  const result = await settleIndependentSlices(
    async () => { throw new Error("PUBLIC_READ_PLANE_UNAVAILABLE"); },
    async () => ({ asOfBlock: "123", candidates: [] }),
  );
  assert.equal(result.feed, null);
  assert.deepEqual(result.radar, { asOfBlock: "123", candidates: [] });
  assert.equal(result.feedError, "PUBLIC_READ_PLANE_UNAVAILABLE");
  assert.equal(result.radarError, null);
});

test("both failures remain visible without DEMO fallback or fictitious zero counts", async () => {
  const result = await settleIndependentSlices(
    async () => { throw new Error("BAD_FEED"); },
    async () => { throw new Error("BAD_RADAR"); },
  );
  assert.equal(result.feed, null);
  assert.equal(result.radar, null);
  assert.equal(result.feedError, "BAD_FEED");
  assert.equal(result.radarError, "BAD_RADAR");
});
