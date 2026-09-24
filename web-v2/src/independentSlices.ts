/** Separate public read scopes. Each validator is inside its own settlement. */
export async function settleIndependentSlices<F, R>(
  readFeed: () => Promise<F>, readRadar: () => Promise<R>,
): Promise<{ feed: F | null; radar: R | null; feedError: string | null; radarError: string | null }> {
  const [feedResult, radarResult] = await Promise.allSettled([readFeed(), readRadar()]);
  const message = (reason: unknown) => reason instanceof Error ? reason.message : "DATA_UNAVAILABLE";
  return {
    feed: feedResult.status === "fulfilled" ? feedResult.value : null,
    radar: radarResult.status === "fulfilled" ? radarResult.value : null,
    feedError: feedResult.status === "rejected" ? message(feedResult.reason) : null,
    radarError: radarResult.status === "rejected" ? message(radarResult.reason) : null,
  };
}
