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
export async function loadPonsPreview({ fetchImpl = globalThis.fetch, signal, now = Date.now } = {}) {
  const raw = await readJson(fetchImpl, "/api/launches/latest", signal);
  const feed = adaptLatestLaunches(raw);
  // Check canonical digest AND every adapted displayed launch field.
  const binding = await verifyFeedBinding(feed);
  const status = validatePublicStatus(await readJson(fetchImpl, "/api/status", signal));
  if (status.state === "NO_VERIFIED_SNAPSHOT") throw new Error("PONS_PREVIEW_NO_VERIFIED_SNAPSHOT");
  if (!bindingMatches(binding, status)) throw new Error("PONS_PREVIEW_BINDING_MISMATCH");
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
