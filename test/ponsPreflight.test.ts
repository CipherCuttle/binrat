import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  derivePonsPreflightReceiptDigest,
  PONS_PREFLIGHT_SCHEMA_VERSION,
  PONS_PREFLIGHT_VERSION,
  PONS_STAKE_READ_CANARY_V1,
  PONS_STAKING_BEACON_V1,
  PONS_STAKING_IMPLEMENTATION_V1,
  PONS_VAULT_UPSTREAM_OWNER_V1,
  registryStakingFactoryCalldata,
  unresolvedExactManifestInputs,
  validatePonsPreflightReceipt
} from '../src/launchConfig/ponsPreflight.js';
import {
  PONS_LAUNCH_PLAN_DIGEST,
  PONS_STAKING_FACTORY_V1,
  PONS_V2_FACTORY_CODE_HASH_V1,
  PONS_V2_FACTORY_V1,
  PONS_VAULT_LAUNCHER_V1,
  PONS_VAULT_REGISTRY_V1,
  validatePonsLaunchPlan
} from '../src/launchConfig/ponsPlan.js';

const PLAN_URL = new URL('../docs/BINRAT_PONS_LAUNCH_PLAN_V1.json', import.meta.url);
const REGISTRY_HASH =
  '0x0818f2fd53a4ccaf9edcb34a9fc7b0980f659dfa99862439c813e0719caaa93f';

async function plan() {
  return validatePonsLaunchPlan(
    JSON.parse(await readFile(PLAN_URL, 'utf8'))
  );
}

test('registry staking lookup is fixed bytes32 and exact manifest inputs remain unresolved', async () => {
  assert.equal(
    registryStakingFactoryCalldata(),
    `0x9aeb4297${'7374616b696e67'.padEnd(64, '0')}`
  );
  assert.deepEqual(
    unresolvedExactManifestInputs(await plan()).sort(),
    [
      'expectedEconomics',
      'launchConfigId',
      'launchWalletAddress',
      'minimumFeesBeforePayoutWei',
      'tokenMetadata',
      'treasuryAddress',
      'workingRatMinStakeRaw'
    ].sort()
  );
});

test('Pons preflight receipt binds current graph without granting launch authority', async () => {
  const launchPlan = await plan();
  const receipt = await fixture(launchPlan);
  await validatePonsPreflightReceipt(receipt, launchPlan);

  assert.equal(receipt.graph.launcherCanLaunch, true);
  assert.equal(receipt.exactManifestSimulation.status, 'BLOCKED_OWNER_INPUTS');
  assert.equal(receipt.authorization.launchAuthorized, false);
  assert.equal(receipt.authorization.marketingAuthorized, false);
});

test('Pons preflight fails closed on pinned hash drift and graph substitution', async () => {
  const launchPlan = await plan();

  const hashDrift = await fixture(launchPlan);
  hashDrift.contracts.ponsFactory.codeHash = `0x${'99'.repeat(32)}`;
  hashDrift.receiptDigest = await derivePonsPreflightReceiptDigest(hashDrift);
  await assert.rejects(
    validatePonsPreflightReceipt(hashDrift, launchPlan),
    /CODEHASH_DRIFT/
  );

  const graphDrift = await fixture(launchPlan);
  graphDrift.graph.registryStakingFactory =
    '0x537483c5B33e2192CfB202d7C50d58975524B047';
  graphDrift.receiptDigest = await derivePonsPreflightReceiptDigest(graphDrift);
  await assert.rejects(
    validatePonsPreflightReceipt(graphDrift, launchPlan),
    /GRAPH_INVALID/
  );
});

test('Pons preflight cannot hide unresolved owner inputs or authorize launch', async () => {
  const launchPlan = await plan();

  const missing = await fixture(launchPlan);
  missing.exactManifestSimulation.missingInputs = [];
  missing.receiptDigest = await derivePonsPreflightReceiptDigest(missing);
  await assert.rejects(
    validatePonsPreflightReceipt(missing, launchPlan),
    /EXACT_SIM_INVALID/
  );

  const authorized = await fixture(launchPlan);
  authorized.authorization.launchAuthorized = true as false;
  authorized.receiptDigest = await derivePonsPreflightReceiptDigest(authorized);
  await assert.rejects(
    validatePonsPreflightReceipt(authorized, launchPlan),
    /AUTHORIZATION_ESCALATION/
  );
});

