import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bagIdFromPath,
  findBagAtCheckpoint,
  radarShortlistCounts,
  replayStagesForBag,
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

test("Replay horizons stay bound to the exact demo case and never leak into LIVE", () => {
  const feral = demoFeed.bags[0];
  const slag = demoFeed.bags[1];
  const feralDemo = replayStagesForBag(feral, "DEMO");
  const slagDemo = replayStagesForBag(slag, "DEMO");
  const feralLive = replayStagesForBag(feral, "LIVE");
  assert.equal(feralDemo["5m"].state, "COMPLETE");
  assert.equal(feralDemo["1h"].state, "PARTIAL");
  assert.match(feralDemo["5m"].note, /DEMO FIXTURE ONLY/);
  for (const horizon of ["5m", "1h", "24h"] as const) {
    assert.equal(slagDemo[horizon].state, "MISSING");
    assert.equal(feralLive[horizon].state, "MISSING");
  }
  assert.equal(slagDemo.LAUNCH.value, "BLOCK " + slag.blockNumber);
  assert.notEqual(feralDemo.LAUNCH.value, slagDemo.LAUNCH.value);
});

test("Malformed or missing Bag URL encoding resolves to not-found, not a crash", () => {
  assert.equal(bagIdFromPath("/bag/" + demoFeed.bags[0].id), demoFeed.bags[0].id);
  assert.equal(bagIdFromPath("/bag/%"), "");
  assert.equal(bagIdFromPath("/bag/%ZZ"), "");
  assert.equal(bagIdFromPath("/bag/"), "");
  assert.equal(findBagAtCheckpoint(demoFeed, bagIdFromPath("/bag/%ZZ")), undefined);
});
