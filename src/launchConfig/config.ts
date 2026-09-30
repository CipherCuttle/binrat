import { getAddress, isAddress } from 'viem';
import { sha256Hex } from '../evidence/canonical.js';

export const LAUNCH_CONFIG_SCHEMA_VERSION = 'binrat.launch-config/0.1' as const;
export const LAUNCH_EXECUTION_SCHEMA_VERSION = 'binrat.launch-execution-receipt/0.1' as const;
export const LAUNCH_MECHANICS_RECEIPT_DIGEST =
  'aff37d6d82cced00a34284453c0327bb51e5624b5761b621264f55602e8245e6' as const;
export const LAUNCH_CONFIG_DIGEST =
  'f631e43287a3bcb6a6da6a7f405d1ad2e3b17c9648b5928dc7c8a3a32890e1f8' as const;
export const BINRAT_TREASURY_ADDRESS =
  '0xab063A9b53a2Ab832a941aE5890ea05c1672339D' as const;
export const BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS =
  '0xba5Ee49734b50Cf62d0B538584fbaC0eFFB79866' as const;
export const ARCPAD_PROTOCOL_TREASURY_ADDRESS =
  '0xa71200705Ed02c5837961b5331EaC119Ecd37746' as const;
export const ARCPAD_LAUNCHER_OWNER_ADDRESS =
  '0x0F7972E8012EEEF3c4fd8084A2739D802f8bFA7f' as const;

export const CONFIGURED_PRODUCTION_AUTHORITIES = Object.freeze({
  status: 'OWNER_SELECTED_PRE_LAUNCH' as const,
  treasury: Object.freeze({ role: 'TREASURY' as const, address: BINRAT_TREASURY_ADDRESS }),
  projectFeeRecipient: Object.freeze({
    role: 'PROJECT_FEE_RECIPIENT' as const,
    address: BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS
  }),
  custodyEvidence: 'OWNER_DECLARATION_ONLY' as const,
  onChainRoleProof: 'NOT_YET_AVAILABLE' as const
});

export interface LaunchConfigV0 {
  schemaVersion: typeof LAUNCH_CONFIG_SCHEMA_VERSION;
  configVersion: 'BINRAT_LAUNCH_CONFIG_V0';
  chainId: 5042;
  configDigest: string;
  [key: string]: unknown;
}

export interface LaunchExecutionReceipt {
  schemaVersion: typeof LAUNCH_EXECUTION_SCHEMA_VERSION;
  executionStatus: 'EXECUTED';
  validationStatus: 'PASS';
  receiptDigest: string;
  [key: string]: unknown;
}

export async function deriveLaunchConfigDigest(value: unknown): Promise<string> {
  const input = record(value, 'LAUNCH_CONFIG_INVALID');
  const { configDigest: _configDigest, ...material } = input;
  return sha256Hex(material);
}

