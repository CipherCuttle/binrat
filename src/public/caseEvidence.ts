import { canonicalJson, sha256Hex } from "../evidence/canonical.js";
import { deriveEventId, deriveLaunchId } from "../core/identity.js";
import type { LaunchObserved } from "../core/types.js";
import { buildProvenanceFact } from "../intelligence/provenance.js";

export const CASE_EVIDENCE_SCHEMA = "binrat.case-evidence/1" as const;
export const CASE_EVIDENCE_PROJECTION =
  "BINRAT_PONS_HISTORICAL_CASE_V1" as const;
export const CASE_EVIDENCE_MAX_BYTES = 65536;
export const CASE_EVIDENCE_LIMIT = 20;
// Kept equal to the indexed Pons source factory; parity is covered by tests.
export const CASE_EVIDENCE_FACTORY =
  "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
export type CaseAuthority = Omit<
  LaunchObserved,
  "observedAtMs" | "blockNumber"
> & { blockNumber: string };
export type CaseProvenance = Omit<
  Awaited<ReturnType<typeof buildProvenanceFact>>,
  "observedBlock"
> & { observedBlock: string };
export type CaseRecord = {
  launch: CaseAuthority;
  provenance: CaseProvenance;
  authorityDigest: string;
};
export type CasePublication = {
  chainId: 4663;
  checkpointBlock: string;
  checkpointBlockHash: string;
  feedDigest: string;
  publicationVersion: number;
  verifiedAtMs: number;
};
export const CASE_COVERAGE = {
  mode: "LATEST_20_DEPLOYER_LAUNCHES_THROUGH_CASE",
  history: "PARTIAL",
  resultLimit: 20,
  countScope: "EARLIER_RECORDS_IN_RETURNED_WINDOW",
  olderHistory: "NOT_ENUMERATED",
} as const;
export type CaseMaterial = {
  schemaVersion: typeof CASE_EVIDENCE_SCHEMA;
  projectionVersion: typeof CASE_EVIDENCE_PROJECTION;
  chainId: 4663;
  caseId: string;
  reconstruction: "PUBLISHED_CHECKPOINT_RECONSTRUCTION";
  archivedPublication: false;
  pointInTimeReplay: false;
  source: "PONS_V2";
  publication: CasePublication;
  coverage: typeof CASE_COVERAGE;
  priorLaunchCount: number;
  records: CaseRecord[];
};
export type CaseEnvelope = { material: CaseMaterial; digest: string };
const id = /^[0-9a-f]{64}$/;
const hash = /^0x[0-9a-f]{64}$/;
const address = /^0x[0-9a-f]{40}$/;
const block = (v: unknown): v is string =>
  typeof v === "string" &&
  /^(0|[1-9]\d*)$/.test(v) &&
  BigInt(v) <= BigInt(Number.MAX_SAFE_INTEGER);
function requireValue(v: unknown, code: string): asserts v {
  if (!v) throw new Error(code);
}
function keys(v: object, expected: string[]) {
  requireValue(
    canonicalJson(Object.keys(v).sort()) === canonicalJson(expected.sort()),
    "CASE_EVIDENCE_FIELDS_INVALID",
  );
}
export function launchOrder(a: CaseAuthority, b: CaseAuthority): number {
  return a.blockNumber === b.blockNumber
    ? a.logIndex - b.logIndex || a.launchId.localeCompare(b.launchId)
    : BigInt(a.blockNumber) < BigInt(b.blockNumber)
      ? -1
      : 1;
}
export async function validateCaseRecord(value: unknown): Promise<CaseRecord> {
  requireValue(
    value && typeof value === "object",
    "CASE_EVIDENCE_RECORD_INVALID",
  );
  const record = value as CaseRecord;
  keys(record, ["launch", "provenance", "authorityDigest"]);
  const l = record.launch,
    f = record.provenance;
  requireValue(
    l && f && typeof l === "object" && typeof f === "object",
    "CASE_EVIDENCE_PROVENANCE_MISSING",
  );
  keys(l, [
    "launchId",
    "eventId",
    "chainId",
    "blockNumber",
    "blockHash",
    "source",
    "launcher",
    "txHash",
    "logIndex",
    "token",
    "creator",
    "pool",
    "name",
    "symbol",
    "imageUri",
    "website",
    "twitter",
    "telegram",
  ]);
  requireValue(
    l.chainId === 4663 &&
      l.source === "PONS_V2" &&
      l.launcher === CASE_EVIDENCE_FACTORY &&
      id.test(l.launchId) &&
      id.test(l.eventId) &&
      block(l.blockNumber) &&
      hash.test(l.blockHash) &&
      hash.test(l.txHash) &&
      [l.launcher, l.token, l.creator, l.pool].every(
        (v) => typeof v === "string" && address.test(v),
      ) &&
      Number.isSafeInteger(l.logIndex) &&
      l.logIndex >= 0 &&
      l.logIndex <= 1000000 &&
      [l.name, l.symbol, l.imageUri, l.website, l.twitter, l.telegram].every(
        (v) => typeof v === "string" && v.length <= 2048,
      ),
    "CASE_EVIDENCE_LAUNCH_INVALID",
  );
  requireValue(
    (await deriveLaunchId(l)) === l.launchId &&
      (await deriveEventId(l)) === l.eventId,
    "CASE_EVIDENCE_IDENTITY_INVALID",
  );
  requireValue(
    typeof record.authorityDigest === "string" &&
      id.test(record.authorityDigest) &&
      (await sha256Hex(l)) === record.authorityDigest,
    "CASE_EVIDENCE_AUTHORITY_DIGEST_INVALID",
  );
  const expectedFact = await buildProvenanceFact({
    ...l,
    blockNumber: BigInt(l.blockNumber),
    observedAtMs: 0,
  });
  requireValue(
    canonicalJson(expectedFact) === canonicalJson(f),
    "CASE_EVIDENCE_PROVENANCE_INVALID",
  );
  return record;
}
/** Recomputes wire integrity, canonical IDs and provenance derivation. The
 * trusted same-origin index remains the source authority; this is not RPC proof. */
