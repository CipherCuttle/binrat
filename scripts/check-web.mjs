import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../web/styles.css', import.meta.url), 'utf8');
const semanticCss = readFileSync(new URL('../web/evidence-semantics.css', import.meta.url), 'utf8');
const fixtures = readFileSync(new URL('../web/fixtures.js', import.meta.url), 'utf8');
const dataSource = readFileSync(new URL('../web/data-source.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const brandAssetReceipt = readFileSync(new URL('../docs/BRAND_ASSET.md', import.meta.url), 'utf8');
const mascotUrl = new URL('../web/binrat-mascot-128.webp', import.meta.url);
const expectedMascotSha256 = '91a1c123e6d3d82443407625ee43b790f07fb36b0bc55c63b9640d816ccb1987';

const requiredHtml = [
  'BINRAT',
  'HOT GARBAGE',
  'FIXTURE MODE',
  'THE DUMPSTER',
  'HOW HE DIGS',
  'CLAIM BOUNDARY',
  'He gets the scraps.',
  'You get the receipts.',
  './binrat-mascot-128.webp'
];

for (const marker of requiredHtml) {
  if (!html.includes(marker)) throw new Error(`WEB_INVARIANT_MISSING:${marker}`);
}

if (!css.includes('--red: #ff2638')) throw new Error('WEB_BRAND_RED_DRIFT');
if (!css.includes('--dumpster: #263b35')) throw new Error('WEB_DUMPSTER_GREEN_DRIFT');
if (!css.includes('image-rendering: pixelated')) throw new Error('WEB_PIXEL_MASCOT_RENDERING_MISSING');
if (!semanticCss.includes('.evidence-item.observed')) throw new Error('WEB_OBSERVATIONAL_SEMANTICS_MISSING');
if (!fixtures.includes('0x1111111111111111111111111111111111111111')) throw new Error('WEB_FIXTURE_BOUNDARY_MISSING');
if (!fixtures.includes('reportedCreatorAddress')) throw new Error('WEB_REPORTED_CREATOR_FIELD_MISSING');
if (/^\s*creator\s*:/m.test(fixtures)) throw new Error('WEB_AMBIGUOUS_CREATOR_FIELD_REINTRODUCED');
if (!dataSource.includes("WEB_DATA_SOURCE_MODE = 'FIXTURE'")) throw new Error('WEB_DATA_SOURCE_MODE_DRIFT');
if (!dataSource.includes("from './fixtures.js'")) throw new Error('WEB_FIXTURE_ADAPTER_MISSING');
if (dataSource.includes('fetch(')) throw new Error('WEB_FIXTURE_SOURCE_NETWORK_ACCESS');
if (!app.includes("from './data-source.js'")) throw new Error('WEB_DATA_SOURCE_BOUNDARY_BYPASSED');
if (!app.includes("feed?.mode !== 'FIXTURE'")) throw new Error('WEB_UNAUTHORIZED_DATA_SOURCE_FAIL_CLOSED_MISSING');
if (!app.includes('reportedCreatorAddress')) throw new Error('WEB_REPORTED_CREATOR_RENDERING_MISSING');
if (app.includes('bag.creator')) throw new Error('WEB_AMBIGUOUS_CREATOR_RENDERING_REINTRODUCED');
if (!app.includes('NOT LIVE EVIDENCE')) throw new Error('WEB_LIVE_EVIDENCE_STAMP_MISSING');
if (!app.includes('0 NOTED CONDITIONS')) throw new Error('WEB_ZERO_CONDITION_COPY_MISSING');

if (!existsSync(mascotUrl)) throw new Error('WEB_CANONICAL_MASCOT_MISSING');
if (statSync(mascotUrl).size !== 4284) throw new Error('WEB_CANONICAL_MASCOT_SIZE_DRIFT');
const mascotDigest = createHash('sha256').update(readFileSync(mascotUrl)).digest('hex');
if (mascotDigest !== expectedMascotSha256) throw new Error(`WEB_CANONICAL_MASCOT_DIGEST_DRIFT:${mascotDigest}`);
if (!brandAssetReceipt.includes(expectedMascotSha256)) throw new Error('WEB_CANONICAL_MASCOT_RECEIPT_DRIFT');
if (!brandAssetReceipt.includes('183dbb65cae463541f788603e01677e5987603c56d706b13266804b9fbd2c9af')) {
  throw new Error('WEB_CANONICAL_MASCOT_SOURCE_RECEIPT_DRIFT');
}

const prohibitedClaims = [
  'BUY_ELIGIBLE',
  'SAFE SCORE',
  'RUG PROBABILITY',
  'SCAM PROBABILITY',
  'GUARANTEED SAFE',
  'NO FIXTURE FLAGS'
];
const corpus = `${html}\n${fixtures}\n${dataSource}\n${app}`.toUpperCase();
for (const claim of prohibitedClaims) {
  if (corpus.includes(claim)) throw new Error(`WEB_CLAIM_BOUNDARY_VIOLATION:${claim}`);
}
if (/tone:\s*['"](?:good|warn)['"]/.test(fixtures)) throw new Error('WEB_EVALUATIVE_TONE_REINTRODUCED');

console.log('BINRAT web invariants: PASS');
