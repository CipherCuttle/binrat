export const SHADOW_ECONOMY_VERSION = 'BINRAT_SHADOW_ECONOMY_V0' as const;

export type ShadowPlan = 'FREE' | 'PRO';
export type ShadowPaymentAsset = 'FIAT' | 'USDC';
export type ShadowInvestigationKind =
  | 'FUNDING_SOURCE'
  | 'RELATED_WALLETS'
  | 'PREVIOUS_PROJECTS'
  | 'EARLY_BUYER_OVERLAP'
  | 'CUSTOM';

export interface ShadowEntitlement {
  version: typeof SHADOW_ECONOMY_VERSION;
  plan: ShadowPlan;
  watchLimit: number;
  priorLaunchDepth: number;
  advancedAlerts: boolean;
  exportEnabled: boolean;
  investigationRequestEnabled: boolean;
}

const ENTITLEMENTS: Readonly<Record<ShadowPlan, ShadowEntitlement>> = Object.freeze({
  FREE: Object.freeze({
    version: SHADOW_ECONOMY_VERSION,
    plan: 'FREE',
    watchLimit: 5,
    priorLaunchDepth: 5,
    advancedAlerts: false,
    exportEnabled: false,
    investigationRequestEnabled: true
  }),
  PRO: Object.freeze({
    version: SHADOW_ECONOMY_VERSION,
    plan: 'PRO',
    watchLimit: 25,
    priorLaunchDepth: 50,
    advancedAlerts: true,
    exportEnabled: true,
    investigationRequestEnabled: true
  })
});

export function shadowEntitlement(plan: ShadowPlan): ShadowEntitlement {
  return { ...ENTITLEMENTS[plan] };
}

export const SHADOW_PAYMENT_ASSETS: readonly ShadowPaymentAsset[] = Object.freeze(['FIAT', 'USDC']);

export type ShadowInvestigationState =
  | 'DRAFT'
  | 'QUOTED'
  | 'FUNDED'
  | 'ASSIGNED'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED';

