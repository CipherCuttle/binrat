import { readFileSync } from "node:fs";
import { D1CompatDatabase } from "./d1Compat.js";
import { D1_SCHEMA_SQL } from "../../src/cloudflare/d1Schema.js";
import { D1Store } from "../../src/cloudflare/d1Store.js";
import type { LaunchObserved } from "../../src/core/types.js";
import type { ProvenanceFact } from "../../src/intelligence/provenance.js";
export const productionCapture = JSON.parse(
  readFileSync(
    new URL(
      "../../docs/receipts/sprint-a1-2-contract/production-records.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
/** Captured production authorities, not invented launches or substituted LIVE evidence. */
export async function capturedCaseDatabase() {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db, 4663);
  for (const row of productionCapture.rows) {
    const raw = JSON.parse(row.authority_json);
    await store.putLaunch({
      ...raw,
      blockNumber: BigInt(raw.blockNumber),
      observedAtMs: 0,
    } as LaunchObserved);
    const f = JSON.parse(row.payload_json);
    await store.putProvenanceFact({
      ...f,
      observedBlock: BigInt(f.observedBlock),
    } as ProvenanceFact);
  }
  const s = productionCapture.snapshot;
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
    blockNumber: BigInt(s.checkpoint_block),
    blockHash: s.checkpoint_block_hash,
    guardBlockNumber: null,
    guardBlockHash: null,
  });
  return db;
}
