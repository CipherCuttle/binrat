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
const readPlane = readFileSync(new URL('../web/read-plane.js', import.meta.url), 'utf8');
const reactBitsIsland = readFileSync(new URL('../web/react-bits-island.js', import.meta.url), 'utf8');
const brandAssetReceipt = readFileSync(new URL('../docs/BRAND_ASSET.md', import.meta.url), 'utf8');
const mascotUrl = new URL('../web/assets/binrat-hero.webp', import.meta.url);
const roadmapRasterUrl = new URL('../web/assets/roadmap-sniff.webp', import.meta.url);
const expectedMascotSha256 = 'e984faa47cdf0ee17c5c0280c83f6d4944bbb8807d68a1e9917cb7f2138bd163';
const expectedRoadmapRasterSha256 = '6aad1c3a02fd031b048adb5d6b9ac389af38c6834c5d782c7fd190f37788d969';

const requiredHtml = [
  "YOU CAN'T WATCH ALL THIS SHIT.", 'RAT ZERO IS DIGGING.', 'START DIGGING', 'MEET THE CREW',
  'WHAT JUST HIT THE DUMPSTER?', 'MEET THE CREW.', 'RAT ZERO', 'TRIPWIRE',
  'SNIFFER', 'CHECKING', 'LOCKED', 'FIND → EMPLOY → LEAVE → RETURN',
  'FREE RAT DIGS WHEN YOU ASK.', 'FUTURE WORKING RAT KEEPS DIGGING AFTER YOU LEAVE.',
  'data-product-status="working-rat"', 'TAKE THE RAT WITH YOU.', 'Persistent Rat employment is not available.',
  'REPEAT DEPLOYERS', 'INDEX CONNECTING', 'THE DUMPSTER', './share-card.css', './frontdoor.css'
];

for (const marker of requiredHtml) {
  if (!html.includes(marker)) throw new Error(`WEB_INVARIANT_MISSING:${marker}`);
}

const frontdoorOrder = [
  'id="hero-title"', 'id="fresh-proof"', 'id="crew"', 'id="telegram"',
  'id="how"', 'id="working-rat"'
].map((marker) => html.indexOf(marker));
if (
  frontdoorOrder.some((index) => index < 0) ||
  frontdoorOrder.some((index, position) => position > 0 && index <= frontdoorOrder[position - 1])
) {
  throw new Error(`WEB_FRONTDOOR_ORDER_DRIFT:${frontdoorOrder.join(',')}`);
}

