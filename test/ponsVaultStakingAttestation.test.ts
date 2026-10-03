import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  derivePonsVaultStakingAttestationDigest,
  PONSVault_STAKING_ATTESTATION_DIGEST,
  validatePonsVaultStakingAttestation
} from '../src/launchConfig/ponsVaultStakingAttestation.js';

const ATTESTATION_URL = new URL(
  '../docs/PONSVault_STAKING_ATTESTATION_V1.json',
  import.meta.url
);

async function attestation(): Promise<Record<string, any>> {
  return JSON.parse(await readFile(ATTESTATION_URL, 'utf8')) as Record<string, any>;
}

test('PonsVault L1B receipt deterministically freezes Staking at CONDITIONAL', async () => {
  const value = await attestation();
  const validated = await validatePonsVaultStakingAttestation(value);

  assert.equal(validated.status, 'CONDITIONAL');
  assert.equal(validated.launchAuthorizationEffect, 'NO_AUTHORIZATION_CHANGE');
  assert.equal(value.candidateConclusion.conditionallySuitableForBinratV1, true);
  assert.equal(value.candidateConclusion.unconditionalPass, false);
  assert.equal(value.authorization.launchAuthorized, false);
  assert.equal(value.authorization.marketingAuthorized, false);
  assert.equal(
    await derivePonsVaultStakingAttestationDigest(value),
    PONSVault_STAKING_ATTESTATION_DIGEST
  );
});

test('L1B receipt cannot be edited into PASS by changing verdict fields', async () => {
  const value = await attestation();
  value.status = 'PASS';
  value.candidateConclusion.conditionallySuitableForBinratV1 = false;
  value.candidateConclusion.unconditionalPass = true;
  value.attestationDigest = await derivePonsVaultStakingAttestationDigest(value);

  await assert.rejects(
    validatePonsVaultStakingAttestation(value),
    /ATTESTATION_HEADER_INVALID|CANDIDATE_ESCALATION/
  );
});

test('L1B receipt cannot paper over unresolved payout or fee-routing evidence', async () => {
  const value = await attestation();
  value.rewardDeliverySemantics.minedFinalTransferAsset = 'ETH';
  value.rewardDeliverySemantics.classification = 'PASS';
  value.feeRoutingSemantics.currentAtomicLauncherStakingMinedExemplarFound = true;
  value.feeRoutingSemantics.exactCurrentAtomicCreatorFeeRecipientAndSweepHop = 'PINNED';
  value.feeRoutingSemantics.classification = 'PASS';
  value.attestationDigest = await derivePonsVaultStakingAttestationDigest(value);

  await assert.rejects(
    validatePonsVaultStakingAttestation(value),
    /REWARD_SEMANTICS_INVALID|FEE_ROUTING_INVALID/
  );
});

test('L1B establishes native quote support and the L2 active-principal read primitive', async () => {
  const value = await attestation();
  await validatePonsVaultStakingAttestation(value);

  assert.equal(
    value.implementationInterfaceEvidence.perWalletActiveStakeGetter,
    'stakedOf(address)'
  );
  assert.equal(value.implementationInterfaceEvidence.activeStakeReadSuitableForL2, true);
  for (const example of value.nativeEthExamples) {
    assert.equal(example.quoteAsset, '0x0000000000000000000000000000000000000000');
    assert.equal(example.totalStakedRaw, example.stakedOfRaw);
  }
});

test('L1B records both native-ETH dry simulations as successful and non-broadcast', async () => {
  const value = await attestation();
  await validatePonsVaultStakingAttestation(value);

  assert.equal(value.factoryCreationEvidence.directNativeEthDryCall.broadcast, false);
  assert.equal(
    value.factoryCreationEvidence.directNativeEthDryCall.returnedHypotheticalVault,
    '0x757ef16e4ea4c703d3e0cbc77cb61599597974e1'
  );
  assert.equal(value.atomicLaunchSimulation.result, 'SUCCESS');
  assert.equal(value.atomicLaunchSimulation.broadcast, false);
  assert.equal(value.atomicLaunchSimulation.template, 'staking');
});

test('L1B does not invent a creator-configurable lock or public reward asset label', async () => {
  const value = await attestation();
  await validatePonsVaultStakingAttestation(value);

  assert.equal(value.factoryCreationEvidence.creatorSelectedLockFieldPresent, false);
  assert.equal(value.lockSemantics.creatorSelectedLockFieldInCurrentFactoryPayload, false);
  assert.equal(
    value.lockSemantics.classification,
    'NO_CREATOR_SELECTED_LOCK_PROVEN_EXACT_INTERNAL_LOCK_RULE_UNRESOLVED'
  );
  assert.equal(
    value.rewardDeliverySemantics.publicCopyEffect,
    'DO_NOT_LABEL_STAKER_REWARDS_ETH_OR_WETH_UNTIL_FINAL_TRANSFER_HOP_IS_PINNED'
  );
});