export async function verifyCaseEnvelope(
  value: unknown,
  requestedId: string,
  publication: CasePublication,
): Promise<CaseEnvelope> {
  requireValue(
    id.test(requestedId) && value && typeof value === "object",
    "CASE_EVIDENCE_INVALID",
  );
  requireValue(
    new TextEncoder().encode(JSON.stringify(value)).length <=
      CASE_EVIDENCE_MAX_BYTES,
    "CASE_EVIDENCE_PAYLOAD_LIMIT",
  );
  const envelope = value as CaseEnvelope;
  keys(envelope, ["material", "digest"]);
  const m = envelope.material;
  requireValue(m && typeof m === "object", "CASE_EVIDENCE_MATERIAL_MISSING");
  keys(m, [
    "schemaVersion",
    "projectionVersion",
    "chainId",
    "caseId",
    "reconstruction",
    "archivedPublication",
    "pointInTimeReplay",
    "source",
    "publication",
    "coverage",
    "priorLaunchCount",
    "records",
  ]);
  requireValue(
    m.schemaVersion === CASE_EVIDENCE_SCHEMA &&
      m.projectionVersion === CASE_EVIDENCE_PROJECTION &&
      m.chainId === 4663 &&
      m.caseId === requestedId &&
      m.source === "PONS_V2" &&
      m.reconstruction === "PUBLISHED_CHECKPOINT_RECONSTRUCTION" &&
      m.archivedPublication === false &&
      m.pointInTimeReplay === false,
    "CASE_EVIDENCE_PROJECTION_INVALID",
  );
  requireValue(
    m.publication?.chainId === 4663 &&
      block(m.publication.checkpointBlock) &&
      hash.test(m.publication.checkpointBlockHash) &&
      id.test(m.publication.feedDigest) &&
      Number.isSafeInteger(m.publication.publicationVersion) &&
      m.publication.publicationVersion > 0 &&
      Number.isSafeInteger(m.publication.verifiedAtMs) &&
      m.publication.verifiedAtMs >= 0 &&
      canonicalJson(m.publication) === canonicalJson(publication),
    "CASE_EVIDENCE_PUBLICATION_MISMATCH",
  );
  requireValue(
    canonicalJson(m.coverage) === canonicalJson(CASE_COVERAGE) &&
      Array.isArray(m.records) &&
      m.records.length >= 1 &&
      m.records.length <= CASE_EVIDENCE_LIMIT &&
      m.priorLaunchCount === m.records.length - 1,
    "CASE_EVIDENCE_COVERAGE_INVALID",
  );
  requireValue(
    typeof envelope.digest === "string" &&
      id.test(envelope.digest) &&
      (await sha256Hex(m)) === envelope.digest,
    "CASE_EVIDENCE_DIGEST_INVALID",
  );
  const seen = new Set<string>();
  const blockHashes = new Map<string, string>();
  for (const record of m.records) {
    await validateCaseRecord(record);
    const l = record.launch;
    requireValue(
      !seen.has(l.launchId) &&
        BigInt(l.blockNumber) <= BigInt(m.publication.checkpointBlock),
      "CASE_EVIDENCE_RECORD_SCOPE_INVALID",
    );
    requireValue(
      (l.blockNumber !== m.publication.checkpointBlock ||
        l.blockHash === m.publication.checkpointBlockHash) &&
        (!blockHashes.has(l.blockNumber) ||
          blockHashes.get(l.blockNumber) === l.blockHash),
      "CASE_EVIDENCE_BLOCK_HASH_CONFLICT",
    );
    blockHashes.set(l.blockNumber, l.blockHash);
    seen.add(l.launchId);
  }
  const target = m.records[0].launch;
  requireValue(
    target.launchId === requestedId &&
      m.records.every((r) => r.launch.creator === target.creator),
    "CASE_EVIDENCE_CASE_MISMATCH",
  );
  for (let i = 1; i < m.records.length; i++)
    requireValue(
      launchOrder(m.records[i - 1].launch, m.records[i].launch) > 0,
      "CASE_EVIDENCE_ORDER_INVALID",
    );
  return envelope;
}
