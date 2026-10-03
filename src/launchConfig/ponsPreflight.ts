import {
  decodeAbiParameters,
  encodeAbiParameters,
  getAddress,
  isHex,
  stringToHex,
  type Address,
  type Hex
} from 'viem';
import { sha256Hex } from '../evidence/canonical.js';
import {
  PONS_LAUNCH_CHAIN_ID,
  PONS_LAUNCH_PLAN_DIGEST,
  PONS_STAKING_FACTORY_V1,
  PONS_V2_FACTORY_V1,
  PONS_VAULT_LAUNCHER_V1,
  PONS_VAULT_REGISTRY_V1,
  type PonsLaunchPlanV1
} from './ponsPlan.js';

export const PONS_PREFLIGHT_SCHEMA_VERSION = 'binrat.pons-preflight/0.1' as const;
export const PONS_PREFLIGHT_VERSION = 'PONS_PREFLIGHT_V1' as const;

export const PONS_STAKING_BEACON_V1 =
  '0xef9f80d2f51ec6aecab284e778f328e9f0982a6f' as const;
export const PONS_STAKING_IMPLEMENTATION_V1 =
  '0xc8e0a4fe58918c47f66cf630c6a7205741c11fd4' as const;
export const PONS_VAULT_UPSTREAM_OWNER_V1 =
  '0x897ac30f73ba92e1efbc1df1e67f8b5f4b3ecd2b' as const;

export const PONS_PREFLIGHT_SELECTORS = {
  launcherPonsFactory: '0xc45a0155',
  launcherRegistry: '0x7b103999',
  launcherCanLaunchProbe: '0x858908cc',
  registryOwner: '0x8da5cb5b',
  registryFactoryByTemplate: '0x9aeb4297',
  stakingFactoryOwner: '0x8da5cb5b',
  stakingFactoryBeacon: '0x59659e90',
  stakingFactoryImplementation: '0x5c60da1b',
  stakingFactoryTemplate: '0x6f2ddd93',
  stakingFactoryVaultCount: '0xa7c6a100',
  beaconOwner: '0x8da5cb5b',
  beaconImplementation: '0x5c60da1b',
  quoteAsset: '0xfdf262b7',
  totalStaked: '0x817b1cd2',
  stakedOf: '0xaf500ba3'
} as const satisfies Record<string, Hex>;

export const PONS_STAKE_READ_CANARY_V1 = {
  vault: '0x96e5c19717f5e681375b65771dd85628f700eb42',
  wallet: '0x35df6256c2fa5c52ae5741a8d81e7047e20b0e6d'
} as const;

export interface PonsPreflightContractObservation {
  address: Address;
  codeHash: Hex;
  expectedCodeHash: Hex | null;
  status: 'MATCH' | 'OBSERVED_BASELINE';
}

export interface PonsPreflightReceiptV1 {
  schemaVersion: typeof PONS_PREFLIGHT_SCHEMA_VERSION;
  preflightVersion: typeof PONS_PREFLIGHT_VERSION;
  status: 'UPSTREAM_GRAPH_PASS_BASELINE_EXACT_MANIFEST_BLOCKED';
  observedAt: string;
  chainId: typeof PONS_LAUNCH_CHAIN_ID;
  block: {
    number: string;
    hash: Hex;
  };
  plan: {
    digest: typeof PONS_LAUNCH_PLAN_DIGEST;
  };
  contracts: {
    ponsFactory: PonsPreflightContractObservation;
    launcher: PonsPreflightContractObservation;
    registry: PonsPreflightContractObservation;
    stakingFactory: PonsPreflightContractObservation;
    stakingBeacon: PonsPreflightContractObservation;
    stakingImplementation: PonsPreflightContractObservation;
    upstreamOwner: {
      address: Address;
      code: '0x';
      status: 'EOA';
    };
  };
  graph: {
    launcherPonsFactory: Address;
    launcherRegistry: Address;
    registryStakingFactory: Address;
    registryOwner: Address;
    stakingFactoryOwner: Address;
    stakingFactoryBeacon: Address;
    stakingFactoryImplementation: Address;
    stakingFactoryTemplate: 'staking';
    stakingFactoryVaultCountRaw: string;
    stakingBeaconOwner: Address;
    stakingBeaconImplementation: Address;
    launcherCanLaunch: true;
    launcherCanLaunchReason: Hex;
    status: 'PASS';
  };
  stakeReadCanary: {
    vault: Address;
    wallet: Address;
    quoteAsset: '0x0000000000000000000000000000000000000000';
    stakedRaw: string;
    totalStakedRaw: string;
    status: 'PASS';
  };
  exactManifestSimulation: {
    status: 'BLOCKED_OWNER_INPUTS';
    missingInputs: string[];
    broadcast: false;
  };
  authorization: {
    marketingAuthorized: false;
    launchAuthorized: false;
    explicitOwnerLaunchAuthorityState: 'NOT_GRANTED';
  };
  receiptDigest: string;
}

