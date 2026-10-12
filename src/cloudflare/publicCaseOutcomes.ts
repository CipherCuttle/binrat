import { sha256Hex } from "../evidence/canonical.js";
import {
  CASE_OUTCOMES_SCHEMA,
  verifyCaseOutcomes,
  type CaseOutcomesEnvelope,
} from "../public/caseOutcomes.js";
import { readPublicCaseEvidence } from "./publicCaseEvidence.js";
import { readPublicSnapshot } from "./publicSnapshot.js";
import type { D1DatabaseLike } from "./d1Types.js";

// Exact indexed point lookups. No creator-history join or RPC, maximum 20×3.
export const CASE_OUTCOME_SQL = `SELECT CASE WHEN length(payload_json)<=8192 THEN payload_json END AS payload_json,
  CASE WHEN length(payload_json)<=8192 THEN (
    json_extract(payload_json,'$.observationId')=observation_id AND
    json_extract(payload_json,'$.observationVersion')=observation_version AND
    json_extract(payload_json,'$.chainId')=chain_id AND json_extract(payload_json,'$.launchId')=launch_id AND
    json_extract(payload_json,'$.token')=token AND json_extract(payload_json,'$.curve')=curve AND
    json_extract(payload_json,'$.horizonMs')=horizon_ms AND json_extract(payload_json,'$.targetTimestampMs')=target_timestamp_ms AND
    json_extract(payload_json,'$.observedBlock')=observed_block AND json_extract(payload_json,'$.observedBlockHash')=observed_block_hash AND
    json_extract(payload_json,'$.observedTimestampMs')=observed_timestamp_ms AND json_extract(payload_json,'$.phase')=phase AND
    json_extract(payload_json,'$.pairToken')=pair_token AND json_extract(payload_json,'$.quoteDecimals')=quote_decimals AND
    json_extract(payload_json,'$.estimatedFdvQuoteRaw') IS estimated_fdv_quote_raw AND
    json_extract(payload_json,'$.status')=status AND json_extract(payload_json,'$.evidenceDigest')=evidence_digest
  ) END AS column_binding FROM pons_outcome_receipts
  INDEXED BY idx_pons_outcome_launch_horizon
  WHERE chain_id=4663 AND launch_id=?
    AND horizon_ms IN (300000,3600000,86400000)
  ORDER BY horizon_ms LIMIT 3`;
export async function readPublicCaseOutcomes(
  db: D1DatabaseLike,
  id: string,
): Promise<CaseOutcomesEnvelope | null> {
  const history = await readPublicCaseEvidence(db, id);
  if (!history) return null;
  const rows = await db.batch(
    history.material.records.map((r) =>
      db.prepare(CASE_OUTCOME_SQL).bind(r.launch.launchId),
    ),
  );
  if (
    rows.length !== history.material.records.length ||
    rows.some((r) => !r.success)
  )
    throw Error("CASE_OUTCOMES_QUERY_FAILED");
  const material = {
    schemaVersion: CASE_OUTCOMES_SCHEMA,
    caseEvidence: history,
    outcomes: history.material.records.map((r, index) => ({
      launchId: r.launch.launchId,
      payloads: (rows[index]!.results ?? []).map((row) => {
        if (typeof row.payload_json !== "string" || row.column_binding !== 1)
          throw Error("CASE_OUTCOMES_STORED_BINDING_INVALID");
        return row.payload_json;
      }),
    })),
  };
  const envelope = { material, digest: await sha256Hex(material) };
  await verifyCaseOutcomes(envelope, id, history.material.publication);
  const checkpoint = await db
    .prepare(
      "SELECT block_number,block_hash FROM chain_checkpoints WHERE chain_id=4663 LIMIT 1",
    )
    .first<{ block_number: string; block_hash: string }>();
  const after = await readPublicSnapshot(db);
  const before = history.material.publication;
  if (
    !checkpoint ||
    BigInt(checkpoint.block_number) < BigInt(before.checkpointBlock) ||
    (checkpoint.block_number === before.checkpointBlock &&
      checkpoint.block_hash !== before.checkpointBlockHash)
  )
    throw Error("CASE_OUTCOMES_CHECKPOINT_MOVED");
  if (
    !after ||
    after.checkpointBlock !== before.checkpointBlock ||
    after.checkpointBlockHash !== before.checkpointBlockHash ||
    after.feedDigest !== before.feedDigest ||
    after.publicationVersion !== before.publicationVersion ||
    after.verifiedAtMs !== before.verifiedAtMs
  )
    throw Error("CASE_OUTCOMES_PUBLICATION_MOVED");
  return envelope;
}
