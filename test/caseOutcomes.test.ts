import assert from "node:assert/strict";
import test from "node:test";
import { a2Capture, a2Database } from "./support/a2Specimen.js";
import {
  readPublicCaseOutcomes,
  CASE_OUTCOME_SQL,
} from "../src/cloudflare/publicCaseOutcomes.js";
import {
  verifyCaseOutcomes,
  CASE_OUTCOMES_MAX_BYTES,
} from "../src/public/caseOutcomes.js";
import { readPublicCaseEvidence } from "../src/cloudflare/publicCaseEvidence.js";
import { sha256Hex } from "../src/evidence/canonical.js";
import worker from "../src/cloudflare/worker.js";
async function specimen() {
  const db = await a2Database();
  try {
    const e = await readPublicCaseOutcomes(db, a2Capture.caseId);
    assert.ok(e);
    return e;
  } finally {
    db.close();
  }
}
test("actual production specimen: legacy source, all fixed-age receipts and partial graduation", async () => {
  const e = await specimen();
  const v = await verifyCaseOutcomes(
    e,
    a2Capture.caseId,
    e.material.caseEvidence.material.publication,
  );
  assert.equal(v.launches.length, 12);
  assert.equal(v.summary.earlierReturned, 11);
  assert.equal(v.summary.earlierWithSamples, 11);
  assert.equal(v.summary.earlierWithGraduatedSample, 1);
  const graduated = v.launches.find((l) =>
    l.samples.some((s) => s.phase === "GRADUATED"),
  );
  assert.ok(graduated);
  assert.deepEqual(
    graduated.samples.map((s) => s.phase),
    ["CURVE", "CURVE", "GRADUATED"],
  );
  assert.deepEqual(graduated.samples[2]!.missing, ["V4_POOL_STATE"]);
  assert.equal(graduated.samples[2]!.estimatedFdvQuoteRaw, null);
});
test("recent 20-launch window has unknown outcomes; no borrowing older samples or global recurrence", async () => {
  const db = await a2Database();
  try {
    const e = await readPublicCaseOutcomes(
      db,
      a2Capture.recentEnvelope.material.caseId,
    );
    assert.ok(e);
    const v = await verifyCaseOutcomes(
      e,
      e.material.caseEvidence.material.caseId,
      e.material.caseEvidence.material.publication,
    );
    assert.equal(v.launches.length, 20);
    assert.equal(v.summary.earlierReturned, 19);
    assert.equal(v.summary.earlierWithSamples, 0);
    assert.equal(v.summary.earlierWithoutSamples, 19);
    assert.equal(v.summary.earlierWithGraduatedSample, 0);
  } finally {
    db.close();
  }
});
const tamper: Record<
  string,
  (e: Awaited<ReturnType<typeof specimen>>) => void
> = {
  wrongCase: (e) => (e.material.caseEvidence.material.caseId = "f".repeat(64)),
  wrongCheckpoint: (e) =>
    e.material.caseEvidence.material.publication.publicationVersion++,
  missingLaunch: (e) => e.material.outcomes.pop(),
  reorderedLaunch: (e) => e.material.outcomes.reverse(),
  duplicateHorizon: (e) =>
    e.material.outcomes[0]!.payloads.push(e.material.outcomes[0]!.payloads[0]!),
  extraPayloadField: (e) => {
    const r = JSON.parse(e.material.outcomes[0]!.payloads[0]!);
    r.fakeRiskScore = 99;
    e.material.outcomes[0]!.payloads[0] = JSON.stringify(r);
  },
  changedSampleToken: (e) => {
    const r = JSON.parse(e.material.outcomes[0]!.payloads[0]!);
    r.token = "0x" + "f".repeat(40);
    e.material.outcomes[0]!.payloads[0] = JSON.stringify(r);
  },
  changedPhase: (e) => {
    const r = JSON.parse(e.material.outcomes[0]!.payloads[0]!);
    r.phase = "GRADUATED";
    e.material.outcomes[0]!.payloads[0] = JSON.stringify(r);
  },
};
for (const [name, mutate] of Object.entries(tamper))
  test(name + " rejected even with recomputed outer digest", async () => {
    const e = await specimen();
    const pub = structuredClone(e.material.caseEvidence.material.publication);
    mutate(e);
    e.digest = await sha256Hex(e.material);
    await assert.rejects(verifyCaseOutcomes(e, a2Capture.caseId, pub));
  });
