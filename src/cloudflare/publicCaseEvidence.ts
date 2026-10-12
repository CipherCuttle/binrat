import type { D1DatabaseLike } from "./d1Types.js";
import { readPublicSnapshot } from "./publicSnapshot.js";
import { canonicalJson, sha256Hex } from "../evidence/canonical.js";
import {
  CASE_COVERAGE,
  CASE_EVIDENCE_SCHEMA,
  CASE_EVIDENCE_PROJECTION,
  verifyCaseEnvelope,
  validateCaseRecord,
  type CaseRecord,
  type CaseMaterial,
  type CaseEnvelope,
} from "../public/caseEvidence.js";

export const CASE_TARGET_SQL = `SELECT launch_id,creator,block_number,log_index FROM launches WHERE chain_id=4663 AND source='PONS_V2' AND launch_id=? LIMIT 1`;
// LEFT JOIN is intentional: missing facts must fail, never disappear from counts.
export const CASE_WINDOW_SQL = `SELECT l.launch_id,l.creator,l.block_number,l.log_index,
  CASE WHEN length(l.authority_json)<=8192 THEN l.authority_json END AS authority_json,
  CASE WHEN length(f.payload_json)<=2048 THEN f.payload_json END AS payload_json,
  CASE WHEN length(l.authority_json)<=8192 THEN (json_extract(l.authority_json,'$.launchId')=l.launch_id AND json_extract(l.authority_json,'$.eventId')=l.event_id AND json_extract(l.authority_json,'$.chainId')=l.chain_id AND json_extract(l.authority_json,'$.blockNumber')=l.block_number AND json_extract(l.authority_json,'$.blockHash')=l.block_hash AND json_extract(l.authority_json,'$.source')=l.source AND json_extract(l.authority_json,'$.launcher')=l.launcher AND json_extract(l.authority_json,'$.txHash')=l.tx_hash AND json_extract(l.authority_json,'$.logIndex')=l.log_index AND json_extract(l.authority_json,'$.token')=l.token AND json_extract(l.authority_json,'$.creator')=l.creator AND json_extract(l.authority_json,'$.pool')=l.pool AND json_extract(l.authority_json,'$.name')=l.name AND json_extract(l.authority_json,'$.symbol')=l.symbol AND json_extract(l.authority_json,'$.imageUri')=l.image_uri AND json_extract(l.authority_json,'$.website')=l.website AND json_extract(l.authority_json,'$.twitter')=l.twitter AND json_extract(l.authority_json,'$.telegram')=l.telegram) END AS column_binding,
  f.fact_id,f.evidence_digest
  FROM launches l INDEXED BY idx_launches_chain_source_creator_block_numeric LEFT JOIN provenance_facts f ON f.launch_id=l.launch_id AND f.chain_id=l.chain_id
  WHERE l.chain_id=4663 AND l.source='PONS_V2' AND l.creator=?
    AND CAST(l.block_number AS INTEGER)<=CAST(? AS INTEGER)
    AND (CAST(l.block_number AS INTEGER)<CAST(? AS INTEGER)
      OR (l.block_number=? AND (l.log_index<? OR (l.log_index=? AND l.launch_id<=?))))
  ORDER BY CAST(l.block_number AS INTEGER) DESC,l.log_index DESC,l.launch_id DESC LIMIT 20`;