export async function validateLaunchConfig(value: unknown): Promise<LaunchConfigV0> {
  const input = record(value, 'LAUNCH_CONFIG_INVALID');
  if (
    input.schemaVersion !== LAUNCH_CONFIG_SCHEMA_VERSION ||
    input.configVersion !== 'BINRAT_LAUNCH_CONFIG_V0' ||
    input.frozenOn !== '2026-09-21' ||
    input.chainId !== 5042
  ) throw new Error('LAUNCH_CONFIG_INVALID');
  digest(input.configDigest, 'LAUNCH_CONFIG_DIGEST_INVALID');

  const rail = record(input.launchRail, 'LAUNCH_CONFIG_RAIL_INVALID');
  const mechanics = record(rail.launchMechanicsReceipt, 'LAUNCH_CONFIG_MECHANICS_INVALID');
  if (
    rail.railId !== 'arcpad-arc-mainnet-usdc-standard-v0' ||
    rail.mode !== 'STANDARD_CREATOR_REWARDS' ||
    mechanics.digest !== LAUNCH_MECHANICS_RECEIPT_DIGEST ||
    mechanics.path !== 'docs/LAUNCH_MECHANICS_VERIFICATION_V0.json'
  ) throw new Error('LAUNCH_CONFIG_MECHANICS_INVALID');

  const authorities = record(input.authorities, 'LAUNCH_CONFIG_AUTHORITIES_INVALID');
  const treasury = roleAddress(authorities.treasury, 'TREASURY');
  const fee = roleAddress(authorities.projectFeeRecipient, 'PROJECT_FEE_RECIPIENT');
  if (treasury !== BINRAT_TREASURY_ADDRESS || fee !== BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS) {
    throw new Error('LAUNCH_CONFIG_ROLE_BINDING_INVALID');
  }
  const protectedAuthorities = [ARCPAD_PROTOCOL_TREASURY_ADDRESS, ARCPAD_LAUNCHER_OWNER_ADDRESS]
    .map((address) => address.toLowerCase());
  if (treasury.toLowerCase() === fee.toLowerCase()) throw new Error('LAUNCH_CONFIG_ROLES_AMBIGUOUS');
  if (protectedAuthorities.includes(treasury.toLowerCase()) || protectedAuthorities.includes(fee.toLowerCase())) {
    throw new Error('LAUNCH_CONFIG_PROTOCOL_AUTHORITY_CONFUSION');
  }
  if (
    authorities.roleBinding !== 'EXPLICIT_NON_INTERCHANGEABLE' ||
    authorities.custodyEvidence !== 'OWNER_DECLARATION_ONLY' ||
    authorities.onChainRoleProof !== 'NOT_YET_AVAILABLE'
  ) throw new Error('LAUNCH_CONFIG_AUTHORITIES_INVALID');

  const policy = record(input.launchPolicy, 'LAUNCH_CONFIG_POLICY_INVALID');
  if (
    policy.privatePresale !== 'NONE' ||
    policy.discountedInsiderRound !== 'NONE' ||
    policy.hiddenTeamAllocation !== 'NONE' ||
    policy.privilegedCreatorFirstBuy !== 'DISABLED' ||
    policy.founderProjectPrivilegedLaunchAllocation !== 'NONE' ||
    policy.founderProjectLaunchBlockPrivilegedPurchase !== 'NONE' ||
    policy.founderProjectPublicMarketPurchaseAtLaunch !== 'NOT_PLANNED_FOR_LAUNCH'
  ) throw new Error('LAUNCH_CONFIG_POLICY_INVALID');

  validateInactiveState(input);
  const actualDigest = await deriveLaunchConfigDigest(input);
  if (input.configDigest !== actualDigest || actualDigest !== LAUNCH_CONFIG_DIGEST) {
    throw new Error('LAUNCH_CONFIG_DIGEST_MISMATCH');
  }
  return input as unknown as LaunchConfigV0;
}

export function validateLaunchStatusConsistency(
  launchConfig: LaunchConfigV0,
  manifest: unknown
): void {
  const root = record(manifest, 'LAUNCH_STATUS_MANIFEST_INVALID');
  const launch = record(root.launchAuthorization, 'LAUNCH_STATUS_MANIFEST_INVALID');
  const configured = record(root.launchConfiguration, 'LAUNCH_STATUS_MANIFEST_INVALID');
  if (
    launch.status !== 'BLOCKED' ||
    launch.launchAuthorized !== false ||
    launch.marketingAuthorized !== false ||
    launch.tokenState !== 'NOT_LAUNCHED' ||
    launch.explicitOwnerLaunchAuthorityState !== 'NOT_GRANTED' ||
    configured.configDigest !== launchConfig.configDigest ||
    configured.treasuryAddress !== BINRAT_TREASURY_ADDRESS ||
    configured.projectFeeRecipientAddress !== BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS ||
    configured.tokenAddressState !== 'NOT_YET_CREATED' ||
    configured.accountingActive !== false ||
    configured.holderGateStatus !== 'TOKEN_AUTHORITY_NOT_CONFIGURED'
  ) throw new Error('LAUNCH_STATUS_CONTRADICTION');
}

export async function deriveLaunchExecutionReceiptDigest(value: unknown): Promise<string> {
  const input = record(value, 'LAUNCH_EXECUTION_RECEIPT_INVALID');
  const { receiptDigest: _receiptDigest, ...material } = input;
  return sha256Hex(material);
}

