import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  deriveLaunchGateMatrixDigest,
  launchAuthorizationEligible,
  REQUIRED_LAUNCH_GATE_IDS,
  validateLaunchGateStatusConsistency,
  validateLaunchGateMatrix
} from '../src/launchConfig/gateMatrix.js';
import {
  LAUNCH_CONFIG_DIGEST,
  validateLaunchConfig,
  validateLaunchStatusConsistency
} from '../src/launchConfig/config.js';
import {
  PONS_LAUNCH_PLAN_DIGEST,
  validatePonsLaunchPlan
} from '../src/launchConfig/ponsPlan.js';
import { validateCapabilityManifest } from '../src/telegram/rat.js';

const MATRIX_URL = new URL('../docs/LAUNCH_GATE_MATRIX_PONS_V1.json', import.meta.url);
const HISTORICAL_ARC_MATRIX_URL = new URL('../docs/LAUNCH_GATE_MATRIX_V0.json', import.meta.url);
const PLAN_URL = new URL('../docs/BINRAT_PONS_LAUNCH_PLAN_V1.json', import.meta.url);
const CONFIG_URL = new URL('../docs/BINRAT_LAUNCH_CONFIG_V0.json', import.meta.url);
const MANIFEST_URL = new URL('../docs/CAPABILITY_MANIFEST_V0.json', import.meta.url);

async function json(url: URL): Promise<Record<string, any>> {
  return JSON.parse(await readFile(url, 'utf8')) as Record<string, any>;
}

test('canonical Pons V1 gate matrix is complete, digested, and blocks on upstream verification', async () => {
  const plan = await validatePonsLaunchPlan(await json(PLAN_URL));
  assert.equal(plan.planDigest, PONS_LAUNCH_PLAN_DIGEST);

  const matrix = await json(MATRIX_URL);
  const validated = validateLaunchGateMatrix(matrix);
  assert.equal(validated.chainId, 4663);
  assert.equal(validated.launchPlanDigest, PONS_LAUNCH_PLAN_DIGEST);
  assert.deepEqual(Object.keys(validated.gates).sort(), [...REQUIRED_LAUNCH_GATE_IDS].sort());
  assert.equal(await deriveLaunchGateMatrixDigest(matrix), matrix.matrixDigest);
  assert.equal(validated.gates.launch_mechanics_verification_receipt.status, 'BLOCKED_UPSTREAM_VERIFICATION');
  assert.equal(validated.gates.launch_mechanics_verification_receipt.blocksLaunchAuthorization, true);

  const manifest = await json(MANIFEST_URL);
  validateLaunchGateStatusConsistency(validated, manifest);
  assert.equal(manifest.launchGateStatus.blockingGateCount, 5);
});

test('Arc 5042 matrix remains historical evidence and cannot become current Pons authority', async () => {
  const historical = await json(HISTORICAL_ARC_MATRIX_URL);
  assert.equal(historical.chainId, 5042);
  assert.equal(historical.matrixVersion, 'LAUNCH_GATE_MATRIX_V0');
  assert.equal(historical.matrixDigest, 'd244d4b8d19d17679adee0e995dbbf4845f321702ea91bfcc646497e6f2ce73b');

  const current = validateLaunchGateMatrix(await json(MATRIX_URL));
  assert.equal(current.historicalArcMatrix.path, 'docs/LAUNCH_GATE_MATRIX_V0.json');
  assert.equal(current.historicalArcMatrix.digest, historical.matrixDigest);
  assert.equal(current.historicalArcMatrix.authority, 'HISTORICAL_ONLY');

  const manifest = await json(MANIFEST_URL);
  assert.equal(manifest.currentLaunchPlan.chainId, 4663);
  assert.equal(manifest.currentLaunchPlan.historicalArcAuthority, 'HISTORICAL_ONLY_NOT_PONS_AUTHORITY');
  assert.notEqual(manifest.launchGateStatus.matrix, 'docs/LAUNCH_GATE_MATRIX_V0.json');
});

