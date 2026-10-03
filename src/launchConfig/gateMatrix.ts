import { sha256Hex } from '../evidence/canonical.js';
import { PONS_LAUNCH_PLAN_DIGEST } from './ponsPlan.js';

export const LAUNCH_GATE_MATRIX_SCHEMA_VERSION = 'binrat.launch-gate-matrix/0.2' as const;
export const LAUNCH_GATE_MATRIX_VERSION = 'LAUNCH_GATE_MATRIX_PONS_V1' as const;

export const REQUIRED_LAUNCH_GATE_IDS = [
  'legal_compliance_artifacts',
  'launch_mechanics_verification_receipt',
  'actual_token_address_and_launch_execution_receipt',
  'telegram_doctrine_smoke',
  'rat_radar_free_value_and_holder_gate_smoke',
  'rat_watch_live_subscription_and_delivery_smoke',
  'dumpster_ledger_bootstrap',
  'replay_lab_real_evidence_smoke',
  'status_consistency_check',
  'allocation_and_privileged_inventory_disclosure'
] as const;

export type LaunchGateId = typeof REQUIRED_LAUNCH_GATE_IDS[number];
export type LaunchGateStatus =
  | 'SATISFIED'
  | 'PARTIAL'
  | 'BLOCKED_FUTURE_EVENT'
  | 'BLOCKED_OWNER_INPUT'
  | 'BLOCKED_UPSTREAM_VERIFICATION'
  | 'BLOCKED_LEGAL';

export interface LaunchGateRecord {
  status: LaunchGateStatus;
  evidenceArtifacts: string[];
  evidenceDigests: string[];
  liveEvidence: Record<string, unknown>;
  verificationDate: string;
  exactRemainingRequirement: string;
  blocksLaunchAuthorization: boolean;
}

export interface LaunchGateMatrix {
  schemaVersion: typeof LAUNCH_GATE_MATRIX_SCHEMA_VERSION;
  matrixVersion: typeof LAUNCH_GATE_MATRIX_VERSION;
  frozenOn: '2026-10-03';
  chainId: 4663;
  launchPlanPath: 'docs/BINRAT_PONS_LAUNCH_PLAN_V1.json';
  launchPlanDigest: typeof PONS_LAUNCH_PLAN_DIGEST;
  historicalArcMatrix: {
    path: 'docs/LAUNCH_GATE_MATRIX_V0.json';
    digest: string;
    authority: 'HISTORICAL_ONLY';
  };
  gates: Record<LaunchGateId, LaunchGateRecord>;
  explicitOwnerLaunchAuthorityState: 'NOT_GRANTED';
  launchAuthorization: 'BLOCKED';
  matrixDigest: string;
}

export async function deriveLaunchGateMatrixDigest(value: unknown): Promise<string> {
  const input = record(value, 'LAUNCH_GATE_MATRIX_INVALID');
  const { matrixDigest: _matrixDigest, ...material } = input;
  return sha256Hex(material);
}

