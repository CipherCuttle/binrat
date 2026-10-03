import { sha256Hex } from '../evidence/canonical.js';

export const PONSVault_STAKING_ATTESTATION_SCHEMA_VERSION =
  'binrat.ponsvault-staking-upstream-attestation/0.1' as const;
export const PONSVault_STAKING_ATTESTATION_VERSION =
  'PONSVault_STAKING_UPSTREAM_ATTESTATION_V1' as const;
export const PONSVault_STAKING_ATTESTATION_DIGEST =
  '86c52726bdf20f1dfe6f482bc75a72c02ef88291c0c0d694b282cd8e22cb59bc' as const;

export interface PonsVaultStakingUpstreamAttestationV1 {
  schemaVersion: typeof PONSVault_STAKING_ATTESTATION_SCHEMA_VERSION;
  attestationVersion: typeof PONSVault_STAKING_ATTESTATION_VERSION;
  observedOn: '2026-10-03';
  observedBlock: 79154923;
  chainId: 4663;
  status: 'CONDITIONAL';
  launchAuthorizationEffect:
    'BLOCKS_UNTIL_EXPLICIT_UPSTREAM_RISK_ACCEPTANCE_AND_CANONICAL_RAIL_REBIND';
  attestationDigest: typeof PONSVault_STAKING_ATTESTATION_DIGEST;
  [key: string]: unknown;
}

export async function derivePonsVaultStakingAttestationDigest(
  value: unknown
): Promise<string> {
  const input = record(value, 'PONSVault_STAKING_ATTESTATION_INVALID');
  const { attestationDigest: _attestationDigest, ...material } = input;
  return sha256Hex(material);
}

