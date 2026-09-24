import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  evaluatePonsCutoverCandidate,
  validatePonsSuccessorCandidate
} from '../src/launchConfig/ponsCutover.js';
import {
  BINRAT_TREASURY_ADDRESS,
  BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS,
  LAUNCH_CONFIG_DIGEST
} from '../src/launchConfig/config.js';
import { validateCapabilityManifest, renderRatReply, type CapabilityManifest } from '../src/telegram/rat.js';
import { projectDumpsterLedger } from '../src/dumpsterLedger/project.js';
import { resolveProductionFundingConfig, type FundingConfigResolution } from '../src/dumpsterLedger/config.js';
import { handleBinratApiRequest, type BinratWorkerEnv } from '../src/cloudflare/worker.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const SELECTION = new URL('../docs/BINRAT_PONS_LAUNCH_SELECTION_V1.json', import.meta.url);
const MANIFEST = new URL('../docs/CAPABILITY_MANIFEST_V0.json', import.meta.url);

async function artifacts() {
  const [selection, manifest] = await Promise.all(
    [SELECTION, MANIFEST].map(async url => JSON.parse(await readFile(url, 'utf8')) as Record<string, any>)
  );
  return { selection, manifest };
}

test('checked-in successor reconciles owner-selected Pons token against frozen Arc research', async () => {
  const { selection, manifest } = await artifacts();
  const view = evaluatePonsCutoverCandidate(selection, manifest);
  assert.equal(view.status, 'BLOCKED_PENDING_VERIFIED_PONS_AUTHORITY');
  assert.deepEqual(view.tokenNetwork, {
    chainId: 4663,
    rail: 'PONS_V2_DIRECT_FACTORY',
    factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e'
  });
  assert.deepEqual(view.researchNetwork, { chainId: 5042, purpose: 'ARC_RESEARCH_ONLY' });
  assert.equal(view.historicalArc.configDigest, LAUNCH_CONFIG_DIGEST);
  assert.equal(view.historicalArc.roles, 'HISTORICAL_ONLY_NOT_PONS');
  assert.equal(view.tokenAddress, null);
  assert.deepEqual(view.ownerRoles, { deployer: null, creatorFeeRecipient: null, treasury: null });
  assert.equal(view.holder.loginPolicyId, 'binrat.pons-candidate/v1');
  assert.equal(view.holder.balancePolicyId, null);
  assert.equal(view.holder.thresholdRaw, null);
  assert.equal(view.holder.holderAccessGranted, false);
  assert.deepEqual(view.funding, {
    creatorFeeRecipient: null, treasury: null, observerActive: false
  });
  assert.equal(view.marketingAuthorized, false);
  assert.equal(view.launchAuthorized, false);
  assert.ok(view.blockers.includes('FRESH_PONS_ONCHAIN_RECEIPT_REQUIRED'));
  assert.ok(view.blockers.includes('EXPLICIT_OWNER_LAUNCH_AUTHORITY_NOT_GRANTED'));
  validateCapabilityManifest(manifest);
});

test('missing successor cannot accidentally inherit the historical Arc token authority', async () => {
  const { selection, manifest } = await artifacts();
  delete manifest.tokenLaunchSuccessor;
  assert.throws(() => evaluatePonsCutoverCandidate(selection, manifest), /PONS_SUCCESSOR_INVALID/);
  // An old-style fixture must omit the dependent discovery record as well.
  // Keeping discovery without its successor remains invalid and must fail closed.
  assert.throws(() => validateCapabilityManifest(manifest), /PONS_SUCCESSOR_INVALID/);
  delete manifest.tokenLaunchDiscovery;
  validateCapabilityManifest(manifest);
});

test('even invented Pons role or token address is rejected before any launch claim', async () => {
  const { selection, manifest } = await artifacts();
  for (const [field, value] of [
    ['treasury', BINRAT_TREASURY_ADDRESS],
    ['creatorFeeRecipient', BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS],
    ['deployer', BINRAT_TREASURY_ADDRESS],
    ['tokenAddress', BINRAT_TREASURY_ADDRESS],
    ['holderThresholdRaw', '1'],
    ['holderBalancePolicyId', 'binrat.pons-holder/v1'],
    ['holderAccessActive', true],
    ['accountingActive', true],
    ['freshPonsReceiptVerified', true],
    ['legalComplianceSatisfied', true],
    ['launchAuthorized', true],
    ['marketingAuthorized', true],
    ['ownerAuthority', 'GRANTED'],
    ['unreviewedNewPermission', true]
  ] as const) {
    const bad = structuredClone(manifest);
    bad.tokenLaunchSuccessor[field] = value;
    assert.throws(
      () => evaluatePonsCutoverCandidate(selection, bad),
      /PONS_SUCCESSOR_(AUTHORITY_ESCALATION|UNEXPECTED_FIELDS)/,
      field
    );
    assert.throws(() => validateCapabilityManifest(bad), /PONS_SUCCESSOR_/, field);
  }
});

