import { sha256Hex } from '../evidence/canonical.js';

export const PONSVault_ATTESTATION_SCHEMA_VERSION =
  'binrat.ponsvault-upstream-attestation/0.1' as const;
export const PONSVault_ATTESTATION_VERSION =
  'PONSVault_UPSTREAM_ATTESTATION_V1' as const;
export const PONSVault_ATTESTATION_DIGEST =
  '69ee99d7b574c2fbb272d7521c2dfd70741c00ca95b401ac895b68928cb2916c' as const;

export interface PonsVaultUpstreamAttestationV1 {
  schemaVersion: typeof PONSVault_ATTESTATION_SCHEMA_VERSION;
  attestationVersion: typeof PONSVault_ATTESTATION_VERSION;
  observedOn: '2026-10-03';
  observedBlock: 79077877;
  chainId: 4663;
  status: 'FAIL_DEFER_CURRENT_CANDIDATE';
  launchAuthorizationEffect: 'BLOCKS_UNTIL_REPLACED_OR_REVERIFIED';
  attestationDigest: typeof PONSVault_ATTESTATION_DIGEST;
  [key: string]: unknown;
}

export async function derivePonsVaultAttestationDigest(value: unknown): Promise<string> {
  const input = record(value, 'PONSVault_ATTESTATION_INVALID');
  const { attestationDigest: _attestationDigest, ...material } = input;
  return sha256Hex(material);
}

export async function validatePonsVaultAttestation(
  value: unknown
): Promise<PonsVaultUpstreamAttestationV1> {
  const input = record(value, 'PONSVault_ATTESTATION_INVALID');

  if (
    input.schemaVersion !== PONSVault_ATTESTATION_SCHEMA_VERSION ||
    input.attestationVersion !== PONSVault_ATTESTATION_VERSION ||
    input.observedOn !== '2026-10-03' ||
    input.observedBlock !== 79077877 ||
    input.chainId !== 4663 ||
    input.status !== 'FAIL_DEFER_CURRENT_CANDIDATE' ||
    input.launchAuthorizationEffect !== 'BLOCKS_UNTIL_REPLACED_OR_REVERIFIED'
  ) throw new Error('PONSVault_ATTESTATION_HEADER_INVALID');

  const conclusion = record(input.candidateConclusion, 'PONSVault_ATTESTATION_CONCLUSION_INVALID');
  if (conclusion.selectedFactorySuitableForBinratV1 !== false) {
    throw new Error('PONSVault_ATTESTATION_CANDIDATE_ESCALATION');
  }

  const contracts = record(input.contracts, 'PONSVault_ATTESTATION_CONTRACTS_INVALID');
  if (
    contracts.ponsFactory !== '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e' ||
    contracts.ponsVaultLauncher !== '0x1770c356eB9312079b9A00e26a8CF4b0a1473dBA' ||
    contracts.ponsVaultRegistry !== '0xaA9C86049A258D4A076d3eF367F69C231C9746D5' ||
    contracts.stakeBurnFactory !== '0x537483c5B33e2192CfB202d7C50d58975524B047' ||
    contracts.stakeBurnBeacon !== '0xf72b3b54220a2e64ee87895d570a2c72a00a3fe4' ||
    contracts.stakeBurnImplementation !== '0xf0453c814cf6a76a8e3507f8fafffe359f28b6cb'
  ) throw new Error('PONSVault_ATTESTATION_CONTRACTS_INVALID');

  const live = record(input.liveState, 'PONSVault_ATTESTATION_LIVE_STATE_INVALID');
  if (
    live.stakeBurnFactoryImplementation !== contracts.stakeBurnImplementation ||
    live.stakeBurnBeaconImplementation !== contracts.stakeBurnImplementation ||
    live.stakeBurnFactoryBeacon !== contracts.stakeBurnBeacon ||
    live.stakeBurnBeaconOwner !== contracts.stakeBurnFactory ||
    live.upstreamOwnerCode !== '0x' ||
    live.stakeBurnTemplate !== 'stake-burn' ||
    live.stakeBurnVaultCount !== 0 ||
    live.stakeBurnRewardAsset !== '0xc9a981FEE1F9DEc688bb123ccDeCc63D0deBFC4e' ||
    live.stakeBurnRewardAssetSymbol !== 'GLD'
  ) throw new Error('PONSVault_ATTESTATION_LIVE_STATE_INVALID');

  const source = record(input.sourceProvenance, 'PONSVault_ATTESTATION_SOURCE_INVALID');
  if (
    source.ponsVaultAdvertisedRepositoryStatus !== 'HTTP_404' ||
    source.ponsVaultSourceMatch !== 'NOT_SATISFIED' ||
    source.thirdPartyAuditStatus !== 'NOT_COMPLETED_PER_PUBLIC_DOCS'
  ) throw new Error('PONSVault_ATTESTATION_SOURCE_INVALID');

  const documented = record(input.documentedModel, 'PONSVault_ATTESTATION_MODEL_INVALID');
  if (
    documented.stakeBurnFactoryScope !==
      'HIMGAJRIA_DESK_SPECIFIC_WITH_IMMUTABLE_PAYOUT_ASSET' ||
    documented.publicLaunchFormExposesStakeBurn !== false ||
    documented.publicLaunchFormExposesStaking !== true ||
    documented.vaultsUpgradeableViaSharedBeacon !== true
  ) throw new Error('PONSVault_ATTESTATION_MODEL_INVALID');

  const iface = record(
    input.implementationInterfaceEvidence,
    'PONSVault_ATTESTATION_INTERFACE_INVALID'
  );
  const selectors = record(iface.selectors, 'PONSVault_ATTESTATION_INTERFACE_INVALID');
  if (
    selectors['stake(uint256)'] !== '0xa694fc3a' ||
    selectors['unstake(uint256)'] !== '0x2e17de78' ||
    selectors['claim()'] !== '0x4e71d92d' ||
    selectors['pendingRewards(address)'] !== '0x31d7a262' ||
    iface.perWalletActiveStakeGetter !== 'UNRESOLVED'
  ) throw new Error('PONSVault_ATTESTATION_INTERFACE_INVALID');

  const authorization = record(
    input.authorization,
    'PONSVault_ATTESTATION_AUTHORIZATION_INVALID'
  );
  if (
    authorization.marketingAuthorized !== false ||
    authorization.launchAuthorized !== false ||
    authorization.explicitOwnerLaunchAuthorityState !== 'NOT_GRANTED'
  ) throw new Error('PONSVault_ATTESTATION_AUTHORIZATION_ESCALATION');

  if (input.attestationDigest !== PONSVault_ATTESTATION_DIGEST) {
    throw new Error('PONSVault_ATTESTATION_DIGEST_INVALID');
  }
  if (await derivePonsVaultAttestationDigest(input) !== PONSVault_ATTESTATION_DIGEST) {
    throw new Error('PONSVault_ATTESTATION_DIGEST_MISMATCH');
  }

  return input as unknown as PonsVaultUpstreamAttestationV1;
}

function record(value: unknown, error: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(error);
  return value as Record<string, any>;
}
