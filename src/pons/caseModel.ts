import type { Hex } from '../core/types.js';
import { ROBINHOOD_CHAIN_ID } from './chain.js';

export const PONS_CASE_MODEL_VERSION = 'BINRAT_PONS_CASE_MODEL_V1' as const;

export type PonsCaseReasonCode =
  | 'REPEAT_DEPLOYER'
  | 'SAME_FUNDING_SOURCE'
  | 'OUTCOME_MEMORY';

export interface PonsCaseLaunchInput {
  launchId: string;
  token: Hex;
  deployer: Hex;
  canonicalName: string;
  canonicalSymbol: string;
}

export interface PonsCaseIdentityInput {
  name: string;
  symbol: string;
  decimals: number;
  evidenceDigest: string;
}

export interface PonsCaseHistoryInput {
  previousLaunches: number;
  launchesWithAnyMemory: number;
  launchesWithFullMemory: number;
  launchesPendingMemory: number;
  launchesStillImmature: number;
}

export interface PonsCaseFundingInput {
  currentFunding: null | {
    sourceAddress: Hex;
    transferTxHash: Hex;
    transferBlock: string;
    transferTimestampMs: number;
    valueWei: string;
  };
  sameFundingSource: null | {
    sourceAddress: Hex;
    distinctDeployersAtLeast: number;
    distinctLaunchesAtLeast: number;
  };
  recurrenceCoverage: {
    status: 'COMPLETE' | 'PARTIAL';
    verifiedReceipts: number;
    truncated: boolean;
  };
}

export interface PonsCaseReplayInput {
  semantics: 'KNOWABLE_AS_OF_BLOCK';
  available: boolean;
  receiptId: string | null;
}

export interface BuildPonsCaseModelInput {
  launch: PonsCaseLaunchInput;
  identity?: PonsCaseIdentityInput | null;
  history?: PonsCaseHistoryInput | null;
  funding?: PonsCaseFundingInput | null;
  replay?: PonsCaseReplayInput | null;
}

export interface PonsCaseReason {
  code: PonsCaseReasonCode;
  label: string;
  evidence: Record<string, string | number | boolean>;
  caveat: string | null;
}

export interface PonsCaseModel {
  caseVersion: typeof PONS_CASE_MODEL_VERSION;
  chainId: typeof ROBINHOOD_CHAIN_ID;
  launch: {
    launchId: string;
    token: Hex;
    deployer: Hex;
    label: string;
    labelSource: 'PERSISTED_TOKEN_IDENTITY' | 'CANONICAL_LAUNCH' | 'TOKEN_ADDRESS';
    identityEvidenceDigest: string | null;
  };
  reasons: PonsCaseReason[];
  rails: {
    identity: 'OBSERVED' | 'NO_RECEIPT_SUPPLIED';
    history: 'AVAILABLE' | 'NOT_SUPPLIED';
    funding: 'POSITIVE_EVIDENCE' | 'NO_POSITIVE_EVIDENCE_SUPPLIED';
    replay: 'AVAILABLE' | 'NOT_SUPPLIED';
  };
  handoffs: {
    trashTrail: boolean;
    replay: boolean;
    receipts: boolean;
  };
  boundaries: {
    noRiskScore: string;
    deployerIdentity: string;
    fundingIdentity: string;
    missingEvidence: string;
    outcomes: string;
    replay: string;
  };
}

