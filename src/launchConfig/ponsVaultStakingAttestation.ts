import { sha256Hex } from '../evidence/canonical.js';

export const PONSVault_STAKING_ATTESTATION_SCHEMA_VERSION =
  'binrat.ponsvault-staking-attestation/0.1' as const;
export const PONSVault_STAKING_ATTESTATION_VERSION =
  'PONSVault_STAKING_ATTESTATION_V1' as const;
export const PONSVault_STAKING_ATTESTATION_DIGEST =
  'fbc01d9084d71af173564fd26659ddaf6ea9d168bb1c2547e1b1314d54320ffd' as const;

export const PONSVault_STAKING_FACTORY_DRY_CALLDATA =
  '0xd7d7d551000000000000000000000000645187382c996cbe752630786164f461ff43180b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000016345785d8a0000' as const;
export const PONSVault_STAKING_ATOMIC_DRY_CALLDATA =
  '0x969e674100000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007374616b696e670000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004200000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000240000000000000000000000000897ac30f73ba92e1efbc1df1e67f8b5f4b3ecd2b000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000193f6d4890a9761a0e76e83f886b5bb6a1bce9d1f461d2d1068543690e9310fb0000000000000000000000000000000000000000000000000000000000000004546573740000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000045465737400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000215465737420e2809420746865206e65787420766972616c206d656d6520636f696e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000016345785d8a0000' as const;

