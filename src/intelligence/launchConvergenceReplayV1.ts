import {
  LAUNCH_CONVERGENCE_FROZEN_PLAN,
  type ConvergenceHoldoutEntry
} from './launchConvergencePrereg.js';

export const LAUNCH_CONVERGENCE_REPLAY_VERSION = 'BINRAT_LAUNCH_CONVERGENCE_REPLAY_V1' as const;
export type ConvergenceEvidenceKind = 'OPEN_BLOCKER' | 'BLOCKER_CLOSED' | 'EXECUTION_COMMITMENT';
export type ConvergenceCoverage = 'VERIFIED' | 'PARTIAL';
export type ConvergenceState = 'CONVERGENCE_CANDIDATE' | 'NO_CONVERGENCE_SIGNAL' | 'INSUFFICIENT_EVIDENCE';

export interface ConvergenceEvidence {
  projectId: string;
  targetId: string;
  kind: ConvergenceEvidenceKind;
  observedOn: string;
  publishedOn: string;
  sourceRef: string;
  sourceOrigin: string;
  sourceHash: string;
  blockerId?: string;
  executionKind?: 'ONCHAIN_PRODUCTION_TX' | 'FINALIZED_GENESIS' | 'LIVE_PRODUCTION_ACTIVATION';
  executionCoordinates?: string;
  independentSourceRef?: string;
  independentSourceOrigin?: string;
  independentSourceHash?: string;
  independentSourcePublishedOn?: string;
}

export interface ConvergenceReplayInput {
  projectId: string;
  targetId: string;
  asOf: string;
  coverage: ConvergenceCoverage;
  receipts: readonly ConvergenceEvidence[];
}

export interface ConvergenceReplayResult {
  version: typeof LAUNCH_CONVERGENCE_REPLAY_VERSION;
  projectId: string;
  targetId: string;
  asOf: string;
  state: ConvergenceState;
  activeBlockerCount: number;
  ignoredFutureEvidence: number;
  eligibleExecutionCount: number;
}

export interface LaunchOutcomeCandidate {
  projectId: string;
  candidateLaunchOn: string | null;
  status: 'DATE_CANDIDATE' | 'PHASE_AMBIGUOUS' | 'DATE_UNVERIFIED';
  sourceRef: string;
  phaseNotes: string;
}

export interface ConvergenceEvidenceInventoryEntry {
  projectId: string;
  receiptCoverage: ConvergenceCoverage;
  searchNotes: string;
}

export interface ConvergenceEvidenceInventoryReport {
  version: typeof LAUNCH_CONVERGENCE_REPLAY_VERSION;
  totalTargets: number;
  verifiedTargetReceiptCoverage: number;
  partialTargetReceiptCoverage: number;
  datedOutcomeCandidates: number;
  phaseOrDateUnresolved: number;
  result: 'INSUFFICIENT_DATA' | 'COLLECTION_READY';
  cause: string;
}