export function buildPonsCaseModel(input: BuildPonsCaseModelInput): PonsCaseModel {
  assertLaunch(input.launch);
  if (input.identity) assertIdentity(input.identity);
  if (input.history) assertHistory(input.history);
  if (input.funding) assertFunding(input.funding);
  if (input.replay) assertReplay(input.replay);

  const reasons: PonsCaseReason[] = [];

  if (input.history && input.history.previousLaunches > 0) {
    reasons.push({
      code: 'REPEAT_DEPLOYER',
      label: `${input.history.previousLaunches} PRIOR LAUNCH${input.history.previousLaunches === 1 ? '' : 'ES'}`,
      evidence: {
        previousLaunches: input.history.previousLaunches
      },
      caveat: 'Exact source-reported deployer recurrence only.'
    });
  }

  const recurrence = input.funding?.sameFundingSource ?? null;
  if (recurrence) {
    reasons.push({
      code: 'SAME_FUNDING_SOURCE',
      label: 'SAME FUNDING SOURCE',
      evidence: {
        sourceAddress: normalizeHex(recurrence.sourceAddress),
        distinctDeployersAtLeast: recurrence.distinctDeployersAtLeast,
        distinctLaunchesAtLeast: recurrence.distinctLaunchesAtLeast,
        coverageStatus: input.funding!.recurrenceCoverage.status,
        coverageTruncated: input.funding!.recurrenceCoverage.truncated
      },
      caveat: 'Exact funding-address recurrence only; this does not establish common ownership, control, team, or person.'
    });
  }

  if (input.history && input.history.launchesWithAnyMemory > 0) {
    reasons.push({
      code: 'OUTCOME_MEMORY',
      label: `${input.history.launchesWithAnyMemory}/${input.history.previousLaunches} PRIOR LAUNCH${input.history.previousLaunches === 1 ? '' : 'ES'} WITH OUTCOME MEMORY`,
      evidence: {
        previousLaunches: input.history.previousLaunches,
        launchesWithAnyMemory: input.history.launchesWithAnyMemory,
        launchesWithFullMemory: input.history.launchesWithFullMemory,
        launchesPendingMemory: input.history.launchesPendingMemory,
        launchesStillImmature: input.history.launchesStillImmature
      },
      caveat: 'Observed historical outcomes are not predictions.'
    });
  }

  const replayAvailable = input.replay?.available === true;
  const fundingPositive = input.funding?.currentFunding !== null && input.funding?.currentFunding !== undefined;
  const receiptsAvailable =
    Boolean(input.identity?.evidenceDigest) ||
    input.history !== null && input.history !== undefined && input.history.launchesWithAnyMemory > 0 ||
    fundingPositive ||
    Boolean(input.replay?.receiptId);

  return {
    caseVersion: PONS_CASE_MODEL_VERSION,
    chainId: ROBINHOOD_CHAIN_ID,
    launch: {
      launchId: input.launch.launchId.toLowerCase(),
      token: normalizeHex(input.launch.token),
      deployer: normalizeHex(input.launch.deployer),
      ...displayLabel(input.launch, input.identity ?? null)
    },
    reasons,
    rails: {
      identity: input.identity ? 'OBSERVED' : 'NO_RECEIPT_SUPPLIED',
      history: input.history ? 'AVAILABLE' : 'NOT_SUPPLIED',
      funding: recurrence || fundingPositive ? 'POSITIVE_EVIDENCE' : 'NO_POSITIVE_EVIDENCE_SUPPLIED',
      replay: replayAvailable ? 'AVAILABLE' : 'NOT_SUPPLIED'
    },
    handoffs: {
      trashTrail: Boolean(input.history),
      replay: replayAvailable,
      receipts: receiptsAvailable
    },
    boundaries: {
      noRiskScore: 'Case reasons are factual evidence summaries, not a risk score, recommendation, or prediction.',
      deployerIdentity: 'The Pons-reported deployer is an onchain address role, not proof of a human identity.',
      fundingIdentity: 'A repeated funding source does not establish common ownership, control, team, or person.',
      missingEvidence: 'Missing optional evidence rails are not negative evidence and must not be presented as a clean bill of health.',
      outcomes: 'Historical outcome memory describes retained observations only and is not predictive.',
      replay: 'Replay availability means retained evidence can be reconstructed with KNOWABLE_AS_OF_BLOCK semantics; it does not prove historical wall-clock ingestion.'
    }
  };
}

function displayLabel(
  launch: PonsCaseLaunchInput,
  identity: PonsCaseIdentityInput | null
): Pick<PonsCaseModel['launch'], 'label' | 'labelSource' | 'identityEvidenceDigest'> {
  const identitySymbol = identity?.symbol.trim() ?? '';
  if (identitySymbol) {
    return {
      label: identitySymbol.startsWith('$') ? identitySymbol : `$${identitySymbol}`,
      labelSource: 'PERSISTED_TOKEN_IDENTITY',
      identityEvidenceDigest: identity!.evidenceDigest.toLowerCase()
    };
  }

  const identityName = identity?.name.trim() ?? '';
  if (identityName) {
    return {
      label: identityName,
      labelSource: 'PERSISTED_TOKEN_IDENTITY',
      identityEvidenceDigest: identity!.evidenceDigest.toLowerCase()
    };
  }

  const canonicalSymbol = launch.canonicalSymbol.trim();
  if (canonicalSymbol) {
    return {
      label: canonicalSymbol.startsWith('$') ? canonicalSymbol : `$${canonicalSymbol}`,
      labelSource: 'CANONICAL_LAUNCH',
      identityEvidenceDigest: null
    };
  }

  const canonicalName = launch.canonicalName.trim();
  if (canonicalName) {
    return {
      label: canonicalName,
      labelSource: 'CANONICAL_LAUNCH',
      identityEvidenceDigest: null
    };
  }

  return {
    label: shortAddress(launch.token),
    labelSource: 'TOKEN_ADDRESS',
    identityEvidenceDigest: null
  };
}

function assertLaunch(launch: PonsCaseLaunchInput): void {
  if (!/^[0-9a-f]{64}$/i.test(launch.launchId)) throw new Error('PONS_CASE_LAUNCH_ID_INVALID');
  assertAddress(launch.token, 'PONS_CASE_TOKEN_INVALID');
  assertAddress(launch.deployer, 'PONS_CASE_DEPLOYER_INVALID');
}

