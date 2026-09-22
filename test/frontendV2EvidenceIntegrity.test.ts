import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findBagAtCheckpoint,
  radarShortlistCounts,
} from "../web-v2/src/evidenceIntegrity.js";
import { demoFeed, demoRadar } from "../web-v2/src/fixtures.js";

test("Bag URL selects only the exact bag identifier", () => {
  const bag = demoFeed.bags[1];
  assert.equal(findBagAtCheckpoint(demoFeed, bag.id), bag);
  assert.equal(findBagAtCheckpoint(demoFeed, "bag-invalid-id"), undefined);
  assert.equal(findBagAtCheckpoint(demoFeed, ""), undefined);
  assert.equal(findBagAtCheckpoint({ bags: [] }, bag.id), undefined);
  assert.notEqual(findBagAtCheckpoint(demoFeed, "bag-invalid-id"), demoFeed.bags[0]);
});

test("Radar explicitly distinguishes displayed, ranked and observed addresses", () => {
  assert.deepEqual(radarShortlistCounts(demoRadar), {
    displayed: 5,
    ranked: 5,
    observed: 414,
  });
  const subset = { ...demoRadar, candidates: demoRadar.candidates.slice(0, 2) };
  assert.deepEqual(radarShortlistCounts(subset), {
    displayed: 2,
    ranked: 5,
    observed: 414,
  });
});