async function fixture(launchPlan: Awaited<ReturnType<typeof plan>>): Promise<any> {
  const missingInputs = unresolvedExactManifestInputs(launchPlan);
  const value: any = {
    schemaVersion: PONS_PREFLIGHT_SCHEMA_VERSION,
    preflightVersion: PONS_PREFLIGHT_VERSION,
    status: 'UPSTREAM_GRAPH_PASS_BASELINE_EXACT_MANIFEST_BLOCKED',
    observedAt: '2026-10-03T20:55:00.000Z',
    chainId: 4663,
    block: {
      number: '79383941',
      hash: `0x${'12'.repeat(32)}`
    },
    plan: {
      digest: PONS_LAUNCH_PLAN_DIGEST
    },
    contracts: {
      ponsFactory: {
        address: PONS_V2_FACTORY_V1,
        codeHash: PONS_V2_FACTORY_CODE_HASH_V1,
        expectedCodeHash: PONS_V2_FACTORY_CODE_HASH_V1,
        status: 'MATCH'
      },
      launcher: baseline(PONS_VAULT_LAUNCHER_V1, '21'),
      registry: {
        address: PONS_VAULT_REGISTRY_V1,
        codeHash: REGISTRY_HASH,
        expectedCodeHash: REGISTRY_HASH,
        status: 'MATCH'
      },
      stakingFactory: baseline(PONS_STAKING_FACTORY_V1, '31'),
      stakingBeacon: baseline(PONS_STAKING_BEACON_V1, '41'),
      stakingImplementation: baseline(PONS_STAKING_IMPLEMENTATION_V1, '51'),
      upstreamOwner: {
        address: PONS_VAULT_UPSTREAM_OWNER_V1,
        code: '0x',
        status: 'EOA'
      }
    },
    graph: {
      launcherPonsFactory: PONS_V2_FACTORY_V1,
      launcherRegistry: PONS_VAULT_REGISTRY_V1,
      registryStakingFactory: PONS_STAKING_FACTORY_V1,
      registryOwner: PONS_VAULT_UPSTREAM_OWNER_V1,
      stakingFactoryOwner: PONS_VAULT_UPSTREAM_OWNER_V1,
      stakingFactoryBeacon: PONS_STAKING_BEACON_V1,
      stakingFactoryImplementation: PONS_STAKING_IMPLEMENTATION_V1,
      stakingFactoryTemplate: 'staking',
      stakingFactoryVaultCountRaw: '1',
      stakingBeaconOwner: PONS_STAKING_FACTORY_V1,
      stakingBeaconImplementation: PONS_STAKING_IMPLEMENTATION_V1,
      launcherCanLaunch: true,
      launcherCanLaunchReason: '0x',
      status: 'PASS'
    },
    stakeReadCanary: {
      vault: PONS_STAKE_READ_CANARY_V1.vault,
      wallet: PONS_STAKE_READ_CANARY_V1.wallet,
      quoteAsset: '0x0000000000000000000000000000000000000000',
      stakedRaw: '1',
      totalStakedRaw: '2',
      status: 'PASS'
    },
    exactManifestSimulation: {
      status: 'BLOCKED_OWNER_INPUTS',
      missingInputs,
      broadcast: false
    },
    authorization: {
      marketingAuthorized: false,
      launchAuthorized: false,
      explicitOwnerLaunchAuthorityState: 'NOT_GRANTED'
    }
  };
  value.receiptDigest = await derivePonsPreflightReceiptDigest(value);
  return value;
}

function baseline(address: string, byte: string) {
  return {
    address,
    codeHash: `0x${byte.repeat(32)}`,
    expectedCodeHash: null,
    status: 'OBSERVED_BASELINE'
  };
}
