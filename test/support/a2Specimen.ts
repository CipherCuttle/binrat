import { readFileSync } from "node:fs";
import { D1CompatDatabase } from "./d1Compat.js";
import { D1_SCHEMA_SQL } from "../../src/cloudflare/d1Schema.js";
import { D1Store } from "../../src/cloudflare/d1Store.js";
import { D1PonsOutcomeObservationStore } from "../../src/cloudflare/ponsOutcomeStore.js";
import { parsePonsOutcomeObservationReceipt } from "../../src/pons/outcomeReceipts.js";
import type { LaunchObserved } from "../../src/core/types.js";
import type { ProvenanceFact } from "../../src/intelligence/provenance.js";
export const a2Capture = JSON.parse(
  readFileSync(
    new URL("../../docs/receipts/sprint-a2/specimen.json", import.meta.url),
    "utf8",
  ),
);
export async function a2Database() {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db, 4663);
  for (const row of a2Capture.rows) {
    const l = JSON.parse(row.authority_json);
    await store.putLaunch({
      ...l,
      blockNumber: BigInt(l.blockNumber),
    } as LaunchObserved);
    await db
      .prepare("UPDATE launches SET authority_json=? WHERE launch_id=?")
      .bind(row.authority_json, l.launchId)
      .run();
    const f = JSON.parse(row.payload_json);
    await store.putProvenanceFact({
      ...f,
      observedBlock: BigInt(f.observedBlock),
    } as ProvenanceFact);
  }
  for (const record of [
    ...a2Capture.recentEnvelope.material.records,
    ...a2Capture.currentEnvelope.material.records,
  ]) {
    const l = record.launch;
    await store.putLaunch({
      ...l,
      blockNumber: BigInt(l.blockNumber),
      observedAtMs: 0,
    } as LaunchObserved);
    const f = record.provenance;
    await store.putProvenanceFact({
      ...f,
      observedBlock: BigInt(f.observedBlock),
    } as ProvenanceFact);
  }
  const outcomes = new D1PonsOutcomeObservationStore(db);
  for (const row of a2Capture.outcomes)
    await outcomes.put(
      await parsePonsOutcomeObservationReceipt(row.payload_json),
    );
  const s = a2Capture.snapshot;
  await db
    .prepare(
      "INSERT INTO binrat_public_snapshots (chain_id,checkpoint_block,checkpoint_block_hash,feed_digest,snapshot_json,verified_at_ms,publication_version) VALUES (?,?,?,?,?,?,?)",
    )
    .bind(
      s.chain_id,
      s.checkpoint_block,
      s.checkpoint_block_hash,
      s.feed_digest,
      s.snapshot_json,
      s.verified_at_ms,
      s.publication_version,
    )
    .run();
  await store.commitCheckpoint({
    blockNumber: BigInt(s.block_number),
    blockHash: s.block_hash,
    guardBlockNumber: null,
    guardBlockHash: null,
  });
  const runtime = a2Capture.runtime;
  if (runtime) {
    const columns = Object.keys(runtime);
    await db
      .prepare(
        `INSERT INTO binrat_runtime_state (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
      )
      .bind(...columns.map((c) => runtime[c]))
      .run();
  }
  return db;
}
