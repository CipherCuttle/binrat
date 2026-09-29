import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { checkTokenPublication } from '../src/tokenLaunch/publication.js';

const root = new URL('../', import.meta.url);
const controlPath = new URL('../docs/launch/BINRAT_LAUNCH_CONTROL_V1.json', import.meta.url);

test('prelaunch control keeps publication, execution, spend and holder activation blocked', async () => {
  const control = JSON.parse(await readFile(controlPath, 'utf8'));
  assert.equal(control.status, 'PREFLIGHT_BLOCKED');
  assert.equal(control.token.state, 'NOT_LAUNCHED');
  assert.equal(control.token.canonicalContractAddress, null);
  assert.equal(control.authorityBoundary.launchExecution, false);
  assert.equal(control.authorityBoundary.personalWalletSpend, false);
  assert.equal(control.authorityBoundary.holderActivation, false);
  assert.equal(control.legal.marketingAuthorized, false);
  assert.equal(control.legal.launchAuthorized, false);
  assert.equal(control.token.launchPolicy.launchAndBuy, 'NONE_UNLESS_SEPARATELY_AUTHORIZED');
});

test('Pons roles cannot silently inherit Arc addresses or personal buyer authority', async () => {
  const control = JSON.parse(await readFile(controlPath, 'utf8'));
  for (const role of Object.values(control.walletRoles) as any[]) {
    assert.equal(role.chainId, 4663);
    assert.equal(role.publicAddress, null);
    assert.equal(role.approved, false);
  }
  assert.match(control.rail.historicalArcRecord.status, /HISTORICAL_ONLY/);
  assert.match(control.walletRoles.personalBuyer.notes, /No allocation/);
});

test('identity and manifest templates cannot publish a placeholder contract', async () => {
  const [identity, manifest] = await Promise.all([
    readFile(new URL('../docs/launch/BINRAT_OFFICIAL_IDENTITY_V1.json', import.meta.url), 'utf8'),
    readFile(new URL('../docs/launch/BINRAT_LAUNCH_TRANSACTION_MANIFEST_V1.template.json', import.meta.url), 'utf8')
  ]);
  assert.equal(JSON.parse(identity).tokenStatus.canonicalContractAddress, null);
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.status, 'UNFROZEN_TEMPLATE_NOT_AUTHORIZATION');
  assert.equal(parsed.authorization.ownerExecutionAuthorized, false);
  assert.equal(parsed.salt, null);
});

test('preflight and verifier contain no signing, broadcast or wallet-client API', async () => {
  const source = await Promise.all(['scripts/pons-preflight.ts', 'scripts/verify-pons-launch.ts'].map((path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
  for (const forbidden of ['createWalletClient', 'privateKeyToAccount', 'writeContract', 'sendTransaction', 'signTransaction', 'signTypedData', 'sendRawTransaction']) {
    assert.equal(source.join('\n').includes(forbidden), false, forbidden);
  }
});

test('capacity doctrine preserves factual equality across FREE and HOLDER', async () => {
  const utility = await readFile(new URL('../docs/launch/BINRAT_TOKEN_UTILITY_V1.md', import.meta.url), 'utf8');
  assert.match(utility, /facts remain identical to FREE/);
  assert.match(utility, /capacity only/);
  assert.equal(root.protocol, 'file:');
});

test('publication checker rejects a prelaunch placeholder and mismatched postlaunch addresses', () => {
  assert.equal(checkTokenPublication({ state: 'NOT_LAUNCHED', canonicalContractAddress: null, surfaces: [{ id: 'web', content: '$BINRAT IS NOT LIVE' }] })[0]?.status, 'PASS');
  assert.equal(checkTokenPublication({ state: 'NOT_LAUNCHED', canonicalContractAddress: null, surfaces: [{ id: 'web', content: '0x0000000000000000000000000000000000000001' }] })[0]?.status, 'BLOCKED');
  assert.equal(checkTokenPublication({ state: 'PUBLICATION_ELIGIBLE', canonicalContractAddress: '0x0000000000000000000000000000000000000001', surfaces: [{ id: 'web', content: '0x0000000000000000000000000000000000000002' }] })[0]?.status, 'BLOCKED');
});