export function validateLaunchGateMatrix(value: unknown): LaunchGateMatrix {
  const input = record(value, 'LAUNCH_GATE_MATRIX_INVALID');
  if (
    input.schemaVersion !== LAUNCH_GATE_MATRIX_SCHEMA_VERSION ||
    input.matrixVersion !== LAUNCH_GATE_MATRIX_VERSION ||
    input.frozenOn !== '2026-10-03' ||
    input.chainId !== 4663 ||
    input.launchPlanPath !== 'docs/BINRAT_PONS_LAUNCH_PLAN_V1.json' ||
    input.launchPlanDigest !== PONS_LAUNCH_PLAN_DIGEST ||
    input.explicitOwnerLaunchAuthorityState !== 'NOT_GRANTED' ||
    input.launchAuthorization !== 'BLOCKED'
  ) throw new Error('LAUNCH_GATE_MATRIX_HEADER_INVALID');

  const historical = record(input.historicalArcMatrix, 'LAUNCH_GATE_MATRIX_HISTORY_INVALID');
  if (
    historical.path !== 'docs/LAUNCH_GATE_MATRIX_V0.json' ||
    historical.digest !== 'd244d4b8d19d17679adee0e995dbbf4845f321702ea91bfcc646497e6f2ce73b' ||
    historical.authority !== 'HISTORICAL_ONLY'
  ) throw new Error('LAUNCH_GATE_MATRIX_HISTORY_INVALID');

  const gates = record(input.gates, 'LAUNCH_GATE_MATRIX_GATES_INVALID');
  const ids = Object.keys(gates).sort();
  const expectedIds = [...REQUIRED_LAUNCH_GATE_IDS].sort();
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
    throw new Error('LAUNCH_GATE_MATRIX_GATE_SET_INVALID');
  }

  for (const id of REQUIRED_LAUNCH_GATE_IDS) {
    const gate = record(gates[id], `LAUNCH_GATE_MATRIX_GATE_INVALID:${id}`);
    if (!VALID_STATUSES.has(gate.status as LaunchGateStatus)) {
      throw new Error(`LAUNCH_GATE_MATRIX_STATUS_INVALID:${id}`);
    }
    if (!Array.isArray(gate.evidenceArtifacts) || gate.evidenceArtifacts.length === 0) {
      throw new Error(`LAUNCH_GATE_MATRIX_EVIDENCE_MISSING:${id}`);
    }
    if (!Array.isArray(gate.evidenceDigests)) {
      throw new Error(`LAUNCH_GATE_MATRIX_DIGESTS_INVALID:${id}`);
    }
    for (const digest of gate.evidenceDigests) {
      if (typeof digest !== 'string' || !/^[0-9a-f]{64}$/.test(digest)) {
        throw new Error(`LAUNCH_GATE_MATRIX_DIGEST_INVALID:${id}`);
      }
    }
    if (!record(gate.liveEvidence, `LAUNCH_GATE_MATRIX_LIVE_EVIDENCE_INVALID:${id}`)) {
      throw new Error(`LAUNCH_GATE_MATRIX_LIVE_EVIDENCE_INVALID:${id}`);
    }
    if (
      typeof gate.verificationDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(gate.verificationDate) ||
      typeof gate.exactRemainingRequirement !== 'string' ||
      gate.exactRemainingRequirement.length === 0 ||
      typeof gate.blocksLaunchAuthorization !== 'boolean'
    ) throw new Error(`LAUNCH_GATE_MATRIX_RECORD_INVALID:${id}`);
  }

  const legal = gates.legal_compliance_artifacts as Record<string, any>;
  if (
    legal.status !== 'BLOCKED_LEGAL' ||
    legal.blocksLaunchAuthorization !== true ||
    legal.liveEvidence.status !== 'NOT_SATISFIED' ||
    legal.liveEvidence.technicalArtifactsAreNotLegalApproval !== true
  ) throw new Error('LAUNCH_GATE_MATRIX_LEGAL_BOUNDARY_INVALID');

  const mechanics = gates.launch_mechanics_verification_receipt as Record<string, any>;
  if (
    mechanics.status !== 'BLOCKED_UPSTREAM_VERIFICATION' ||
    mechanics.blocksLaunchAuthorization !== true ||
    mechanics.liveEvidence.chainId !== 4663 ||
    mechanics.liveEvidence.rail !== 'pons-v2-vault-staking-candidate-v1' ||
    mechanics.liveEvidence.stakingAttestationStatus !== 'CONDITIONAL' ||
    mechanics.liveEvidence.rejectedStakeBurnCandidateStatus !== 'FAIL_DEFER_CURRENT_CANDIDATE' ||
    mechanics.liveEvidence.ponsVaultSourceMatch !== 'NOT_SATISFIED' ||
    mechanics.liveEvidence.explicitUpstreamRiskAcceptance !== 'ACCEPTED_FOR_SELECTED_DEPENDENCY_NOT_LAUNCH_AUTHORITY'
  ) throw new Error('LAUNCH_GATE_MATRIX_PONS_MECHANICS_BOUNDARY_INVALID');

  const execution = gates.actual_token_address_and_launch_execution_receipt as Record<string, any>;
  if (
    execution.status !== 'BLOCKED_FUTURE_EVENT' ||
    execution.blocksLaunchAuthorization !== true ||
    execution.liveEvidence.tokenAddress !== null ||
    execution.liveEvidence.launchTransaction !== null ||
    execution.liveEvidence.launchBlock !== null ||
    execution.liveEvidence.launchBlockHash !== null
  ) throw new Error('LAUNCH_GATE_MATRIX_EXECUTION_BOUNDARY_INVALID');

  const holder = gates.rat_radar_free_value_and_holder_gate_smoke as Record<string, any>;
  if (
    holder.status !== 'PARTIAL' ||
    holder.blocksLaunchAuthorization !== true ||
    holder.liveEvidence.stakeSource !== 'L1B_STAKED_OF_PINNED_L2_NOT_IMPLEMENTED' ||
    holder.liveEvidence.stakeReadSelector !== '0xaf500ba3' ||
    holder.liveEvidence.productionEligibilityActive !== false
  ) throw new Error('LAUNCH_GATE_MATRIX_HOLDER_BOUNDARY_INVALID');

  const watch = gates.rat_watch_live_subscription_and_delivery_smoke as Record<string, any>;
  if (
    watch.status !== 'SATISFIED' ||
    watch.blocksLaunchAuthorization !== false ||
    watch.liveEvidence.realRecurrenceStatus !== 'PENDING_REAL_FUTURE_LAUNCH'
  ) throw new Error('LAUNCH_GATE_MATRIX_RAT_WATCH_BOUNDARY_INVALID');

  const allocation = gates.allocation_and_privileged_inventory_disclosure as Record<string, any>;
  if (
    allocation.status !== 'PARTIAL' ||
    allocation.blocksLaunchAuthorization !== true ||
    allocation.liveEvidence.evidenceClass !== 'OWNER_POLICY' ||
    allocation.liveEvidence.creatorTaxBps !== 0 ||
    allocation.liveEvidence.openingBuy !== 'ZERO_ETH_OWNER_SELECTED' ||
    allocation.liveEvidence.privatePresale !== 'NO' ||
    allocation.liveEvidence.discountedInsiderRound !== 'NO' ||
    allocation.liveEvidence.hiddenTeamAllocation !== 'NO'
  ) throw new Error('LAUNCH_GATE_MATRIX_ALLOCATION_BOUNDARY_INVALID');

  if (typeof input.matrixDigest !== 'string' || !/^[0-9a-f]{64}$/.test(input.matrixDigest)) {
    throw new Error('LAUNCH_GATE_MATRIX_DIGEST_INVALID');
  }
  return input as unknown as LaunchGateMatrix;
}

