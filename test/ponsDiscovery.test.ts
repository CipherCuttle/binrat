import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { evaluatePonsCutoverCandidate } from '../src/launchConfig/ponsCutover.js';
import { previewPonsListingMetadata, validatePonsDiscoveryDraft } from '../src/launchConfig/ponsDiscovery.js';
import { renderRatReply, validateCapabilityManifest } from '../src/telegram/rat.js';

const dir = new URL('../', import.meta.url);
const getText = (path: string) => readFile(new URL(path, dir), 'utf8');
const getJson = async (path: string): Promise<Record<string, any>> =>
  JSON.parse(await getText(path)) as Record<string, any>;

test('one canonical Pons discovery draft cannot become public launch metadata', async () => {
  const [raw, selection, manifest] = await Promise.all([
    getJson('docs/PONS_DISCOVERY_CANDIDATE_V1.json'),
    getJson('docs/BINRAT_PONS_LAUNCH_SELECTION_V1.json'),
    getJson('docs/CAPABILITY_MANIFEST_V0.json')
  ]);
  const discovery = validatePonsDiscoveryDraft(
    raw, manifest.tokenLaunchDiscovery, manifest.tokenLaunchSuccessor
  );
  const cutover = evaluatePonsCutoverCandidate(selection, manifest);
  const preview = previewPonsListingMetadata(discovery);

  assert.equal(discovery.status, 'DRAFT_NOT_PUBLISHABLE');
  assert.equal(discovery.token.tokenAddress, null);
  assert.equal(discovery.token.launchTransaction, null);
  assert.equal(discovery.token.ponsListingUrl, null);
  assert.equal(discovery.token.chainId, cutover.tokenNetwork.chainId);
  assert.equal(discovery.token.factory, cutover.tokenNetwork.factory);
  assert.equal(discovery.research.chainId, cutover.researchNetwork.chainId);
  assert.equal(discovery.destinations.officialWebsite, null);
  assert.equal(discovery.destinations.officialTelegram, null);
  assert.equal(discovery.destinations.officialX, null);
  assert.equal(discovery.destinations.telegramCandidateStatus, 'USER_REPORTED_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED');
  assert.equal(discovery.destinations.verifiedGithub, 'https://github.com/CipherCuttle/binrat');
  assert.equal(discovery.proof.ponsDeployerCustody, 'NOT_VERIFIED');
  assert.equal(discovery.proof.ponsFeeRecipientCustody, 'NOT_VERIFIED');
  assert.equal(discovery.proof.ponsTreasuryCustody, 'NOT_VERIFIED');
  assert.equal(discovery.proof.readOnlyPonsMechanics.freshReadRequired, true);
  assert.equal(discovery.proof.readOnlyPonsMechanics.currentStateVerified, false);
  assert.equal(discovery.authority.launchAuthorized, false);
  assert.equal(discovery.authority.marketingAuthorized, false);
  assert.equal(discovery.authority.metadataPublishAuthorized, false);
  assert.equal(discovery.authority.holderEntitlementActive, false);
  assert.equal(discovery.authority.fundingObserverActive, false);

  assert.equal(preview.publishable, false);
  assert.equal(preview.launchAuthorized, false);
  assert.equal(preview.logo, '');
  assert.deepEqual(preview.socials, {
    website: '', twitter: '', telegram: '', discord: '', farcaster: ''
  });
  assert.ok(preview.blockers.includes('FRESH_PONS_READ_ONLY_RECEIPT_REQUIRED'));
  assert.ok(preview.blockers.includes('PONS_WALLET_CUSTODY_UNVERIFIED'));
});

test('draft schema rejects forged official links, owner authority and fake launch receipts', async () => {
  const [raw, manifest] = await Promise.all([
    getJson('docs/PONS_DISCOVERY_CANDIDATE_V1.json'),
    getJson('docs/CAPABILITY_MANIFEST_V0.json')
  ]);
  const adversarial = [
    (x: Record<string, any>) => { x.token.tokenAddress = '0xab063A9b53a2Ab832a941aE5890ea05c1672339D'; },
    (x: Record<string, any>) => { x.destinations.officialTelegram = 'https://t.me/not_binrat'; },
    (x: Record<string, any>) => { x.destinations.telegramCandidateStatus = 'INDEPENDENTLY_VERIFIED'; },
    (x: Record<string, any>) => { x.authority.marketingAuthorized = true; },
    (x: Record<string, any>) => { x.authority.metadataPublishAuthorized = true; },
    (x: Record<string, any>) => { x.proof.readOnlyPonsMechanics.currentStateVerified = true; },
    (x: Record<string, any>) => { x.proof.ponsTreasuryCustody = 'VERIFIED'; },
    (x: Record<string, any>) => { x.identity.undisclosedPresale = true; }
  ];
  for (const mutate of adversarial) {
    const item = structuredClone(raw);
    mutate(item);
    assert.throws(() => validatePonsDiscoveryDraft(
      item, manifest.tokenLaunchDiscovery, manifest.tokenLaunchSuccessor
    ), /PONS_DISCOVERY_/);
  }
});

test('website and unpublished announcement separate research from planned token', async () => {
  const [html, doc, draft] = await Promise.all([
    getText('web/index.html'),
    getText('docs/LAUNCH_PRESENTATION_V0.md'),
    getJson('docs/PONS_DISCOVERY_CANDIDATE_V1.json')
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
  assert.match(draft.identity.description, /Pons V2 candidate on Robinhood Chain/);
  assert.doesNotMatch(html, /href="https:\/\/(?:x\.com|twitter\.com|t\.me)\//i);
  const displayed = html.match(/0x[0-9a-fA-F]{40}/g) ?? [];
  assert.ok(displayed.length >= 2);
  assert.deepEqual([...new Set(displayed)].sort(), [
    '0xab063A9b53a2Ab832a941aE5890ea05c1672339D',
    '0xba5Ee49734b50Cf62d0B538584fbaC0eFFB79866'
  ].sort(), 'only separately labeled historical Arc addresses may appear in this preview');
});

test('Telegram token wording agrees with canonical discovery but grants no rights', async () => {
  const [draft, selection, manifest] = await Promise.all([
    getJson('docs/PONS_DISCOVERY_CANDIDATE_V1.json'),
    getJson('docs/BINRAT_PONS_LAUNCH_SELECTION_V1.json'),
    getJson('docs/CAPABILITY_MANIFEST_V0.json')
  ]);
  const discovery = validatePonsDiscoveryDraft(draft, manifest.tokenLaunchDiscovery, manifest.tokenLaunchSuccessor);
  const cutover = evaluatePonsCutoverCandidate(selection, manifest);
  const reply = await renderRatReply('/token', {
    apiBaseUrl: 'https://api.invalid',
    siteUrl: 'https://invalid.example',
    manifest: validateCapabilityManifest(manifest)
  });
  assert.equal(discovery.token.chainId, cutover.tokenNetwork.chainId);
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
