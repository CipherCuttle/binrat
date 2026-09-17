import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../web/styles.css', import.meta.url), 'utf8');
const fixtures = readFileSync(new URL('../web/fixtures.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');

const requiredHtml = [
  'BINRAT',
  'HOT GARBAGE',
  'FIXTURE MODE',
  'THE DUMPSTER',
  'HOW HE DIGS',
  'CLAIM BOUNDARY',
  'He gets the scraps.',
  'You get the receipts.'
];

for (const marker of requiredHtml) {
  if (!html.includes(marker)) throw new Error(`WEB_INVARIANT_MISSING:${marker}`);
}

if (!css.includes('--red: #ff2638')) throw new Error('WEB_BRAND_RED_DRIFT');
if (!css.includes('--dumpster: #263b35')) throw new Error('WEB_DUMPSTER_GREEN_DRIFT');
if (!fixtures.includes('0x1111111111111111111111111111111111111111')) throw new Error('WEB_FIXTURE_BOUNDARY_MISSING');
if (!app.includes('NOT LIVE EVIDENCE')) throw new Error('WEB_LIVE_EVIDENCE_STAMP_MISSING');

const prohibitedClaims = [
  'BUY_ELIGIBLE',
  'SAFE SCORE',
  'RUG PROBABILITY',
  'SCAM PROBABILITY',
  'GUARANTEED SAFE'
];
const corpus = `${html}\n${fixtures}\n${app}`.toUpperCase();
for (const claim of prohibitedClaims) {
  if (corpus.includes(claim)) throw new Error(`WEB_CLAIM_BOUNDARY_VIOLATION:${claim}`);
}

console.log('BINRAT web invariants: PASS');
