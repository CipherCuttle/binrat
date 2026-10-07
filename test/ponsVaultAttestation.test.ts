import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  derivePonsVaultAttestationDigest,
  PONSVault_ATTESTATION_DIGEST,
  validatePonsVaultAttestation
} from '../src/launchConfig/ponsVaultAttestation.js';

const ATTESTATION_URL = new URL('../docs/PONSVault_UPSTREAM_ATTESTATION_V1.json', import.meta.url);

async function attestation(): Promise<Record<string, any>> {
  return JSON.parse(await readFile(ATTESTATION_URL, 'utf8')) as Record<string, any>;
}

test('PonsVault L1 receipt deterministically rejects the current Stake & Burn candidate', async () => {
  const value = await attestation();
  const validated = await validatePonsVaultAttestation(value);

  assert.equal(validated.status, 'FAIL_DEFER_CURRENT_CANDIDATE');
  assert.equal(validated.launchAuthorizationEffect, 'BLOCKS_UNTIL_REPLACED_OR_REVERIFIED');
  assert.equal(value.candidateConclusion.selectedFactorySuitableForBinratV1, false);
  assert.equal(value.liveState.stakeBurnVaultCount, 0);
  assert.equal(value.liveState.stakeBurnRewardAssetSymbol, 'GLD');
  assert.equal(value.documentedModel.publicLaunchFormExposesStakeBurn, false);
  assert.equal(value.sourceProvenance.ponsVaultSourceMatch, 'NOT_SATISFIED');
  assert.equal(value.authorization.launchAuthorized, false);
  assert.equal(value.authorization.marketingAuthorized, false);
  assert.equal(await derivePonsVaultAttestationDigest(value), PONSVault_ATTESTATION_DIGEST);
});

test('L1 receipt cannot be edited into a pass by changing only the verdict', async () => {
  const value = await attestation();
  value.status = 'PASS';
  value.candidateConclusion.selectedFactorySuitableForBinratV1 = true;
  value.attestationDigest = await derivePonsVaultAttestationDigest(value);

  await assert.rejects(
    validatePonsVaultAttestation(value),
    /ATTESTATION_HEADER_INVALID|CANDIDATE_ESCALATION/
  );
});

test('L2 remains blocked until a per-wallet active-stake getter is established', async () => {
  const value = await attestation();
  assert.equal(value.implementationInterfaceEvidence.perWalletActiveStakeGetter, 'UNRESOLVED');
  assert.match(
    value.requiredNextEvidence.join('\n'),
    /Do not implement L2 active-stake entitlement/
  );
});
