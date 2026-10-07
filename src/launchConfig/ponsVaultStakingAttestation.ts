import { sha256Hex } from '../evidence/canonical.js';

export const PONSVault_STAKING_ATTESTATION_SCHEMA_VERSION =
  'binrat.ponsvault-staking-attestation/0.1' as const;
export const PONSVault_STAKING_ATTESTATION_VERSION =
  'PONSVault_STAKING_ATTESTATION_V1' as const;
export const PONSVault_STAKING_ATTESTATION_DIGEST =
  'f42f4794f3e064262b901cf1dbaa10bfa3a2a3370267f7db48b8387972aad54d' as const;

export interface PonsVaultStakingAttestationV1 {
  schemaVersion: typeof PONSVault_STAKING_ATTESTATION_SCHEMA_VERSION;
  attestationVersion: typeof PONSVault_STAKING_ATTESTATION_VERSION;
  observedOn: '2026-10-03';
  observedBlock: 79139797;
  chainId: 4663;
  status: 'CONDITIONAL';
  launchAuthorizationEffect: 'BLOCKS_LAUNCH_UNTIL_UPSTREAM_RISK_ACCEPTED_AND_RECHECKED';
  l2ReadBuildEffect: 'READ_ONLY_STAKE_READER_ALLOWED_FAIL_CLOSED';
  attestationDigest: typeof PONSVault_STAKING_ATTESTATION_DIGEST;
  [key: string]: unknown;
}

export async function derivePonsVaultStakingAttestationDigest(value: unknown): Promise<string> {
  const input = record(value, 'PONSVault_STAKING_ATTESTATION_INVALID');
  const { attestationDigest: _attestationDigest, ...material } = input;
  return sha256Hex(material);
}

