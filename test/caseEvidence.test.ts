import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import {
  capturedCaseDatabase,
  productionCapture as capture,
} from "./support/caseProductionCapture.js";
import {
  readPublicCaseEvidence,
  CASE_WINDOW_SQL,
} from "../src/cloudflare/publicCaseEvidence.js";
import {
  verifyCaseEnvelope,
  CASE_EVIDENCE_MAX_BYTES,
  CASE_EVIDENCE_FACTORY,
} from "../src/public/caseEvidence.js";
import { PONS_V2_FACTORY } from "../src/pons/chain.js";
import { canonicalJson, sha256Hex } from "../src/evidence/canonical.js";
import type { D1DatabaseLike } from "../src/cloudflare/d1Types.js";
import worker from "../src/cloudflare/worker.js";
const id = capture.caseId;
async function envelope() {
  const db = await capturedCaseDatabase();
  try {
    const e = await readPublicCaseEvidence(db, id);
    assert.ok(e);
    return e;
  } finally {
    db.close();
  }
}
test("real old Case: canonical bounded source, recomputable digest, factory and exact identity", async () => {
  const e = await envelope();
  assert.equal(CASE_EVIDENCE_FACTORY, PONS_V2_FACTORY);
  assert.equal(e.digest, await sha256Hex(e.material));
  assert.equal(e.material.records[0].launch.launchId, id);
  assert.equal(e.material.priorLaunchCount, 19);
  assert.equal(e.material.records.length, 20);
  assert.ok(
    !JSON.parse(capture.snapshot.snapshot_json).launches.some(
      (l: { launchId: string }) => l.launchId === id,
    ),
  );
  assert.ok(
    new TextEncoder().encode(JSON.stringify(e)).length <
      CASE_EVIDENCE_MAX_BYTES,
  );
  await verifyCaseEnvelope(e, id, e.material.publication);
  writeFileSync(
    "docs/receipts/sprint-a1-2-contract/old-case-envelope.json",
    JSON.stringify(e, null, 2) + "\n",
  );
});
const mutations: Record<
  string,
  (v: Awaited<ReturnType<typeof envelope>>) => void
> = {
  token: (e) =>
    (e.material.records[0].launch.token = ("0x" +
      "f".repeat(40)) as `0x${string}`),
  deployer: (e) =>
    (e.material.records[0].launch.creator = ("0x" +
      "f".repeat(40)) as `0x${string}`),
  metadata: (e) => (e.material.records[0].launch.name = "Tampered"),
  blockHash: (e) =>
    (e.material.records[0].launch.blockHash = ("0x" +
      "f".repeat(64)) as `0x${string}`),
  eventId: (e) => (e.material.records[0].launch.eventId = "f".repeat(64)),
  chain: (e) => (e.material.chainId = 5042 as 4663),
  identity: (e) => (e.material.caseId = "f".repeat(64)),
  checkpoint: (e) => (e.material.publication.checkpointBlock = "0"),
  checkpointHash: (e) =>
    (e.material.publication.checkpointBlockHash = ("0x" +
      "f".repeat(64)) as `0x${string}`),
  feedDigest: (e) => (e.material.publication.feedDigest = "f".repeat(64)),
  publication: (e) => e.material.publication.publicationVersion++,
  count: (e) => (e.material.priorLaunchCount = 38),
  coverage: (e) =>
    (e.material.coverage = { ...e.material.coverage, resultLimit: 4 as 20 }),
  projection: (e) =>
    (e.material.projectionVersion =
      "OTHER" as typeof e.material.projectionVersion),
  missingEvidence: (e) => (e.material.records[0].provenance = null as never),
  provenance: (e) =>
    (e.material.records[0].provenance.evidenceDigest = "f".repeat(64)),
  authorityDigest: (e) =>
    (e.material.records[0].authorityDigest = "f".repeat(64)),
  missingEarlier: (e) => e.material.records.pop(),
  reordered: (e) => e.material.records.reverse(),
  archived: (e) => (e.material.archivedPublication = true as false),
  replay: (e) => (e.material.pointInTimeReplay = true as false),
};
for (const [name, mutate] of Object.entries(mutations))
  test(
    name + " tampering is rejected with original or recomputed envelope digest",
    async () => {
      const original = await envelope();
      const e = structuredClone(original);
      mutate(e);
      await assert.rejects(
        verifyCaseEnvelope(e, id, original.material.publication),
      );
      e.digest = await sha256Hex(e.material);
      await assert.rejects(
        verifyCaseEnvelope(e, id, original.material.publication),
      );
    },
  );
