import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../web/styles.css', import.meta.url), 'utf8');
const fixtures = readFileSync(new URL('../web/fixtures.js', import.meta.url), 'utf8');

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
if (!fixtures.includes('FIXTURE / PRODUCT-SHELL ONLY')) {
  // The exact stamp is rendered in app.js; fixtures must still be obviously synthetic addresses.
  if (!fixtures.includes('0x1111111111111111111111111111111111111111')) throw new Error('WEB_FIXTURE_BOUNDARY_MISSING');
}
if (/BUY|SELL|SAFE SCORE|RUG PROBABILITY/i.test(html)) throw new Error('WEB_CLAIM_BOUNDARY_VIOLATION');

console.log('BINRAT web invariants: PASS');