test('gate evidence cannot be silently removed and blocked legal cannot silently satisfy', async () => {
  const matrix = await json(MATRIX_URL);
  const originalDigest = matrix.matrixDigest;
  matrix.gates.launch_mechanics_verification_receipt.evidenceArtifacts.push('tampered');
  assert.notEqual(await deriveLaunchGateMatrixDigest(matrix), originalDigest);
  matrix.gates.launch_mechanics_verification_receipt.evidenceArtifacts = [];
  matrix.matrixDigest = await deriveLaunchGateMatrixDigest(matrix);
  assert.throws(() => validateLaunchGateMatrix(matrix), /EVIDENCE_MISSING/);

  const legal = await json(MATRIX_URL);
  legal.gates.legal_compliance_artifacts.status = 'SATISFIED';
  legal.matrixDigest = await deriveLaunchGateMatrixDigest(legal);
  assert.throws(() => validateLaunchGateMatrix(legal), /LEGAL_BOUNDARY_INVALID/);
});

test('future Pons token execution cannot satisfy without token, transaction, block, and hash', async () => {
  const matrix = validateLaunchGateMatrix(await json(MATRIX_URL));
  const gate = matrix.gates.actual_token_address_and_launch_execution_receipt;
  assert.equal(gate.status, 'BLOCKED_FUTURE_EVENT');
  assert.equal(gate.liveEvidence.tokenAddress, null);
  assert.equal(gate.liveEvidence.launchTransaction, null);
  assert.equal(gate.liveEvidence.launchBlock, null);
  assert.equal(gate.liveEvidence.launchBlockHash, null);
  assert.equal(gate.blocksLaunchAuthorization, true);
});

test('final allocation and Working Rat readiness both count as launch blockers', async () => {
  const matrix = validateLaunchGateMatrix(await json(MATRIX_URL));
  assert.equal(
    matrix.gates.rat_radar_free_value_and_holder_gate_smoke.blocksLaunchAuthorization,
    true
  );
  assert.equal(
    matrix.gates.allocation_and_privileged_inventory_disclosure.blocksLaunchAuthorization,
    true
  );
});

test('Working Rat remains partial until a reviewed active-stake source exists', async () => {
  const matrix = validateLaunchGateMatrix(await json(MATRIX_URL));
  const holder = matrix.gates.rat_radar_free_value_and_holder_gate_smoke;
  assert.equal(holder.status, 'PARTIAL');
  assert.equal(holder.liveEvidence.entitlementModel, 'ACTIVE_STAKE_WORKING_RAT_PLANNED');
  assert.equal(holder.liveEvidence.stakeSource, 'L1B_STAKED_OF_PINNED_L2_NOT_IMPLEMENTED');
  assert.equal(holder.liveEvidence.stakeReadSelector, '0xaf500ba3');
  assert.equal(holder.liveEvidence.productionEligibilityActive, false);
  assert.equal(holder.blocksLaunchAuthorization, true);
});

test('all mandatory gates and explicit owner authority remain required', async () => {
  const matrix = validateLaunchGateMatrix(await json(MATRIX_URL));
  assert.equal(launchAuthorizationEligible(matrix, 'NOT_GRANTED'), false);
  assert.equal(launchAuthorizationEligible(matrix, 'GRANTED'), false);

  const allSatisfied = structuredClone(matrix);
  for (const id of REQUIRED_LAUNCH_GATE_IDS) allSatisfied.gates[id].status = 'SATISFIED';
  assert.equal(launchAuthorizationEligible(allSatisfied, 'NOT_GRANTED'), false);
  assert.equal(launchAuthorizationEligible(allSatisfied, 'GRANTED'), true);

  // Legacy Arc launch config remains valid only as historical role/accounting evidence.
  const config = await validateLaunchConfig(await json(CONFIG_URL));
  const manifest = await json(MANIFEST_URL);
  validateCapabilityManifest(manifest);
  validateLaunchStatusConsistency(config, manifest);
  assert.equal(manifest.historicalArcLaunchConfiguration.configDigest, LAUNCH_CONFIG_DIGEST);
  assert.equal(
    manifest.historicalArcLaunchConfiguration.authorityScope,
    'HISTORICAL_ARC_V0_ROLE_BINDING_ONLY_NOT_CURRENT_PUBLIC_ROLE_SOURCE'
  );
  assert.equal(manifest.currentPonsLaunchConfiguration.chainId, 4663);
  assert.equal(manifest.currentPonsLaunchConfiguration.treasuryAddress, null);
  assert.equal(manifest.currentPonsLaunchConfiguration.creatorTaxBps, 0);
  assert.equal(manifest.currentPonsLaunchConfiguration.openingBuyWei, '0');
  assert.equal(manifest.launchAuthorization.status, 'BLOCKED');
});
