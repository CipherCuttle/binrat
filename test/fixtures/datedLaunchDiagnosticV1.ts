import type { DatedLaunchEvent } from '../../src/intelligence/datedLaunchBaselineV1.js';

/**
 * Retrospective illustrative example — NOT blinded validation or a scored
 * holdout. The 2026-08-05 schedule is public; page immutability and complete
 * revision history have not been independently archived, so coverage PARTIAL.
 */
export const ARC_SCHEDULE_DIAGNOSTIC: readonly DatedLaunchEvent[] = [
  {
    projectId:'arc-public-mainnet',
    targetId:'public-mainnet',
    event:'SCHEDULED',
    observedOn:'2026-08-05',
    publishedOn:'2026-08-05',
    launchOn:'2026-09-16',
    sourceRef:'https://www.arc.io/blog/arc-mainnet-goes-live-on-september-16-2026',
    sourceOrigin:'arc.io'
  }
] as const;

export const ARC_REPORTED_OUTCOME = {
  projectId:'arc-public-mainnet',publicLaunchOn:'2026-09-16',
  sourceRef:'https://www.arc.io/blog/arc-economic-os-internet'
} as const;