export interface PonsVaultStakingAttestationV1 {
  schemaVersion: typeof PONSVault_STAKING_ATTESTATION_SCHEMA_VERSION;
  attestationVersion: typeof PONSVault_STAKING_ATTESTATION_VERSION;
  observedOn: '2026-10-03';
  observedBlock: 79164449;
  observedBlockHash: '0x44cb1a70c57335e94ce553d601c581913bc784eebb78b1d104e31f7b4bdffe25';
  chainId: 4663;
  status: 'CONDITIONAL';
  launchAuthorizationEffect: 'NO_AUTHORIZATION_CHANGE';
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
): Promise<PonsVaultStakingAttestationV1> {
  const input = record(value, 'PONSVault_STAKING_ATTESTATION_INVALID');

  if (
    input.schemaVersion !== PONSVault_STAKING_ATTESTATION_SCHEMA_VERSION ||
    input.attestationVersion !== PONSVault_STAKING_ATTESTATION_VERSION ||
    input.observedOn !== '2026-10-03' ||
    input.observedBlock !== 79164449 ||
    input.observedBlockHash !==
      '0x44cb1a70c57335e94ce553d601c581913bc784eebb78b1d104e31f7b4bdffe25' ||
    input.chainId !== 4663 ||
    input.status !== 'CONDITIONAL' ||
    input.launchAuthorizationEffect !== 'NO_AUTHORIZATION_CHANGE'
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_HEADER_INVALID');
  }

  const conclusion = record(
    input.candidateConclusion,
    'PONSVault_STAKING_ATTESTATION_CONCLUSION_INVALID'
  );
  if (
    conclusion.conditionallySuitableForBinratV1 !== true ||
    conclusion.unconditionalPass !== false
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_CANDIDATE_ESCALATION');
  }

  const contracts = record(
    input.contracts,
    'PONSVault_STAKING_ATTESTATION_CONTRACTS_INVALID'
  );
  if (
    contracts.ponsFactory !== '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e' ||
    contracts.ponsVaultLauncher !== '0x1770c356eB9312079b9A00e26a8CF4b0a1473dBA' ||
    contracts.ponsVaultRegistry !== '0xaA9C86049A258D4A076d3eF367F69C231C9746D5' ||
    contracts.stakingFactory !== '0x1488473464F2C6E6c5C412f05d805c619322E7EB' ||
    contracts.stakingBeacon !== '0xef9f80d2f51ec6aecab284e778f328e9f0982a6f' ||
    contracts.stakingImplementation !== '0xc8e0a4fe58918c47f66cf630c6a7205741c11fd4' ||
    contracts.upstreamOwner !== '0x897ac30f73ba92e1efbc1df1e67f8b5f4b3ecd2b'
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_CONTRACTS_INVALID');
  }

  const live = record(input.liveState, 'PONSVault_STAKING_ATTESTATION_LIVE_STATE_INVALID');
  if (
    live.registryTemplate !== 'staking' ||
    live.registryStakingFactory !== contracts.stakingFactory ||
    live.registryOwner !== contracts.upstreamOwner ||
    live.stakingFactoryBeacon !== contracts.stakingBeacon ||
    live.stakingFactoryImplementation !== contracts.stakingImplementation ||
    live.stakingFactoryOwner !== contracts.upstreamOwner ||
    live.stakingBeaconOwner !== contracts.stakingFactory ||
    live.stakingBeaconImplementation !== contracts.stakingImplementation ||
    live.upstreamOwnerCode !== '0x' ||
    live.upgradeControlTerminatesAtEoa !== true
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_LIVE_STATE_INVALID');
  }

  const creation = record(
    input.factoryCreationEvidence,
    'PONSVault_STAKING_ATTESTATION_FACTORY_CREATION_INVALID'
  );
  const nativeFactoryDryCall = record(
    creation.directNativeEthDryCall,
    'PONSVault_STAKING_ATTESTATION_FACTORY_CREATION_INVALID'
  );
  if (
    creation.selector !== '0xd7d7d551' ||
    creation.shape !== 'createVault(address token,address quoteAsset,bytes config)' ||
    creation.configShape !== 'abi.encode(uint256 minimumFeesBeforePayout)' ||
    creation.creatorSelectedLockFieldPresent !== false ||
    creation.historicalTransaction !==
      '0x300335cd71201b787ba59b98561fcf337e2e26c3172b557590959d9d37751d46' ||
    nativeFactoryDryCall.quoteAsset !== '0x0000000000000000000000000000000000000000' ||
    nativeFactoryDryCall.minimumFeesBeforePayoutRaw !== '100000000000000000' ||
    nativeFactoryDryCall.observedBlock !== 79164449 ||
    nativeFactoryDryCall.calldata !== PONSVault_STAKING_FACTORY_DRY_CALLDATA ||
    nativeFactoryDryCall.returnData !==
      '0x000000000000000000000000757ef16e4ea4c703d3e0cbc77cb61599597974e1' ||
    nativeFactoryDryCall.returnedHypotheticalVault !==
      '0x757ef16e4ea4c703d3e0cbc77cb61599597974e1' ||
    nativeFactoryDryCall.broadcast !== false
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_FACTORY_CREATION_INVALID');
  }

  const atomic = record(
    input.atomicLaunchSimulation,
    'PONSVault_STAKING_ATTESTATION_ATOMIC_SIM_INVALID'
  );
  if (
    atomic.launcher !== contracts.ponsVaultLauncher ||
    atomic.selector !== '0x969e6741' ||
    atomic.template !== 'staking' ||
    atomic.vaultConfigMinimumFeesBeforePayoutRaw !== '100000000000000000' ||
    atomic.observedBlock !== 79164449 ||
    atomic.valueWei !== '500000000000000' ||
    atomic.calldata !== PONSVault_STAKING_ATOMIC_DRY_CALLDATA ||
    atomic.returnData !==
      '0x0000000000000000000000000d5afa91c20be6df39b2e970b3737c68b70a358d000000000000000000000000757ef16e4ea4c703d3e0cbc77cb61599597974e1' ||
    atomic.returnedHypotheticalToken !== '0x0d5afa91c20be6df39b2e970b3737c68b70a358d' ||
    atomic.returnedHypotheticalVault !== '0x757ef16e4ea4c703d3e0cbc77cb61599597974e1' ||
    atomic.broadcast !== false ||
    atomic.result !== 'SUCCESS'
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_ATOMIC_SIM_INVALID');
  }

  const iface = record(
    input.implementationInterfaceEvidence,
    'PONSVault_STAKING_ATTESTATION_INTERFACE_INVALID'
  );
  const selectors = record(iface.selectors, 'PONSVault_STAKING_ATTESTATION_INTERFACE_INVALID');
  if (
    selectors['stake(uint256)'] !== '0xa694fc3a' ||
    selectors['unstake(uint256)'] !== '0x2e17de78' ||
    selectors['claim()'] !== '0x4e71d92d' ||
    selectors['pendingRewards(address)'] !== '0x31d7a262' ||
    selectors['totalStaked()'] !== '0x817b1cd2' ||
    selectors['stakedOf(address)'] !== '0xaf500ba3' ||
    selectors['quoteAsset()'] !== '0xfdf262b7' ||
    iface.perWalletActiveStakeGetter !== 'stakedOf(address)' ||
    iface.activeStakeReadSuitableForL2 !== true
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_INTERFACE_INVALID');
  }

  const examples = array(
    input.nativeEthExamples,
    'PONSVault_STAKING_ATTESTATION_NATIVE_EXAMPLES_INVALID'
  );
  if (examples.length < 2) {
    throw new Error('PONSVault_STAKING_ATTESTATION_NATIVE_EXAMPLES_INVALID');
  }
  const clai = record(examples[0], 'PONSVault_STAKING_ATTESTATION_NATIVE_EXAMPLES_INVALID');
  const sinu = record(examples[1], 'PONSVault_STAKING_ATTESTATION_NATIVE_EXAMPLES_INVALID');
  if (
    clai.symbol !== 'CLAI' ||
    clai.quoteAsset !== '0x0000000000000000000000000000000000000000' ||
    clai.totalStakedRaw !== clai.stakedOfRaw ||
    sinu.symbol !== 'SINU' ||
    sinu.quoteAsset !== '0x0000000000000000000000000000000000000000' ||
    sinu.totalStakedRaw !== sinu.stakedOfRaw ||
    sinu.pendingRewardsFirstComponentRaw !== sinu.claimDryReturnFirstComponentRaw ||
    sinu.pendingRewardsFirstComponentRaw === '0'
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_NATIVE_EXAMPLES_INVALID');
  }

  const rewards = record(
    input.rewardDeliverySemantics,
    'PONSVault_STAKING_ATTESTATION_REWARD_SEMANTICS_INVALID'
  );
  if (
    rewards.nativeQuoteSupport !== 'CONFIRMED' ||
    rewards.claimAccounting !== 'CONFIRMED_NONZERO_ON_SINU' ||
    rewards.publicDocsRewardLabel !== 'WETH' ||
    rewards.minedFinalTransferAsset !== 'UNRESOLVED_IN_CURRENT_PASS' ||
    rewards.classification !==
      'NATIVE_QUOTE_ACCOUNTING_CONFIRMED_FINAL_TRANSFER_ASSET_NOT_PINNED' ||
    rewards.publicCopyEffect !==
      'DO_NOT_LABEL_STAKER_REWARDS_ETH_OR_WETH_UNTIL_FINAL_TRANSFER_HOP_IS_PINNED'
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_REWARD_SEMANTICS_INVALID');
  }

  const routing = record(
    input.feeRoutingSemantics,
    'PONSVault_STAKING_ATTESTATION_FEE_ROUTING_INVALID'
  );
  if (
    routing.ponsV2SourceCommit !== '44a3db9193c365f6c25cf0d4c2efc396e6de0df5' ||
    routing.liveStakingRewardAccrualObserved !== true ||
    routing.currentAtomicLauncherStakingMinedExemplarFound !== false ||
    routing.currentAtomicLauncherStakingDrySimulation !== 'SUCCESS' ||
    routing.exactCurrentAtomicCreatorFeeRecipientAndSweepHop !== 'NOT_FULLY_PINNED' ||
    routing.classification !== 'SUPPORTED_BUT_CONDITIONAL'
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_FEE_ROUTING_INVALID');
  }

  const lock = record(input.lockSemantics, 'PONSVault_STAKING_ATTESTATION_LOCK_INVALID');
  const lockProbe = record(
    lock.commonLockGetterProbe,
    'PONSVault_STAKING_ATTESTATION_LOCK_INVALID'
  );
  if (
    lock.creatorSelectedLockFieldInCurrentFactoryPayload !== false ||
    lockProbe['lockPeriod()'] !== 'REVERT' ||
    lockProbe['lockDuration()'] !== 'REVERT' ||
    lock.stakeAndUnstakeObservedOnLiveVaults !== true ||
    lock.classification !==
      'NO_CREATOR_SELECTED_LOCK_PROVEN_EXACT_INTERNAL_LOCK_RULE_UNRESOLVED' ||
    lock.genesisEffect !==
      'DO_NOT_DEPEND_ON_CONTRACT_LOCK; MEASURE_SUSTAINED_STAKE_IN_BINRAT'
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_LOCK_INVALID');
  }

  const source = record(
    input.sourceProvenance,
    'PONSVault_STAKING_ATTESTATION_SOURCE_INVALID'
  );
  if (
    source.ponsV2Source !== 'PUBLIC_REPOSITORY_AVAILABLE' ||
    source.ponsV2PinnedCommit !== '44a3db9193c365f6c25cf0d4c2efc396e6de0df5' ||
    source.ponsVaultImplementationSourceMatch !== 'NOT_ESTABLISHED' ||
    source.thirdPartyAuditStatus !== 'NOT_COMPLETED_PER_PUBLIC_DOCS'
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_SOURCE_INVALID');
  }

  const risk = record(input.riskAcceptance, 'PONSVault_STAKING_ATTESTATION_RISK_INVALID');
  if (
    risk.vaultPrincipalCustody !== 'THIRD_PARTY_UPGRADEABLE_BEACON' ||
    risk.sharedImplementation !== true ||
    risk.upstreamControl !== 'EOA_OWNED_FACTORY_CONTROLS_BEACON' ||
    risk.residualRisk !== 'MUST_BE_DISCLOSED_AND_EXPLICITLY_ACCEPTED_BEFORE_READY_TO_ARM'
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_RISK_INVALID');
  }

  const conditions = array(input.conditions, 'PONSVault_STAKING_ATTESTATION_CONDITIONS_INVALID');
  if (
    conditions.length < 5 ||
    !conditions.every((condition) => typeof condition === 'string') ||
    !conditions.some((condition) => condition.includes('final claim transfer asset')) ||
    !conditions.some((condition) => condition.includes('creator-fee-recipient/sweep route')) ||
    !conditions.some((condition) => condition.includes('third-party beacon upgrade'))
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_CONDITIONS_INVALID');
  }

  const authorization = record(
    input.authorization,
    'PONSVault_STAKING_ATTESTATION_AUTHORIZATION_INVALID'
  );
  if (
    authorization.marketingAuthorized !== false ||
    authorization.launchAuthorized !== false ||
    authorization.explicitOwnerLaunchAuthorityState !== 'NOT_GRANTED'
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_AUTHORIZATION_ESCALATION');
  }

  if (input.attestationDigest !== PONSVault_STAKING_ATTESTATION_DIGEST) {
    throw new Error('PONSVault_STAKING_ATTESTATION_DIGEST_INVALID');
  }
  if (
    (await derivePonsVaultStakingAttestationDigest(input)) !==
    PONSVault_STAKING_ATTESTATION_DIGEST
  ) {
    throw new Error('PONSVault_STAKING_ATTESTATION_DIGEST_MISMATCH');
  }

  return input as unknown as PonsVaultStakingAttestationV1;
}

function record(value: unknown, error: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(error);
  return value as Record<string, any>;
}

function array(value: unknown, error: string): any[] {
  if (!Array.isArray(value)) throw new Error(error);
  return value;
}
