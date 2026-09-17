import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../web/styles.css', import.meta.url), 'utf8');
const semanticCss = readFileSync(new URL('../web/evidence-semantics.css', import.meta.url), 'utf8');
const shareCss = readFileSync(new URL('../web/share-card.css', import.meta.url), 'utf8');
const fixtures = readFileSync(new URL('../web/fixtures.js', import.meta.url), 'utf8');
const dataSource = readFileSync(new URL('../web/data-source.js', import.meta.url), 'utf8');
const shareCard = readFileSync(new URL('../web/share-card.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const brandAssetReceipt = readFileSync(new URL('../docs/BRAND_ASSET.md', import.meta.url), 'utf8');
const mascotUrl = new URL('../web/assets/binrat-hero.webp', import.meta.url);
const expectedMascotSha256 = 'e984faa47cdf0ee17c5c0280c83f6d4944bbb8807d68a1e9917cb7f2138bd163';

const requiredHtml = [
  'BINRAT',
  'HOT GARBAGE',
  'FIXTURE MODE',
  'THE DUMPSTER',
  'HOW HE DIGS',
  'CLAIM BOUNDARY',
  'He gets the scraps.',
  'You get the receipts.',
  './assets/binrat-hero.webp',
  './share-card.css'
];

for (const marker of requiredHtml) {
  if (!html.includes(marker)) throw new Error(`WEB_INVARIANT_MISSING:${marker}`);
}

if (!css.includes('--red: #ff2638')) throw new Error('WEB_BRAND_RED_DRIFT');
if (!css.includes('--dumpster: #263b35')) throw new Error('WEB_DUMPSTER_GREEN_DRIFT');
if (css.includes('image-rendering: pixelated') || shareCss.includes('image-rendering: pixelated')) throw new Error('WEB_ARTIFICIAL_PIXELATION');
if (!css.includes('image-rendering: auto')) throw new Error('WEB_NORMAL_MASCOT_RENDERING_MISSING');
if (!semanticCss.includes('.evidence-item.observed')) throw new Error('WEB_OBSERVATIONAL_SEMANTICS_MISSING');
if (!shareCss.includes('aspect-ratio: 1200 / 630')) throw new Error('WEB_SHARE_CARD_ASPECT_DRIFT');
if (!shareCss.includes('.share-card-rat')) throw new Error('WEB_SHARE_CARD_MASCOT_SLOT_MISSING');
if (!fixtures.includes('0x1111111111111111111111111111111111111111')) throw new Error('WEB_FIXTURE_BOUNDARY_MISSING');
if (!fixtures.includes('reportedCreatorAddress')) throw new Error('WEB_REPORTED_CREATOR_FIELD_MISSING');
if (/^\s*creator\s*:/m.test(fixtures)) throw new Error('WEB_AMBIGUOUS_CREATOR_FIELD_REINTRODUCED');
if (!dataSource.includes("WEB_DATA_SOURCE_MODE = 'FIXTURE'")) throw new Error('WEB_DATA_SOURCE_MODE_DRIFT');
if (!dataSource.includes("from './fixtures.js'")) throw new Error('WEB_FIXTURE_ADAPTER_MISSING');
if (dataSource.includes('fetch(')) throw new Error('WEB_FIXTURE_SOURCE_NETWORK_ACCESS');
if (!shareCard.includes("SHARE_CARD_MODE = 'FIXTURE'")) throw new Error('WEB_SHARE_CARD_MODE_DRIFT');
if (!shareCard.includes('FIXTURE // NOT LIVE EVIDENCE')) throw new Error('WEB_SHARE_CARD_FIXTURE_STAMP_MISSING');
if (shareCard.includes('fetch(')) throw new Error('WEB_SHARE_CARD_NETWORK_ACCESS');
if (!app.includes("from './data-source.js'")) throw new Error('WEB_DATA_SOURCE_BOUNDARY_BYPASSED');
if (!app.includes("from './share-card.js'")) throw new Error('WEB_SHARE_CARD_BOUNDARY_BYPASSED');
if (!app.includes("feed?.mode !== 'FIXTURE'")) throw new Error('WEB_UNAUTHORIZED_DATA_SOURCE_FAIL_CLOSED_MISSING');
if (!app.includes('reportedCreatorAddress')) throw new Error('WEB_REPORTED_CREATOR_RENDERING_MISSING');
if (app.includes('bag.creator')) throw new Error('WEB_AMBIGUOUS_CREATOR_RENDERING_REINTRODUCED');
if (!app.includes('NOT LIVE EVIDENCE')) throw new Error('WEB_LIVE_EVIDENCE_STAMP_MISSING');
if (!app.includes('0 NOTED CONDITIONS')) throw new Error('WEB_ZERO_CONDITION_COPY_MISSING');

if (!existsSync(mascotUrl)) throw new Error('WEB_CANONICAL_MASCOT_MISSING');
if (statSync(mascotUrl).size !== 256890) throw new Error('WEB_CANONICAL_MASCOT_SIZE_DRIFT');
const mascotDigest = createHash('sha256').update(readFileSync(mascotUrl)).digest('hex');
if (mascotDigest !== expectedMascotSha256) throw new Error(`WEB_CANONICAL_MASCOT_DIGEST_DRIFT:${mascotDigest}`);
if (!brandAssetReceipt.includes(expectedMascotSha256)) throw new Error('WEB_CANONICAL_MASCOT_RECEIPT_DRIFT');
if (!brandAssetReceipt.includes('36faee4b1d1a1bf533a3959b430207ae0812c1a7f2e40fb7ce9d23d550fce982')) {
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
const corpus = `${html}\n${fixtures}\n${dataSource}\n${shareCard}\n${app}`.toUpperCase();
for (const claim of prohibitedClaims) {
  if (corpus.includes(claim)) throw new Error(`WEB_CLAIM_BOUNDARY_VIOLATION:${claim}`);
}
if (/tone:\s*['"](?:good|warn)['"]/.test(fixtures)) throw new Error('WEB_EVALUATIVE_TONE_REINTRODUCED');

console.log('BINRAT web invariants: PASS');
