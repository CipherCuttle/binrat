import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../web/launch-presentation.css', import.meta.url), 'utf8');
const launchDoc = readFileSync(new URL('../docs/LAUNCH_PRESENTATION_V0.md', import.meta.url), 'utf8');

const requiredHtml = [
  '$BINRAT IS NOT LIVE.',
  'NO CONTRACT PUBLISHED',
  'NO PRESALE',
  'NO WALLET CONNECTION',
  'TOKEN STATUS',
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
if (!launchDoc.includes('NOT LIVE') || !launchDoc.includes('NOT PUBLISHED') || !launchDoc.includes('presale: **NONE**')) {
  throw new Error('LAUNCH_STATUS_DOC_DRIFT');
}

const prelaunchCorpus = `${html}\n${launchDoc}`;
if (/0x[0-9a-fA-F]{40}/.test(prelaunchCorpus)) throw new Error('LAUNCH_CONTRACT_ADDRESS_PUBLISHED_EARLY');

for (const prohibited of ['BUY NOW', 'PRESALE OPEN', 'GUARANTEED RETURNS', '100X GUARANTEED']) {
  if (html.toUpperCase().includes(prohibited)) throw new Error(`LAUNCH_PRESENTATION_PROHIBITED:${prohibited}`);
}

console.log('BINRAT launch-presentation invariants: PASS');
