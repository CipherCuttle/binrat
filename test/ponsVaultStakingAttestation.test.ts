import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  derivePonsVaultStakingAttestationDigest,
  PONSVault_STAKING_ATTESTATION_DIGEST,
  validatePonsVaultStakingAttestation
} from '../src/launchConfig/ponsVaultStakingAttestation.js';

const ATTESTATION_URL = new URL(
  '../docs/PONSVault_STAKING_UPSTREAM_ATTESTATION_V1.json',
  import.meta.url
);

async function attestation(): Promise<Record<string, any>> {
  return JSON.parse(await readFile(ATTESTATION_URL, 'utf8')) as Record<string, any>;
}

test('PonsVault Staking L1B is conditional but sufficient to start L2', async () => {
  const value = await attestation();
  const validated = await validatePonsVaultStakingAttestation(value);

  assert.equal(validated.status, 'CONDITIONAL');
  assert.equal(value.candidateConclusion.selectedStakingPrimitiveSuitableForL2, true);
  assert.equal(value.candidateConclusion.launchSafeWithoutExplicitRiskAcceptance, false);
  assert.equal(value.readInterfaceEvidence.perWalletActiveStakeGetter, 'stakedOf(address)');
  assert.equal(value.readInterfaceEvidence.workingRatReadStatus, 'READY_FOR_L2_FAIL_CLOSED_READER');
  assert.equal(value.atomicLauncherSimulation.status, 'PASS_NO_STATE_CHANGE');
  assert.equal(value.authorization.launchAuthorized, false);
  assert.equal(value.authorization.marketingAuthorized, false);
  assert.equal(
    await derivePonsVaultStakingAttestationDigest(value),
    PONSVault_STAKING_ATTESTATION_DIGEST
  );
});

test('native ETH staking evidence stays bound to the current shared beacon', async () => {
  const value = await attestation();

  assert.equal(
    value.liveState.stakingBeaconImplementation,
    value.contracts.stakingImplementation
  );
  assert.equal(value.nativeEthEvidence.clai.beacon, value.contracts.stakingBeacon);
  assert.equal(value.nativeEthEvidence.sinu.beacon, value.contracts.stakingBeacon);
  assert.equal(
    value.nativeEthEvidence.clai.quoteAsset,
    '0x0000000000000000000000000000000000000000'
  );
  assert.equal(
    value.nativeEthEvidence.sinu.quoteAsset,
    '0x0000000000000000000000000000000000000000'
  );
  assert.match(value.nativeEthEvidence.sinu.observedStatus, /1 runs/);
});

test('current Staking factory config does not pretend to carry a creator lock period', async () => {
  const value = await attestation();

  assert.equal(
    value.factoryCreationEvidence.currentConfigShape,
    'ABI_ENCODED_SINGLE_UINT256_MINIMUM_FEES_BEFORE_PAYOUT'
  );
  assert.equal(value.factoryCreationEvidence.creatorSetLockPeriodFieldPresent, false);
  assert.equal(
    value.readInterfaceEvidence.lockSemantics,
    'CURRENT_FACTORY_CREATION_CONFIG_HAS_NO_CREATOR_SET_LOCK_FIELD'
  );
  assert.equal(value.readInterfaceEvidence.genesisContinuousStakeMustBeObservedByBinrat, true);
});

test('L1B cannot be edited into unconditional launch approval', async () => {
  const value = await attestation();
  value.status = 'PASS';
  value.candidateConclusion.launchSafeWithoutExplicitRiskAcceptance = true;
  value.authorization.launchAuthorized = true;
  value.attestationDigest = await derivePonsVaultStakingAttestationDigest(value);

  await assert.rejects(
    validatePonsVaultStakingAttestation(value),
    /ATTESTATION_HEADER_INVALID|CONCLUSION_INVALID|AUTHORIZATION_ESCALATION/
  );
});
