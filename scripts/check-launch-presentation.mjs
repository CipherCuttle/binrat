import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../web/launch-presentation.css', import.meta.url), 'utf8');
const launchDoc = readFileSync(new URL('../docs/LAUNCH_PRESENTATION_V0.md', import.meta.url), 'utf8');
const candidate = JSON.parse(readFileSync(new URL('../docs/PONS_DISCOVERY_METADATA_V1.json', import.meta.url), 'utf8'));
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

// The draft metadata is not a Pons launchToken payload. Never infer wallet,
// listing, website, token address or social authority from a selected rail.
if (
  candidate.schemaVersion !== 'binrat.pons-discovery-candidate/1' ||
  candidate.publicationStatus !== 'INTERNAL_PRELAUNCH_DRAFT_NOT_FOR_LISTING' ||
  candidate.ownerApproval !== 'NOT_GRANTED' ||
  candidate.launchAuthorized !== false ||
  candidate.marketingAuthorized !== false ||
  candidate.token.status !== 'NOT_LAUNCHED' ||
  candidate.token.name !== 'BINRAT' ||
  candidate.token.symbol !== 'BINRAT' ||
  candidate.token.chainId !== 4663 ||
  candidate.token.rail !== 'PONS_V2_DIRECT_FACTORY' ||
  candidate.token.factory !== selection.selectedTokenNetwork.factory ||
  candidate.token.factory !== manifest.tokenLaunchSuccessor?.ponsFactory ||
  candidate.token.chainId !== manifest.tokenLaunchSuccessor?.tokenChainId ||
  candidate.product.researchChainId !== 5042 ||
  candidate.product.researchChainId !== selection.researchNetwork.chainId ||
  candidate.product.publicReceiptsRemainFree !== true ||
  candidate.product.paidHolderAccessActive !== false ||
  candidate.token.contractAddress !== null ||
  candidate.token.launchTransaction !== null ||
  candidate.token.launchBlock !== null ||
  Object.values(candidate.ownerRoles).some(v => v !== null && v !== 'NOT_SUPPLIED') ||
  candidate.ownerRoles.custodyProof !== 'NOT_SUPPLIED' ||
  candidate.presentation.logoUrl !== null ||
  candidate.presentation.verifiedWebsiteUrl !== null ||
  candidate.presentation.verifiedTelegramUrl !== null ||
  candidate.presentation.verifiedXUrl !== null ||
  candidate.presentation.sourceRepositoryUrl !== 'https://github.com/CipherCuttle/binrat' ||
  Object.values(candidate.verification).some(v => v !== false) ||
  manifest.tokenLaunchSuccessor?.status !== 'SELECTED_CANDIDATE_BLOCKED' ||
  manifest.tokenLaunchSuccessor?.tokenAddress !== null ||
  manifest.tokenLaunchSuccessor?.holderAccessActive !== false ||
  manifest.tokenLaunchSuccessor?.accountingActive !== false ||
  manifest.launchAuthorization.tokenState !== 'NOT_LAUNCHED' ||
  manifest.launchAuthorization.launchAuthorized !== false ||
  manifest.launchAuthorization.marketingAuthorized !== false
) throw new Error('PONS_DISCOVERY_UNVERIFIED_LISTING_ESCALATION');

if (/href=["']https?:\\/\\/(?:t\\.me|x\\.com|twitter\\.com)\\//i.test(html)) {
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