/** Data availability is the LATER of event observation and publication. */
export function evaluateConvergenceReplay(input: ConvergenceReplayInput): ConvergenceReplayResult {
  const asOf = parseIso(input.asOf);
  if (!input.projectId.trim() || !input.targetId.trim()) {
    throw new Error('CONVERGENCE_TARGET_REQUIRED');
  }

  const eligible: Array<ConvergenceEvidence & { availableOnMs: number }> = [];
  let ignoredFutureEvidence = 0;
  for (const event of input.receipts) {
    if (!event.projectId.trim() || !event.targetId.trim() ||
      !event.sourceRef.trim() || !event.sourceOrigin.trim() ||
      !/^[a-f0-9]{64}$/.test(event.sourceHash)) {
      throw new Error('CONVERGENCE_PROVENANCE_INVALID');
    }
    const availableOnMs = Math.max(parseIso(event.observedOn), parseIso(event.publishedOn));
    if (availableOnMs > asOf) {
      ignoredFutureEvidence++;
      continue;
    }
    if (event.projectId !== input.projectId || event.targetId !== input.targetId) {
      // A different phase/chain must never influence the current target.
      continue;
    }
    eligible.push({ ...event, availableOnMs });
  }

  eligible.sort((a,b) => a.availableOnMs - b.availableOnMs ||
    (a.kind === 'OPEN_BLOCKER' ? -1 : b.kind === 'OPEN_BLOCKER' ? 1 : 0));
  const known = new Map<string, { closed: boolean; closedOn: number | null }>();
  const executions: typeof eligible = [];
  for (const event of eligible) {
    if (event.kind === 'OPEN_BLOCKER') {
      if (!event.blockerId?.trim()) throw new Error('CONVERGENCE_BLOCKER_ID_REQUIRED');
      known.set(event.blockerId, { closed:false, closedOn:null });
    } else if (event.kind === 'BLOCKER_CLOSED') {
      if (!event.blockerId?.trim()) throw new Error('CONVERGENCE_BLOCKER_ID_REQUIRED');
      const previous = known.get(event.blockerId);
      if (!previous || previous.closed) {
        // Cannot invent prior explicitly documented blocker from a closure alone.
        throw new Error('CONVERGENCE_UNMATCHED_CLOSURE');
      }
      known.set(event.blockerId, {closed:true, closedOn:event.availableOnMs});
    } else if (event.kind === 'EXECUTION_COMMITMENT') {
      executions.push(event);
    } else {
      throw new Error('CONVERGENCE_KIND_INVALID');
    }
  }

  const activeBlockerCount = [...known.values()].filter(x => !x.closed).length;
  let state: ConvergenceState = 'INSUFFICIENT_EVIDENCE';
  let eligibleExecutionCount=0;
  if (input.coverage === 'VERIFIED') {
    state = 'NO_CONVERGENCE_SIGNAL';
    const closed = [...known.values()];
    // UNKNOWN / no documented blocker is NOT blocker closed.
    if (closed.length > 0 && activeBlockerCount===0) {
      const lastClosure = Math.max(...closed.map(x=>x.closedOn!));
      for (const action of executions) {
        if (!action.executionKind || !action.executionCoordinates?.trim() ||
            !action.independentSourceRef?.trim() || !action.independentSourceOrigin?.trim() ||
            action.independentSourceOrigin === action.sourceOrigin ||
            action.independentSourceRef === action.sourceRef ||
            !/^[a-f0-9]{64}$/.test(action.independentSourceHash ?? '') ||
            !action.independentSourcePublishedOn) continue;
        const independentPublished = parseIso(action.independentSourcePublishedOn);
        if (independentPublished > asOf) continue;
        const lagDays = (action.availableOnMs - lastClosure)/86400000;
        const ageDays = (asOf - action.availableOnMs)/86400000;
        if (lagDays <= 0 || lagDays > LAUNCH_CONVERGENCE_FROZEN_PLAN.closureToActionMaxDays ||
            ageDays < 0 || ageDays > LAUNCH_CONVERGENCE_FROZEN_PLAN.actionFreshnessDays) continue;
        eligibleExecutionCount++;
      }
      if (eligibleExecutionCount > 0) state = 'CONVERGENCE_CANDIDATE';
    }
  }
  return {
    version:LAUNCH_CONVERGENCE_REPLAY_VERSION,
    projectId:input.projectId,targetId:input.targetId,asOf:input.asOf,state,
    activeBlockerCount,ignoredFutureEvidence,eligibleExecutionCount
  };
}

/**
 * Coverage gate only. A dated launch article is NOT equivalent to complete
 * prelaunch blocker / production-action coverage.
 */
export function summarizeConvergenceEvidenceInventory(
  targets: readonly ConvergenceHoldoutEntry[],
  labels: readonly LaunchOutcomeCandidate[],
  inventory: readonly ConvergenceEvidenceInventoryEntry[]
): ConvergenceEvidenceInventoryReport {
  const ids = targets.map(t=>t.projectId);
  if (new Set(ids).size !== ids.length ||
      labels.length !== targets.length || inventory.length !== targets.length ||
      new Set(labels.map(x=>x.projectId)).size !== targets.length ||
      new Set(inventory.map(x=>x.projectId)).size !== targets.length ||
      labels.some(x=>!ids.includes(x.projectId) || !x.sourceRef.trim() || !x.phaseNotes.trim()) ||
      inventory.some(x=>!ids.includes(x.projectId) || !x.searchNotes.trim())) {
    throw new Error('CONVERGENCE_INVENTORY_IDENTITY_INVALID');
  }
  const verifiedTargetReceiptCoverage = inventory.filter(x=>x.receiptCoverage==='VERIFIED').length;
  const phaseOrDateUnresolved = labels.filter(x=>x.status!=='DATE_CANDIDATE').length;
  const datedOutcomeCandidates=labels.filter(x=>x.status==='DATE_CANDIDATE' && x.candidateLaunchOn).length;
  for(const label of labels) if(label.candidateLaunchOn) parseIso(label.candidateLaunchOn);
  return {
    version:LAUNCH_CONVERGENCE_REPLAY_VERSION,totalTargets:targets.length,
    verifiedTargetReceiptCoverage,
    partialTargetReceiptCoverage:targets.length-verifiedTargetReceiptCoverage,
    datedOutcomeCandidates, phaseOrDateUnresolved,
    result:'INSUFFICIENT_DATA',
    cause: 'The preregistered replay efficacy gates require >=8 VERIFIED launchers, >=4 VERIFIED delayed controls and >=5 V0-positive delayed anchors; outcome-date candidates alone cannot satisfy evidence coverage or generate scores.'
  };
}

function parseIso(day:string):number {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('CONVERGENCE_DATE_INVALID');
  const d=Date.parse(day+'T00:00:00Z');
  if(!Number.isFinite(d) || new Date(d).toISOString().slice(0,10)!==day) {
    throw new Error('CONVERGENCE_DATE_INVALID');
  }
  return d;
}
