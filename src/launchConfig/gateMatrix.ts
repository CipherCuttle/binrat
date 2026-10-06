import { sha256Hex } from '../evidence/canonical.js';
import { PONS_LAUNCH_PLAN_DIGEST } from './ponsPlan.js';
import { assertDigest, requireCondition, same } from './ponsLaunchManifest.js';
import { cloneArmInputs } from './ponsExecutionEnvelope.js';

export const LAUNCH_GATE_MATRIX_SCHEMA_VERSION = 'binrat.launch-gate-matrix/0.3' as const;
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
export type LaunchPhase = 'PRE-PREFLIGHT' | 'PRE-ARM' | 'PRE-BROADCAST' | 'POST-BROADCAST' | 'PRE-PUBLIC' | 'POST-LAUNCH';
export type LaunchState = 'DRAFT' | 'PREFLIGHTED' | 'ARMED' | 'BROADCAST' | 'CONFIRMED' | 'VERIFIED' | 'PUBLIC' | 'ABORT' | 'RECONCILE';
export const GATE_PHASES: Record<LaunchGateId, LaunchPhase[]> = {
  legal_compliance_artifacts:['PRE-ARM','PRE-BROADCAST','PRE-PUBLIC'],
  launch_mechanics_verification_receipt:['PRE-PREFLIGHT','PRE-ARM','PRE-BROADCAST','POST-BROADCAST','PRE-PUBLIC'],
  actual_token_address_and_launch_execution_receipt:['POST-BROADCAST','PRE-PUBLIC'],
  telegram_doctrine_smoke:['PRE-ARM','PRE-PUBLIC'],
  rat_radar_free_value_and_holder_gate_smoke:['POST-LAUNCH'],
  rat_watch_live_subscription_and_delivery_smoke:['PRE-ARM'],
  dumpster_ledger_bootstrap:['PRE-ARM','PRE-PUBLIC'],
  replay_lab_real_evidence_smoke:['PRE-ARM'],
  status_consistency_check:['PRE-PREFLIGHT','PRE-ARM','PRE-BROADCAST','POST-BROADCAST','PRE-PUBLIC'],
  allocation_and_privileged_inventory_disclosure:['PRE-ARM','POST-BROADCAST','PRE-PUBLIC']
};
Object.freeze(REQUIRED_LAUNCH_GATE_IDS);
for (const phases of Object.values(GATE_PHASES)) Object.freeze(phases);
Object.freeze(GATE_PHASES);
export interface PhaseGateReceipt {gateId:LaunchGateId;phase:LaunchPhase;manifestDigest:string;envelopeDigest:string|null;status:'SATISFIED';artifactDigest:string;digest:string}
export interface PhaseGateBundle {schemaVersion:'binrat.pons-phase-gates/1';phase:LaunchPhase;manifestDigest:string;envelopeDigest:string|null;receipts:PhaseGateReceipt[];digest:string}
/** Phase evaluation never signs, sends, or substitutes for scoped owner/legal authority. */
export async function validatePhaseGates(bundle:PhaseGateBundle,phase:LaunchPhase,manifestDigest:string,envelopeDigest:string|null):Promise<void> {
  bundle=structuredClone(bundle);
  await assertDigest(bundle);
  requireCondition(bundle.schemaVersion === 'binrat.pons-phase-gates/1' && bundle.phase === phase && bundle.manifestDigest === manifestDigest && bundle.envelopeDigest === envelopeDigest, 'PHASE_GATE_BINDING_INVALID');
  const required=REQUIRED_LAUNCH_GATE_IDS.filter(id => GATE_PHASES[id].includes(phase));
  requireCondition(same(bundle.receipts.map(r=>r.gateId).sort(),[...required].sort()), 'PHASE_GATE_SET_INCOMPLETE');
  for (const r of bundle.receipts) {
    await assertDigest(r);
    requireCondition(r.phase === phase && r.manifestDigest === manifestDigest && r.envelopeDigest === envelopeDigest && r.status === 'SATISFIED' && /^[a-f0-9]{64}$/.test(r.artifactDigest), `PHASE_GATE_UNSATISFIED:${r.gateId}`);
  }
}
export interface TransitionProof {
  authority?:import('./ponsExecutionEnvelope.js').ArmInputs;
  armed?:import('./ponsExecutionEnvelope.js').ArmReceipt;
  fresh?:import('./ponsFreshAuthority.js').AuthoritySnapshot;
  nowMs?:number; headNumber?:bigint;
  confirmation?:import('./ponsLaunchVerifier.js').ConfirmedLaunchReceipt;
  verification?:import('./ponsLaunchVerifier.js').VerifiedLaunchReceipt;
  facts?:import('./ponsLaunchFacts.js').PonsLaunchFacts;
  legalPublication?:import('./ponsExecutionEnvelope.js').ScopedApproval;
  ownerPublication?:import('./ponsExecutionEnvelope.js').ScopedApproval;
}
export async function evaluateLaunchTransition(from:LaunchState,to:LaunchState,bundle:PhaseGateBundle,proof:TransitionProof={}):Promise<{eligible:boolean;reason:string|null}> {
  bundle=structuredClone(bundle);
  // Issued confirmation/verification handles are already frozen and retain their identity.
  proof={...proof,authority:proof.authority ? cloneArmInputs(proof.authority) : undefined,armed:proof.armed ? structuredClone(proof.armed) : undefined,fresh:proof.fresh ? structuredClone(proof.fresh) : undefined,facts:proof.facts ? structuredClone(proof.facts) : undefined,legalPublication:proof.legalPublication ? structuredClone(proof.legalPublication) : undefined,ownerPublication:proof.ownerPublication ? structuredClone(proof.ownerPublication) : undefined};
  const edges:Partial<Record<LaunchState,{to:LaunchState;phase:LaunchPhase}>>={DRAFT:{to:'PREFLIGHTED',phase:'PRE-PREFLIGHT'},PREFLIGHTED:{to:'ARMED',phase:'PRE-ARM'},ARMED:{to:'BROADCAST',phase:'PRE-BROADCAST'},BROADCAST:{to:'CONFIRMED',phase:'POST-BROADCAST'},CONFIRMED:{to:'VERIFIED',phase:'POST-BROADCAST'},VERIFIED:{to:'PUBLIC',phase:'PRE-PUBLIC'}};
  try {
    const edge=edges[from]; requireCondition(edge && edge.to === to,'LAUNCH_TRANSITION_INVALID'); await validatePhaseGates(bundle,edge.phase,bundle.manifestDigest,bundle.envelopeDigest);
    const authority=await import('./ponsExecutionEnvelope.js');
    const verifier=await import('./ponsLaunchVerifier.js');
    if (to === 'PREFLIGHTED') {
      requireCondition(proof.authority,'PREFLIGHT_PROOF_REQUIRED'); const a=proof.authority;
      const {validatePonsLaunchManifest,validateBehaviorEvidence}=await import('./ponsLaunchManifest.js');
      const {validateFreshAuthority}=await import('./ponsFreshAuthority.js');
      await validatePonsLaunchManifest(a.manifest);
      await validateBehaviorEvidence(a.manifest,a.behavior);
      await authority.validateExecutionEnvelope(a.manifest,a.envelope,a.nowMs);
      await validateFreshAuthority(a.manifest,a.readPlan,a.snapshot,a.budget,a.nowMs,a.headNumber,a.corroboration);
      await authority.validateRehearsal(a.manifest,a.envelope,a.snapshot,a.rehearsal);
    } else if (to === 'ARMED') {
      requireCondition(proof.authority && proof.authority.gates.digest === bundle.digest,'EXACT_ARM_AUTHORITY_REQUIRED');
      await authority.armExecutionEnvelope(proof.authority);
    } else if (to === 'BROADCAST') {
      requireCondition(proof.authority && proof.armed && proof.fresh && proof.nowMs !== undefined && proof.headNumber !== undefined,'PRE_SEND_PROOF_REQUIRED');
      await authority.preSendRevalidation(proof.authority,proof.armed,proof.fresh,proof.nowMs,proof.headNumber);
    } else if (to === 'CONFIRMED') {
      requireCondition(proof.confirmation,'CONFIRMATION_REQUIRED');verifier.assertIssuedConfirmation(proof.confirmation);
      requireCondition(proof.confirmation.manifestDigest === bundle.manifestDigest && proof.confirmation.envelopeDigest === bundle.envelopeDigest,'CONFIRMATION_BINDING_INVALID');
    } else {
      requireCondition(proof.verification,'VERIFICATION_REQUIRED');verifier.assertIssuedVerifiedReceipt(proof.verification);
      requireCondition(proof.verification.manifestDigest === bundle.manifestDigest && proof.verification.envelopeDigest === bundle.envelopeDigest,'VERIFICATION_BINDING_INVALID');
      if (to === 'PUBLIC') {
        requireCondition(proof.authority && proof.facts && proof.legalPublication && proof.ownerPublication && proof.nowMs !== undefined,'PUBLICATION_PROOF_REQUIRED');
        const {validateLaunchFacts}=await import('./ponsLaunchFacts.js');
        await validateLaunchFacts(proof.facts,proof.authority.manifest,proof.verification);
        await authority.validateScopedApproval(proof.legalPublication,'LEGAL_PUBLICATION',bundle.manifestDigest,null,proof.authority.trust.legalSigner,proof.nowMs,proof.authority.trust);
        requireCondition(proof.legalPublication.body.scope.includes('PUBLICATION') && proof.legalPublication.body.references.facts === proof.facts.digest,'LEGAL_PUBLICATION_SCOPE_MISSING');
        await authority.validateScopedApproval(proof.ownerPublication,'OWNER_PUBLICATION',bundle.manifestDigest,bundle.envelopeDigest,proof.authority.manifest.wallet.address,proof.nowMs,proof.authority.trust);
        requireCondition(proof.ownerPublication.body.scope.includes('PUBLICATION') && proof.ownerPublication.body.references.facts === proof.facts.digest && proof.ownerPublication.body.references.legal === proof.legalPublication.digest,'OWNER_PUBLICATION_SCOPE_MISSING');
      }
    }
    if (proof.authority) requireCondition(proof.authority.manifest.digest === bundle.manifestDigest && proof.authority.envelope.digest === bundle.envelopeDigest,'TRANSITION_AUTHORITY_BINDING_INVALID');
    return {eligible:true,reason:null};
  }
  catch(error) {return {eligible:false,reason:error instanceof Error ? error.message : 'LAUNCH_TRANSITION_BLOCKED'};}
}
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
  /** Compatibility boolean is a PRE-ARM projection only. Authority uses requiredAt. */
  requiredAt: LaunchPhase[];
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
    if (!same(gate.requiredAt,GATE_PHASES[id]) || gate.blocksLaunchAuthorization !== GATE_PHASES[id].includes('PRE-ARM')) throw new Error(`LAUNCH_GATE_MATRIX_PHASE_INVALID:${id}`);
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
    execution.blocksLaunchAuthorization !== false ||
    execution.liveEvidence.tokenAddress !== null ||
    execution.liveEvidence.launchTransaction !== null ||
    execution.liveEvidence.launchBlock !== null ||
    execution.liveEvidence.launchBlockHash !== null
  ) throw new Error('LAUNCH_GATE_MATRIX_EXECUTION_BOUNDARY_INVALID');

  const holder = gates.rat_radar_free_value_and_holder_gate_smoke as Record<string, any>;
  if (
    holder.status !== 'PARTIAL' ||
    holder.blocksLaunchAuthorization !== false ||
    holder.liveEvidence.stakeSource !== 'L2_COMPOSED_READ_ONLY_PRODUCTION_DISABLED' ||
    holder.liveEvidence.stakeReadSelector !== '0xaf500ba3' ||
    holder.liveEvidence.productionEligibilityActive !== false
  ) throw new Error('LAUNCH_GATE_MATRIX_HOLDER_BOUNDARY_INVALID');

  const watch = gates.rat_watch_live_subscription_and_delivery_smoke as Record<string, any>;
  if (
    watch.status !== 'SATISFIED' ||
    watch.blocksLaunchAuthorization !== true ||
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
  // Deprecated generic owner boolean cannot arm a transaction. Use exact scoped envelope authority.
  return false;
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
