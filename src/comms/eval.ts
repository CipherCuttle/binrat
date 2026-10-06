import type {
  ClaimViolation,
  CommsDecisionKind,
  CommsEvent,
  ShadowPostBundle,
} from './commsRat.js';
import type { ModelDraftAttempt } from './modelWriter.js';

export interface CommsEvalForbiddenClaim {
  code: string;
  pattern: string;
  flags?: string;
}

export interface CommsEvalSource {
  pr: number;
  title: string;
  headSha: string;
}

export interface CommsEvalCase {
  id: string;
  source: CommsEvalSource;
  event: CommsEvent;
  expectedDecision: CommsDecisionKind;
  requiredReceiptRefs: string[];
  forbiddenClaims: CommsEvalForbiddenClaim[];
}

export interface CommsEvalCaseResult {
  id: string;
  source: CommsEvalSource;
  providerCallSucceeded: boolean;
  draftContractPass: boolean;
  modelCallSucceeded: boolean;
  decision: CommsDecisionKind | null;
  expectedDecision: CommsDecisionKind;
  decisionMatches: boolean;
  receiptPresent: boolean;
  capabilityUpgradeCount: number;
  bannedLanguageCount: number;
  forbiddenClaims: string[];
  hardFidelityPass: boolean;
  automaticCandidate: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
  rawOutput: string | null;
  x: string | null;
  telegram: string | null;
  error: string | null;
}

export interface CommsEvalSummary {
  schemaVersion: 'binrat.comms-eval-summary/1';
  totalCases: number;
  providerCallSuccesses: number;
  draftContractPasses: number;
  modelCallSuccesses: number;
  hardFidelityPasses: number;
  receiptPasses: number;
  automaticCandidates: number;
  unsupportedClaimFailures: number;
  decisionMismatches: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  maxCaseDurationMs: number;
  manualEditReviewRequired: boolean;
  autonomyVerdict:
    | 'BLOCKED_PROVIDER_FAILURE'
    | 'BLOCKED_OUTPUT_CONTRACT'
    | 'BLOCKED_UNSUPPORTED_CLAIMS'
    | 'BLOCKED_AUTOMATIC_QUALITY'
    | 'MANUAL_EDIT_REVIEW_REQUIRED';
}

