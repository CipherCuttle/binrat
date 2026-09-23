import { demoFeed, demoRadar } from "./fixtures";
import { adaptLiveCreatorFile, adaptLiveFeed, adaptLiveRadar, type LiveCreatorFile } from "./liveAdapter";
import type { PublicFeed, RadarWatchlist } from "./types";

export type DataMode = "DEMO" | "LIVE";

const wantsLive = new URLSearchParams(window.location.search).get("source") === "live";

async function readJson(path: string, unavailableCode: string): Promise<unknown> {
  const response = await fetch(path, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(unavailableCode);
  return response.json() as Promise<unknown>;
}

export async function loadProductData(): Promise<{ feed: PublicFeed; radar: RadarWatchlist; mode: DataMode }> {
  if (!wantsLive) return { feed: demoFeed, radar: demoRadar, mode: "DEMO" };
  const [feedRaw, radarRaw] = await Promise.all([
    readJson("/api/feed", "PUBLIC_READ_PLANE_UNAVAILABLE"),
    readJson("/api/rat-radar/watchlist", "RAT_RADAR_UNAVAILABLE"),
  ]);
  // Requests may cross an advancing checkpoint. Validate both scopes separately
  // instead of claiming they share the same receipt or inventing a common horizon.
  const feed = adaptLiveFeed(feedRaw);
  const radar = adaptLiveRadar(radarRaw);
  return { feed, radar, mode: "LIVE" };
}

/** 404 is a genuine not-indexed address. Every other failure remains an error. */
export async function loadLiveCreatorFile(address: string): Promise<LiveCreatorFile | null> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
  const response = await fetch("/api/creator/" + encodeURIComponent(address), {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("CREATOR_FILE_UNAVAILABLE");
  return adaptLiveCreatorFile(await response.json() as unknown, address);
}