const frontdoorJs = readFileSync(new URL('../web/frontdoor.js', import.meta.url), 'utf8');
// Loading must not masquerade as canonical UNVERIFIED; failure must still fail closed to UNVERIFIED.
if (/data-product-status="[a-z-]+"[^>]*>UNVERIFIED</.test(html)) throw new Error('WEB_LOADING_STATE_MASQUERADES_AS_UNVERIFIED');
if (!frontdoorJs.includes('"UNVERIFIED"') || !frontdoorJs.includes('projectionSettled')) throw new Error('WEB_FAIL_CLOSED_UNVERIFIED_MISSING');
// Customer-facing vocabulary: Den is planned and not primary navigation; Telegram is a hero secondary.
const navBlocks = html.match(/<nav aria-label="(?:Primary|Mobile primary)">[\s\S]*?<\/nav>/g) ?? [];
if (navBlocks.length !== 2 || navBlocks.some((block) => block.includes('#den'))) throw new Error('WEB_DEN_IN_PRIMARY_NAV');
if (/<footer[\s\S]*href="#den"/.test(html)) throw new Error('WEB_DEN_IN_FOOTER_NAV');
const heroBlock = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="fresh-proof"'));
if (!heroBlock.includes('Fresh Pons launches. What BINRAT remembers about the deployer. Receipts you can open.')) throw new Error('WEB_HERO_CURRENT_VALUE_MISSING');
if (!heroBlock.includes('t.me/BinratBot')) throw new Error('WEB_HERO_TELEGRAM_SECONDARY_MISSING');
if (/future product direction|EMPLOY|Working Rat|staking/i.test(heroBlock)) throw new Error('WEB_HERO_FUTURE_LANGUAGE');
if (/Fresh Rats/i.test(html)) throw new Error('WEB_FRESH_RATS_COLLISION');
if (!html.includes('Watch is not Tripwire')) throw new Error('WEB_WATCH_TRIPWIRE_DISTINCTION_MISSING');
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
if (!dataSource.includes('schemaVersion !== "binrat.public-feed/0.1"')) throw new Error('WEB_SCHEMA_VALIDATION_MISSING');
if (!dataSource.includes('binrat.latest-launches/0.1')) throw new Error('WEB_LATEST_LAUNCH_SCHEMA_VALIDATION_MISSING');
if (!shareCard.includes("SHARE_CARD_MODES = ['FIXTURE', 'LIVE']")) throw new Error('WEB_SHARE_CARD_MODE_DRIFT');
if (!shareCard.includes('FIXTURE // NOT LIVE EVIDENCE')) throw new Error('WEB_SHARE_CARD_FIXTURE_STAMP_MISSING');
if (shareCard.includes('fetch(')) throw new Error('WEB_SHARE_CARD_NETWORK_ACCESS');
if (!html.includes('https://t.me/BinratBot')) throw new Error('WEB_TELEGRAM_FRONTDOOR_CTA_MISSING');
if ((html.match(/https:\/\/t\.me\/BinratBot/g) ?? []).length < 2) throw new Error('WEB_TELEGRAM_FIRST_CLASS_CTA_MISSING');
if (!dataSource.includes('fetch("/api/capabilities"')) throw new Error('WEB_CAPABILITY_MANIFEST_SOURCE_MISSING');
if (!dataSource.includes('typeof value.launchAuthorization.marketingAuthorized !== "boolean"')) throw new Error('WEB_TOKEN_MANIFEST_LAUNCH_SHAPE_MISSING');
for (const marker of [
  'RAT ZERO FOUND SOMETHING.',
  '01 / SUPPORTED FACTS',
  '02 / FOLLOW THE TRAIL',
  'NEXT / CURRENT WATCH',
  'When it is enabled for you, current Watch is accessed through the Telegram bot.',
  'COPY DEPLOYER',
  'SEE TRIPWIRE PLAN'
]) {
  if (!app.includes(marker)) throw new Error(`WEB_CASE_JOURNEY_MISSING:${marker}`);
}
if (!app.includes('from "./data-source.js"')) throw new Error('WEB_DATA_SOURCE_BOUNDARY_BYPASSED');
if (!app.includes('from "./share-card.js"')) throw new Error('WEB_SHARE_CARD_BOUNDARY_BYPASSED');
if (!readPlane.includes('["LIVE", "FIXTURE"].includes(feed.mode)')) throw new Error('WEB_UNAUTHORIZED_DATA_SOURCE_FAIL_CLOSED_MISSING');
if (!app.includes('reportedCreatorAddress')) throw new Error('WEB_REPORTED_CREATOR_RENDERING_MISSING');
if (app.includes('bag.creator')) throw new Error('WEB_AMBIGUOUS_CREATOR_RENDERING_REINTRODUCED');
for (const forbidden of ['REPEAT CREATORS', 'CREATOR FILE', 'REPORTED CREATOR', 'reported creator address']) {
  if (`${html}\n${app}`.includes(forbidden)) throw new Error(`WEB_PUBLIC_CREATOR_ROLE_DRIFT:${forbidden}`);
}
if (!html.includes('REPEAT DEPLOYERS')) throw new Error('WEB_REPEAT_DEPLOYER_LABEL_MISSING');
if (!app.includes('DEPLOYER FILE')) throw new Error('WEB_DEPLOYER_FILE_LABEL_MISSING');
if (!app.includes('NOT LIVE EVIDENCE')) throw new Error('WEB_LIVE_EVIDENCE_STAMP_MISSING');
if (!app.includes('notedConditions')) throw new Error('WEB_NOTED_CONDITIONS_MAPPING_MISSING');
if (!dataSource.includes('fetch(`/api/bag/${encodeURIComponent(bagId)}/intelligence`')) throw new Error('WEB_BAG_INTELLIGENCE_SOURCE_MISSING');
if (!dataSource.includes('fetch(`/api/creator/${encodeURIComponent(reportedCreatorAddress)}/summary`')) throw new Error('WEB_CREATOR_FILE_SOURCE_MISSING');
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

