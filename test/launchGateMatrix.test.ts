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
import { validateCapabilityManifest } from '../src/telegram/rat.js';

const MATRIX_URL = new URL('../docs/LAUNCH_GATE_MATRIX_V0.json', import.meta.url);
const CONFIG_URL = new URL('../docs/BINRAT_LAUNCH_CONFIG_V0.json', import.meta.url);
const MANIFEST_URL = new URL('../docs/CAPABILITY_MANIFEST_V0.json', import.meta.url);

async function json(url: URL): Promise<Record<string, any>> {
  return JSON.parse(await readFile(url, 'utf8')) as Record<string, any>;
}

test('canonical Launch V0 gate matrix is complete, digested, and evidence-bound', async () => {
  const matrix = await json(MATRIX_URL);
  const validated = validateLaunchGateMatrix(matrix);
  assert.deepEqual(Object.keys(validated.gates).sort(), [...REQUIRED_LAUNCH_GATE_IDS].sort());
  assert.equal(await deriveLaunchGateMatrixDigest(matrix), matrix.matrixDigest);
  for (const id of REQUIRED_LAUNCH_GATE_IDS) {
    assert.ok(matrix.gates[id].evidenceArtifacts.length > 0, id);
  }
  const manifest = await json(MANIFEST_URL);
  validateLaunchGateStatusConsistency(validated, manifest);
});

test('satisfied gates cannot omit evidence and blocked legal cannot silently satisfy', async () => {
  const matrix = await json(MATRIX_URL);
  const originalDigest = matrix.matrixDigest;
  matrix.gates.launch_mechanics_verification_receipt.evidenceArtifacts.push('tampered');
  assert.notEqual(await deriveLaunchGateMatrixDigest(matrix), originalDigest);
  matrix.gates.launch_mechanics_verification_receipt.evidenceArtifacts.pop();
  matrix.gates.launch_mechanics_verification_receipt.evidenceArtifacts = [];
  matrix.matrixDigest = await deriveLaunchGateMatrixDigest(matrix);
  assert.throws(() => validateLaunchGateMatrix(matrix), /EVIDENCE_MISSING/);

  const legal = await json(MATRIX_URL);
  legal.gates.legal_compliance_artifacts.status = 'SATISFIED';
  legal.matrixDigest = await deriveLaunchGateMatrixDigest(legal);
  assert.throws(() => validateLaunchGateMatrix(legal), /LEGAL_BOUNDARY_INVALID/);
  const manifest = await json(MANIFEST_URL);
  assert.equal(manifest.launchAuthorization.legalComplianceStatus, 'NOT_SATISFIED');
});

test('future token execution cannot satisfy without token, transaction, block, and hash', async () => {
  const matrix = await json(MATRIX_URL);
  const gate = matrix.gates.actual_token_address_and_launch_execution_receipt;
  assert.equal(gate.status, 'BLOCKED_FUTURE_EVENT');
  assert.equal(gate.liveEvidence.tokenAddress, null);
  assert.equal(gate.liveEvidence.launchTransaction, null);
  assert.equal(gate.liveEvidence.launchBlock, null);
  assert.equal(gate.liveEvidence.launchBlockHash, null);
  assert.equal(gate.blocksLaunchAuthorization, true);
});

test('holder partial state and Rat Watch maturity do not masquerade as production launch evidence', async () => {
  const matrix = validateLaunchGateMatrix(await json(MATRIX_URL));
  assert.equal(matrix.gates.rat_radar_free_value_and_holder_gate_smoke.status, 'PARTIAL');
  assert.equal(matrix.gates.rat_radar_free_value_and_holder_gate_smoke.liveEvidence.productionEligibilityActive, false);
  assert.equal(matrix.gates.rat_watch_live_subscription_and_delivery_smoke.status, 'SATISFIED');
  assert.equal(matrix.gates.rat_watch_live_subscription_and_delivery_smoke.liveEvidence.realRecurrenceStatus, 'PENDING_REAL_FUTURE_LAUNCH');
  assert.equal(matrix.gates.rat_watch_live_subscription_and_delivery_smoke.blocksLaunchAuthorization, false);
});

test('all mandatory gates and explicit owner authority are required before launch authorization', async () => {
  const matrix = validateLaunchGateMatrix(await json(MATRIX_URL));
  assert.equal(launchAuthorizationEligible(matrix, 'NOT_GRANTED'), false);
  assert.equal(launchAuthorizationEligible(matrix, 'GRANTED'), false);
  const allSatisfied = structuredClone(matrix);
  for (const id of REQUIRED_LAUNCH_GATE_IDS) allSatisfied.gates[id].status = 'SATISFIED';
  assert.equal(launchAuthorizationEligible(allSatisfied, 'NOT_GRANTED'), false);
  assert.equal(launchAuthorizationEligible(allSatisfied, 'GRANTED'), true);
  const config = await validateLaunchConfig(await json(CONFIG_URL));
  const manifest = await json(MANIFEST_URL);
  validateCapabilityManifest(manifest);
  validateLaunchStatusConsistency(config, manifest);
  assert.equal(manifest.launchConfiguration.configDigest, LAUNCH_CONFIG_DIGEST);
  assert.equal(manifest.launchAuthorization.status, 'BLOCKED');
});
