import { canonicalJson, sha256Hex } from "../evidence/canonical.js";
import {
  verifyCaseEnvelope,
  type CaseEnvelope,
  type CasePublication,
} from "./caseEvidence.js";
import {
  parsePonsOutcomeObservationReceipt,
  type PonsOutcomeObservationReceipt,
} from "../pons/outcomeReceipts.js";

export const CASE_OUTCOMES_SCHEMA = "binrat.case-outcomes/1" as const;
export const CASE_OUTCOMES_MAX_BYTES = 262144;
export type CaseOutcomesEnvelope = {
  material: {
    schemaVersion: typeof CASE_OUTCOMES_SCHEMA;
    caseEvidence: CaseEnvelope;
    outcomes: { launchId: string; payloads: string[] }[];
  };
  digest: string;
};
function requireValue(value: unknown, code: string): asserts value {
  if (!value) throw Error(code);
}
function fields(value: object, names: string[]) {
  requireValue(
    canonicalJson(Object.keys(value).sort()) === canonicalJson(names.sort()),
    "CASE_OUTCOMES_FIELDS_INVALID",
  );
}
/** Index consistency and receipt derivation, not an independent RPC proof. */
export async function verifyCaseOutcomes(
  value: unknown,
  id: string,
  publication: CasePublication,
) {
  requireValue(
    value &&
      typeof value === "object" &&
      new TextEncoder().encode(JSON.stringify(value)).length <=
        CASE_OUTCOMES_MAX_BYTES,
    "CASE_OUTCOMES_PAYLOAD_INVALID",
  );
  const e = value as CaseOutcomesEnvelope;
  fields(e, ["material", "digest"]);
  requireValue(
    e.material && typeof e.material === "object",
    "CASE_OUTCOMES_MATERIAL_INVALID",
  );
  fields(e.material, ["schemaVersion", "caseEvidence", "outcomes"]);
  requireValue(
    e.material.schemaVersion === CASE_OUTCOMES_SCHEMA,
    "CASE_OUTCOMES_VERSION_INVALID",
  );
  const history = await verifyCaseEnvelope(
    e.material.caseEvidence,
    id,
    publication,
  );
  requireValue(
    e.digest === (await sha256Hex(e.material)),
    "CASE_OUTCOMES_DIGEST_INVALID",
  );
  requireValue(
    Array.isArray(e.material.outcomes) &&
      e.material.outcomes.length === history.material.records.length,
    "CASE_OUTCOMES_COVERAGE_INVALID",
  );
  const launches = [];
  const blockHashes = new Map<string, string>(
    history.material.records.map((r) => [
      r.launch.blockNumber,
      r.launch.blockHash,
    ]),
  );
  blockHashes.set(publication.checkpointBlock, publication.checkpointBlockHash);
  for (const [index, row] of e.material.outcomes.entries()) {
    requireValue(row && typeof row === "object", "CASE_OUTCOMES_ROW_INVALID");
    fields(row, ["launchId", "payloads"]);
    const record = history.material.records[index]!;
    requireValue(
      row.launchId === record.launch.launchId &&
        Array.isArray(row.payloads) &&
        row.payloads.length <= 3,
      "CASE_OUTCOMES_LAUNCH_INVALID",
    );
    const samples: PonsOutcomeObservationReceipt[] = [];
    const horizons = new Set<number>();
    let launchTime: number | undefined;
    for (const payload of row.payloads) {
      requireValue(
        typeof payload === "string" &&
          new TextEncoder().encode(payload).length <= 8192,
        "CASE_OUTCOMES_RECEIPT_LIMIT",
      );
      const r = await parsePonsOutcomeObservationReceipt(payload);
      requireValue(
        canonicalJson(r) === payload,
        "CASE_OUTCOMES_RECEIPT_FIELDS_INVALID",
      );
      requireValue(
        r.launchId === row.launchId &&
          r.token === record.launch.token &&
          r.curve === record.launch.pool,
        "CASE_OUTCOMES_SOURCE_MISMATCH",
      );
      requireValue(
        r.observedBlock >= BigInt(record.launch.blockNumber) &&
          r.observedBlock <= BigInt(publication.checkpointBlock) &&
          r.observedTimestampMs <= publication.verifiedAtMs,
        "CASE_OUTCOMES_FUTURE_SAMPLE",
      );
      const block = r.observedBlock.toString();
      requireValue(
        !blockHashes.has(block) ||
          blockHashes.get(block) === r.observedBlockHash,
        "CASE_OUTCOMES_BLOCK_CONFLICT",
      );
      blockHashes.set(block, r.observedBlockHash);
      requireValue(
        !horizons.has(r.horizonMs),
        "CASE_OUTCOMES_DUPLICATE_HORIZON",
      );
      horizons.add(r.horizonMs);
      const inferredTime = r.targetTimestampMs - r.horizonMs;
      requireValue(
        inferredTime >= 0 &&
          (launchTime === undefined || launchTime === inferredTime),
        "CASE_OUTCOMES_TARGET_MISMATCH",
      );
      launchTime = inferredTime;
      samples.push(r);
    }
    samples.sort((a, b) => a.horizonMs - b.horizonMs);
    for (let i = 1; i < samples.length; i++) {
      const previous = samples[i - 1]!,
        current = samples[i]!;
      requireValue(
        current.observedBlock >= previous.observedBlock &&
          current.observedTimestampMs >= previous.observedTimestampMs,
        "CASE_OUTCOMES_SAMPLE_ORDER_INVALID",
      );
    }
    launches.push({ record, samples });
  }
  const earlier = launches.slice(1);
  return {
    envelope: e,
    launches,
    summary: {
      earlierReturned: earlier.length,
      earlierWithSamples: earlier.filter((l) => l.samples.length > 0).length,
      earlierWithoutSamples: earlier.filter((l) => l.samples.length === 0)
        .length,
      earlierWithGraduatedSample: earlier.filter((l) =>
        l.samples.some((s) => s.phase === "GRADUATED"),
      ).length,
      earlierWithCurveSample: earlier.filter((l) =>
        l.samples.some((s) => s.phase === "CURVE"),
      ).length,
    },
  };
}
export type VerifiedCaseOutcomes = Awaited<
  ReturnType<typeof verifyCaseOutcomes>
>;
