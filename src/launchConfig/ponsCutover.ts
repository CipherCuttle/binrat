import {
  BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS,
  BINRAT_TREASURY_ADDRESS,
  LAUNCH_CONFIG_DIGEST
} from './config.js';
import { PONS_AUTH_POLICY } from '../cloudflare/ponsCandidateAuth.js';

/**
 * Separate selection record. This version deliberately cannot represent
 * LAUNCHED, verified treasury custody, active accounting or HOLDER access.
 * A later production transition requires a separately reviewed schema.
 */
export const PONS_CUTOVER_SCHEMA = 'binrat.pons-successor/1' as const;
export const PONS_SELECTED_FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e' as const;
export const PONS_SELECTION_DOCUMENT = 'docs/BINRAT_PONS_LAUNCH_SELECTION_V1.json' as const;

export interface PonsSuccessorCandidate {
  schemaVersion: typeof PONS_CUTOVER_SCHEMA;
  status: 'SELECTED_CANDIDATE_BLOCKED';
  selectionDocument: typeof PONS_SELECTION_DOCUMENT;
  tokenChainId: 4663;
  tokenLaunchRail: 'PONS_V2_DIRECT_FACTORY';
  ponsFactory: typeof PONS_SELECTED_FACTORY;
  researchChainId: 5042;
  historicalArcConfigDigest: typeof LAUNCH_CONFIG_DIGEST;
  historicalArcRoles: 'HISTORICAL_ONLY_NOT_PONS';
  tokenAddress: null;
  deployer: null;
  creatorFeeRecipient: null;
  treasury: null;
  holderLoginPolicyId: typeof PONS_AUTH_POLICY;
  holderBalancePolicyId: null;
  holderThresholdRaw: null;
  holderAccessActive: false;
  accountingActive: false;
  freshPonsReceiptVerified: false;
  legalComplianceSatisfied: false;
  marketingAuthorized: false;
  launchAuthorized: false;
  ownerAuthority: 'NOT_GRANTED';
}

export interface PonsCutoverCandidateView {
  status: 'BLOCKED_PENDING_VERIFIED_PONS_AUTHORITY';
  tokenNetwork: { chainId: 4663; rail: 'PONS_V2_DIRECT_FACTORY'; factory: typeof PONS_SELECTED_FACTORY };
  researchNetwork: { chainId: 5042; purpose: 'ARC_RESEARCH_ONLY' };
  historicalArc: { configDigest: typeof LAUNCH_CONFIG_DIGEST; roles: 'HISTORICAL_ONLY_NOT_PONS' };
  tokenAddress: null;
  ownerRoles: { deployer: null; creatorFeeRecipient: null; treasury: null };
  holder: {
    loginPolicyId: typeof PONS_AUTH_POLICY;
    balancePolicyId: null;
    thresholdRaw: null;
    holderAccessGranted: false;
  };
  funding: { creatorFeeRecipient: null; treasury: null; observerActive: false };
  marketingAuthorized: false;
  launchAuthorized: false;
  blockers: readonly string[];
}

const SUCCESSOR_KEYS = [
  'schemaVersion', 'status', 'selectionDocument', 'tokenChainId',
  'tokenLaunchRail', 'ponsFactory', 'researchChainId',
  'historicalArcConfigDigest', 'historicalArcRoles',
  'tokenAddress', 'deployer', 'creatorFeeRecipient', 'treasury',
  'holderLoginPolicyId', 'holderBalancePolicyId', 'holderThresholdRaw',
  'holderAccessActive', 'accountingActive', 'freshPonsReceiptVerified',
  'legalComplianceSatisfied', 'marketingAuthorized',
  'launchAuthorized', 'ownerAuthority'
].sort();

function object(value: unknown, error: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(error);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], error: string): void {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    throw new Error(error);
  }
}

