import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectPublicProduct, validateTransportedProduct } from '../src/public/productProjection.js';
import { renderRatReply, validateCapabilityManifest, type CapabilityManifest } from '../src/telegram/rat.js';
import { validateLaunchGateMatrix, validateLaunchGateStatusConsistency, launchAuthorizationEligible } from '../src/launchConfig/gateMatrix.js';

const manifest = () => JSON.parse(readFileSync('docs/CAPABILITY_MANIFEST_V0.json', 'utf8')) as CapabilityManifest;

test('integration H1: C2 nested entitlement and Staking contradictions revoke C1 Working Rat projection', async () => {
  for (const [field, value] of [['productionEntitlementActive', true], ['workingRatStatus', 'ACTIVE'], ['stakingRequired', false]] as const) {
    const raw = manifest();
    raw.currentPonsLaunchConfiguration![field] = value;
    assert.throws(() => validateCapabilityManifest(raw), /CURRENT_PONS_CONFIG_INVALID/);
    const product = await projectPublicProduct({ manifest: raw, snapshot: null, status: null });
    assert.equal(product.workingRat.workingRatStatus, 'UNVERIFIED', field);
    assert.equal(product.workingRat.productionEntitlementActive, null, field);
    assert.equal(product.crew.find(rat => rat.id === 'working-rat')!.status, 'UNVERIFIED', field);
    assert.equal(product.crew.find(rat => rat.id === 'working-rat')!.actionAvailable, false, field);
  }
});

test('integration H1: the public Staking boundary states the required launch vault without claiming labor activation', async () => {
  const raw = manifest();
  validateCapabilityManifest(raw);
  const product = await projectPublicProduct({ manifest: raw, snapshot: null, status: null });
  assert.match(product.workingRat.stakingBoundary, /Staking is required at token launch/);
  assert.match(product.workingRat.stakingBoundary, /does not activate Working Rat entitlement/);
  assert.equal(product.workingRat.workingRatStatus, 'PLANNED');
  assert.equal(product.workingRat.productionEntitlementActive, false);
  assert.equal(product.launchState.tokenState, 'NOT_LAUNCHED');
  assert.equal(product.launchState.launchAuthorized, false);
});

test('integration control: C2 gates remain phase-aware and fail-closed while C1 transport and Telegram stay coherent', async () => {
  const raw = manifest();
  const matrix = validateLaunchGateMatrix(JSON.parse(readFileSync('docs/LAUNCH_GATE_MATRIX_PONS_V1.json', 'utf8')));
  validateLaunchGateStatusConsistency(matrix, raw);
  assert.equal(matrix.gates.actual_token_address_and_launch_execution_receipt.blocksLaunchAuthorization, false);
  assert.equal(matrix.gates.rat_radar_free_value_and_holder_gate_smoke.blocksLaunchAuthorization, false);
  assert.equal(matrix.gates.legal_compliance_artifacts.status, 'BLOCKED_LEGAL');
  assert.equal(launchAuthorizationEligible(matrix, 'GRANTED'), false);
  raw.publicProduct = await projectPublicProduct({ manifest: raw, snapshot: null, status: null });
  assert.equal(await validateTransportedProduct(raw), raw.publicProduct);
  const reply = await renderRatReply('/token', {
    manifest: manifest(), manifestMode: 'REMOTE_FAIL_CLOSED', apiBaseUrl: 'https://api.example.test', siteUrl: 'https://binrat.example.test'
  }, async () => new Response(JSON.stringify(raw), { headers: { 'content-type': 'application/json' } }));
  assert.match(reply ?? '', /token state: NOT_LAUNCHED/);
  assert.match(reply ?? '', /Working Rat: PLANNED/);
  assert.match(reply ?? '', /Staking is required at token launch/);
  assert.match(reply ?? '', /does not activate Working Rat entitlement/);
  assert.doesNotMatch(reply ?? '', /authorized: YES|UNVERIFIED_REMOTE_STATUS/);
});