function negatedAt(text: string, index: number): boolean {
  const prefix = text.slice(Math.max(0, index - 48), index).toLowerCase();
  return (
    /\b(?:not|never|no)\s+(?:(?:yet|currently|publicly|actually|being|considered|claimed|proven|validated|ready|available)\s+){0,3}$/.test(prefix) ||
    /\bisn['’]?t\s+(?:(?:yet|currently|publicly|actually|being|considered|claimed|proven|validated|ready|available)\s+){0,3}$/.test(prefix) ||
    /\bdoes(?:\s+not|n['’]?t)\s+(?:(?:prove|establish|show|mean|claim)\s+){0,2}(?:(?:a|the|this|that|our|their|his|her|its)\s+)?$/.test(prefix) ||
    /\bwithout\s+(?:(?:being|proving|establishing)\s+){0,2}$/.test(prefix)
  );
}

function hasAffirmativePattern(
  text: string,
  claim: CommsEvalForbiddenClaim,
): boolean {
  const flags = claim.flags ?? 'i';
  const globalFlags = flags.includes('g') ? flags : flags + 'g';
  const pattern = new RegExp(claim.pattern, globalFlags);

  for (const match of text.matchAll(pattern)) {
    if (!negatedAt(text, match.index ?? 0)) return true;
  }
  return false;
}

function countViolation(
  violations: ClaimViolation[],
  code: ClaimViolation['code'],
): number {
  return violations.filter((item) => item.code === code).length;
}

function hasReceipt(bundle: ShadowPostBundle, refs: string[]): boolean {
  const text = (bundle.drafts.x + '\n' + bundle.drafts.telegram).toLowerCase();
  return refs.some((ref) => text.includes(ref.toLowerCase()));
}

export function evaluateCommsDraftAttempt(
  testCase: CommsEvalCase,
  attempt: ModelDraftAttempt,
  durationMs: number | null = null,
): CommsEvalCaseResult {
  const text = attempt.bundle.drafts.x + '\n' + attempt.bundle.drafts.telegram;
  const forbiddenClaims = testCase.forbiddenClaims
    .filter((claim) => hasAffirmativePattern(text, claim))
    .map((claim) => claim.code);

  const capabilityUpgradeCount = countViolation(
    attempt.bundle.violations,
    'CAPABILITY_STATUS_UPGRADE',
  );
  const bannedLanguageCount = countViolation(
    attempt.bundle.violations,
    'BANNED_LANGUAGE',
  );
  const receiptPresent = hasReceipt(
    attempt.bundle,
    testCase.requiredReceiptRefs,
  );
  const decisionMatches = attempt.bundle.decision === testCase.expectedDecision;
  const hardFidelityPass =
    capabilityUpgradeCount === 0 && forbiddenClaims.length === 0;
  const automaticCandidate =
    hardFidelityPass &&
    bannedLanguageCount === 0 &&
    receiptPresent &&
    decisionMatches;

  return {
    id: testCase.id,
    source: testCase.source,
    providerCallSucceeded: true,
    draftContractPass: true,
    modelCallSucceeded: true,
    decision: attempt.bundle.decision,
    expectedDecision: testCase.expectedDecision,
    decisionMatches,
    receiptPresent,
    capabilityUpgradeCount,
    bannedLanguageCount,
    forbiddenClaims,
    hardFidelityPass,
    automaticCandidate,
    inputTokens: attempt.writerReceipt.usage?.inputTokens ?? null,
    outputTokens: attempt.writerReceipt.usage?.outputTokens ?? null,
    durationMs,
    rawOutput: null,
    x: attempt.bundle.drafts.x,
    telegram: attempt.bundle.drafts.telegram,
    error: null,
  };
}

export interface FailedCommsEvalOptions {
  providerCallSucceeded?: boolean;
  inputTokens?: number | null;
  outputTokens?: number | null;
  durationMs?: number | null;
  rawOutput?: string | null;
}

export function failedCommsEvalCase(
  testCase: CommsEvalCase,
  error: string,
  options: FailedCommsEvalOptions = {},
): CommsEvalCaseResult {
  const providerCallSucceeded = options.providerCallSucceeded ?? false;
  return {
    id: testCase.id,
    source: testCase.source,
    providerCallSucceeded,
    draftContractPass: false,
    modelCallSucceeded: false,
    decision: null,
    expectedDecision: testCase.expectedDecision,
    decisionMatches: false,
    receiptPresent: false,
    capabilityUpgradeCount: 0,
    bannedLanguageCount: 0,
    forbiddenClaims: [],
    hardFidelityPass: false,
    automaticCandidate: false,
    inputTokens: options.inputTokens ?? null,
    outputTokens: options.outputTokens ?? null,
    durationMs: options.durationMs ?? null,
    rawOutput: options.rawOutput ?? null,
    x: null,
    telegram: null,
    error,
  };
}

export function summarizeCommsEval(
  results: CommsEvalCaseResult[],
): CommsEvalSummary {
  const providerCallSuccesses = results.filter(
    (item) => item.providerCallSucceeded,
  ).length;
  const draftContractPasses = results.filter(
    (item) => item.draftContractPass,
  ).length;
  const modelCallSuccesses = draftContractPasses;
  const hardFidelityPasses = results.filter((item) => item.hardFidelityPass).length;
  const receiptPasses = results.filter((item) => item.receiptPresent).length;
  const automaticCandidates = results.filter((item) => item.automaticCandidate).length;
  const unsupportedClaimFailures = results.filter(
    (item) => item.capabilityUpgradeCount > 0 || item.forbiddenClaims.length > 0,
  ).length;
  const decisionMismatches = results.filter(
    (item) => item.draftContractPass && !item.decisionMatches,
  ).length;
  const totalInputTokens = results.reduce(
    (sum, item) => sum + (item.inputTokens ?? 0),
    0,
  );
  const totalOutputTokens = results.reduce(
    (sum, item) => sum + (item.outputTokens ?? 0),
    0,
  );
  const maxCaseDurationMs = results.reduce(
    (max, item) => Math.max(max, item.durationMs ?? 0),
    0,
  );

  let autonomyVerdict: CommsEvalSummary['autonomyVerdict'];
  if (providerCallSuccesses !== results.length) {
    autonomyVerdict = 'BLOCKED_PROVIDER_FAILURE';
  } else if (draftContractPasses !== results.length) {
    autonomyVerdict = 'BLOCKED_OUTPUT_CONTRACT';
  } else if (unsupportedClaimFailures > 0) {
    autonomyVerdict = 'BLOCKED_UNSUPPORTED_CLAIMS';
  } else if (
    results.length === 0 ||
    automaticCandidates / results.length < 0.7
  ) {
    autonomyVerdict = 'BLOCKED_AUTOMATIC_QUALITY';
  } else {
    autonomyVerdict = 'MANUAL_EDIT_REVIEW_REQUIRED';
  }

  return {
    schemaVersion: 'binrat.comms-eval-summary/1',
    totalCases: results.length,
    providerCallSuccesses,
    draftContractPasses,
    modelCallSuccesses,
    hardFidelityPasses,
    receiptPasses,
    automaticCandidates,
    unsupportedClaimFailures,
    decisionMismatches,
    totalInputTokens,
    totalOutputTokens,
    maxCaseDurationMs,
    manualEditReviewRequired: true,
    autonomyVerdict,
  };
}