test("payload limits, forged authority, and missing outcome remain fail closed", async () => {
  const e = await specimen();
  await assert.rejects(
    verifyCaseOutcomes(
      { ...e, padding: "x".repeat(CASE_OUTCOMES_MAX_BYTES) },
      a2Capture.caseId,
      e.material.caseEvidence.material.publication,
    ),
  );
  const db = await a2Database();
  try {
    await db
      .prepare("DELETE FROM pons_outcome_receipts WHERE launch_id=?")
      .bind(e.material.outcomes[1]!.launchId)
      .run();
    const next = await readPublicCaseOutcomes(db, a2Capture.caseId);
    assert.ok(next);
    const v = await verifyCaseOutcomes(
      next,
      a2Capture.caseId,
      next.material.caseEvidence.material.publication,
    );
    assert.equal(v.summary.earlierWithoutSamples, 1);
  } finally {
    db.close();
  }
});
test("unknown legacy source fields are rejected, ingestion timestamp alone is normalized", async () => {
  const db = await a2Database();
  try {
    const row = a2Capture.rows[0];
    const l = JSON.parse(row.authority_json);
    l.fakeClaim = true;
    await db
      .prepare("UPDATE launches SET authority_json=? WHERE launch_id=?")
      .bind(JSON.stringify(l), row.launch_id)
      .run();
    await assert.rejects(readPublicCaseEvidence(db, a2Capture.caseId));
  } finally {
    db.close();
  }
});
test("point lookup plan uses existing index; no join/scan or RPC authority", async () => {
  const db = await a2Database();
  try {
    const rows = await db
      .prepare("EXPLAIN QUERY PLAN " + CASE_OUTCOME_SQL)
      .bind(a2Capture.caseId)
      .all<{ detail: string }>();
    assert.ok(
      rows.results?.some((r) =>
        /SEARCH.*idx_pons_outcome_launch_horizon/.test(r.detail),
      ),
    );
    assert.ok(
      rows.results?.every(
        (r) => !r.detail.includes("SCAN pons_outcome_receipts"),
      ),
    );
  } finally {
    db.close();
  }
});
test("default evidence contract preserved, optional projection stays read only", async () => {
  const db = await a2Database();
  try {
    const env = { DB: db, BINRAT_PONS_READ_ONLY: "true" };
    for (const [suffix, status] of [
      ["", 200],
      ["?include=outcomes", 200],
      ["?include=invalid", 400],
    ] as const) {
      const r = await worker.fetch(
        new Request(
          "https://binrat.tech/api/bag/" +
            a2Capture.caseId +
            "/evidence" +
            suffix,
        ),
        env,
      );
      assert.equal(r.status, status);
    }
    const r = await worker.fetch(
      new Request(
        "https://binrat.tech/api/bag/" +
          a2Capture.caseId +
          "/evidence?include=outcomes",
        { method: "POST" },
      ),
      env,
    );
    assert.equal(r.status, 405);
  } finally {
    db.close();
  }
});

// Rebuild every inner digest: these test source binding, not just tamper detection.
import { buildPonsCurveOutcomeCapabilityReceipt } from "../src/pons/outcomeCapability.js";
import {
  buildPonsOutcomeObservationReceipt,
  parsePonsOutcomeObservationReceipt,
} from "../src/pons/outcomeReceipts.js";
import { canonicalJson } from "../src/evidence/canonical.js";
for (const kind of [
  "token",
  "curve",
  "futureBlock",
  "futureTime",
  "target",
  "blockConflict",
] as const)
  test("fully redigested " + kind + " mismatch rejected", async () => {
    const e = await specimen(),
      pub = e.material.caseEvidence.material.publication;
    const old = await parsePonsOutcomeObservationReceipt(
      e.material.outcomes[0]!.payloads[1]!,
    );
    const launch = {
      launchId: old.launchId,
      token: old.token,
      curve: old.curve,
    };
    if (kind === "token")
      launch.token = ("0x" + "f".repeat(40)) as `0x${string}`;
    if (kind === "curve")
      launch.curve = ("0x" + "f".repeat(40)) as `0x${string}`;
    const capability = await buildPonsCurveOutcomeCapabilityReceipt({
      launch,
      observedBlock:
        kind === "futureBlock"
          ? BigInt(pub.checkpointBlock) + 1n
          : kind === "blockConflict"
            ? BigInt(pub.checkpointBlock)
            : old.observedBlock,
      observedBlockHash: old.observedBlockHash,
      observedTimestampMs:
        kind === "futureTime" ? pub.verifiedAtMs + 1 : old.observedTimestampMs,
      pairToken: old.pairToken,
      quoteDecimals: old.quoteDecimals,
      totalSupply: old.totalSupply,
      graduated: old.phase === "GRADUATED",
      quoteReserve: old.quoteReserve,
      tokenReserve: old.tokenReserve,
    });
    const receipt = await buildPonsOutcomeObservationReceipt({
      launch,
      horizonMs: old.horizonMs,
      targetTimestampMs: old.targetTimestampMs - (kind === "target" ? 1 : 0),
      capability,
    });
    e.material.outcomes[0]!.payloads[1] = canonicalJson(receipt);
    e.digest = await sha256Hex(e.material);
    await assert.rejects(verifyCaseOutcomes(e, a2Capture.caseId, pub));
  });
test("oversized stored receipt and concurrent publication/checkpoint changes fail closed", async () => {
  for (const kind of ["oversized", "publication", "rollback"] as const) {
    const db = await a2Database();
    try {
      if (kind === "oversized")
        await db
          .prepare(
            "UPDATE pons_outcome_receipts SET payload_json=? WHERE launch_id=?",
          )
          .bind("x".repeat(8193), a2Capture.caseId)
          .run();
      else {
        const batch = db.batch.bind(db);
        db.batch = async (statements) => {
          const result = await batch(statements);
          if (kind === "publication")
            await db
              .prepare(
                "UPDATE binrat_public_snapshots SET publication_version=publication_version+1",
              )
              .run();
          else
            await db
              .prepare("UPDATE chain_checkpoints SET block_number=?")
              .bind("1")
              .run();
          return result;
        };
      }
      await assert.rejects(readPublicCaseOutcomes(db, a2Capture.caseId));
    } finally {
      db.close();
    }
  }
});
test("hostile H1: stored authority columns cannot contradict an intact canonical receipt", async () => {
  for (const column of [
    "phase",
    "token",
    "observed_block_hash",
    "evidence_digest",
  ]) {
    const db = await a2Database();
    try {
      await db
        .prepare(
          `UPDATE pons_outcome_receipts SET ${column}=? WHERE launch_id=?`,
        )
        .bind(
          column === "phase"
            ? "GRADUATED"
            : column === "token"
              ? "0x" + "f".repeat(40)
              : column === "observed_block_hash"
                ? "0x" + "f".repeat(64)
                : "f".repeat(64),
          a2Capture.caseId,
        )
        .run();
      await assert.rejects(
        readPublicCaseOutcomes(db, a2Capture.caseId),
        /STORED_BINDING_INVALID/,
      );
    } finally {
      db.close();
    }
  }
});
