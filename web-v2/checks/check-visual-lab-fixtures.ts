import assert from "node:assert/strict";
import { labCases, labProvenance } from "../src/visual-lab-fixtures";

const expected = {
  "$MOLDY": { matches: 3, receipts: 4, watch: "access-required" },
  "$SLOP": { matches: 0, receipts: 1, watch: "access-required" },
  "$CRUST": { matches: 2, receipts: 3, watch: "access-required" },
  "$OOZE": { matches: 0, receipts: 2, watch: "unavailable" },
  "$TIN": { matches: 0, receipts: 1, watch: "unavailable" },
};
const sharedRecords = new Map();
assert.match(labProvenance.boundary, /Invented local examples/);
assert.equal(new Set(labCases.map((item) => item.id)).size, 5);
assert.deepEqual(labCases.map((item) => item.symbol), Object.keys(expected));
for (const item of labCases) {
  const contract = expected[item.symbol as keyof typeof expected];
  assert.equal(item.history.prior.length, contract.matches, item.symbol);
  assert.equal(item.receipts.length, contract.receipts, item.symbol);
  assert.equal(item.watch, contract.watch, item.symbol);
  const receipts = new Map(item.receipts.map((receipt) => [receipt.id, receipt]));
  assert.equal(receipts.size, item.receipts.length, "duplicate receipt ID");
  const current = receipts.get(item.current.receiptId)!;
  assert.ok(current, "current receipt must exist");
  assert.equal(current.record.symbol, item.symbol);
  for (const fact of item.facts) assert.ok(receipts.has(fact.receiptId), `unsupported fact: ${fact.text}`);
  for (const event of item.history.prior) {
    const prior = receipts.get(event.receiptId)!;
    assert.ok(prior, "prior receipt must exist in selected Case");
    assert.equal(prior.record.symbol, event.symbol);
    assert.notEqual(prior.record.reportedDeployer, "unknown");
    assert.equal(prior.record.reportedDeployer, current.record.reportedDeployer, "recurrence must match reported addresses");
    assert.ok(Date.parse(prior.record.indexedAt) < Date.parse(current.record.indexedAt), "future launches cannot become prior history");
  }
  if (item.history.kind === "unknown") {
    assert.equal(item.history.prior.length, 0);
    assert.ok(item.history.reason.length > 30, "unknown history needs an explicit boundary");
  }
  if (item.watch === "access-required") assert.notEqual(current.record.reportedDeployer, "unknown");
  for (const receipt of item.receipts) {
    assert.equal(receipt.source, "LOCAL_SYNTHETIC_FIXTURE");
    assert.match(receipt.record.chainVerification, /none/);
    if (sharedRecords.has(receipt.id)) assert.deepEqual(receipt, sharedRecords.get(receipt.id), "shared records must not contradict another Case");
    sharedRecords.set(receipt.id, receipt);
  }
}
console.log("BINRAT visual lab: all 5 fixture graphs, chronology, unknown-history and Watch boundaries PASS");