export async function validateLaunchExecutionReceipt(value: unknown): Promise<LaunchExecutionReceipt> {
  const input = record(value, 'LAUNCH_EXECUTION_RECEIPT_INVALID');
  if (input.schemaVersion !== LAUNCH_EXECUTION_SCHEMA_VERSION) {
    throw new Error('LAUNCH_EXECUTION_SCHEMA_INVALID');
  }
  if (input.executionStatus !== 'EXECUTED' || input.validationStatus !== 'PASS') {
    throw new Error('LAUNCH_EXECUTION_NOT_EXECUTED');
  }
  if (input.chainId !== 5042) throw new Error('LAUNCH_EXECUTION_CHAIN_INVALID');
  checksumAddress(input.tokenAddress, 'LAUNCH_EXECUTION_TOKEN_ADDRESS_MISSING');
  hash(input.launchTransaction, 'LAUNCH_EXECUTION_TRANSACTION_MISSING');
  positiveInteger(input.launchBlock, 'LAUNCH_EXECUTION_BLOCK_MISSING');
  hash(input.launchBlockHash, 'LAUNCH_EXECUTION_BLOCK_HASH_MISSING');

  const supply = record(input.tokenSupply, 'LAUNCH_EXECUTION_SUPPLY_MISSING');
  positiveRaw(supply.raw, 'LAUNCH_EXECUTION_SUPPLY_MISSING');
  if (!Number.isInteger(supply.decimals) || Number(supply.decimals) < 0 || Number(supply.decimals) > 255) {
    throw new Error('LAUNCH_EXECUTION_SUPPLY_MISSING');
  }
  checksumAddress(record(input.pool, 'LAUNCH_EXECUTION_POOL_MISSING').address, 'LAUNCH_EXECUTION_POOL_MISSING');
  const position = record(input.liquidityPosition, 'LAUNCH_EXECUTION_POSITION_MISSING');
  positiveRaw(position.positionId, 'LAUNCH_EXECUTION_POSITION_MISSING');
  hash(position.mintTransaction, 'LAUNCH_EXECUTION_POSITION_MISSING');
  checksumAddress(input.lockerAddress, 'LAUNCH_EXECUTION_LOCKER_MISSING');

  const authorities = record(input.authorities, 'LAUNCH_EXECUTION_AUTHORITIES_INVALID');
  if (
    roleAddress(authorities.treasury, 'TREASURY') !== BINRAT_TREASURY_ADDRESS ||
    roleAddress(authorities.projectFeeRecipient, 'PROJECT_FEE_RECIPIENT') !== BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS
  ) throw new Error('LAUNCH_EXECUTION_ROLE_BINDING_INVALID');
  if (input.launchMechanicsReceiptDigest !== LAUNCH_MECHANICS_RECEIPT_DIGEST) {
    throw new Error('LAUNCH_EXECUTION_MECHANICS_MISMATCH');
  }
  if (input.launchConfigDigest !== LAUNCH_CONFIG_DIGEST) {
    throw new Error('LAUNCH_EXECUTION_CONFIG_MISMATCH');
  }

  const allocation = record(input.allocationVerification, 'LAUNCH_EXECUTION_ALLOCATION_MISSING');
  if (
    allocation.status !== 'PASS' ||
    allocation.evidenceClass !== 'POST_LAUNCH_ON_CHAIN_VERIFICATION' ||
    allocation.launchTransactionMatches !== true ||
    allocation.ownerPolicyMatched !== true ||
    allocation.privilegedCreatorFirstBuyObserved !== false
  ) throw new Error('LAUNCH_EXECUTION_ALLOCATION_MISSING');
  digest(allocation.receiptDigest, 'LAUNCH_EXECUTION_ALLOCATION_MISSING');
  instant(allocation.verifiedAt, 'LAUNCH_EXECUTION_ALLOCATION_MISSING');

  const purchase = record(input.founderProjectPublicPurchase, 'LAUNCH_EXECUTION_PURCHASE_MISSING');
  if (purchase.policy !== 'NOT_PLANNED_FOR_LAUNCH') throw new Error('LAUNCH_EXECUTION_PURCHASE_POLICY_INVALID');
  if (purchase.observedStatus === 'NONE_OBSERVED') {
    if (purchase.transaction !== null) throw new Error('LAUNCH_EXECUTION_PURCHASE_INVALID');
  } else if (purchase.observedStatus === 'OBSERVED') {
    hash(purchase.transaction, 'LAUNCH_EXECUTION_PURCHASE_INVALID');
  } else {
    throw new Error('LAUNCH_EXECUTION_PURCHASE_MISSING');
  }
  digest(purchase.verificationReceiptDigest, 'LAUNCH_EXECUTION_PURCHASE_MISSING');
  instant(input.deploymentExecutedAt, 'LAUNCH_EXECUTION_TIMESTAMP_MISSING');
  digest(input.receiptDigest, 'LAUNCH_EXECUTION_DIGEST_INVALID');
  if (await deriveLaunchExecutionReceiptDigest(input) !== input.receiptDigest) {
    throw new Error('LAUNCH_EXECUTION_DIGEST_MISMATCH');
  }
  return input as unknown as LaunchExecutionReceipt;
}

