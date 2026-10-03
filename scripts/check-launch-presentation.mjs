import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../web/launch-presentation.css', import.meta.url), 'utf8');
const launchDoc = readFileSync(new URL('../docs/LAUNCH_PRESENTATION_V0.md', import.meta.url), 'utf8');
const dataSource = readFileSync(new URL('../web/data-source.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');

const requiredHtml = [
  'THE RAT',
  'NEEDS A COIN.',
  '$BINRAT is the culture and coordination layer around BINRAT.',
  'BANKROLL THE BUILD',
  'NATIVE CULTURE ASSET',
  'COORDINATE ATTENTION',
  'GROW THE EVIDENCE NETWORK',
  'CULTURE + CAPACITY.',
  'POINT THE PACK.',
  'COLLATERAL, NOT TRUTH.',
  'THE TOKEN NEVER GETS TO REWRITE A RECEIPT.',
  '$BINRAT IS NOT LIVE',
  'NO OFFICIAL CONTRACT HAS BEEN PUBLISHED',
  'NO PRIVATE PRESALE',
  'NO WALLET CONNECTION',
  'DISABLED PRELAUNCH',
  'NOT AUTHORIZED',
  'TOKEN DOES NOT CHANGE FACTS',
  'og:title',
  'og:description',
  'twitter:card',
  './launch-presentation.css'
];
for (const marker of requiredHtml) {
  if (!html.includes(marker)) throw new Error(`LAUNCH_PRESENTATION_MISSING:${marker}`);
}

if (!html.includes('noindex,nofollow,noarchive')) throw new Error('LAUNCH_PREVIEW_NOINDEX_REMOVED');
if (!css.includes('.token-status-section')) throw new Error('LAUNCH_STATUS_STYLE_MISSING');
if (!css.includes('.anti-scam-strip')) throw new Error('LAUNCH_ANTI_SCAM_STYLE_MISSING');
if (!launchDoc.includes('DO NOT PUBLISH UNTIL EXPLICIT TOKEN-LAUNCH AUTHORITY EXISTS.')) {
  throw new Error('LAUNCH_AUTHORITY_GATE_MISSING');
}
if (!launchDoc.includes('Robinhood Chain 4663 / Pons V2')) throw new Error('LAUNCH_PONS_AUTHORITY_MISSING');
if (!launchDoc.includes('NOT LAUNCHED') || !launchDoc.includes('NOT PUBLISHED') || !launchDoc.includes('private presale: **NONE**')) {
  throw new Error('LAUNCH_STATUS_DOC_DRIFT');
}
if (!launchDoc.includes('The token never gets to rewrite a receipt.')) throw new Error('LAUNCH_TRUTH_BOUNDARY_MISSING');
if (!dataSource.includes('value.tokenState !== "NOT_LAUNCHED"')) throw new Error('LAUNCH_RUNTIME_TOKEN_STATE_NOT_FAIL_CLOSED');
if (!dataSource.includes('value.launchAuthorization !== "BLOCKED"')) throw new Error('LAUNCH_RUNTIME_AUTHORITY_NOT_FAIL_CLOSED');
if (!app.includes('renderTokenPrelaunchState')) throw new Error('LAUNCH_RUNTIME_PRESENTATION_NOT_BOUND');

const tokenStart = html.indexOf('id="token-status"');
const tokenEnd = html.indexOf('id="boundary"', tokenStart);
if (tokenStart < 0 || tokenEnd < 0) throw new Error('LAUNCH_TOKEN_SECTION_NOT_FOUND');
const tokenSection = html.slice(tokenStart, tokenEnd);

if (/0x[0-9a-fA-F]{40}/.test(tokenSection)) throw new Error('LAUNCH_PRELAUNCH_ADDRESS_EXPOSED_IN_TOKEN_SECTION');
if (/0x[0-9a-fA-F]{40}/.test(launchDoc)) throw new Error('LAUNCH_PRELAUNCH_ADDRESS_EXPOSED_IN_PRESENTATION_DOC');

for (const prohibited of [
  'BUY NOW',
  'PRESALE OPEN',
  'GUARANTEED RETURNS',
  '100X GUARANTEED',
  'GUARANTEED APY',
  'PRICE WILL',
  'NUMBER GO UP'
]) {
  if (tokenSection.toUpperCase().includes(prohibited)) throw new Error(`LAUNCH_PRESENTATION_PROHIBITED:${prohibited}`);
}

console.log('BINRAT launch-presentation invariants: PASS');
