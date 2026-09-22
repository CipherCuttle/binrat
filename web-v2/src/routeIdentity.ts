import type { Bag, PublicFeed, RadarCandidate, RadarWatchlist } from "./types.js";

/** Distinguish an unrelated URL from a malformed or unknown address route. */
export function addressFromRoute(path: string, prefix: string): string | null {
  if (!path.startsWith(prefix)) return null;
  try {
    const address = decodeURIComponent(path.slice(prefix.length));
    return /^0x[0-9a-fA-F]{40}$/.test(address) ? address.toLowerCase() : "";
  } catch {
    return "";
  }
}

/** Explicit address links must never silently select the first candidate. */
export function selectRadarCandidate(
  radar: Pick<RadarWatchlist, "candidates">,
  selectedAddress?: string,
): RadarCandidate | undefined {
  if (selectedAddress === undefined) return radar.candidates[0];
  if (!/^0x[0-9a-f]{40}$/i.test(selectedAddress)) return undefined;
  return radar.candidates.find(
    (candidate) => candidate.observedRecipientAddress.toLowerCase() === selectedAddress.toLowerCase(),
  );
}

/** The same source-reported address is not a proof of human identity. */
export function matchingCreatorBags(
  feed: Pick<PublicFeed, "bags">,
  address: string,
): Bag[] {
  if (!/^0x[0-9a-f]{40}$/i.test(address)) return [];
  return feed.bags
    .filter((bag) => bag.reportedCreatorAddress.toLowerCase() === address.toLowerCase())
    .sort((a, b) => {
      const aa = BigInt(a.blockNumber);
      const bb = BigInt(b.blockNumber);
      return aa === bb ? a.id.localeCompare(b.id) : aa > bb ? -1 : 1;
    });
}
