import {
  CASE_EVIDENCE_MAX_BYTES,
  verifyCaseEnvelope,
  type CaseEnvelope,
} from "../../src/public/caseEvidence.js";
import type { PonsCase, PonsPreview } from "./pons-readonly-preview.mjs";
export type HistoricalCaseItem = Omit<PonsCase, "feedDigest">;
export async function loadHistoricalCase({
  id,
  snapshot,
  signal,
  fetchImpl = fetch,
}: {
  id: string;
  snapshot: PonsPreview;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<{ envelope: CaseEnvelope; item: HistoricalCaseItem }> {
  if (!/^[0-9a-f]{64}$/.test(id)) throw Error("CASE_EVIDENCE_ID_INVALID");
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
    : AbortSignal.timeout(15000);
  const response = await fetchImpl("/api/bag/" + id + "/evidence", {
    method: "GET",
    headers: { accept: "application/json" },
    signal: requestSignal,
    cache: "no-store",
  });
  if (!response.ok) throw Error("CASE_EVIDENCE_HTTP_" + response.status);
  if (
    !response.body ||
    Number(response.headers.get("content-length") ?? 0) >
      CASE_EVIDENCE_MAX_BYTES
  )
    throw Error("CASE_EVIDENCE_PAYLOAD_LIMIT");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.length;
      if (length > CASE_EVIDENCE_MAX_BYTES) {
        await reader.cancel();
        throw Error("CASE_EVIDENCE_PAYLOAD_LIMIT");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const s = snapshot.status;
  const envelope = await verifyCaseEnvelope(
    JSON.parse(new TextDecoder().decode(bytes)),
    id,
    {
      chainId: 4663,
      checkpointBlock: s.checkpointBlock,
      checkpointBlockHash: s.checkpointBlockHash,
      feedDigest: s.feedDigest,
      publicationVersion: s.publicationVersion,
      verifiedAtMs: s.verifiedAtMs,
    },
  );
  const l = envelope.material.records[0].launch;
  return {
    envelope,
    item: {
      mode: "LIVE",
      id: l.launchId,
      symbol: l.symbol,
      name: l.name,
      token: l.token,
      reportedCreatorAddress: l.creator,
      block: l.blockNumber,
      txHash: l.txHash,
      priorLaunches: envelope.material.priorLaunchCount,
      coverage: "PARTIAL",
      receipt: "fact:" + envelope.material.records[0].provenance.factId,
      asOfBlock: s.checkpointBlock,
      asOfBlockHash: s.checkpointBlockHash,
      evidence: [],
    },
  };
}