function validateInactiveState(input: Record<string, unknown>): void {
  const token = record(input.token, 'LAUNCH_CONFIG_TOKEN_STATE_INVALID');
  const holder = record(input.holderGate, 'LAUNCH_CONFIG_HOLDER_INVALID');
  const ledger = record(input.dumpsterLedger, 'LAUNCH_CONFIG_LEDGER_INVALID');
  const legal = record(input.legalCompliance, 'LAUNCH_CONFIG_LEGAL_INVALID');
  const authority = record(input.launchAuthority, 'LAUNCH_CONFIG_AUTHORITY_INVALID');
  const disclosure = record(input.allocationDisclosure, 'LAUNCH_CONFIG_DISCLOSURE_INVALID');
  if (
    token.state !== 'NOT_LAUNCHED' || token.addressState !== 'NOT_YET_CREATED' ||
    token.address !== null || token.launchTransaction !== null || token.launchBlock !== null ||
    holder.status !== 'TOKEN_AUTHORITY_NOT_CONFIGURED' || holder.productionEligibilityActive !== false ||
    holder.rawBalanceThresholdStatus !== 'UNRESOLVED' ||
    ledger.accountingActivationStatus !== 'DISABLED_PRE_LAUNCH' || ledger.accountingActive !== false ||
    legal.status !== 'NOT_SATISFIED' ||
    authority.launchAuthorization !== 'BLOCKED' || authority.launchAuthorized !== false ||
    authority.marketingAuthorized !== false || authority.explicitOwnerLaunchAuthorityState !== 'NOT_GRANTED' ||
    disclosure.evidenceClass !== 'OWNER_POLICY' ||
    disclosure.postLaunchOnChainVerification !== 'REQUIRED_NOT_YET_AVAILABLE'
  ) throw new Error('LAUNCH_CONFIG_AUTHORIZATION_ESCALATION');
}

function roleAddress(value: unknown, role: 'TREASURY' | 'PROJECT_FEE_RECIPIENT'): string {
  const input = record(value, 'LAUNCH_CONFIG_ROLE_INVALID');
  if (input.role !== role) throw new Error('LAUNCH_CONFIG_ROLE_BINDING_INVALID');
  return checksumAddress(input.address, 'LAUNCH_CONFIG_ADDRESS_INVALID');
}

function checksumAddress(value: unknown, code: string): string {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) throw new Error(code);
  const checksum = getAddress(value);
  if (checksum !== value || checksum === '0x0000000000000000000000000000000000000000') {
    throw new Error(code);
  }
  return checksum;
}

function hash(value: unknown, code: string): string {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/.test(value)) throw new Error(code);
  return value;
}

function digest(value: unknown, code: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new Error(code);
  return value;
}

function positiveRaw(value: unknown, code: string): string {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) throw new Error(code);
  return value;
}

function positiveInteger(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(code);
  return Number(value);
}

function instant(value: unknown, code: string): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) throw new Error(code);
  return value;
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}
