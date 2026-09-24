import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../web/launch-presentation.css', import.meta.url), 'utf8');
const launchDoc = readFileSync(new URL('../docs/LAUNCH_PRESENTATION_V0.md', import.meta.url), 'utf8');
const candidate = JSON.parse(readFileSync(new URL('../docs/PONS_DISCOVERY_CANDIDATE_V1.json', import.meta.url), 'utf8'));
const selection = JSON.parse(readFileSync(new URL('../docs/BINRAT_PONS_LAUNCH_SELECTION_V1.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../docs/CAPABILITY_MANIFEST_V0.json', import.meta.url), 'utf8'));


const requiredHtml = [
  '$BINRAT IS NOT LIVE.',
  'NO CONTRACT PUBLISHED',
  'NO PRESALE',
  'NO WALLET CONNECTION',
  '0xab063A9b53a2Ab832a941aE5890ea05c1672339D',
  '0xba5Ee49734b50Cf62d0B538584fbaC0eFFB79866',
  'ACCOUNTING OFF · HOLDER GATE OFF · LAUNCH BLOCKED',
  'TOKEN STATUS',
  'og:title',
  'og:description',
  'twitter:card',
  './launch-presentation.css',
  'Pons V2 / Robinhood Chain 4663',
  'Arc 5042',
  'PONS TREASURY: NOT_VERIFIED',
  'PONS CREATOR FEE RECIPIENT: NOT_VERIFIED',
  'HISTORICAL ARCPAD V0 ROLE DECLARATIONS — NOT PONS CUSTODY PROOF',
  'NO OFFICIAL BINRAT CONTRACT EXISTS ON ROBINHOOD CHAIN 4663'
];
for (const marker of requiredHtml) {
  if (!html.includes(marker)) throw new Error(`LAUNCH_PRESENTATION_MISSING:${marker}`);
}

if (!html.includes('noindex,nofollow,noarchive')) throw new Error('LAUNCH_PREVIEW_NOINDEX_REMOVED');
if (!css.includes('.token-status-section')) throw new Error('LAUNCH_STATUS_STYLE_MISSING');
if (!css.includes('.anti-scam-strip')) throw new Error('LAUNCH_ANTI_SCAM_STYLE_MISSING');
if (!css.includes('.token-discovery-path') || !css.includes('.historical-authorities')) {
  throw new Error('PONS_DISCOVERY_STATUS_STYLE_MISSING');
}
if (!launchDoc.includes('DO NOT PUBLISH UNTIL EXPLICIT TOKEN-LAUNCH AUTHORITY EXISTS.')) {
  throw new Error('LAUNCH_AUTHORITY_GATE_MISSING');
}
if (!launchDoc.includes('NOT LIVE') || !launchDoc.includes('NOT PUBLISHED') || !launchDoc.includes('presale: **NONE**')) {
  throw new Error('LAUNCH_STATUS_DOC_DRIFT');
}
if (!launchDoc.includes('Pons V2 direct factory / Robinhood Chain 4663') ||
    !launchDoc.includes('Arc 5042') ||
    !launchDoc.includes('$BINRAT is live on Robinhood Chain 4663 via Pons V2.') ||
    !launchDoc.includes('INTERNAL PRELAUNCH DRAFT, NOT SUBMITTABLE')) {
  throw new Error('PONS_DISCOVERY_PRESENTATION_DOC_DRIFT');
}