test('wrong Pons chain, factory, stale snapshot override or role reuse fail closed', async () => {
  const { selection, manifest } = await artifacts();
  const mutate = [
    (v: any) => { v.selectedTokenNetwork.chainId = 5042; },
    (v: any) => { v.selectedTokenNetwork.factory = '0x0000000000000000000000000000000000000001'; },
    (v: any) => { v.researchNetwork.chainId = 4663; },
    (v: any) => { v.historicalSupersededCandidate.digest = 'a'.repeat(64); },
    (v: any) => { v.readOnlyEvidence.currentSnapshotMustBeRefreshed = false; },
    (v: any) => { v.ownerInputs.treasury = BINRAT_TREASURY_ADDRESS; },
    (v: any) => { v.ownerInputs.creatorFeeRecipient = BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS; },
    (v: any) => { v.ownerInputs.ownerCustodyProofStatus = 'VERIFIED'; },
    (v: any) => { v.candidatePolicy.extraOpeningTaxExemptions = [BINRAT_TREASURY_ADDRESS]; },
    (v: any) => { v.token.address = BINRAT_TREASURY_ADDRESS; },
    (v: any) => { v.holderEntitlement.eligibilityActive = true; },
    (v: any) => { v.funding.productionObserverStatus = 'ACTIVE'; },
    (v: any) => { v.authorization.legalComplianceSatisfied = true; }
  ];
  for (const change of mutate) {
    const bad = structuredClone(selection);
    change(bad);
    assert.throws(() => evaluatePonsCutoverCandidate(bad, manifest), /PONS_CUTOVER_SELECTION_CONTRADICTION/);
  }
});

test('historical Arc config mutation or false launch status never qualifies Pons successor', async () => {
  const { selection, manifest } = await artifacts();
  const wrongLegacy = structuredClone(manifest);
  wrongLegacy.launchConfiguration.treasuryAddress = null;
  assert.throws(
    () => evaluatePonsCutoverCandidate(selection, wrongLegacy),
    /PONS_CUTOVER_LEGACY_STATUS_CONTRADICTION/
  );
  const wrongToken = structuredClone(manifest);
  wrongToken.launchAuthorization.tokenState = 'LAUNCHED';
  assert.throws(
    () => evaluatePonsCutoverCandidate(selection, wrongToken),
    /PONS_CUTOVER_LEGACY_STATUS_CONTRADICTION/
  );
  assert.throws(() => validateCapabilityManifest(wrongToken), /AUTHORIZATION_ESCALATION/);
});

test('ledger clearly separates Arc V0 historical addresses from unverified Pons roles', async () => {
  const { manifest } = await artifacts();
  const ledger = await projectDumpsterLedger(
    manifest as unknown as CapabilityManifest,
    resolveProductionFundingConfig(undefined, 5042),
    []
  );
  assert.equal(ledger.chainId, 5042);
  assert.equal(ledger.historicalRoleScope, 'ARCPAD_V0_HISTORICAL_ONLY_NOT_PONS');
  assert.equal(ledger.configuredAuthorities.treasury.address, BINRAT_TREASURY_ADDRESS);
  assert.equal(ledger.configuredAuthorities.projectFeeRecipient.address, BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS);
  assert.deepEqual(ledger.successorToken, {
    status: 'SELECTED_CANDIDATE_BLOCKED',
    tokenChainId: 4663,
    researchChainId: 5042,
    tokenAddress: null,
    treasury: null,
    creatorFeeRecipient: null,
    holderAccessActive: false,
    accountingActive: false
  });
  assert.equal(ledger.fundingAuthority.accountingEnabled, false);
  assert.equal(ledger.fundingAuthority.tokenAddress, null);
  assert.deepEqual(ledger.entries, []);
  assert.match(ledger.explanation, /historical ArcPad V0/i);
  assert.match(ledger.evidenceBoundary, /NOT Pons/i);
});

test('Arc runtime funding input cannot silently become production Pons accounting', async () => {
  const { manifest } = await artifacts();
  const fakeLegacyFunding: FundingConfigResolution = {
    status: 'FUNDING_OBSERVATION_SOURCE_NOT_IMPLEMENTED',
    config: { chainId: 5042 } as FundingConfigResolution['config']
  };
  await assert.rejects(
    projectDumpsterLedger(manifest as unknown as CapabilityManifest, fakeLegacyFunding, []),
    /DUMPSTER_LEDGER_PONS_FUNDING_CROSS_CHAIN_BLOCKED/
  );
});

test('Telegram /token and API status label Arc wallet roles as historical, never Pons custody', async () => {
  const { manifest } = await artifacts();
  const validated = validateCapabilityManifest(manifest);
  const rat = await renderRatReply('/token', {
    apiBaseUrl: 'https://binrat.example',
    siteUrl: 'https://binrat.example',
    manifest: validated
  });
  assert.match(rat ?? '', /Pons V2 on Robinhood 4663/);
  assert.match(rat ?? '', /Arc 5042 \(research only\)/);
  assert.match(rat ?? '', /Pons treasury: NOT_VERIFIED/);
  assert.match(rat ?? '', /Pons fee recipient: NOT_VERIFIED/);
  assert.match(rat ?? '', /legacy Arc treasury \(not Pons\)/);
  assert.match(rat ?? '', /token state: NOT_LAUNCHED/);
  assert.match(rat ?? '', /marketing authorized: NO/);
  const db = new D1CompatDatabase();
  try {
    const env: BinratWorkerEnv = {
      DB: db,
      CAPABILITY_MANIFEST_JSON: JSON.stringify(manifest)
    };
    const response = await handleBinratApiRequest(
      new Request('https://binrat.example/api/capabilities'),
      env,
      { externalFetch: fetch, now: () => 1_800_000_000_000 }
    );
    assert.equal(response.status, 200);
    const body = await response.json() as CapabilityManifest;
    assert.equal(body.tokenLaunchSuccessor?.tokenChainId, 4663);
    assert.equal(body.tokenLaunchSuccessor?.treasury, null);
    assert.equal(body.launchAuthorization.launchAuthorized, false);
    assert.equal(body.launchAuthorization.marketingAuthorized, false);
  } finally { db.close(); }
});