export function registryStakingFactoryCalldata(): Hex {
  return `${PONS_PREFLIGHT_SELECTORS.registryFactoryByTemplate}${stringToHex('staking', { size: 32 }).slice(2)}` as Hex;
}

export function addressArgCalldata(selector: Hex, address: Address): Hex {
  const args = encodeAbiParameters([{ type: 'address' }], [address]);
  return `${selector}${args.slice(2)}` as Hex;
}

export function decodeAddressWord(data: Hex): Address {
  const [value] = decodeAbiParameters([{ type: 'address' }], data);
  return getAddress(value);
}

export function decodeUintWord(data: Hex): bigint {
  const [value] = decodeAbiParameters([{ type: 'uint256' }], data);
  return value;
}

export function decodeStringResult(data: Hex): string {
  const [value] = decodeAbiParameters([{ type: 'string' }], data);
  return value;
}

export function decodeCanLaunchProbe(data: Hex): { canLaunch: boolean; reason: Hex } {
  const [canLaunch, reason] = decodeAbiParameters(
    [{ type: 'bool' }, { type: 'bytes' }],
    data
  );
  return { canLaunch, reason };
}

export function unresolvedExactLaunchSimulationInputs(plan: PonsLaunchPlanV1): string[] {
  const raw = plan.unresolvedImmutableInputs;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return ['unresolvedImmutableInputs'];
  }
  const unresolved = raw as Record<string, unknown>;
  return [
    'launchConfigId',
    'expectedEconomics',
    'minimumFeesBeforePayoutWei',
    'launchWalletAddress',
    'tokenMetadata'
  ].filter((key) => unresolved[key] === null || unresolved[key] === undefined);
}

export async function derivePonsPreflightReceiptDigest(value: unknown): Promise<string> {
  const input = record(value, 'PONS_PREFLIGHT_RECEIPT_INVALID');
  const { receiptDigest: _receiptDigest, ...material } = input;
  return sha256Hex(material);
}