export async function validatePonsVaultStakingAttestation(
  value: unknown
): Promise<PonsVaultStakingUpstreamAttestationV1> {
  const input = record(value, 'PONSVault_STAKING_ATTESTATION_INVALID');

  if (
    input.schemaVersion !== PONSVault_STAKING_ATTESTATION_SCHEMA_VERSION ||
    input.attestationVersion !== PONSVault_STAKING_ATTESTATION_VERSION ||
    input.observedOn !== '2026-10-03' ||
    input.observedBlock !== 79154923 ||
    input.chainId !== 4663 ||
    input.status !== 'CONDITIONAL' ||
    input.launchAuthorizationEffect !==
      'BLOCKS_UNTIL_EXPLICIT_UPSTREAM_RISK_ACCEPTANCE_AND_CANONICAL_RAIL_REBIND'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_HEADER_INVALID');

  const conclusion = record(
    input.candidateConclusion,
    'PONSVault_STAKING_ATTESTATION_CONCLUSION_INVALID'
  );
  if (
    conclusion.selectedStakingPrimitiveSuitableForL2 !== true ||
    conclusion.launchSafeWithoutExplicitRiskAcceptance !== false
  ) throw new Error('PONSVault_STAKING_ATTESTATION_CONCLUSION_INVALID');

  const contracts = record(input.contracts, 'PONSVault_STAKING_ATTESTATION_CONTRACTS_INVALID');
  if (
    contracts.ponsFactory !== '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e' ||
    contracts.ponsFeeEscrow !== '0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e' ||
    contracts.ponsVaultLauncher !== '0x1770c356eB9312079b9A00e26a8CF4b0a1473dBA' ||
    contracts.ponsVaultRegistry !== '0xaA9C86049A258D4A076d3eF367F69C231C9746D5' ||
    contracts.stakingFactory !== '0x1488473464F2C6E6c5C412f05d805c619322E7EB' ||
    contracts.stakingBeacon !== '0xef9f80d2f51ec6aecab284e778f328e9f0982a6f' ||
    contracts.stakingImplementation !== '0xc8e0a4fe58918c47f66cf630c6a7205741c11fd4'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_CONTRACTS_INVALID');

  const live = record(input.liveState, 'PONSVault_STAKING_ATTESTATION_LIVE_STATE_INVALID');
  if (
    live.registryTemplate !== 'staking' ||
    live.registryStakingFactory !== contracts.stakingFactory ||
    live.stakingFactoryBeacon !== contracts.stakingBeacon ||
    live.stakingFactoryImplementation !== contracts.stakingImplementation ||
    live.stakingBeaconOwner !== contracts.stakingFactory ||
    live.stakingBeaconImplementation !== contracts.stakingImplementation ||
    live.upstreamOwnerCode !== '0x'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_LIVE_STATE_INVALID');

  const factory = record(
    input.factoryCreationEvidence,
    'PONSVault_STAKING_ATTESTATION_FACTORY_INVALID'
  );
  if (
    factory.selector !== '0xd7d7d551' ||
    factory.signature !== 'createVault(address,address,bytes)' ||
    factory.currentConfigShape !==
      'ABI_ENCODED_SINGLE_UINT256_MINIMUM_FEES_BEFORE_PAYOUT' ||
    factory.creatorSetLockPeriodFieldPresent !== false
  ) throw new Error('PONSVault_STAKING_ATTESTATION_FACTORY_INVALID');

  const read = record(input.readInterfaceEvidence, 'PONSVault_STAKING_ATTESTATION_READ_INVALID');
  const selectors = record(read.selectors, 'PONSVault_STAKING_ATTESTATION_READ_INVALID');
  if (
    selectors['stake(uint256)'] !== '0xa694fc3a' ||
    selectors['unstake(uint256)'] !== '0x2e17de78' ||
    selectors['pendingRewards(address)'] !== '0x31d7a262' ||
    selectors['stakedOf(address)'] !== '0xaf500ba3' ||
    read.perWalletActiveStakeGetter !== 'stakedOf(address)' ||
    read.workingRatReadStatus !== 'READY_FOR_L2_FAIL_CLOSED_READER' ||
    read.genesisContinuousStakeMustBeObservedByBinrat !== true
  ) throw new Error('PONSVault_STAKING_ATTESTATION_READ_INVALID');

  const native = record(input.nativeEthEvidence, 'PONSVault_STAKING_ATTESTATION_NATIVE_INVALID');
  for (const key of ['clai', 'sinu']) {
    const exemplar = record(native[key], 'PONSVault_STAKING_ATTESTATION_NATIVE_INVALID');
    if (
      exemplar.beacon !== contracts.stakingBeacon ||
      exemplar.quoteAsset !== '0x0000000000000000000000000000000000000000'
    ) throw new Error('PONSVault_STAKING_ATTESTATION_NATIVE_INVALID');
  }
  if (
    native.nativeRewardConclusion !==
      'ETH_PAIRED_VAULTS_USE_NATIVE_QUOTE_ACCOUNTING; CURRENT_RUNTIME_CLAIMS_NATIVE_ESCROW_FOR_ZERO_QUOTE_ASSET' ||
    native.publicCopyMismatch !== 'DOCS_SAY_WETH_WHILE_CURRENT_LAUNCH_FORM_SAYS_ETH'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_NATIVE_INVALID');

  const simulation = record(
    input.atomicLauncherSimulation,
    'PONSVault_STAKING_ATTESTATION_SIMULATION_INVALID'
  );
  if (
    simulation.status !== 'PASS_NO_STATE_CHANGE' ||
    simulation.method !== 'eth_call' ||
    simulation.pairAsset !== 'NATIVE_ETH'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_SIMULATION_INVALID');

  const security = record(
    input.sourceAndSecurity,
    'PONSVault_STAKING_ATTESTATION_SECURITY_INVALID'
  );
  if (
    security.ponsVaultThirdPartyAuditStatus !== 'NOT_COMPLETED_PER_PUBLIC_DOCS' ||
    security.sharedBeaconUpgradeable !== true ||
    security.upgradeAuthorityStatus !== 'ACTIVE_EOA_CONTROL_CHAIN_OBSERVED'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_SECURITY_INVALID');

  const authorization = record(
    input.authorization,
    'PONSVault_STAKING_ATTESTATION_AUTHORIZATION_INVALID'
  );
  if (
    authorization.marketingAuthorized !== false ||
    authorization.launchAuthorized !== false ||
    authorization.explicitOwnerLaunchAuthorityState !== 'NOT_GRANTED'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_AUTHORIZATION_ESCALATION');

  if (input.attestationDigest !== PONSVault_STAKING_ATTESTATION_DIGEST) {
    throw new Error('PONSVault_STAKING_ATTESTATION_DIGEST_INVALID');
  }
  if (
    await derivePonsVaultStakingAttestationDigest(input) !==
    PONSVault_STAKING_ATTESTATION_DIGEST
  ) throw new Error('PONSVault_STAKING_ATTESTATION_DIGEST_MISMATCH');

  return input as unknown as PonsVaultStakingUpstreamAttestationV1;
}

function record(value: unknown, error: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(error);
  return value as Record<string, any>;
}
