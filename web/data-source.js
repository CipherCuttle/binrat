export const WEB_DATA_SOURCE_VERSION = "BINRAT_WEB_DATA_SOURCE_V0";
export const WEB_DATA_SOURCE_MODE =
  new URLSearchParams(globalThis.location?.search ?? "").get("fixtures") === "1"
    ? "FIXTURE"
    : "LIVE";

export async function loadDumpsterFeed() {
  if (WEB_DATA_SOURCE_MODE === "FIXTURE") {
    const { hotGarbageFixtures } = await import("./fixtures.js");
    return {
      version: WEB_DATA_SOURCE_VERSION,
      mode: "FIXTURE",
      bags: hotGarbageFixtures.map((bag) => ({ ...bag, mode: "FIXTURE" })),
    };
  }
  const response = await fetch("/api/feed", {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("LIVE_INDEX_NOT_AVAILABLE");
  return adaptPublicFeed(await response.json());
}

export function adaptPublicFeed(feed) {
  if (
    feed?.schemaVersion !== "binrat.public-feed/0.1" ||
    feed.chainId !== 5042 ||
    !Array.isArray(feed.bags) ||
    feed.historyCoverage !== "UNVERIFIED" ||
    !block(feed.asOfBlock) ||
    !hash(feed.asOfBlockHash) ||
    feed.receipt?.projectionVersion !== "BINRAT_PUBLIC_PROJECTION_V0" ||
    typeof feed.receipt.receiptId !== "string" ||
    !feed.receipt.receiptId ||
    feed.receipt.chainId !== 5042 ||
    feed.receipt.asOfBlock !== feed.asOfBlock ||
    feed.receipt.asOfBlockHash !== feed.asOfBlockHash ||
    feed.receipt.historyCoverage !== "UNVERIFIED"
  ) {
    throw new Error("WEB_PUBLIC_FEED_INVALID");
  }
  const bags = feed.bags.map((bag) => {
    const trail = bag?.trashTrail;
    if (
      typeof bag?.id !== "string" ||
      !bag.id ||
      typeof bag.symbol !== "string" ||
      typeof bag.name !== "string" ||
      !address(bag.token) ||
      !address(bag.reportedCreatorAddress) ||
      !block(bag.blockNumber) ||
      BigInt(bag.blockNumber) > BigInt(feed.asOfBlock) ||
      !hash(bag.txHash) ||
      !hash(bag.blockHash) ||
      trail?.coverage !== "UNVERIFIED" ||
      !Number.isSafeInteger(trail.priorLaunchCount) ||
      trail.priorLaunchCount < 0 ||
      !Array.isArray(trail.prior) ||
      trail.prior.length !== trail.priorLaunchCount ||
      !Array.isArray(bag.evidence) ||
      !bag.metadata ||
      !["imageUri", "website", "twitter", "telegram"].every(
        (key) => typeof bag.metadata[key] === "string",
      ) ||
      !bag.evidence.every(
        (item) =>
          ["OBSERVED", "NOTED", "UNKNOWN"].includes(item?.state) &&
          typeof item.text === "string",
      )
    ) {
      throw new Error("WEB_PUBLIC_BAG_INVALID");
    }
    const prior = trail.prior.map((item) => {
      if (
        typeof item?.symbol !== "string" ||
        !block(item.blockNumber) ||
        !address(item.token)
      )
        throw new Error("WEB_PUBLIC_TRAIL_INVALID");
      return {
        symbol: item.symbol,
        token: item.token,
        block: item.blockNumber,
        age: `BLOCK ${item.blockNumber}`,
        outcome: "OUTCOME NOT PROJECTED",
        coverage: trail.coverage,
      };
    });
    return {
      mode: "LIVE",
      id: bag.id,
      symbol: bag.symbol,
      name: bag.name,
      token: bag.token,
      reportedCreatorAddress: bag.reportedCreatorAddress,
      block: bag.blockNumber,
      txHash: bag.txHash,
      age: `BLOCK ${bag.blockNumber}`,
      priorLaunches: trail.priorLaunchCount,
      coverage: trail.coverage,
      notedConditions: bag.evidence.filter((item) => item.state === "NOTED")
        .length,
      evidence: bag.evidence.map((item) => ({
        tone: item.state.toLowerCase(),
        text: item.text,
      })),
      imageUri: bag.metadata.imageUri,
      socials: {
        website: bag.metadata.website,
        twitter: bag.metadata.twitter,
        telegram: bag.metadata.telegram,
      },
      trail: prior,
      mature24h: "NOT PROJECTED",
      concentration: "NOT PROJECTED",
      note: ratNote(trail.priorLaunchCount),
      receipt: feed.receipt.receiptId,
      asOfBlock: feed.asOfBlock,
      asOfBlockHash: feed.asOfBlockHash,
    };
  });
  return {
    version: WEB_DATA_SOURCE_VERSION,
    mode: "LIVE",
    asOfBlock: feed.asOfBlock,
    historyCoverage: feed.historyCoverage,
    bags,
  };
}

function ratNote(prior) {
  if (prior === 0) return "no indexed history yet. rat cannot time travel.";
  if (prior === 1) return "same address. second indexed bag.";
  const n = prior + 1;
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
  return `same address. ${n}${suffix} indexed bag.`;
}
function address(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}
function hash(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}
function block(value) {
  return typeof value === "string" && /^\d+$/.test(value);
}


export async function loadBagIntelligence(bagId) {
  if (WEB_DATA_SOURCE_MODE !== "LIVE") return null;
  const response = await fetch(`/api/bag/${encodeURIComponent(bagId)}/intelligence`, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("BAG_INTELLIGENCE_NOT_AVAILABLE");
  const value = await response.json();
  if (
    value?.schemaVersion !== "binrat.bag-intelligence/0.1" ||
    value.projectionVersion !== "BINRAT_BAG_INTELLIGENCE_V0" ||
    value.chainId !== 5042 ||
    !["COMPLETE", "PARTIAL", "UNVERIFIED"].includes(value.observationCoverage) ||
    !Array.isArray(value.snapshots) ||
    !Array.isArray(value.changes) ||
    typeof value.receipt?.receiptId !== "string"
  ) throw new Error("BAG_INTELLIGENCE_INVALID");
  return value;
}

export async function loadCreatorFile(reportedCreatorAddress) {
  if (WEB_DATA_SOURCE_MODE !== "LIVE") return null;
  const response = await fetch(`/api/creator/${encodeURIComponent(reportedCreatorAddress)}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("CREATOR_FILE_NOT_AVAILABLE");
  const value = await response.json();
  if (
    value?.schemaVersion !== "binrat.creator-file/0.1" ||
    value.chainId !== 5042 ||
    value.historyCoverage !== "UNVERIFIED" ||
    !Number.isSafeInteger(value.indexedLaunchCount) ||
    !Array.isArray(value.launches) ||
    typeof value.receipt?.receiptId !== "string"
  ) throw new Error("CREATOR_FILE_INVALID");
  return value;
}
