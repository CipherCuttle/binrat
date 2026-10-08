import type { ConvergenceHoldoutEntry } from '../../src/intelligence/launchConvergencePrereg.js';

/**
 * Roster sealed before new blocker/closure/action receipts or outcomes are
 * compiled. Curated historical target set; NOT a random market sample.
 *
 * No outcome status or launch date is asserted by inclusion.
 * Phased/ambiguous launches may later become PARTIAL, never relabeled to fit.
 */
export const LAUNCH_CONVERGENCE_HOLDOUT_V1: readonly ConvergenceHoldoutEntry[] = [
  { projectId: 'linea', targetLabel: 'Linea public network launch', targetClass: 'ROLLUP' },
  { projectId: 'polygon-zkevm', targetLabel: 'Polygon zkEVM public network launch', targetClass: 'ROLLUP' },
  { projectId: 'mantle-network', targetLabel: 'Mantle Network public mainnet', targetClass: 'ROLLUP' },
  { projectId: 'base', targetLabel: 'Base public network launch', targetClass: 'ROLLUP' },
  { projectId: 'opbnb', targetLabel: 'opBNB public network launch', targetClass: 'ROLLUP' },
  { projectId: 'blast', targetLabel: 'Blast public network launch', targetClass: 'ROLLUP' },
  { projectId: 'mode-network', targetLabel: 'Mode Network public mainnet', targetClass: 'ROLLUP' },
  { projectId: 'zora-network', targetLabel: 'Zora Network public network launch', targetClass: 'ROLLUP' },
  { projectId: 'world-chain', targetLabel: 'World Chain public mainnet', targetClass: 'ROLLUP' },
  { projectId: 'unichain', targetLabel: 'Unichain public mainnet', targetClass: 'ROLLUP' },
  { projectId: 'dydx-chain', targetLabel: 'dYdX Chain public network launch', targetClass: 'L1_OR_APPCHAIN' },
  { projectId: 'hyperliquid-l1', targetLabel: 'Hyperliquid L1 public network launch', targetClass: 'L1_OR_APPCHAIN' }
] as const;
