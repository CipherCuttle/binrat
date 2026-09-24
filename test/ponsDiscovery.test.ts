import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { evaluatePonsCutoverCandidate } from '../src/launchConfig/ponsCutover.js';
import { renderRatReply, validateCapabilityManifest } from '../src/telegram/rat.js';

const dir = new URL('../', import.meta.url);
const getText = (path: string) => readFile(new URL(path, dir), 'utf8');
const getJson = async (path: string): Promise<Record<string, any>> =>
  JSON.parse(await getText(path)) as Record<string, any>;

test('prelaunch Pons listing candidate is not publishable or launch calldata', async () => {
  const [metadata, selection, manifest] = await Promise.all([
    getJson('docs/PONS_DISCOVERY_METADATA_V1.json'),
    getJson('docs/BINRAT_PONS_LAUNCH_SELECTION_V1.json'),
    getJson('docs/CAPABILITY_MANIFEST_V0.json')
  ]);
  const cutover = evaluatePonsCutoverCandidate(selection, manifest);
  assert.equal(metadata.publicationStatus, 'INTERNAL_PRELAUNCH_DRAFT_NOT_FOR_LISTING');
  assert.equal(metadata.ownerApproval, 'NOT_GRANTED');
  assert.equal(metadata.launchAuthorized, false);
  assert.equal(metadata.marketingAuthorized, false);
  assert.equal(metadata.token.status, 'NOT_LAUNCHED');
  assert.equal(metadata.token.contractAddress, null);
  assert.equal(metadata.token.launchTransaction, null);
  assert.equal(metadata.token.launchBlock, null);
  assert.equal(metadata.token.chainId, cutover.tokenNetwork.chainId);
  assert.equal(metadata.token.factory, cutover.tokenNetwork.factory);
  assert.equal(metadata.product.researchChainId, cutover.researchNetwork.chainId);
  assert.equal(metadata.product.paidHolderAccessActive, false);
  assert.equal(metadata.product.publicReceiptsRemainFree, true);
  assert.deepEqual(
    [metadata.ownerRoles.deployer, metadata.ownerRoles.creatorFeeRecipient, metadata.ownerRoles.treasury],
    [null, null, null]
  );
  assert.equal(metadata.ownerRoles.custodyProof, 'NOT_SUPPLIED');
  assert.equal(metadata.presentation.logoUrl, null);
  assert.equal(metadata.presentation.verifiedWebsiteUrl, null);
  assert.equal(metadata.presentation.verifiedTelegramUrl, null);
  assert.equal(metadata.presentation.verifiedXUrl, null);
  assert.equal(metadata.presentation.sourceRepositoryUrl, 'https://github.com/CipherCuttle/binrat');
  assert.ok(Object.values(metadata.verification).every(value => value === false));
});

test('website and prelaunch announcement cannot confuse token and research networks', async () => {
  const [html, doc, meta] = await Promise.all([
    getText('web/index.html'),
    getText('docs/LAUNCH_PRESENTATION_V0.md'),
    getJson('docs/PONS_DISCOVERY_METADATA_V1.json')
  ]);
  assert.match(html, /Arc 5042 \/ ArcPad-reported creator and launch evidence/);
  assert.match(html, /Pons V2 \/ Robinhood Chain 4663/);
  assert.match(html, /NO OFFICIAL BINRAT CONTRACT EXISTS ON ROBINHOOD CHAIN 4663/);
  assert.match(html, /HISTORICAL ARCPAD V0 ROLE DECLARATIONS — NOT PONS CUSTODY PROOF/);
  assert.match(html, /PONS DEPLOYER: NOT_VERIFIED/);
  assert.match(html, /PONS TREASURY: NOT_VERIFIED/);
  assert.match(html, /PONS CREATOR FEE RECIPIENT: NOT_VERIFIED/);
  assert.match(html, /\$BINRAT IS NOT LIVE\./);
  assert.match(html, /noindex,nofollow,noarchive/);
  assert.match(doc, /DO NOT PUBLISH UNTIL EXPLICIT TOKEN-LAUNCH AUTHORITY EXISTS/);
  assert.match(doc, /\$BINRAT is live on Robinhood Chain 4663 via Pons V2/);
  assert.doesNotMatch(doc, /\$BINRAT is live on Arc/);
  assert.match(doc, /INTERNAL PRELAUNCH DRAFT, NOT SUBMITTABLE/);
  assert.match(meta.presentation.description, /separate BINRAT token is planned for Pons V2/);
  assert.doesNotMatch(html, /href="https:\/\/(?:x\.com|twitter\.com|t\.me)\//i);
  const displayed = html.match(/0x[0-9a-fA-F]{40}/g) ?? [];
  assert.ok(displayed.length >= 2);
  assert.deepEqual([...new Set(displayed)].sort(), [
    '0xab063A9b53a2Ab832a941aE5890ea05c1672339D',
    '0xba5Ee49734b50Cf62d0B538584fbaC0eFFB79866'
  ].sort(), 'only separately labeled historical Arc addresses may appear in this preview');
});

test('Telegram token wording agrees with planned listing, but grants no rights', async () => {
  const [metadata, selection, manifest] = await Promise.all([
    getJson('docs/PONS_DISCOVERY_METADATA_V1.json'),
    getJson('docs/BINRAT_PONS_LAUNCH_SELECTION_V1.json'),
    getJson('docs/CAPABILITY_MANIFEST_V0.json')
  ]);
  const cutover = evaluatePonsCutoverCandidate(selection, manifest);
  const reply = await renderRatReply('/token', {
    apiBaseUrl: 'https://api.invalid',
    siteUrl: 'https://invalid.example',
    manifest: validateCapabilityManifest(manifest)
  });
  assert.equal(metadata.token.chainId, cutover.tokenNetwork.chainId);
  assert.match(reply ?? '', /Pons V2 on Robinhood 4663/);
  assert.match(reply ?? '', /Arc 5042 \(research only\)/);
  assert.match(reply ?? '', /Pons treasury: NOT_VERIFIED/);
  assert.match(reply ?? '', /Pons fee recipient: NOT_VERIFIED/);
  assert.match(reply ?? '', /legacy Arc treasury \(not Pons\)/);
  assert.match(reply ?? '', /token state: NOT_LAUNCHED/);
  assert.match(reply ?? '', /marketing authorized: NO/);
  assert.match(reply ?? '', /launch authorized: NO/);
  assert.equal(cutover.holder.holderAccessGranted, false);
  assert.equal(cutover.funding.observerActive, false);
});
