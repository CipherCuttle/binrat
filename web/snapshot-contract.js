// Matches src/evidence/canonical.ts and buildPublicSnapshot's signed material.
// Never hash the display adapter or include feedDigest in its own material.
export function canonicalJson(value) {
  const normalize = item => Array.isArray(item) ? item.map(normalize) :
    item && typeof item === "object" ? Object.fromEntries(Object.keys(item).sort().map(key => [key, normalize(item[key])])) : item;
  return JSON.stringify(normalize(value));
}
export async function canonicalSnapshotDigest(snapshot) {
  const { schemaVersion, chainId, sourceCheckpoint, checkpointBlockHash, historyCoverage, launches } = snapshot;
  const bytes = new TextEncoder().encode(canonicalJson({ schemaVersion, chainId, sourceCheckpoint, checkpointBlockHash, historyCoverage, launches }));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function verifyFeedBinding(feed) {
  const raw = feed?.canonicalSnapshot;
  if (!raw || raw.schemaVersion !== "binrat.latest-launches/0.1" || raw.chainId !== 4663 ||
      feed.chainId !== raw.chainId || feed.asOfBlock !== raw.sourceCheckpoint ||
      !/^(0|[1-9]\d*)$/.test(raw.sourceCheckpoint) || raw.historyCoverage !== "PARTIAL" ||
      !/^0x[0-9a-f]{64}$/.test(raw.checkpointBlockHash) || !/^[0-9a-f]{64}$/.test(raw.feedDigest) ||
      feed.checkpointBlockHash !== raw.checkpointBlockHash || feed.feedDigest !== raw.feedDigest ||
      !Array.isArray(raw.launches) || raw.launches.length > 20 || !Array.isArray(feed.bags) || feed.bags.length !== raw.launches.length) {
    throw new Error("PUBLIC_FEED_BINDING_INVALID");
  }
  const digest = await canonicalSnapshotDigest(raw);
  if (digest !== raw.feedDigest) throw new Error("PUBLIC_FEED_DIGEST_INVALID");
  for (let i = 0; i < raw.launches.length; i += 1) {
    const launch = raw.launches[i], bag = feed.bags[i];
    if (!launch || !bag || launch.factId !== `binrat-fact:4663:${launch.launchId}` ||
        bag.id !== launch.launchId || bag.token !== launch.token || bag.txHash !== launch.txHash ||
        bag.reportedCreatorAddress !== launch.deployer || bag.block !== launch.blockNumber ||
        bag.symbol !== launch.symbol || bag.name !== launch.name || bag.priorLaunches !== launch.priorLaunchCount ||
        bag.asOfBlockHash !== raw.checkpointBlockHash) throw new Error("PUBLIC_FEED_ADAPTATION_INVALID");
  }
  return { chainId: raw.chainId, checkpoint: raw.sourceCheckpoint, checkpointBlockHash: raw.checkpointBlockHash, digest };
}
export function bindingMatches(binding, status) {
  return binding.chainId === status.chainId && binding.checkpoint === status.checkpointBlock &&
    binding.checkpointBlockHash === status.checkpointBlockHash && binding.digest === status.feedDigest;
}
