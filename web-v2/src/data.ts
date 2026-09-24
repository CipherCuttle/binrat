import { demoFeed, demoRadar } from "./fixtures";
import { settleIndependentSlices } from "./independentSlices";
import { publicApiUrl } from "./previewRuntime";
import { adaptLiveCreatorFile, adaptLiveFeed, adaptLiveRadar, adaptLiveReplay, adaptLiveLedger, type LiveCreatorFile, type LiveReplayBundle, type LiveLedger } from "./liveAdapter";
import type { PublicFeed, RadarWatchlist } from "./types";

export type DataMode = "DEMO" | "LIVE";

const wantsLive = new URLSearchParams(window.location.search).get("source") === "live";
export const selectedDataMode: DataMode = wantsLive ? "LIVE" : "DEMO";

async function readJson(path: string, unavailableCode: string): Promise<unknown> {
  const response = await fetch(publicApiUrl(path), {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(unavailableCode);
  return response.json() as Promise<unknown>;
}

export async function loadProductData(): Promise<{
  feed: PublicFeed | null; radar: RadarWatchlist | null;
  feedError: string | null; radarError: string | null; mode: DataMode;
}> {
  if (!wantsLive) return {
    feed: demoFeed, radar: demoRadar, feedError: null, radarError: null, mode: "DEMO",
  };
  // Each request AND adapter is independently settled; malformed Radar cannot
  // hide a valid Feed and a Feed outage cannot erase the Radar shortlist.
  const slices = await settleIndependentSlices(
    () => readJson("/api/feed", "PUBLIC_READ_PLANE_UNAVAILABLE").then(adaptLiveFeed),
    () => readJson("/api/rat-radar/watchlist", "RAT_RADAR_UNAVAILABLE").then(adaptLiveRadar),
  );
  return { ...slices, mode: "LIVE" };
}

/** 404 is a genuine not-indexed address. Every other failure remains an error. */
export async function loadLiveCreatorFile(address: string): Promise<LiveCreatorFile | null> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
  const response = await fetch(publicApiUrl("/api/creator/" + encodeURIComponent(address)), {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("CREATOR_FILE_UNAVAILABLE");
  return adaptLiveCreatorFile(await response.json() as unknown, address);
}


/** A replay can have a newer canonical checkpoint than the originally loaded feed. */
export async function loadLiveReplayBundle(bagId: string): Promise<LiveReplayBundle> {
  if (!/^[0-9a-f]{64}$/.test(bagId)) throw new Error("REPLAY_BAG_ID_INVALID");
  return adaptLiveReplay(
    await readJson("/api/bag/" + encodeURIComponent(bagId) + "/replay", "REPLAY_BUNDLE_UNAVAILABLE"),
    bagId,
  );
}

/** The current production authority exposes only a disabled, pre-launch ledger. */
export async function loadLiveLedger(): Promise<LiveLedger> {
  return adaptLiveLedger(await readJson("/api/dumpster-ledger", "DUMPSTER_LEDGER_UNAVAILABLE"));
}
