import type { Hex, LaunchObserved } from '../core/types.js';

export type HotGarbageDecision =
  | 'CONTINUE_ARCPAD_ONLY'
  | 'ADD_SECOND_SOURCE'
  | 'ARCPAD_ONLY_TOO_SPARSE';

export interface HotGarbageMetrics {
  launchCount: number;
  uniqueCreatorAddresses: number;
  repeatCreatorAddresses: number;
  launchesFromRepeatCreatorAddresses: number;
  maxLaunchesByOneCreatorAddress: number;
  metadata: {
    withWebsite: number;
    withTwitter: number;
    withTelegram: number;
    withAnySocialOrWebsite: number;
  };
}

export interface Reconciliation {
  onchainCount: number;
  apiCount: number;
  inBoth: number;
  missingFromApi: Hex[];
  missingFromOnchain: Hex[];
  capturePercentAgainstUnion: number;
}

export function computeHotGarbageMetrics(launches: readonly LaunchObserved[]): HotGarbageMetrics {
  const byCreator = new Map<string, number>();
  let withWebsite = 0;
  let withTwitter = 0;
  let withTelegram = 0;
  let withAnySocialOrWebsite = 0;

  for (const launch of launches) {
    const creator = launch.creator.toLowerCase();
    byCreator.set(creator, (byCreator.get(creator) ?? 0) + 1);

    const website = hasText(launch.website);
    const twitter = hasText(launch.twitter);
    const telegram = hasText(launch.telegram);
    if (website) withWebsite += 1;
    if (twitter) withTwitter += 1;
    if (telegram) withTelegram += 1;
    if (website || twitter || telegram) withAnySocialOrWebsite += 1;
  }

  const counts = [...byCreator.values()];
  const repeatCounts = counts.filter((count) => count > 1);

  return {
    launchCount: launches.length,
    uniqueCreatorAddresses: byCreator.size,
    repeatCreatorAddresses: repeatCounts.length,
    launchesFromRepeatCreatorAddresses: repeatCounts.reduce((sum, count) => sum + count, 0),
    maxLaunchesByOneCreatorAddress: counts.length === 0 ? 0 : Math.max(...counts),
    metadata: {
      withWebsite,
      withTwitter,
      withTelegram,
      withAnySocialOrWebsite
    }
  };
}

export function reconcileTokenSets(onchainTokens: readonly Hex[], apiTokens: readonly Hex[]): Reconciliation {
  const onchain = new Set(onchainTokens.map(normalizeToken));
  const api = new Set(apiTokens.map(normalizeToken));
  const inBoth = [...onchain].filter((token) => api.has(token)).length;
  const missingFromApi = [...onchain].filter((token) => !api.has(token)).sort() as Hex[];
  const missingFromOnchain = [...api].filter((token) => !onchain.has(token)).sort() as Hex[];
  const union = new Set([...onchain, ...api]);

  return {
    onchainCount: onchain.size,
    apiCount: api.size,
    inBoth,
    missingFromApi,
    missingFromOnchain,
    capturePercentAgainstUnion: union.size === 0 ? 100 : round4((inBoth / union.size) * 100)
  };
}

export function decideHotGarbage(launchCount: number): HotGarbageDecision {
  if (!Number.isInteger(launchCount) || launchCount < 0) throw new Error('launchCount must be a non-negative integer');
  if (launchCount >= 25) return 'CONTINUE_ARCPAD_ONLY';
  if (launchCount >= 10) return 'ADD_SECOND_SOURCE';
  return 'ARCPAD_ONLY_TOO_SPARSE';
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function normalizeToken(token: Hex): Hex {
  return token.toLowerCase() as Hex;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
