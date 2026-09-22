import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addressFromRoute,
  matchingCreatorBags,
  selectRadarCandidate,
} from "../web-v2/src/routeIdentity.js";
import { demoFeed, demoRadar } from "../web-v2/src/fixtures.js";

test("Radar deep link recognizes exact EVM address in any case", () => {
  const actual = demoRadar.candidates[1].observedRecipientAddress;
  const parsed = addressFromRoute("/radar/address/" + actual, "/radar/address/");
  assert.equal(parsed, actual.toLowerCase());
  assert.equal(selectRadarCandidate(demoRadar, parsed || undefined)?.rank, demoRadar.candidates[1].rank);
  assert.equal(addressFromRoute("/radar", "/radar/address/"), null);
  assert.equal(addressFromRoute("/radar/address/%ZZ", "/radar/address/"), "");
  assert.equal(addressFromRoute("/radar/address/nope", "/radar/address/"), "");
});

test("Unknown Radar address fails closed instead of opening another dossier", () => {
  const unknown = "0x0000000000000000000000000000000000000000";
  assert.equal(selectRadarCandidate(demoRadar, unknown), undefined);
  assert.equal(selectRadarCandidate(demoRadar, ""), undefined);
  assert.equal(selectRadarCandidate(demoRadar), demoRadar.candidates[0]);
  assert.equal(selectRadarCandidate({ candidates: [] }), undefined);
});

test("Creator URLs bind only the source-reported address, not observed recipient roles", () => {
  const creator = demoFeed.bags[0].reportedCreatorAddress;
  const encoded = addressFromRoute("/creator/" + creator, "/creator/");
  assert.equal(encoded, creator.toLowerCase());
  const found = matchingCreatorBags(demoFeed, encoded || "");
  assert.equal(found.length, 1);
  assert.equal(found[0].id, demoFeed.bags[0].id);
  assert.deepEqual(matchingCreatorBags(demoFeed, demoRadar.candidates[0].observedRecipientAddress), []);
  assert.deepEqual(matchingCreatorBags(demoFeed, "nope"), []);
});