const frontdoor = readFileSync(new URL('../web/frontdoor.js', import.meta.url), 'utf8');
const frontdoorCss = readFileSync(new URL('../web/frontdoor.css', import.meta.url), 'utf8');
if (!frontdoor.includes('feed.bags.slice(0, 3)')) throw new Error('WEB_HOME_PROOF_UNBOUNDED');
if (!frontdoor.includes('FIXTURE · NOT LIVE EVIDENCE')) throw new Error('WEB_HOME_FIXTURE_STAMP_MISSING');
if (frontdoor.includes('fetch(')) throw new Error('WEB_HOME_BYPASSES_READ_PLANE');
if (!app.includes('renderFreshCases(feed)') || !app.includes('renderFreshState(')) throw new Error('WEB_HOME_READ_PLANE_BINDING_MISSING');
if (!app.includes('Persistent Tripwire jobs are not available yet.')) throw new Error('WEB_CASE_WATCH_AVAILABILITY_MISSING');
if (!app.includes('No prior match is not a safety claim, prediction or proof that the address is globally new.')) throw new Error('WEB_CASE_NO_PRIOR_BOUNDARY_MISSING');
if (!app.includes('Missing history stays missing; absence outside this coverage is unknown.')) throw new Error('WEB_CASE_PARTIAL_HISTORY_BOUNDARY_MISSING');
if (html.includes('$BINRAT') || html.includes('token-status') || html.includes('NEEDS A COIN')) throw new Error('WEB_PUBLIC_TOKEN_MARKETING_REINTRODUCED');
if ((html.match(/class="locked-slot"/g) ?? []).length !== 2) throw new Error('WEB_LOCKED_ROSTER_DRIFT');
if (!frontdoorCss.includes('"Geist Sans"') || !frontdoorCss.includes('"Geist Mono"')) throw new Error('WEB_GEIST_MISSING');
const crewReceipt = JSON.parse(readFileSync(new URL('../docs/FRONTDOOR_ASSETS_V1.json', import.meta.url), 'utf8'));
for (const asset of crewReceipt.assets) {
  const digest = createHash('sha256').update(readFileSync(new URL(`../${asset.file}`, import.meta.url))).digest('hex');
  if (digest !== asset.sha256) throw new Error(`WEB_CREW_ASSET_DRIFT:${asset.file}`);
}
console.log('BINRAT web invariants: PASS');

const contract=readFileSync(new URL('../web/product-contract.js',import.meta.url),'utf8');
const binding=readFileSync(new URL('../web/snapshot-contract.js',import.meta.url),'utf8');
if(!dataSource.includes('validatePublicProduct')||!app.includes('renderPublicProduct(manifest.publicProduct)')) throw new Error('PUBLIC_PROJECTION_NOT_BOUND');
if(!binding.includes('canonicalSnapshotDigest')||!readPlane.includes('bindingMatches(candidate, status)')) throw new Error('SNAPSHOT_BINDING_MISSING');
for(const field of ['chainId','checkpointBlockHash','feedDigest','sourceCheckpoint']) if(!binding.includes(field)) throw new Error('SNAPSHOT_BINDING_FIELD_MISSING:'+field);
if(!contract.includes('rat.actionAvailable')||!html.includes('FUTURE WORKFORCE LOOP.')) throw new Error('PUBLIC_EMPLOYMENT_BOUNDARY_MISSING');
for(const forbidden of ['Sniffer NEXT','Den BUILDING','HOLDER / PRO','Rat Credits','Intelligence V1','Dumpster Ledger','Rat Den V0','Rat Watch V0','ARCPAD','5042']) {
 if(html.toUpperCase().includes(forbidden.toUpperCase())) throw new Error('PUBLIC_COPY_DRIFT:'+forbidden);
}
