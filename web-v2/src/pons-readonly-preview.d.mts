export type PonsCase = {
  mode: "LIVE";
  id: string;
  symbol: string;
  name: string;
  token: string;
  reportedCreatorAddress: string;
  block: string;
  txHash: string;
  priorLaunches: number;
  coverage: "PARTIAL";
  receipt: string;
  asOfBlock: string;
  asOfBlockHash: string;
  feedDigest: string;
  evidence: readonly { tone: "observed" | "noted" | "unknown"; text: string }[];
};
export type PonsPreview = {
  feed: { chainId: 4663; asOfBlock: string; feedDigest: string; bags: PonsCase[] };
  status: {
    state: "FRESH_VERIFIED" | "STALE_VERIFIED";
    checkpointBlock: string;
    checkpointBlockHash: string;
    feedDigest: string;
    verifiedAtMs: number;
    runtimeUpdatedAtMs: number | null;
    publicationVersion: number;
    lastSyncError: string | null;
    freshnessValidUntilMs: number | null;
  };
  freshness: "FRESH_VERIFIED" | "STALE_VERIFIED";
  cases: PonsCase[];
};
export function loadPonsPreview(options?: {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  now?: () => number;
  previous?: PonsPreview | null;
}): Promise<PonsPreview>;
