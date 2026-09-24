import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const V1_URL = new URL('../docs/BINRAT_PONS_LAUNCH_SELECTION_V1.json', import.meta.url);
const LEGACY_URL = new URL('../docs/BINRAT_LAUNCH_CONFIG_V0.json', import.meta.url);
const MANIFEST_URL = new URL('../docs/CAPABILITY_MANIFEST_V0.json', import.meta.url);

test('Robinhood/Pons is selected for planning without silently upgrading launch authority', async () => {
  const [v1, old, manifest] = await Promise.all([V1_URL, LEGACY_URL, MANIFEST_URL].map(async url => JSON.parse(await readFile(url, 'utf8'))));
  assert.equal(v1.selectedTokenNetwork.chainId, 4663);
  assert.equal(v1.researchNetwork.chainId, 5042);
  assert.equal(v1.holderEntitlement.balanceChainId, 4663);
  assert.equal(v1.holderEntitlement.researchChainId, 5042);
  assert.equal(old.chainId, 5042);
  assert.equal(v1.historicalSupersededCandidate.digest, old.configDigest);
  assert.equal(v1.documentStatus, 'OWNER_SELECTED_PLANNING_CANDIDATE_NOT_RUNTIME_AUTHORITY');
  assert.equal(manifest.launchAuthorization.status, 'BLOCKED');
  assert.equal(manifest.launchAuthorization.launchAuthorized, false);
  assert.equal(manifest.launchAuthorization.marketingAuthorized, false);
  assert.equal(v1.authorization.launchAuthorized, false);
  assert.equal(v1.authorization.marketingAuthorized, false);
  assert.equal(v1.token.address, null);
  assert.equal(v1.holderEntitlement.eligibilityActive, false);
  assert.equal(v1.funding.productionObserverStatus, 'NOT_ACTIVATED');
});

test('no unproved Arc wallet authority or unsupported launch input is inherited on Robinhood', async () => {
  const v1 = JSON.parse(await readFile(V1_URL, 'utf8'));
  const p = v1.candidatePolicy;
  assert.equal(p.creatorTaxBps, 0);
  assert.equal(p.buybackEnabled, false);
  assert.equal(p.founderOpeningBuy, false);
  assert.deepEqual(p.extraOpeningTaxExemptions, []);
  assert.equal(v1.ownerInputs.deployer, null);
  assert.equal(v1.ownerInputs.creatorFeeRecipient, null);
  assert.equal(v1.ownerInputs.treasury, null);
  assert.equal(v1.ownerInputs.launchSalt, null);
  assert.equal(v1.ownerInputs.doNotInheritArcRoleAddressesSilently, true);
  assert.equal(v1.observedSnapshotNotFutureGuarantee.needsFreshOnchainCheck, true);
});