export async function validatePonsPreflightReceipt(
  value: unknown,
  plan: PonsLaunchPlanV1
): Promise<PonsPreflightReceiptV1> {
  const input = record(value, 'PONS_PREFLIGHT_RECEIPT_INVALID');
  if (
    input.schemaVersion !== PONS_PREFLIGHT_SCHEMA_VERSION ||
    input.preflightVersion !== PONS_PREFLIGHT_VERSION ||
    input.status !== 'UPSTREAM_GRAPH_PASS_BASELINE_EXACT_MANIFEST_BLOCKED' ||
    input.chainId !== PONS_LAUNCH_CHAIN_ID ||
    typeof input.observedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(input.observedAt)
  ) throw new Error('PONS_PREFLIGHT_HEADER_INVALID');

  const block = record(input.block, 'PONS_PREFLIGHT_BLOCK_INVALID');
  if (
    typeof block.number !== 'string' ||
    !/^\d+$/.test(block.number) ||
    !isHex(block.hash) ||
    block.hash.length !== 66
  ) throw new Error('PONS_PREFLIGHT_BLOCK_INVALID');

  const planBinding = record(input.plan, 'PONS_PREFLIGHT_PLAN_INVALID');
  if (
    planBinding.digest !== PONS_LAUNCH_PLAN_DIGEST ||
    plan.planDigest !== PONS_LAUNCH_PLAN_DIGEST
  ) throw new Error('PONS_PREFLIGHT_PLAN_INVALID');

  const contracts = record(input.contracts, 'PONS_PREFLIGHT_CONTRACTS_INVALID');
  validateContract(contracts.ponsFactory, PONS_V2_FACTORY_V1, true);
  validateContract(contracts.launcher, PONS_VAULT_LAUNCHER_V1, false);
  validateContract(contracts.registry, PONS_VAULT_REGISTRY_V1, true);
  validateContract(contracts.stakingFactory, PONS_STAKING_FACTORY_V1, false);
  validateContract(contracts.stakingBeacon, PONS_STAKING_BEACON_V1, false);
  validateContract(contracts.stakingImplementation, PONS_STAKING_IMPLEMENTATION_V1, false);

  const upstreamOwner = record(
    contracts.upstreamOwner,
    'PONS_PREFLIGHT_CONTRACTS_INVALID'
  );
  if (
    checksum(upstreamOwner.address) !== getAddress(PONS_VAULT_UPSTREAM_OWNER_V1) ||
    upstreamOwner.code !== '0x' ||
    upstreamOwner.status !== 'EOA'
  ) throw new Error('PONS_PREFLIGHT_UPSTREAM_OWNER_INVALID');

  const graph = record(input.graph, 'PONS_PREFLIGHT_GRAPH_INVALID');
  if (
    checksum(graph.launcherPonsFactory) !== getAddress(PONS_V2_FACTORY_V1) ||
    checksum(graph.launcherRegistry) !== getAddress(PONS_VAULT_REGISTRY_V1) ||
    checksum(graph.registryStakingFactory) !== getAddress(PONS_STAKING_FACTORY_V1) ||
    checksum(graph.registryOwner) !== getAddress(PONS_VAULT_UPSTREAM_OWNER_V1) ||
    checksum(graph.stakingFactoryOwner) !== getAddress(PONS_VAULT_UPSTREAM_OWNER_V1) ||
    checksum(graph.stakingFactoryBeacon) !== getAddress(PONS_STAKING_BEACON_V1) ||
    checksum(graph.stakingFactoryImplementation) !== getAddress(PONS_STAKING_IMPLEMENTATION_V1) ||
    graph.stakingFactoryTemplate !== 'staking' ||
    typeof graph.stakingFactoryVaultCountRaw !== 'string' ||
    !/^\d+$/.test(graph.stakingFactoryVaultCountRaw) ||
    BigInt(graph.stakingFactoryVaultCountRaw) < 1n ||
    checksum(graph.stakingBeaconOwner) !== getAddress(PONS_STAKING_FACTORY_V1) ||
    checksum(graph.stakingBeaconImplementation) !== getAddress(PONS_STAKING_IMPLEMENTATION_V1) ||
    graph.launcherCanLaunch !== true ||
    !isHex(graph.launcherCanLaunchReason) ||
    graph.status !== 'PASS'
  ) throw new Error('PONS_PREFLIGHT_GRAPH_INVALID');

  const canary = record(input.stakeReadCanary, 'PONS_PREFLIGHT_STAKE_CANARY_INVALID');
  if (
    checksum(canary.vault) !== getAddress(PONS_STAKE_READ_CANARY_V1.vault) ||
    checksum(canary.wallet) !== getAddress(PONS_STAKE_READ_CANARY_V1.wallet) ||
    canary.quoteAsset !== '0x0000000000000000000000000000000000000000' ||
    typeof canary.stakedRaw !== 'string' ||
    !/^\d+$/.test(canary.stakedRaw) ||
    typeof canary.totalStakedRaw !== 'string' ||
    !/^\d+$/.test(canary.totalStakedRaw) ||
    BigInt(canary.stakedRaw) > BigInt(canary.totalStakedRaw) ||
    canary.status !== 'PASS'
  ) throw new Error('PONS_PREFLIGHT_STAKE_CANARY_INVALID');

  const exact = record(
    input.exactManifestSimulation,
    'PONS_PREFLIGHT_EXACT_SIM_INVALID'
  );
  const expectedMissing = unresolvedExactLaunchSimulationInputs(plan);
  if (
    exact.status !== 'BLOCKED_OWNER_INPUTS' ||
    exact.broadcast !== false ||
    !Array.isArray(exact.missingInputs) ||
    JSON.stringify([...exact.missingInputs].sort()) !==
      JSON.stringify([...expectedMissing].sort()) ||
    expectedMissing.length === 0
  ) throw new Error('PONS_PREFLIGHT_EXACT_SIM_INVALID');

  const authorization = record(input.authorization, 'PONS_PREFLIGHT_AUTH_INVALID');
  if (
    authorization.marketingAuthorized !== false ||
    authorization.launchAuthorized !== false ||
    authorization.explicitOwnerLaunchAuthorityState !== 'NOT_GRANTED'
  ) throw new Error('PONS_PREFLIGHT_AUTHORIZATION_ESCALATION');

  if (
    typeof input.receiptDigest !== 'string' ||
    !/^[0-9a-f]{64}$/.test(input.receiptDigest) ||
    await derivePonsPreflightReceiptDigest(input) !== input.receiptDigest
  ) throw new Error('PONS_PREFLIGHT_RECEIPT_DIGEST_INVALID');

  return input as unknown as PonsPreflightReceiptV1;
}

function validateContract(
  value: unknown,
  expectedAddress: Address,
  requiresPinnedHash: boolean
): void {
  const input = record(value, 'PONS_PREFLIGHT_CONTRACT_INVALID');
  if (
    checksum(input.address) !== getAddress(expectedAddress) ||
    !isHex(input.codeHash) ||
    input.codeHash.length !== 66
  ) throw new Error('PONS_PREFLIGHT_CONTRACT_INVALID');

  if (requiresPinnedHash) {
    if (
      !isHex(input.expectedCodeHash) ||
      input.expectedCodeHash.length !== 66 ||
      input.codeHash.toLowerCase() !== input.expectedCodeHash.toLowerCase() ||
      input.status !== 'MATCH'
    ) throw new Error('PONS_PREFLIGHT_CODEHASH_DRIFT');
  } else if (
    input.expectedCodeHash !== null ||
    input.status !== 'OBSERVED_BASELINE'
  ) {
    throw new Error('PONS_PREFLIGHT_UNPINNED_HASH_INVALID');
  }
}

function checksum(value: unknown): Address {
  if (typeof value !== 'string') throw new Error('PONS_PREFLIGHT_ADDRESS_INVALID');
  return getAddress(value);
}

function record(value: unknown, code: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Record<string, any>;
}
