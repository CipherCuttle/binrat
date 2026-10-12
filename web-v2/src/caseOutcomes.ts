import {
  verifyCaseOutcomes,
  CASE_OUTCOMES_MAX_BYTES,
} from "../../src/public/caseOutcomes.js";
import type { PonsCase, PonsPreview } from "./pons-readonly-preview.mjs";
export async function loadCaseOutcomes({
  id,
  snapshot,
  current,
  signal,
  fetchImpl = fetch,
}: {
  id: string;
  snapshot: PonsPreview;
  current?: PonsCase;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}) {
  if (!/^[0-9a-f]{64}$/.test(id)) throw Error("CASE_OUTCOMES_ID_INVALID");
  const timeout = AbortSignal.timeout(15000);
  const response = await fetchImpl(
    "/api/bag/" + id + "/evidence?include=outcomes",
    {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    },
  );
  if (!response.ok) throw Error("CASE_OUTCOMES_HTTP_" + response.status);
  if (
    !response.body ||
    Number(response.headers.get("content-length") ?? 0) >
      CASE_OUTCOMES_MAX_BYTES
  )
    throw Error("CASE_OUTCOMES_PAYLOAD_LIMIT");
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      length += r.value.length;
      if (length > CASE_OUTCOMES_MAX_BYTES) {
        await reader.cancel();
        throw Error("CASE_OUTCOMES_PAYLOAD_LIMIT");
      }
      chunks.push(r.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  const s = snapshot.status;
  const verified = await verifyCaseOutcomes(
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
  if (current) {
    const l = verified.launches[0]!.record.launch;
    if (
      current.id !== id ||
      l.token !== current.token ||
      l.creator !== current.reportedCreatorAddress ||
      l.blockNumber !== current.block ||
      l.txHash !== current.txHash
    )
      throw Error("CASE_OUTCOMES_CURRENT_MISMATCH");
  }
  return verified;
}