export interface ShadowInvestigation {
  version: typeof SHADOW_ECONOMY_VERSION;
  requestId: string;
  principalId: string;
  chainId: number;
  launchId: string;
  kind: ShadowInvestigationKind;
  question: string;
  state: ShadowInvestigationState;
  quote?: {
    amountMinor: number;
    asset: ShadowPaymentAsset;
    expiresAtMs: number;
  };
  paymentReference?: string;
  investigatorId?: string;
  submissionId?: string;
  decisionId?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export type ShadowInvestigationEvent =
  | {
      type: 'QUOTE_ISSUED';
      eventId: string;
      occurredAtMs: number;
      amountMinor: number;
      asset: ShadowPaymentAsset;
      expiresAtMs: number;
    }
  | {
      type: 'PAYMENT_CONFIRMED';
      eventId: string;
      occurredAtMs: number;
      paymentReference: string;
    }
  | {
      type: 'ASSIGNED';
      eventId: string;
      occurredAtMs: number;
      investigatorId: string;
    }
  | {
      type: 'SUBMITTED';
      eventId: string;
      occurredAtMs: number;
      submissionId: string;
    }
  | {
      type: 'ACCEPTED';
      eventId: string;
      occurredAtMs: number;
      decisionId: string;
    }
  | {
      type: 'REJECTED';
      eventId: string;
      occurredAtMs: number;
      decisionId: string;
    }
  | {
      type: 'CANCELLED';
      eventId: string;
      occurredAtMs: number;
    };

export type ShadowEvidenceClass =
  | 'OBSERVED'
  | 'DERIVED'
  | 'SOURCE_REPORTED'
  | 'UNVERIFIED_CLAIM';

export interface ShadowEvidenceClaim {
  claimId: string;
  evidenceClass: ShadowEvidenceClass;
  statement: string;
  refs: readonly string[];
}

export function createShadowInvestigation(input: {
  requestId: string;
  principalId: string;
  chainId: number;
  launchId: string;
  kind: ShadowInvestigationKind;
  question: string;
  nowMs: number;
}): ShadowInvestigation {
  const requestId = boundedId(input.requestId, 'SHADOW_REQUEST_ID_INVALID');
  const principalId = boundedId(input.principalId, 'SHADOW_PRINCIPAL_ID_INVALID');
  if (!Number.isSafeInteger(input.chainId) || input.chainId < 1) throw new Error('SHADOW_CHAIN_INVALID');
  if (!/^[0-9a-f]{64}$/.test(input.launchId)) throw new Error('SHADOW_LAUNCH_ID_INVALID');
  const question = input.question.trim();
  if (question.length < 3 || question.length > 500) throw new Error('SHADOW_QUESTION_INVALID');
  validateTime(input.nowMs);

  return {
    version: SHADOW_ECONOMY_VERSION,
    requestId,
    principalId,
    chainId: input.chainId,
    launchId: input.launchId,
    kind: input.kind,
    question,
    state: 'DRAFT',
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs
  };
}

export function applyShadowInvestigationEvent(
  current: ShadowInvestigation,
  event: ShadowInvestigationEvent
): ShadowInvestigation {
  boundedId(event.eventId, 'SHADOW_EVENT_ID_INVALID');
  validateTime(event.occurredAtMs);
  if (event.occurredAtMs < current.updatedAtMs) throw new Error('SHADOW_EVENT_TIME_REGRESSION');

  switch (event.type) {
    case 'QUOTE_ISSUED': {
      requireState(current, 'DRAFT');
      if (!Number.isSafeInteger(event.amountMinor) || event.amountMinor < 1) {
        throw new Error('SHADOW_QUOTE_AMOUNT_INVALID');
      }
      if (!SHADOW_PAYMENT_ASSETS.includes(event.asset)) throw new Error('SHADOW_PAYMENT_ASSET_INVALID');
      if (!Number.isSafeInteger(event.expiresAtMs) || event.expiresAtMs <= event.occurredAtMs) {
        throw new Error('SHADOW_QUOTE_EXPIRY_INVALID');
      }
      return {
        ...current,
        state: 'QUOTED',
        quote: {
          amountMinor: event.amountMinor,
          asset: event.asset,
          expiresAtMs: event.expiresAtMs
        },
        updatedAtMs: event.occurredAtMs
      };
    }
    case 'PAYMENT_CONFIRMED': {
      requireState(current, 'QUOTED');
      if (!current.quote || event.occurredAtMs > current.quote.expiresAtMs) {
        throw new Error('SHADOW_QUOTE_EXPIRED');
      }
      return {
        ...current,
        state: 'FUNDED',
        paymentReference: boundedId(event.paymentReference, 'SHADOW_PAYMENT_REFERENCE_INVALID'),
        updatedAtMs: event.occurredAtMs
      };
    }
    case 'ASSIGNED': {
      requireState(current, 'FUNDED');
      return {
        ...current,
        state: 'ASSIGNED',
        investigatorId: boundedId(event.investigatorId, 'SHADOW_INVESTIGATOR_ID_INVALID'),
        updatedAtMs: event.occurredAtMs
      };
    }
    case 'SUBMITTED': {
      requireState(current, 'ASSIGNED');
      return {
        ...current,
        state: 'SUBMITTED',
        submissionId: boundedId(event.submissionId, 'SHADOW_SUBMISSION_ID_INVALID'),
        updatedAtMs: event.occurredAtMs
      };
    }
    case 'ACCEPTED':
    case 'REJECTED': {
      requireState(current, 'SUBMITTED');
      return {
        ...current,
        state: event.type,
        decisionId: boundedId(event.decisionId, 'SHADOW_DECISION_ID_INVALID'),
        updatedAtMs: event.occurredAtMs
      };
    }
    case 'CANCELLED': {
      if (current.state !== 'DRAFT' && current.state !== 'QUOTED') {
        throw new Error('SHADOW_FUNDED_CANCELLATION_REQUIRES_REFUND_FLOW');
      }
      return {
        ...current,
        state: 'CANCELLED',
        updatedAtMs: event.occurredAtMs
      };
    }
  }
}

export function validateShadowEvidenceClaim(claim: ShadowEvidenceClaim): ShadowEvidenceClaim {
  const claimId = boundedId(claim.claimId, 'SHADOW_CLAIM_ID_INVALID');
  const statement = claim.statement.trim();
  if (statement.length < 3 || statement.length > 1000) throw new Error('SHADOW_CLAIM_STATEMENT_INVALID');
  const refs = [...new Set(claim.refs.map((ref) => boundedId(ref, 'SHADOW_EVIDENCE_REF_INVALID')))];
  if (claim.evidenceClass !== 'UNVERIFIED_CLAIM' && refs.length === 0) {
    throw new Error('SHADOW_EVIDENCE_REF_REQUIRED');
  }
  return { claimId, evidenceClass: claim.evidenceClass, statement, refs };
}

export function canAutoPromoteShadowClaim(_claim: ShadowEvidenceClaim): false {
  // Shadow Economy V0 never turns contributor assertions into canonical BINRAT facts.
  // Acceptance means the job was accepted; canonical graph promotion is a separate reviewed process.
  return false;
}

function requireState(current: ShadowInvestigation, required: ShadowInvestigationState): void {
  if (current.state !== required) {
    throw new Error(`SHADOW_STATE_CONFLICT:${current.state}->${required}`);
  }
}

function boundedId(value: string, code: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9:._/-]{1,128}$/.test(normalized)) throw new Error(code);
  return normalized;
}

function validateTime(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('SHADOW_TIME_INVALID');
}
