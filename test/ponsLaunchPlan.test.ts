import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  derivePonsLaunchPlanDigest,
  PONS_LAUNCH_PLAN_DIGEST,
  PONS_LAUNCH_CHAIN_ID,
  PONS_V2_FACTORY_CODE_HASH_V1,
  validatePonsLaunchPlan
} from '../src/launchConfig/ponsPlan.js';

const PLAN_URL = new URL('../docs/BINRAT_PONS_LAUNCH_PLAN_V1.json', import.meta.url);

async function plan(): Promise<Record<string, any>> {
  return JSON.parse(await readFile(PLAN_URL, 'utf8')) as Record<string, any>;
}

test('Pons launch plan is deterministic, chain-scoped and fail-closed', async () => {
  const value = await plan();
  const validated = await validatePonsLaunchPlan(value);
  assert.equal(validated.chainId, PONS_LAUNCH_CHAIN_ID);
  assert.equal(validated.planDigest, PONS_LAUNCH_PLAN_DIGEST);
  assert.equal(await derivePonsLaunchPlanDigest(value), PONS_LAUNCH_PLAN_DIGEST);
  assert.equal(value.launchRail.ponsFactory.runtimeCodeHash, PONS_V2_FACTORY_CODE_HASH_V1);
  assert.equal(value.launchRail.railId, 'pons-v2-vault-staking-candidate-v1');
  assert.equal(value.launchRail.stakingFactory.address, '0x1488473464F2C6E6c5C412f05d805c619322E7EB');
  assert.equal(value.upstreamRisk.stakingAttestationStatus, 'CONDITIONAL');
  assert.equal(value.upstreamRisk.explicitUpstreamRiskAcceptanceRequired, true);
  assert.equal(value.authorization.launchAuthorized, false);
  assert.equal(value.authorization.marketingAuthorized, false);
});

test('immutable launch inputs cannot be guessed into the planning artifact', async () => {
  const value = await plan();
  value.unresolvedImmutableInputs.creatorTaxBps = 100;
  value.planDigest = await derivePonsLaunchPlanDigest(value);
  await assert.rejects(validatePonsLaunchPlan(value), /IMMUTABLES_PREMATURELY_FROZEN/);
});

test('old Arc launch authority is explicitly historical only', async () => {
  const value = await plan();
  assert.equal(value.historicalPredecessor.chainId, 5042);
  assert.equal(value.historicalPredecessor.authority, 'HISTORICAL_ONLY_NOT_PONS_AUTHORITY');
  assert.equal(value.upstreamRisk.rejectedStakeBurnAttestation, 'docs/PONSVault_UPSTREAM_ATTESTATION_V1.json');
  assert.equal(value.upstreamRisk.stakingAttestation, 'docs/PONSVault_STAKING_ATTESTATION_V1.json');
  assert.equal(value.upstreamRisk.launchMechanicsGate, 'BLOCKED_UPSTREAM_RISK_ACCEPTANCE');
});

test('rejected Stake & Burn inputs cannot reappear as current immutable Staking inputs', async () => {
  const value = await plan();
  assert.equal('stakeBurnFactory' in value.launchRail, false);
  assert.equal('stakeLockPeriodSeconds' in value.unresolvedImmutableInputs, false);
  assert.equal('minimumFeesBeforeRun' in value.unresolvedImmutableInputs, false);
  assert.equal(value.unresolvedImmutableInputs.minimumFeesBeforePayoutWei, null);
});
