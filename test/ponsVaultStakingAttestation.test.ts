import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  derivePonsVaultStakingAttestationDigest,
  PONSVault_STAKING_ATTESTATION_DIGEST,
  validatePonsVaultStakingAttestation
} from '../src/launchConfig/ponsVaultStakingAttestation.js';

const ATTESTATION_URL =
  new URL('../docs/PONSVault_STAKING_ATTESTATION_V1.json', import.meta.url);

async function attestation(): Promise<Record<string, any>> {
  return JSON.parse(await readFile(ATTESTATION_URL, 'utf8')) as Record<string, any>;
}

test('PonsVault Staking is conditional for launch but sufficient for fail-closed L2 reads', async () => {
  const value = await attestation();
  const validated = await validatePonsVaultStakingAttestation(value);

  assert.equal(validated.status, 'CONDITIONAL');
  assert.equal(
    validated.launchAuthorizationEffect,
    'BLOCKS_LAUNCH_UNTIL_UPSTREAM_RISK_ACCEPTED_AND_RECHECKED'
  );
  assert.equal(validated.l2ReadBuildEffect, 'READ_ONLY_STAKE_READER_ALLOWED_FAIL_CLOSED');
  assert.equal(value.candidateConclusion.technicallyComposableForBinratV1, true);
  assert.equal(value.candidateConclusion.sourceMatchSatisfied, false);
  assert.equal(value.authorization.launchAuthorized, false);
  assert.equal(value.authorization.marketingAuthorized, false);
  assert.equal(
    await derivePonsVaultStakingAttestationDigest(value),
    PONSVault_STAKING_ATTESTATION_DIGEST
  );
});

test('active stake reader is pinned to stakedOf(address) and native ETH exemplars', async () => {
  const value = await attestation();
  assert.equal(value.stakeReadInterface.signature, 'stakedOf(address)');
  assert.equal(value.stakeReadInterface.selector, '0xaf500ba3');
  assert.equal(value.stakeReadInterface.returnType, 'uint256');
  assert.equal(value.stakeReadInterface.examples.length, 2);
  for (const example of value.stakeReadInterface.examples) {
    assert.equal(example.quoteAsset, '0x0000000000000000000000000000000000000000');
    assert.equal(example.stakedRaw, example.totalStakedRaw);
  }
  assert.match(value.stakeReadInterface.l2Requirement, /fail closed/i);
});

test('current Staking creation contract has payout-floor config but no lock-period field', async () => {
  const value = await attestation();
  assert.equal(value.factoryCreationInterface.signature, 'createVault(address,address,bytes)');
  assert.equal(
    value.factoryCreationInterface.configEncoding,
    'abi.encode(uint256 minimumFeesBeforePayoutRaw)'
  );
  assert.equal(value.factoryCreationInterface.lockPeriodFieldPresent, false);
  assert.equal(value.lockSemantics.currentFactoryCreationLockField, 'ABSENT');
  assert.equal(value.lockSemantics.currentPathPrincipalLockVerdict, 'NO_LOCK_OBSERVED');
});

test('dry atomic Staking launch evidence cannot be promoted into live execution evidence', async () => {
  const value = await attestation();
  assert.equal(value.launcherComposition.currentLiveLauncherStakingExecutionObserved, false);
  assert.equal(
    value.launcherComposition.alignedAtomicStakingSimulation.status,
    'SUCCESS_ETH_CALL_NO_STATE_CHANGE'
  );
  assert.equal(
    value.launcherComposition.alignedAtomicStakingSimulation.returnedAddressesStatus,
    'SIMULATION_ONLY_NOT_DEPLOYED'
  );
});

test('unresolved reward asset and EOA upgrade authority keep launch fail closed', async () => {
  const value = await attestation();
  assert.equal(value.nativeRewardSemantics.exactClaimTransferAsset, 'UNRESOLVED_DOCS_VS_UI');
  assert.equal(value.upgradeAuthority.factoryOwnerType, 'EOA');
  assert.equal(value.upgradeAuthority.historicalUpgradeEvidence.length, 2);
  assert.equal(value.authorization.explicitOwnerLaunchAuthorityState, 'NOT_GRANTED');
});

test('changing only the conditional verdict cannot authorize launch', async () => {
  const value = await attestation();
  value.status = 'PASS';
  value.authorization.launchAuthorized = true;
  value.attestationDigest = await derivePonsVaultStakingAttestationDigest(value);

  await assert.rejects(
    validatePonsVaultStakingAttestation(value),
    /HEADER_INVALID|AUTHORIZATION_ESCALATION/
  );
});