interface Target {
  launch_id: string;
  creator: string;
  block_number: string;
  log_index: number;
}
interface Row extends Target {
  authority_json: string | null;
  payload_json: string | null;
  fact_id: string | null;
  evidence_digest: string | null;
  column_binding: number;
}
export async function readPublicCaseEvidence(
  db: D1DatabaseLike,
  id: string,
): Promise<CaseEnvelope | null> {
  if (!/^[0-9a-f]{64}$/.test(id)) throw new Error("BAG_ID_INVALID");
  const snapshot = await readPublicSnapshot(db);
  if (!snapshot) throw new Error("CASE_EVIDENCE_NO_PUBLICATION");
  const target = await db.prepare(CASE_TARGET_SQL).bind(id).first<Target>();
  if (!target || BigInt(target.block_number) > BigInt(snapshot.checkpointBlock))
    return null;
  const result = await db
    .prepare(CASE_WINDOW_SQL)
    .bind(
      target.creator,
      target.block_number,
      target.block_number,
      target.block_number,
      target.log_index,
      target.log_index,
      id,
    )
    .all<Row>();
  if (!result.success) throw new Error("CASE_EVIDENCE_QUERY_FAILED");
  const records: CaseRecord[] = [];
  for (const row of result.results ?? []) {
    if (!row.authority_json || !row.payload_json || row.column_binding !== 1)
      throw new Error("CASE_EVIDENCE_SOURCE_MISSING_OR_OVERSIZED");
    const launch = JSON.parse(row.authority_json),
      provenance = JSON.parse(row.payload_json);
    if (
      canonicalJson(launch) !== row.authority_json ||
      canonicalJson(provenance) !== row.payload_json ||
      launch.launchId !== row.launch_id ||
      launch.creator !== row.creator ||
      launch.blockNumber !== row.block_number ||
      launch.logIndex !== row.log_index ||
      provenance.factId !== row.fact_id ||
      provenance.evidenceDigest !== row.evidence_digest
    )
      throw new Error("CASE_EVIDENCE_STORED_BINDING_INVALID");
    // Legacy authorities also stored ingestion time. It is not chain evidence
    // and is deliberately absent from CaseAuthority. Validate before removing
    // this one known field; all other unknown fields still fail the validator.
    if (Object.hasOwn(launch, "observedAtMs")) {
      if (!Number.isSafeInteger(launch.observedAtMs) || launch.observedAtMs < 0)
        throw new Error("CASE_EVIDENCE_INGESTION_TIME_INVALID");
      delete launch.observedAtMs;
    }
    const record = {
      launch,
      provenance,
      authorityDigest: await sha256Hex(launch),
    };
    await validateCaseRecord(record);
    records.push(record);
  }
  const publication = {
    chainId: 4663 as const,
    checkpointBlock: snapshot.checkpointBlock,
    checkpointBlockHash: snapshot.checkpointBlockHash,
    feedDigest: snapshot.feedDigest,
    publicationVersion: snapshot.publicationVersion,
    verifiedAtMs: snapshot.verifiedAtMs,
  };
  const material: CaseMaterial = {
    schemaVersion: CASE_EVIDENCE_SCHEMA,
    projectionVersion: CASE_EVIDENCE_PROJECTION,
    chainId: 4663,
    caseId: id,
    reconstruction: "PUBLISHED_CHECKPOINT_RECONSTRUCTION",
    archivedPublication: false,
    pointInTimeReplay: false,
    source: "PONS_V2",
    publication,
    coverage: CASE_COVERAGE,
    priorLaunchCount: records.length - 1,
    records,
  };
  const envelope = { material, digest: await sha256Hex(material) };
  await verifyCaseEnvelope(envelope, id, publication);
  // Fail closed if the durable checkpoint rolled back, or publication moved
  // during the read. No RPC calls and no modification of freshness authority.
  const checkpoint = await db
    .prepare(
      "SELECT block_number,block_hash FROM chain_checkpoints WHERE chain_id=4663 LIMIT 1",
    )
    .first<{ block_number: string; block_hash: string }>();
  const after = await readPublicSnapshot(db);
  if (
    !checkpoint ||
    BigInt(checkpoint.block_number) < BigInt(publication.checkpointBlock) ||
    (checkpoint.block_number === publication.checkpointBlock &&
      checkpoint.block_hash !== publication.checkpointBlockHash) ||
    !after ||
    after.publicationVersion !== publication.publicationVersion ||
    after.feedDigest !== publication.feedDigest ||
    after.checkpointBlock !== publication.checkpointBlock ||
    after.checkpointBlockHash !== publication.checkpointBlockHash ||
    after.verifiedAtMs !== publication.verifiedAtMs
  )
    throw new Error("CASE_EVIDENCE_SOURCE_MOVED");
  return envelope;
}