test("stored canonical/provenance contradictions and missing facts fail closed", async () => {
  for (const sql of [
    "UPDATE launches SET creator='0x' || printf('%040d',0) WHERE launch_id=?",
    "UPDATE provenance_facts SET evidence_digest=? WHERE launch_id=?",
    "DELETE FROM provenance_facts WHERE launch_id=?",
  ]) {
    const db = await capturedCaseDatabase();
    try {
      const params = sql.includes("evidence_digest")
        ? ["f".repeat(64), id]
        : [sql.startsWith("DELETE") ? capture.rows.at(-1).launch_id : id];
      await db
        .prepare(sql)
        .bind(...params)
        .run();
      await assert.rejects(readPublicCaseEvidence(db, id));
    } finally {
      db.close();
    }
  }
});
test("five SELECTs, indexed LIMIT20 window, payload cap and no writes", async () => {
  const db = await capturedCaseDatabase();
  const queries: string[] = [];
  const spy: D1DatabaseLike = {
    prepare(sql) {
      assert.match(sql.trim(), /^SELECT/);
      queries.push(sql);
      return db.prepare(sql);
    },
    batch() {
      throw Error("unexpected batch");
    },
    exec() {
      throw Error("unexpected mutation");
    },
  };
  try {
    const e = await readPublicCaseEvidence(spy, id);
    assert.ok(e);
    assert.equal(queries.length, 5);
    assert.match(CASE_WINDOW_SQL, /LEFT JOIN/);
    assert.match(CASE_WINDOW_SQL, /LIMIT 20$/);
    const plan = await db
      .prepare("EXPLAIN QUERY PLAN " + CASE_WINDOW_SQL)
      .bind(
        capture.target.creator,
        capture.target.block_number,
        capture.target.block_number,
        capture.target.block_number,
        capture.target.log_index,
        capture.target.log_index,
        id,
      )
      .all<{ detail: string }>();
    assert.ok(
      plan.results?.some((r) =>
        r.detail.includes("idx_launches_chain_source_creator_block_numeric"),
      ),
    );
    const oversized = structuredClone(e);
    oversized.material.records[0].launch.name = "x".repeat(
      CASE_EVIDENCE_MAX_BYTES,
    );
    await assert.rejects(
      verifyCaseEnvelope(oversized, id, e.material.publication),
      /PAYLOAD_LIMIT/,
    );
    writeFileSync(
      "docs/receipts/sprint-a1-2-contract/bounds.json",
      JSON.stringify(
        {
          queries: queries.length,
          returnedRecords: e.material.records.length,
          payloadBytes: new TextEncoder().encode(JSON.stringify(e)).length,
          maxBytes: CASE_EVIDENCE_MAX_BYTES,
          plan: plan.results,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    db.close();
  }
});
test("publication movement and durable checkpoint hash contradiction fail closed", async () => {
  const db = await capturedCaseDatabase();
  try {
    await db
      .prepare("UPDATE chain_checkpoints SET block_hash=? WHERE chain_id=4663")
      .bind("0x" + "f".repeat(64))
      .run();
    await assert.rejects(readPublicCaseEvidence(db, id), /SOURCE_MOVED/);
  } finally {
    db.close();
  }
});
test("GET-only additive Worker route, missing evidence unavailable, legacy response stays identical", async () => {
  const db = await capturedCaseDatabase();
  try {
    const url = "https://binrat.example/api/bag/" + id;
    const before = await worker
      .fetch(new Request(url), { DB: db })
      .then((r) => r.json());
    const result = await worker.fetch(new Request(url + "/evidence"), {
      DB: db,
      BINRAT_PONS_READ_ONLY: "true",
    });
    assert.equal(result.status, 200);
    const e = await result.json();
    await verifyCaseEnvelope(
      e,
      id,
      (e as Awaited<ReturnType<typeof envelope>>).material.publication,
    );
    assert.equal(
      (
        await worker.fetch(new Request(url + "/evidence", { method: "POST" }), {
          DB: db,
        })
      ).status,
      405,
    );
    assert.equal(
      (
        await worker.fetch(
          new Request(
            "https://binrat.example/api/bag/" + "f".repeat(64) + "/evidence",
          ),
          { DB: db },
        )
      ).status,
      404,
    );
    assert.equal(
      canonicalJson(
        await worker.fetch(new Request(url), { DB: db }).then((r) => r.json()),
      ),
      canonicalJson(before),
    );
    await db
      .prepare("DELETE FROM provenance_facts WHERE launch_id=?")
      .bind(id)
      .run();
    assert.equal(
      (await worker.fetch(new Request(url + "/evidence"), { DB: db })).status,
      503,
    );
  } finally {
    db.close();
  }
});