function assertIdentity(identity: PonsCaseIdentityInput): void {
  if (!Number.isSafeInteger(identity.decimals) || identity.decimals < 0 || identity.decimals > 255) {
    throw new Error('PONS_CASE_IDENTITY_DECIMALS_INVALID');
  }
  if (!/^[0-9a-f]{64}$/i.test(identity.evidenceDigest)) {
    throw new Error('PONS_CASE_IDENTITY_DIGEST_INVALID');
  }
}

function assertHistory(history: PonsCaseHistoryInput): void {
  for (const [key, value] of Object.entries(history)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`PONS_CASE_HISTORY_COUNT_INVALID:${key}`);
    }
  }
  if (
    history.launchesWithAnyMemory > history.previousLaunches ||
    history.launchesWithFullMemory > history.launchesWithAnyMemory ||
    history.launchesPendingMemory > history.previousLaunches ||
    history.launchesStillImmature > history.previousLaunches ||
    history.launchesWithAnyMemory + history.launchesPendingMemory + history.launchesStillImmature > history.previousLaunches
  ) {
    throw new Error('PONS_CASE_HISTORY_COUNT_OVERFLOW');
  }
}

function assertFunding(funding: PonsCaseFundingInput): void {
  if (!Number.isSafeInteger(funding.recurrenceCoverage.verifiedReceipts) || funding.recurrenceCoverage.verifiedReceipts < 0) {
    throw new Error('PONS_CASE_FUNDING_COVERAGE_INVALID');
  }
  if ((funding.recurrenceCoverage.status === 'PARTIAL') !== funding.recurrenceCoverage.truncated) {
    throw new Error('PONS_CASE_FUNDING_COVERAGE_STATE_INVALID');
  }
  if (funding.currentFunding) {
    assertAddress(funding.currentFunding.sourceAddress, 'PONS_CASE_FUNDING_SOURCE_INVALID');
    assertHash(funding.currentFunding.transferTxHash, 'PONS_CASE_FUNDING_TX_INVALID');
    assertUintString(funding.currentFunding.transferBlock, 'PONS_CASE_FUNDING_BLOCK_INVALID');
    assertUintString(funding.currentFunding.valueWei, 'PONS_CASE_FUNDING_VALUE_INVALID');
    if (!Number.isSafeInteger(funding.currentFunding.transferTimestampMs) || funding.currentFunding.transferTimestampMs < 0) {
      throw new Error('PONS_CASE_FUNDING_TIMESTAMP_INVALID');
    }
  }
  if (funding.sameFundingSource) {
    if (!funding.currentFunding) {
      throw new Error('PONS_CASE_FUNDING_RECURRENCE_WITHOUT_CURRENT');
    }
    assertAddress(funding.sameFundingSource.sourceAddress, 'PONS_CASE_FUNDING_RECURRENCE_SOURCE_INVALID');
    if (
      !Number.isSafeInteger(funding.sameFundingSource.distinctDeployersAtLeast) ||
      funding.sameFundingSource.distinctDeployersAtLeast < 2 ||
      !Number.isSafeInteger(funding.sameFundingSource.distinctLaunchesAtLeast) ||
      funding.sameFundingSource.distinctLaunchesAtLeast < 2
    ) {
      throw new Error('PONS_CASE_FUNDING_RECURRENCE_COUNT_INVALID');
    }
    if (funding.recurrenceCoverage.verifiedReceipts < funding.sameFundingSource.distinctLaunchesAtLeast) {
      throw new Error('PONS_CASE_FUNDING_RECURRENCE_COVERAGE_INVALID');
    }
    if (
      normalizeHex(funding.currentFunding.sourceAddress) !== normalizeHex(funding.sameFundingSource.sourceAddress)
    ) {
      throw new Error('PONS_CASE_FUNDING_SOURCE_MISMATCH');
    }
  }
}

function assertReplay(replay: PonsCaseReplayInput): void {
  if (replay.semantics !== 'KNOWABLE_AS_OF_BLOCK') throw new Error('PONS_CASE_REPLAY_SEMANTICS_INVALID');
  if (replay.receiptId !== null && !/^binrat-pons-replay:[0-9a-f]{64}$/i.test(replay.receiptId)) {
    throw new Error('PONS_CASE_REPLAY_RECEIPT_INVALID');
  }
  if (!replay.available && replay.receiptId !== null) {
    throw new Error('PONS_CASE_REPLAY_RECEIPT_WITHOUT_AVAILABILITY');
  }
}

function assertAddress(value: string, error: string): void {
  if (!/^0x[0-9a-f]{40}$/i.test(value)) throw new Error(error);
}

function assertHash(value: string, error: string): void {
  if (!/^0x[0-9a-f]{64}$/i.test(value)) throw new Error(error);
}

function assertUintString(value: string, error: string): void {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(error);
}

function normalizeHex<T extends Hex>(value: T): T {
  return value.toLowerCase() as T;
}

function shortAddress(value: string): string {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}
