import type { Bag, PublicFeed, RadarWatchlist } from "./types";

/**
 * A dossier may only render the bag identified by its URL. Unknown IDs must
 * remain unknown; selecting a different bag would misattribute its evidence.
 */
export function findBagAtCheckpoint(
  feed: Pick<PublicFeed, "bags">,
  bagId: string,
): Bag | undefined {
  return feed.bags.find((bag) => bag.id === bagId);
}

/** Keep the displayed shortlist, ranked universe and observed universe distinct. */
export function radarShortlistCounts(
  radar: Pick<RadarWatchlist, "candidates" | "coverage">,
) {
  return {
    displayed: radar.candidates.length,
    ranked: radar.coverage.rankedAddressCount,
    observed: radar.coverage.distinctRecipientAddressCount,
  };
}

/** A staged observation is only shown when this exact case has a staged fixture.
 * Production Replay requires a separately validated replay response; feed
 * membership alone never proves 5m, 1h or 24h observations exist.
 */
export const REPLAY_HORIZONS = ["LAUNCH", "5m", "1h", "24h"] as const;
export type ReplayHorizon = (typeof REPLAY_HORIZONS)[number];
export type ReplayStage = {
  state: "COMPLETE" | "PARTIAL" | "UNVERIFIED" | "MISSING";
  note: string;
  value: string;
};

export function replayStagesForBag(
  bag: Bag,
  mode: "DEMO" | "LIVE",
): Record<ReplayHorizon, ReplayStage> {
  const stages: Record<ReplayHorizon, ReplayStage> = {
    LAUNCH: {
      state: "COMPLETE",
      note: mode === "DEMO"
        ? "Synthetic demo launch event for this bag. Later stages are excluded until explicitly represented in this demo fixture."
        : "Indexed launch record only. No later observation is inferred from the feed.",
      value: `BLOCK ${bag.blockNumber}`,
    },
    "5m": { state: "MISSING", note: "No validated +5m observation is available for this exact bag in this view.", value: "NO RECEIPT" },
    "1h": { state: "MISSING", note: "No validated +1h observation is available for this exact bag in this view.", value: "NO RECEIPT" },
    "24h": { state: "MISSING", note: "No validated +24h observation is available for this exact bag in this view.", value: "NO RECEIPT" },
  };
  // Only the original FERAL visual-demo case includes explicitly authored
  // simulated horizons. Never project them onto SLAG, GUNK or LIVE objects.
  if (mode === "DEMO" && bag.id === "bag-feral-arc-20418791") {
    stages["5m"] = {
      state: "COMPLETE",
      note: "DEMO FIXTURE ONLY: simulated five-minute observation for this exact case; not an independently verifiable chain receipt.",
      value: "DEMO +5m",
    };
    stages["1h"] = {
      state: "PARTIAL",
      note: "DEMO FIXTURE ONLY: simulated one-hour observation with a deliberately unavailable field.",
      value: "DEMO +1h",
    };
  }
  return stages;
}
