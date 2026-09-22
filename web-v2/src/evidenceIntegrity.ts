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