export function launchAuthorizationEligible(
  matrix: LaunchGateMatrix,
  ownerAuthority: 'NOT_GRANTED' | 'GRANTED'
): boolean {
  return (
    ownerAuthority === 'GRANTED' &&
    matrix.launchAuthorization === 'BLOCKED' &&
    REQUIRED_LAUNCH_GATE_IDS.every((id) => matrix.gates[id].status === 'SATISFIED')
  );
}

export function validateLaunchGateStatusConsistency(
  matrix: LaunchGateMatrix,
  manifest: unknown
): void {
  const root = record(manifest, 'LAUNCH_GATE_MANIFEST_INVALID');
  const launch = record(root.launchAuthorization, 'LAUNCH_GATE_MANIFEST_INVALID');
  const gateStatus = record(root.launchGateStatus, 'LAUNCH_GATE_MANIFEST_INVALID');
  const statuses = record(gateStatus.statuses, 'LAUNCH_GATE_MANIFEST_INVALID');
  if (
    gateStatus.matrix !== 'docs/LAUNCH_GATE_MATRIX_PONS_V1.json' ||
    gateStatus.matrixDigest !== matrix.matrixDigest ||
    launch.status !== 'BLOCKED' ||
    launch.marketingAuthorized !== false ||
    launch.launchAuthorized !== false ||
    launch.tokenState !== 'NOT_LAUNCHED'
  ) throw new Error('LAUNCH_GATE_STATUS_CONTRADICTION');
  const expectedBlocking = REQUIRED_LAUNCH_GATE_IDS.filter((id) =>
    matrix.gates[id].blocksLaunchAuthorization && matrix.gates[id].status !== 'SATISFIED'
  ).length;
  if (gateStatus.blockingGateCount !== expectedBlocking) {
    throw new Error('LAUNCH_GATE_STATUS_CONTRADICTION');
  }
  for (const id of REQUIRED_LAUNCH_GATE_IDS) {
    if (statuses[id] !== matrix.gates[id].status) {
      throw new Error(`LAUNCH_GATE_STATUS_CONTRADICTION:${id}`);
    }
  }
}

const VALID_STATUSES = new Set<LaunchGateStatus>([
  'SATISFIED',
  'PARTIAL',
  'BLOCKED_FUTURE_EVENT',
  'BLOCKED_OWNER_INPUT',
  'BLOCKED_UPSTREAM_VERIFICATION',
  'BLOCKED_LEGAL'
]);

function record(value: unknown, code: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Record<string, any>;
}
