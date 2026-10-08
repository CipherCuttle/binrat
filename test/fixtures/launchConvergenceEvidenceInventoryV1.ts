import type {
  ConvergenceEvidenceInventoryEntry, LaunchOutcomeCandidate
} from '../../src/intelligence/launchConvergenceReplayV1.js';

/**
 * First-pass label research only. Outcome candidates are NOT detector inputs.
 * Do not infer missing prelaunch blocker receipts from known launch dates.
 */
export const CONVERGENCE_OUTCOME_CANDIDATES_V1: readonly LaunchOutcomeCandidate[] = [
  {
    projectId:'linea',candidateLaunchOn:null,status:'PHASE_AMBIGUOUS',
    sourceRef:'https://linea.build/blog/linea-completes-its-alpha-mainnet-launch',
    phaseNotes:'Restricted mainnet rollout July 11, partner/public network around ETHCC, completed launch August 16; original public-access target needs prereg-consistent adjudication.'
  },
  {
    projectId:'polygon-zkevm',candidateLaunchOn:'2023-03-27',status:'DATE_CANDIDATE',
    sourceRef:'https://polygon.technology/blog/polygon-zkevm-mainnet-beta-is-live',
    phaseNotes:'Official states public permissionless Mainnet Beta on March 27; not earlier testnet.'
  },
  {
    projectId:'mantle-network',candidateLaunchOn:'2023-07-17',status:'DATE_CANDIDATE',
    sourceRef:'https://www.youtube.com/watch?v=wFcujtseUoE',
    phaseNotes:'Official Mantle launch announcement says Mainnet Alpha now open to all developers and users.'
  },
  {
    projectId:'base',candidateLaunchOn:'2023-08-09',status:'DATE_CANDIDATE',
    sourceRef:'https://blog.base.org/base-is-open-for-everyone',
    phaseNotes:'Public general availability August 9; developer-only mainnet phase was earlier.'
  },
  {
    projectId:'opbnb',candidateLaunchOn:'2023-09-13',status:'DATE_CANDIDATE',
    sourceRef:'https://www.bnbchain.org/tr-TR/blog/opbnb-mainnet-is-live',
    phaseNotes:'Official BNB Chain states public mainnet launched September 13.'
  },
  {
    projectId:'blast',candidateLaunchOn:'2024-02-29',status:'DATE_CANDIDATE',
    sourceRef:'https://www.pyth.network/blog/pyth-price-feeds-launch-on-blast-mainnet',
    phaseNotes:'Pyth confirms production integrations active immediately after February 29 mainnet launch; Blast had pre-launch deposits before public network access.'
  },
  {
    projectId:'mode-network',candidateLaunchOn:'2024-01-31',status:'DATE_CANDIDATE',
    sourceRef:'https://paragraph.com/@modenetwork/4dM0wUGlxyS0Um45yLv8',
    phaseNotes:'Official Mode Sunrise Mainnet announcement dated January 31; separate earlier developer mainnet.'
  },
  {
    projectId:'zora-network',candidateLaunchOn:'2023-06-21',status:'DATE_CANDIDATE',
    sourceRef:'https://nftnow.com/news/zora-launches-its-own-layer-2-chain-zora-network/',
    phaseNotes:'Launch announced June 21; independent contemporary source, should obtain immutable first-party archive before VERIFIED label.'
  },
  {
    projectId:'world-chain',candidateLaunchOn:'2024-10-17',status:'DATE_CANDIDATE',
    sourceRef:'https://world.org/blog/announcements/world-chain-now-open-every-human',
    phaseNotes:'Official World Chain announcement says network live and open to everyone October 17.'
  },
  {
    projectId:'unichain',candidateLaunchOn:'2025-02-11',status:'DATE_CANDIDATE',
    sourceRef:'https://blog.uniswap.org/unichain-mainnet-is-here',
    phaseNotes:'Official Uniswap Labs February 11 full mainnet availability.'
  },
  {
    projectId:'dydx-chain',candidateLaunchOn:null,status:'PHASE_AMBIGUOUS',
    sourceRef:'https://www.dydx.foundation/blog/new-trading-pairs-permissionless-markets-on-the-dydx-chain',
    phaseNotes:'Genesis chain went live October 26, 2023; full production trading only after community governance November 28. Original "public network" label needs explicit user-action definition.'
  },
  {
    projectId:'hyperliquid-l1',candidateLaunchOn:null,status:'PHASE_AMBIGUOUS',
    sourceRef:'https://hyperliquid.medium.com/hyperliquid-q2-update-7c39c726c45b',
    phaseNotes:'Original project already trading in mainnet closed alpha February 2023; March referrals widened alpha and May HLP opened. No strict first broad-public-access day established.'
  }
] as const;

/**
 * Coverage is PARTIAL across every project because a complete cutoff-indexed
 * search of explicit OPEN_BLOCKER -> CLOSED -> independently verified
 * EXECUTION_COMMITMENT, plus a parallel frozen-P1-P6 baseline, is not complete.
 *
 * No zero-positive or zero-FPR statistic is manufactured from this.
 */
export const CONVERGENCE_EVIDENCE_INVENTORY_V1: readonly ConvergenceEvidenceInventoryEntry[] =
  CONVERGENCE_OUTCOME_CANDIDATES_V1.map(row=>({
    projectId: row.projectId,
    receiptCoverage: 'PARTIAL' as const,
    searchNotes:'Launch-label source located; historical blocker/closure/action receipts, publication provenance, source hashes, independent production coordinates, and full V0 evidence perimeter not yet frozen.'
  }));
