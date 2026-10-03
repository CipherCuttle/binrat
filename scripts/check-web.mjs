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
const reactBitsIsland = readFileSync(new URL('../web/react-bits-island.js', import.meta.url), 'utf8');
const brandAssetReceipt = readFileSync(new URL('../docs/BRAND_ASSET.md', import.meta.url), 'utf8');
const mascotUrl = new URL('../web/assets/binrat-hero.webp', import.meta.url);
const roadmapRasterUrl = new URL('../web/assets/roadmap-sniff.webp', import.meta.url);
const expectedMascotSha256 = 'e984faa47cdf0ee17c5c0280c83f6d4944bbb8807d68a1e9917cb7f2138bd163';
const expectedRoadmapRasterSha256 = '6aad1c3a02fd031b048adb5d6b9ac389af38c6834c5d782c7fd190f37788d969';

const requiredHtml = [
  'BINRAT',
  'HOT GARBAGE',
  'INDEX CONNECTING',
  'THE DUMPSTER',
  'HOW HE DIGS',
  'DUMPSTER LEDGER',
  'CLAIM BOUNDARY',
  'FOUND SOMETHING.',
  'OPEN FRESH GARBAGE',
  'GET THE TELEGRAM RAT',
  "DON'T TRUST THE RAT. CHECK THE RECEIPT.",
  'WHY IT SURFACED / RECEIPT-BACKED',
  'RAT IS DIGGING FOR A REPEAT TRAIL',
  '02 / TELEGRAM',
  "DON'T LIVE IN THE TERMINAL.",
  'Telegram tells you when to care.',
  'ADD @BINRATBOT',
  'SAME PAWS. AGAIN.',
  'WATCHING THESE PAWS. ✓',
  'SAME PAWS. NEW LAUNCH.',
  'NOT A LIVE ALERT',
  '03 / ROADMAP',
  'DOWN THE RAT HOLE',
  "THIS ISN'T",
  'THE RAT CATCHES THE LAUNCH.',
  "SITES VANISH. THE TRAIL DOESN'T.",
  'LEAVE A TRIPWIRE IN THE TRASH.',
  'POINT THE RATS AT SOMETHING WORTH DIGGING.',
  'USEFUL WORK EARNS A RECEIPT.',
  'GIVE IT A CASE. IT COMES BACK WITH RECEIPTS.',
  'UNBADGED = ROADMAP DIRECTION, NOT A LIVE CLAIM.',
  './assets/binrat-hero.webp',
  './assets/roadmap-sniff.webp',
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
if (!dataSource.includes('get("fixtures") === "1"')) throw new Error('WEB_EXPLICIT_FIXTURE_MODE_MISSING');
if (!dataSource.includes('import("./fixtures.js")')) throw new Error('WEB_FIXTURE_ADAPTER_MISSING');
if (!dataSource.includes('fetch("/api/launches/latest"')) throw new Error('WEB_LIVE_SOURCE_MISSING');
if (!dataSource.includes('fetch("/api/dumpster-ledger"')) throw new Error('WEB_DUMPSTER_LEDGER_SOURCE_MISSING');
if (!dataSource.includes('TREASURY_AUTHORITY_NOT_CONFIGURED')) throw new Error('WEB_DUMPSTER_LEDGER_FAIL_CLOSED_STATE_MISSING');
if (!dataSource.includes('schemaVersion !== "binrat.public-feed/0.1"')) throw new Error('WEB_SCHEMA_VALIDATION_MISSING');
if (!dataSource.includes('binrat.latest-launches/0.1')) throw new Error('WEB_LATEST_LAUNCH_SCHEMA_VALIDATION_MISSING');
if (!shareCard.includes("SHARE_CARD_MODES = ['FIXTURE', 'LIVE']")) throw new Error('WEB_SHARE_CARD_MODE_DRIFT');
if (!shareCard.includes('FIXTURE // NOT LIVE EVIDENCE')) throw new Error('WEB_SHARE_CARD_FIXTURE_STAMP_MISSING');
if (shareCard.includes('fetch(')) throw new Error('WEB_SHARE_CARD_NETWORK_ACCESS');
if (!html.includes('https://t.me/BinratBot')) throw new Error('WEB_TELEGRAM_FRONTDOOR_CTA_MISSING');
if ((html.match(/https:\/\/t\.me\/BinratBot/g) ?? []).length < 2) throw new Error('WEB_TELEGRAM_FIRST_CLASS_CTA_MISSING');
if (!html.includes('Event-driven. User-requested. No fake urgency. No engagement pings.')) throw new Error('WEB_TELEGRAM_NOTIFICATION_BOUNDARY_MISSING');
if (!html.includes('A watched reported deployer showed up again.')) throw new Error('WEB_TELEGRAM_DEPLOYER_ALERT_BOUNDARY_MISSING');
if (!dataSource.includes('fetch("/api/capabilities"')) throw new Error('WEB_CAPABILITY_MANIFEST_SOURCE_MISSING');
if (!app.includes('bootstrapRoadmapCapabilities')) throw new Error('WEB_ROADMAP_RUNTIME_STATUS_MISSING');
if (!app.includes('currentRailReplacementStatus === "BUILDING_ON_PONS_4663"')) throw new Error('WEB_ROADMAP_PONS_STATUS_BOUNDARY_MISSING');
if (!app.includes('currentRailRevalidationRequired === true')) throw new Error('WEB_ROADMAP_WATCH_STATUS_BOUNDARY_MISSING');
if (!app.includes('renderFrontdoorProof')) throw new Error('WEB_FRONTDOOR_PROOF_RENDERER_MISSING');
if (!app.includes('SMELLS FAMILIAR.')) throw new Error('WEB_FRONTDOOR_REPEAT_STORY_MISSING');
if (!app.includes('Same Pons-reported deployer appears on')) throw new Error('WEB_FRONTDOOR_DEPLOYER_BOUNDARY_MISSING');
if (!app.includes('PROJECT NAMES UNAVAILABLE IN THIS FAST VIEW')) throw new Error('WEB_FRONTDOOR_FAIL_CLOSED_HISTORY_MISSING');
if (!app.includes('from "./data-source.js"')) throw new Error('WEB_DATA_SOURCE_BOUNDARY_BYPASSED');
if (!app.includes('loadDumpsterLedger')) throw new Error('WEB_DUMPSTER_LEDGER_RENDERING_MISSING');
if (!app.includes('No wallet or balance is being presented as production truth.')) throw new Error('WEB_DUMPSTER_LEDGER_TRUTH_BOUNDARY_MISSING');
if (!app.includes('from "./share-card.js"')) throw new Error('WEB_SHARE_CARD_BOUNDARY_BYPASSED');
if (!app.includes('!["FIXTURE", "LIVE"].includes(feed?.mode)')) throw new Error('WEB_UNAUTHORIZED_DATA_SOURCE_FAIL_CLOSED_MISSING');
if (!app.includes('reportedCreatorAddress')) throw new Error('WEB_REPORTED_CREATOR_RENDERING_MISSING');
if (app.includes('bag.creator')) throw new Error('WEB_AMBIGUOUS_CREATOR_RENDERING_REINTRODUCED');
if (!app.includes('NOT LIVE EVIDENCE')) throw new Error('WEB_LIVE_EVIDENCE_STAMP_MISSING');
if (!app.includes('notedConditions')) throw new Error('WEB_NOTED_CONDITIONS_MAPPING_MISSING');
if (!dataSource.includes('fetch(`/api/bag/${encodeURIComponent(bagId)}/intelligence`')) throw new Error('WEB_BAG_INTELLIGENCE_SOURCE_MISSING');
if (!dataSource.includes('fetch(`/api/creator/${encodeURIComponent(reportedCreatorAddress)}`')) throw new Error('WEB_CREATOR_FILE_SOURCE_MISSING');
if (!dataSource.includes('fetch(`/api/bag/${encodeURIComponent(bagId)}/replay`')) throw new Error('WEB_REPLAY_BUNDLE_SOURCE_MISSING');
if (!app.includes('REPLAY LAB')) throw new Error('WEB_REPLAY_LAB_MISSING');
if (!app.includes('nothing is simulated')) throw new Error('WEB_REPLAY_BOUNDARY_MISSING');
if (!app.includes('Raw pool liquidity is not USD liquidity')) throw new Error('WEB_RAW_LIQUIDITY_BOUNDARY_MISSING');
if (!app.includes('Same Pons-reported deployer address only')) throw new Error('WEB_CREATOR_IDENTITY_BOUNDARY_MISSING');
if (!reactBitsIsland.includes('React Bits')) throw new Error('WEB_REACT_BITS_DONOR_MARKER_MISSING');
if (!reactBitsIsland.includes('prefers-reduced-motion')) throw new Error('WEB_REDUCED_MOTION_GUARD_MISSING');

if (!existsSync(mascotUrl)) throw new Error('WEB_CANONICAL_MASCOT_MISSING');
if (!existsSync(roadmapRasterUrl)) throw new Error('WEB_ROADMAP_RASTER_MISSING');
const roadmapRasterDigest = createHash('sha256').update(readFileSync(roadmapRasterUrl)).digest('hex');
if (roadmapRasterDigest !== expectedRoadmapRasterSha256) throw new Error(`WEB_ROADMAP_RASTER_DIGEST_DRIFT:${roadmapRasterDigest}`);
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