export function validatePonsSuccessorCandidate(value: unknown): PonsSuccessorCandidate {
  const p = object(value, 'PONS_SUCCESSOR_INVALID');
  exactKeys(p, SUCCESSOR_KEYS, 'PONS_SUCCESSOR_UNEXPECTED_FIELDS');
  if (
    p.schemaVersion !== PONS_CUTOVER_SCHEMA ||
    p.status !== 'SELECTED_CANDIDATE_BLOCKED' ||
    p.selectionDocument !== PONS_SELECTION_DOCUMENT ||
    p.tokenChainId !== 4663 ||
    p.tokenLaunchRail !== 'PONS_V2_DIRECT_FACTORY' ||
    p.ponsFactory !== PONS_SELECTED_FACTORY ||
    p.researchChainId !== 5042 ||
    p.historicalArcConfigDigest !== LAUNCH_CONFIG_DIGEST ||
    p.historicalArcRoles !== 'HISTORICAL_ONLY_NOT_PONS' ||
    p.tokenAddress !== null ||
    p.deployer !== null ||
    p.creatorFeeRecipient !== null ||
    p.treasury !== null ||
    p.holderLoginPolicyId !== PONS_AUTH_POLICY ||
    p.holderBalancePolicyId !== null ||
    p.holderThresholdRaw !== null ||
    p.holderAccessActive !== false ||
    p.accountingActive !== false ||
    p.freshPonsReceiptVerified !== false ||
    p.legalComplianceSatisfied !== false ||
    p.marketingAuthorized !== false ||
    p.launchAuthorized !== false ||
    p.ownerAuthority !== 'NOT_GRANTED'
  ) throw new Error('PONS_SUCCESSOR_AUTHORITY_ESCALATION');
  return p as unknown as PonsSuccessorCandidate;
}

/**
 * Read-only migration check: reconcile the frozen Arc V0 legacy artifact,
 * documented Pons selection, and optional manifest successor. Any changed
 * source fails closed; an omitted successor is not an implicit activation.
 */