export async function validatePonsVaultStakingAttestation(
  value: unknown
): Promise<PonsVaultStakingAttestationV1> {
  const input = record(value, 'PONSVault_STAKING_ATTESTATION_INVALID');

  if (
    input.schemaVersion !== PONSVault_STAKING_ATTESTATION_SCHEMA_VERSION ||
    input.attestationVersion !== PONSVault_STAKING_ATTESTATION_VERSION ||
    input.observedOn !== '2026-10-03' ||
    input.observedBlock !== 79139797 ||
    input.chainId !== 4663 ||
    input.status !== 'CONDITIONAL' ||
    input.launchAuthorizationEffect !==
      'BLOCKS_LAUNCH_UNTIL_UPSTREAM_RISK_ACCEPTED_AND_RECHECKED' ||
    input.l2ReadBuildEffect !== 'READ_ONLY_STAKE_READER_ALLOWED_FAIL_CLOSED'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_HEADER_INVALID');

  const conclusion = record(
    input.candidateConclusion,
    'PONSVault_STAKING_ATTESTATION_CONCLUSION_INVALID'
  );
  if (
    conclusion.technicallyComposableForBinratV1 !== true ||
    conclusion.selectedAsTechnicalReplacementCandidate !== true ||
    conclusion.sourceMatchSatisfied !== false ||
    conclusion.currentLauncherStakingLiveExecutionObserved !== false
  ) throw new Error('PONSVault_STAKING_ATTESTATION_CONCLUSION_INVALID');

  const contracts = record(input.contracts, 'PONSVault_STAKING_ATTESTATION_CONTRACTS_INVALID');
  if (
    contracts.ponsFactory !== '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e' ||
    contracts.ponsVaultLauncher !== '0x1770c356eB9312079b9A00e26a8CF4b0a1473dBA' ||
    contracts.ponsVaultRegistry !== '0xaA9C86049A258D4A076d3eF367F69C231C9746D5' ||
    contracts.stakingFactory !== '0x1488473464F2C6E6c5C412f05d805c619322E7EB' ||
    contracts.stakingBeacon !== '0xef9f80d2f51ec6aecab284e778f328e9f0982a6f' ||
    contracts.stakingImplementation !== '0xc8e0a4fe58918c47f66cf630c6a7205741c11fd4'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_CONTRACTS_INVALID');

  const live = record(input.liveState, 'PONSVault_STAKING_ATTESTATION_LIVE_STATE_INVALID');
  if (
    live.registryStakingFactory !== contracts.stakingFactory ||
    live.stakingFactoryBeacon !== contracts.stakingBeacon ||
    live.stakingFactoryImplementation !== contracts.stakingImplementation ||
    live.stakingBeaconImplementation !== contracts.stakingImplementation ||
    live.stakingBeaconOwner !== contracts.stakingFactory ||
    live.upstreamOwnerCode !== '0x' ||
    live.stakingTemplate !== 'staking' ||
    live.factoryVaultCount !== 1 ||
    live.currentLauncherCanLaunch !== true
  ) throw new Error('PONSVault_STAKING_ATTESTATION_LIVE_STATE_INVALID');

  const source = record(input.sourceProvenance, 'PONSVault_STAKING_ATTESTATION_SOURCE_INVALID');
  if (
    source.ponsV2Source !== 'PUBLIC_REPOSITORY_AVAILABLE' ||
    source.ponsVaultAdvertisedRepositoryStatus !== 'HTTP_404' ||
    source.ponsVaultSourceMatch !== 'NOT_SATISFIED' ||
    source.thirdPartyAuditStatus !== 'NOT_COMPLETED_PER_PUBLIC_DOCS'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_SOURCE_INVALID');

  const creation = record(
    input.factoryCreationInterface,
    'PONSVault_STAKING_ATTESTATION_CREATION_INVALID'
  );
  const createSim = record(
    creation.nativeEthCreateSimulation,
    'PONSVault_STAKING_ATTESTATION_CREATION_INVALID'
  );
  if (
    creation.selector !== '0xd7d7d551' ||
    creation.signature !== 'createVault(address,address,bytes)' ||
    creation.configEncoding !== 'abi.encode(uint256 minimumFeesBeforePayoutRaw)' ||
    creation.lockPeriodFieldPresent !== false ||
    createSim.status !== 'SUCCESS_ETH_CALL_NO_STATE_CHANGE' ||
    createSim.inputQuoteAsset !== '0x0000000000000000000000000000000000000000' ||
    createSim.returnedVaultStatus !== 'SIMULATION_ONLY_NOT_DEPLOYED'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_CREATION_INVALID');

  const stake = record(input.stakeReadInterface, 'PONSVault_STAKING_ATTESTATION_STAKE_READ_INVALID');
  if (
    stake.selector !== '0xaf500ba3' ||
    stake.signature !== 'stakedOf(address)' ||
    stake.returnType !== 'uint256' ||
    stake.currentImplementationSelectorPresent !== true ||
    !Array.isArray(stake.examples) ||
    stake.examples.length < 2
  ) throw new Error('PONSVault_STAKING_ATTESTATION_STAKE_READ_INVALID');

  for (const example of stake.examples as unknown[]) {
    const row = record(example, 'PONSVault_STAKING_ATTESTATION_STAKE_READ_INVALID');
    if (
      row.quoteAsset !== '0x0000000000000000000000000000000000000000' ||
      typeof row.stakedRaw !== 'string' ||
      row.stakedRaw !== row.totalStakedRaw
    ) throw new Error('PONSVault_STAKING_ATTESTATION_STAKE_READ_INVALID');
  }

  const lock = record(input.lockSemantics, 'PONSVault_STAKING_ATTESTATION_LOCK_INVALID');
  if (
    lock.currentFactoryCreationLockField !== 'ABSENT' ||
    lock.currentImplementationObservedBehavior !== 'SAME_TRANSACTION_STAKE_THEN_UNSTAKE_SUCCEEDED' ||
    lock.currentPathPrincipalLockVerdict !== 'NO_LOCK_OBSERVED'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_LOCK_INVALID');

  const routing = record(input.feeRouting, 'PONSVault_STAKING_ATTESTATION_FEE_ROUTING_INVALID');
  if (
    routing.ponsSourceVerdict !==
      'CREATOR_BASE_FEE_SHARE_PLUS_FULL_CREATOR_TAX_ROUTE_TO_CURRENT_CREATOR_FEE_RECIPIENT' ||
    routing.creatorTax !== 'PAID_TO_CREATOR_FEE_RECIPIENT_IN_FULL' ||
    routing.ponsVaultLauncherAction !== 'REDIRECTS_CREATOR_FEE_RECIPIENT_TO_CREATED_VAULT'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_FEE_ROUTING_INVALID');

  const rewards = record(
    input.nativeRewardSemantics,
    'PONSVault_STAKING_ATTESTATION_REWARD_INVALID'
  );
  if (
    rewards.ethPairQuoteAssetRepresentation !== 'ADDRESS_ZERO' ||
    rewards.exactClaimTransferAsset !== 'UNRESOLVED_DOCS_VS_UI' ||
    rewards.marketingRule !== 'DO_NOT_DESCRIBE_REWARD_ASSET_MORE_SPECIFICALLY_THAN_VERIFIED'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_REWARD_INVALID');

  const launcher = record(
    input.launcherComposition,
    'PONSVault_STAKING_ATTESTATION_LAUNCHER_INVALID'
  );
  const launchSim = record(
    launcher.alignedAtomicStakingSimulation,
    'PONSVault_STAKING_ATTESTATION_LAUNCHER_INVALID'
  );
  if (
    launcher.currentLiveLauncherStakingExecutionObserved !== false ||
    launcher.currentLauncherPonsDeployerBehavior !== 'LAUNCHER_IS_PONS_TOKEN_DEPLOYER' ||
    launchSim.status !== 'SUCCESS_ETH_CALL_NO_STATE_CHANGE' ||
    launchSim.template !== 'staking' ||
    launchSim.pairAsset !== 'NATIVE_ETH_ADDRESS_ZERO' ||
    launchSim.returnedAddressesStatus !== 'SIMULATION_ONLY_NOT_DEPLOYED'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_LAUNCHER_INVALID');

  const upgrade = record(
    input.upgradeAuthority,
    'PONSVault_STAKING_ATTESTATION_UPGRADE_INVALID'
  );
  if (
    upgrade.factoryOwnerType !== 'EOA' ||
    upgrade.beaconOwnedByFactory !== true ||
    upgrade.currentImplementation !== contracts.stakingImplementation ||
    !Array.isArray(upgrade.historicalUpgradeEvidence) ||
    upgrade.historicalUpgradeEvidence.length < 2 ||
    upgrade.launchRisk !== 'USER_STAKED_BINRAT_PRINCIPAL_DEPENDS_ON_THIRD_PARTY_UPGRADE_AUTHORITY'
  ) throw new Error('PONSVault_STAKING_ATTESTATION_UPGRADE_INVALID');

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
  if (await derivePonsVaultStakingAttestationDigest(input) !== PONSVault_STAKING_ATTESTATION_DIGEST) {
    throw new Error('PONSVault_STAKING_ATTESTATION_DIGEST_MISMATCH');
  }

  return input as unknown as PonsVaultStakingAttestationV1;
}

function record(value: unknown, error: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(error);
  return value as Record<string, any>;
}
