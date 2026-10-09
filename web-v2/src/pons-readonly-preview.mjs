// Isolated Pons/Robinhood 4663 read-only preview.
// Reuse current public validators; never touch the historical ARC 5042 V2 adapter.
import { adaptLatestLaunches } from "../../web/data-source.js";
import { verifyFeedBinding, bindingMatches } from "../../web/snapshot-contract.js";
import { validatePublicStatus } from "../../web/read-plane.js";

async function readJson(fetchImpl, path, signal) {
  const timeout = AbortSignal.timeout(15000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetchImpl(path, {
    method: "GET", headers: { accept: "application/json" }, signal: requestSignal, cache: "no-store",
  });
  if (!response.ok) throw new Error("PONS_PREVIEW_HTTP_" + response.status);
  return response.json();
}

/** No fallback to synthetic data, ARC feeds, or another checkpoint. */
export async function loadPonsPreview({ fetchImpl = globalThis.fetch, signal, now = Date.now, previous } = {}) {
  const raw = await readJson(fetchImpl, "/api/launches/latest", signal);
  const feed = adaptLatestLaunches(raw);
  // Check canonical digest AND every adapted displayed launch field.
  const binding = await verifyFeedBinding(feed);
  const status = validatePublicStatus(await readJson(fetchImpl, "/api/status", signal));
  if (status.state === "NO_VERIFIED_SNAPSHOT") throw new Error("PONS_PREVIEW_NO_VERIFIED_SNAPSHOT");
  if (!bindingMatches(binding, status)) throw new Error("PONS_PREVIEW_BINDING_MISMATCH");
  if (previous) {
    if (BigInt(status.checkpointBlock) < BigInt(previous.status.checkpointBlock)) {
      throw new Error("PONS_PREVIEW_CHECKPOINT_REGRESSION");
    }
    if (status.checkpointBlock === previous.status.checkpointBlock &&
      !bindingMatches(binding, previous.status)) throw new Error("PONS_PREVIEW_CHECKPOINT_CONFLICT");
    if (status.publicationVersion < previous.status.publicationVersion ||
      status.verifiedAtMs < previous.status.verifiedAtMs) throw new Error("PONS_PREVIEW_PUBLICATION_REGRESSION");
  }
  if (status.verifiedAtMs > now() ||
    (status.runtimeUpdatedAtMs !== null && status.runtimeUpdatedAtMs > now())) {
    throw new Error("PONS_PREVIEW_FUTURE_TIMESTAMP");
  }
  // A verified stale snapshot is never upgraded to fresh by its age alone.
  const freshness = status.state === "FRESH_VERIFIED" &&
    status.freshnessValidUntilMs !== null && status.freshnessValidUntilMs > now()
      ? "FRESH_VERIFIED" : "STALE_VERIFIED";
  return { feed, status, freshness, cases: feed.bags };
}

/** Optional historical trail. A different publication is never mixed into a Case. */
export async function loadPonsCreatorTrail({ item, snapshot, fetchImpl = globalThis.fetch, signal }) {
  const value = await readJson(fetchImpl, "/api/creator/" + encodeURIComponent(item.reportedCreatorAddress) + "/summary", signal);
  const id = /^[0-9a-f]{64}$/, address = /^0x[0-9a-f]{40}$/, hash = /^0x[0-9a-f]{64}$/;
  if (value?.schemaVersion !== "binrat.creator-summary/0.1" || value.chainId !== 4663 ||
      value.reportedCreatorAddress !== item.reportedCreatorAddress ||
      value.checkpointBlock !== snapshot.status.checkpointBlock ||
      value.checkpointBlockHash !== snapshot.status.checkpointBlockHash ||
      value.feedDigest !== snapshot.status.feedDigest ||
      value.coverage?.mode !== "LATEST_4_VERIFIED_PONS_LAUNCHES" ||
      value.coverage.resultLimit !== 4 || value.coverage.olderLaunchesOmitted !== true ||
      !Array.isArray(value.launches) || value.launches.length < 1 || value.launches.length > 4) {
    throw new Error("PONS_TRAIL_BINDING_MISMATCH");
  }
  const seen = new Set();
  for (const launch of value.launches) {
    if (!id.test(launch?.launchId) || seen.has(launch.launchId) || !address.test(launch.token) ||
        !hash.test(launch.blockHash) || !hash.test(launch.txHash) ||
        typeof launch.blockNumber !== "string" || !/^(0|[1-9]\d*)$/.test(launch.blockNumber) ||
        BigInt(launch.blockNumber) > BigInt(value.checkpointBlock) ||
        typeof launch.symbol !== "string" || typeof launch.name !== "string" ||
        launch.evidence?.factId !== "binrat-fact:4663:" + launch.launchId ||
        !id.test(launch.evidence?.digest) || !id.test(launch.evidence?.sourceEventId)) {
      throw new Error("PONS_TRAIL_RECORD_INVALID");
    }
    seen.add(launch.launchId);
  }
  const selected = value.launches.find((launch) => launch.launchId === item.id);
  if (!selected || selected.token !== item.token || selected.txHash !== item.txHash ||
      selected.blockNumber !== item.block || selected.symbol !== item.symbol || selected.name !== item.name) {
    throw new Error("PONS_TRAIL_CASE_MISMATCH");
  }
  return value;
}