// Only the strict Pons discovery draft is canonical. Its user-reported bot URL is
// deliberately not an official social destination; the preview must not link it.
const proof = candidate.proof?.readOnlyPonsMechanics;
if (
  candidate.schemaVersion !== 'binrat.pons-discovery/1' ||
  candidate.status !== 'DRAFT_NOT_PUBLISHABLE' ||
  candidate.identity?.name !== 'BINRAT' ||
  candidate.identity?.symbol !== 'BINRAT' ||
  candidate.identity?.logoUrl !== null ||
  candidate.token?.chainId !== selection.selectedTokenNetwork.chainId ||
  candidate.token?.chainId !== manifest.tokenLaunchSuccessor?.tokenChainId ||
  candidate.token?.rail !== 'PONS_V2_DIRECT_FACTORY' ||
  candidate.token?.factory !== selection.selectedTokenNetwork.factory ||
  candidate.token?.factory !== manifest.tokenLaunchSuccessor?.ponsFactory ||
  candidate.token?.tokenAddress !== null ||
  candidate.token?.launchTransaction !== null ||
  candidate.token?.ponsListingUrl !== null ||
  candidate.research?.chainId !== selection.researchNetwork.chainId ||
  candidate.research?.chainId !== manifest.tokenLaunchSuccessor?.researchChainId ||
  candidate.research?.coverage !== 'ARC_RESEARCH_ONLY' ||
  candidate.destinations?.officialWebsite !== null ||
  candidate.destinations?.officialTelegram !== null ||
  candidate.destinations?.officialX !== null ||
  candidate.destinations?.officialDiscord !== null ||
  candidate.destinations?.officialFarcaster !== null ||
  candidate.destinations?.verifiedGithub !== 'https://github.com/CipherCuttle/binrat' ||
  candidate.destinations?.telegramCandidateStatus !== 'USER_REPORTED_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED' ||
  candidate.proof?.websiteControl !== 'NOT_VERIFIED' ||
  candidate.proof?.telegramControl !== 'NOT_VERIFIED' ||
  candidate.proof?.xControl !== 'NOT_VERIFIED' ||
  candidate.proof?.logoApproval !== 'NOT_APPROVED' ||
  candidate.proof?.ponsDeployerCustody !== 'NOT_VERIFIED' ||
  candidate.proof?.ponsFeeRecipientCustody !== 'NOT_VERIFIED' ||
  candidate.proof?.ponsTreasuryCustody !== 'NOT_VERIFIED' ||
  proof?.historicBlock !== selection.observedSnapshotNotFutureGuarantee.observedAtRobinhoodBlock ||
  proof?.freshReadRequired !== true ||
  proof?.currentStateVerified !== false ||
  candidate.authority?.launchAuthorized !== false ||
  candidate.authority?.marketingAuthorized !== false ||
  candidate.authority?.metadataPublishAuthorized !== false ||
  candidate.authority?.contractPublished !== false ||
  candidate.authority?.holderEntitlementActive !== false ||
  candidate.authority?.fundingObserverActive !== false ||
  manifest.tokenLaunchDiscovery?.source !== 'docs/PONS_DISCOVERY_CANDIDATE_V1.json' ||
  manifest.tokenLaunchDiscovery?.status !== candidate.status ||
  manifest.tokenLaunchDiscovery?.metadataPublishAuthorized !== false ||
  manifest.tokenLaunchSuccessor?.status !== 'SELECTED_CANDIDATE_BLOCKED' ||
  manifest.tokenLaunchSuccessor?.tokenAddress !== null ||
  manifest.tokenLaunchSuccessor?.holderAccessActive !== false ||
  manifest.tokenLaunchSuccessor?.accountingActive !== false ||
  manifest.launchAuthorization.tokenState !== 'NOT_LAUNCHED' ||
  manifest.launchAuthorization.launchAuthorized !== false ||
  manifest.launchAuthorization.marketingAuthorized !== false
) throw new Error('PONS_DISCOVERY_UNVERIFIED_LISTING_ESCALATION');

if (['https://t.me/', 'https://x.com/', 'https://twitter.com/'].some(url => html.includes('href="' + url))) {
  throw new Error('PONS_UNVERIFIED_SOCIAL_LINK_IN_PREVIEW');
}
if (html.includes('BUY $BINRAT') || html.includes('CONNECT TO BUY')) {
  throw new Error('PONS_BUY_CTA_BEFORE_DEPLOYMENT');
}

const prelaunchCorpus = `${html}\n${launchDoc}`;
const allowedAuthorities = new Set([
  '0xab063A9b53a2Ab832a941aE5890ea05c1672339D',
  '0xba5Ee49734b50Cf62d0B538584fbaC0eFFB79866'
]);
for (const address of prelaunchCorpus.match(/0x[0-9a-fA-F]{40}/g) ?? []) {
  if (!allowedAuthorities.has(address)) throw new Error('LAUNCH_CONTRACT_ADDRESS_PUBLISHED_EARLY');
}

for (const prohibited of ['BUY NOW', 'PRESALE OPEN', 'GUARANTEED RETURNS', '100X GUARANTEED']) {
  if (html.toUpperCase().includes(prohibited)) throw new Error(`LAUNCH_PRESENTATION_PROHIBITED:${prohibited}`);
}

console.log('BINRAT launch-presentation invariants: PASS');