export function evaluatePonsCutoverCandidate(
  selection: unknown,
  manifest: unknown
): PonsCutoverCandidateView {
  const s = object(selection, 'PONS_SELECTION_INVALID');
  const m = object(manifest, 'PONS_MANIFEST_INVALID');
  const selected = object(s.selectedTokenNetwork, 'PONS_SELECTION_INVALID');
  const research = object(s.researchNetwork, 'PONS_SELECTION_INVALID');
  const old = object(s.historicalSupersededCandidate, 'PONS_SELECTION_INVALID');
  const evidence = object(s.readOnlyEvidence, 'PONS_SELECTION_INVALID');
  const policy = object(s.candidatePolicy, 'PONS_SELECTION_INVALID');
  const observed = object(s.observedSnapshotNotFutureGuarantee, 'PONS_SELECTION_INVALID');
  const inputs = object(s.ownerInputs, 'PONS_SELECTION_INVALID');
  const token = object(s.token, 'PONS_SELECTION_INVALID');
  const holder = object(s.holderEntitlement, 'PONS_SELECTION_INVALID');
  const funding = object(s.funding, 'PONS_SELECTION_INVALID');
  const authority = object(s.authorization, 'PONS_SELECTION_INVALID');
  const launch = object(m.launchAuthorization, 'PONS_MANIFEST_INVALID');
  const legacy = object(m.launchConfiguration, 'PONS_LEGACY_CONFIG_MISSING');

  // The live production manifest is still V0 and BLOCKED. These old addresses
  // are known *historical* declarations, not inferred Robinhood custody.
  if (
    m.schemaVersion !== 'binrat.capability-manifest/0.1' ||
    legacy.configDigest !== LAUNCH_CONFIG_DIGEST ||
    legacy.treasuryAddress !== BINRAT_TREASURY_ADDRESS ||
    legacy.projectFeeRecipientAddress !== BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS ||
    legacy.accountingActive !== false ||
    legacy.tokenAddressState !== 'NOT_YET_CREATED' ||
    launch.status !== 'BLOCKED' ||
    launch.tokenState !== 'NOT_LAUNCHED' ||
    launch.marketingAuthorized !== false ||
    launch.launchAuthorized !== false
  ) throw new Error('PONS_CUTOVER_LEGACY_STATUS_CONTRADICTION');
  const successor = validatePonsSuccessorCandidate(m.tokenLaunchSuccessor);

  if (
    s.schemaVersion !== 'binrat.pons-launch-selection/1.0' ||
    s.documentStatus !== 'OWNER_SELECTED_PLANNING_CANDIDATE_NOT_RUNTIME_AUTHORITY' ||
    selected.chainId !== successor.tokenChainId ||
    selected.rail !== 'Pons V2 direct factory' ||
    selected.factory !== successor.ponsFactory ||
    research.chainId !== successor.researchChainId ||
    old.path !== 'docs/BINRAT_LAUNCH_CONFIG_V0.json' ||
    old.digest !== successor.historicalArcConfigDigest ||
    old.status !== 'FROZEN_HISTORICAL_EVIDENCE_NOT_TO_BE_REWRITTEN' ||
    evidence.status !== 'READ_ONLY_SNAPSHOT_NOT_LAUNCH_AUTHORITY' ||
    evidence.currentSnapshotMustBeRefreshed !== true ||
    policy.configId !== 0 ||
    policy.pair !== 'NATIVE_ETH' ||
    policy.creatorTaxBps !== 0 ||
    policy.buybackEnabled !== false ||
    !Array.isArray(policy.extraOpeningTaxExemptions) ||
    policy.extraOpeningTaxExemptions.length !== 0 ||
    policy.founderOpeningBuy !== false ||
    policy.directFactoryLaunch !== true ||
    policy.privatePresalePlanned !== false ||
    policy.discountedInsiderRoundPlanned !== false ||
    policy.hiddenTeamAllocationPlanned !== false ||
    observed.needsFreshOnchainCheck !== true ||
    inputs.deployer !== null ||
    inputs.creatorFeeRecipient !== null ||
    inputs.treasury !== null ||
    inputs.launchSalt !== null ||
    inputs.finalTokenMetadata !== null ||
    inputs.verifiedWebsite !== null ||
    inputs.verifiedTelegram !== null ||
    inputs.verifiedX !== null ||
    inputs.ownerCustodyProofStatus !== 'NOT_SUPPLIED' ||
    inputs.doNotInheritArcRoleAddressesSilently !== true ||
    token.status !== 'NOT_LAUNCHED' ||
    token.address !== null ||
    token.transaction !== null ||
    token.launchBlock !== null ||
    holder.balanceChainId !== 4663 ||
    holder.researchChainId !== 5042 ||
    holder.thresholdRaw !== null ||
    holder.eligibilityActive !== false ||
    holder.walletAuthStatus !== 'NOT_ACTIVATED' ||
    holder.balanceSourceStatus !== 'NOT_REVIEWED' ||
    holder.publicEvidenceRemainsFree !== true ||
    funding.feeRevenueSource !== 'DISCLOSED_PONS_CREATOR_FEE_SHARE_NOT_CURVE_PROCEEDS' ||
    funding.productionObserverStatus !== 'NOT_ACTIVATED' ||
    funding.forecastedRevenue !== null ||
    authority.legalComplianceSatisfied !== false ||
    authority.marketingAuthorized !== false ||
    authority.launchAuthorized !== false ||
    authority.mergeAuthorized !== false ||
    authority.ownerLaunchAuthority !== 'NOT_GRANTED'
  ) throw new Error('PONS_CUTOVER_SELECTION_CONTRADICTION');

  return {
    status: 'BLOCKED_PENDING_VERIFIED_PONS_AUTHORITY',
    tokenNetwork: { chainId: 4663, rail: 'PONS_V2_DIRECT_FACTORY', factory: PONS_SELECTED_FACTORY },
    researchNetwork: { chainId: 5042, purpose: 'ARC_RESEARCH_ONLY' },
    historicalArc: {
      configDigest: LAUNCH_CONFIG_DIGEST, roles: 'HISTORICAL_ONLY_NOT_PONS'
    },
    tokenAddress: null,
    ownerRoles: { deployer: null, creatorFeeRecipient: null, treasury: null },
    holder: {
      loginPolicyId: PONS_AUTH_POLICY, balancePolicyId: null,
      thresholdRaw: null, holderAccessGranted: false
    },
    funding: { creatorFeeRecipient: null, treasury: null, observerActive: false },
    marketingAuthorized: false,
    launchAuthorized: false,
    blockers: Object.freeze([
      'FRESH_PONS_ONCHAIN_RECEIPT_REQUIRED',
      'DEPLOYER_AND_FEE_RECIPIENT_CUSTODY_UNVERIFIED',
      'PONS_TOKEN_NOT_LAUNCHED',
      'ROBINHOOD_HOLDER_BALANCE_POLICY_NOT_APPROVED',
      'PONS_FUNDING_OBSERVER_NOT_REVIEWED',
      'LEGAL_AND_SECURITY_REVIEW_NOT_SATISFIED',
      'CROSS_SURFACE_PUBLIC_STATUS_CUTOVER_NOT_AUTHORIZED',
      'EXPLICIT_OWNER_LAUNCH_AUTHORITY_NOT_GRANTED'
    ])
  };
}
