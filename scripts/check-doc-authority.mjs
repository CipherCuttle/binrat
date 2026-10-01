import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

for (const file of [
  "docs/README.md",
  "docs/ROADMAP.md",
  "docs/PHILOSOPHY.md",
  "docs/PRODUCT_LANGUAGE.md",
  "docs/CAPABILITY_MANIFEST_V0.json",
]) assert.ok(fs.existsSync(path.join(root, file)), file + " must exist");

const manifest = JSON.parse(read("docs/CAPABILITY_MANIFEST_V0.json"));
assert.equal(manifest.doctrine.documentationRouter, "docs/README.md");
assert.equal(manifest.doctrine.roadmap, "docs/ROADMAP.md");
assert.equal(manifest.doctrine.productLanguage, "docs/PRODUCT_LANGUAGE.md");
assert.equal(manifest.doctrine.currentIntelligenceRail, "docs/product/ROBINHOOD_LIVE_INTELLIGENCE_V1.md");
assert.equal(manifest.currentProductAuthority.activeIntelligenceChainId, 4663);
assert.equal(manifest.currentProductAuthority.activeIntelligenceRail, "PONS_V2_DIRECT_FACTORY");
assert.equal(manifest.currentProductAuthority.legacyEvidenceChainId, 5042);
assert.equal(manifest.currentProductAuthority.legacyEvidenceState, "HISTORICAL_LEGACY_EVIDENCE_ONLY");
assert.equal(manifest.capabilityStatusFreshness.currentRailChainId, 4663);
assert.equal(manifest.capabilities.ratRadarV0.statusScope, "LEGACY_ARC_5042_STATUS_SNAPSHOT");
assert.equal(manifest.capabilities.ratWatchV0.statusScope, "LEGACY_ARC_5042_STATUS_SNAPSHOT");
assert.equal(manifest.capabilities.telegramRatV0.currentRailRevalidationRequired, true);
assert.equal(manifest.launchGateStatus.recomputeRequired, true);
assert.equal(manifest.capabilities.launchMechanicsV0.authorityStatus, "LEGACY_ARC_5042_REFERENCE_ONLY");
assert.equal(manifest.capabilities.launchConfigurationV0.authorityStatus, "LEGACY_ARC_5042_REFERENCE_ONLY");
assert.equal(manifest.launchAuthorization.status, "BLOCKED");
assert.equal(manifest.launchAuthorization.marketingAuthorized, false);
assert.equal(manifest.launchAuthorization.launchAuthorized, false);
assert.equal(manifest.launchAuthorization.tokenState, "NOT_LAUNCHED");
assert.equal(manifest.launchAuthorization.currentRailReverificationRequired, true);

const router = read("docs/README.md");
assert.match(router, /KEEP \/ active authority/);
assert.match(router, /BACKBURNER \/ vision/);
assert.match(router, /discard from active context/i);

const roadmap = read("docs/ROADMAP.md");
for (const heading of [
  "## 01 — SNIFF",
  "## 02 — REMEMBER",
  "## 03 — WATCH",
  "## 04 — HUNT",
  "## 05 — ORGANIZE",
  "## 06 — AUTONOMOUS RAT",
]) assert.ok(roadmap.includes(heading), heading + " missing");
assert.doesNotMatch(roadmap, /ArcPad|chain ID 5042|Arc 5042/i);

const motionLab = read("web-v2/src/roadmap/MotionLabPage.tsx");
for (const title of ["SNIFF", "REMEMBER", "WATCH", "HUNT", "ORGANIZE", "AUTONOMOUS RAT"]) {
  assert.match(motionLab, new RegExp('title: "' + title + '"'));
}
assert.doesNotMatch(motionLab, /title: "INVESTIGATE"|title: "CONNECT"/);

const language = read("docs/PRODUCT_LANGUAGE.md");
assert.match(language, /DEPLOYER/);
assert.match(language, /Degen decides attention\. Receipts decide truth\./i);
assert.match(language, /deployer → creator/);

const doctrine = read("docs/TOKEN_LAUNCH_DOCTRINE.md");
assert.doesNotMatch(doctrine, /Preferred current launch rail: ArcPad standard launch/);
assert.match(doctrine, /does \*\*not\*\* select or freeze the current token-launch rail/);
assert.match(doctrine, /Pons V2 on Robinhood Chain `4663`/);

const removedFromActiveDocs = [
  "docs/PRD.md",
  "docs/CODEPLAN.md",
  "docs/ASTRA_FRONTEND_SPRINT.md",
  "docs/INTELLIGENCE_V1.md",
  "docs/WEB_V0.md",
  "docs/LAUNCH_PRESENTATION_V0.md",
  "docs/PRODUCT_SURFACE_V1.md",
  "docs/PRODUCT_SURFACE_V1_HOSTILE_REVIEW.md",
  "docs/PRODUCT_SURFACE_V1_VISUAL_HOSTILE_REVIEW.md",
  "docs/PRODUCT_SURFACE_V1_VISUAL_REVIEW.md",
  "docs/FRONTEND_V2_AUDIT.md",
  "docs/DUMPSTER_OS_VISUAL_SYSTEM_V1.md",
  "docs/ROADMAP_V0.md",
  "docs/ROADMAP_LIVING_SCENES_V1.md",
  "docs/ROADMAP_LIVING_SCENES_ASSET_PLAN_V1.md",
  "docs/ROADMAP_LIVING_SCENES_IMPLEMENTATION_PLAN_V1.md",
  "docs/ROADMAP_LIVING_SCENES_REDTEAM_V1.md",
  "docs/ROADMAP_GATE1_VERIFY_2026_10_01.md",
  "docs/ROADMAP_G6_RECOVERY_GATE0.md",
  "docs/ROADMAP_G6_RECOVERY_RECEIPT_2026_10_01.md",
];
for (const file of removedFromActiveDocs) {
  assert.equal(fs.existsSync(path.join(root, file)), false, file + " must not remain in active docs");
}

for (const archived of [
  "docs/archive/README.md",
  "docs/archive/legacy-arc-product/PRD.md",
  "docs/archive/legacy-arc-product/CODEPLAN.md",
  "docs/archive/legacy-arc-product/INTELLIGENCE_V1.md",
  "docs/archive/legacy-arc-product/PRODUCT_SURFACE_V1.md",
  "docs/archive/legacy-arc-product/LAUNCH_PRESENTATION_V0.md",
  "docs/archive/legacy-arc-product/LIVE_READ_V0.md",
  "docs/archive/legacy-arc-product/PUBLIC_READ_PLANE.md",
  "docs/archive/legacy-arc-product/TELEGRAM_RATBOT_V0.md",
  "docs/archive/legacy-arc-product/SHARE_CARDS_V0.md",
  "docs/archive/legacy-arc-product/REPLAY_LAB_V1.md",
  "docs/archive/legacy-arc-product/DUMPSTER_LEDGER_V0.md",
  "docs/archive/legacy-design/ASSET_BIBLE_V0.md",
  "docs/archive/legacy-design/ASSET_INVENTORY_V0.md",
  "docs/archive/legacy-design/ASSET_PRODUCTION_BRIEF_V1.md",
  "docs/archive/legacy-arc-launch/BINRAT_LAUNCH_CONFIG_V0.md",
  "docs/archive/legacy-arc-launch/LAUNCH_MECHANICS_VERIFICATION_V0.md",
  "docs/archive/receipts-2026-09/RAT_WATCH_V0_LIVE_SUBSCRIPTION_ACCEPTANCE_2026_09_19.md",
  "docs/archive/receipts-2026-09/TELEGRAM_RAT_CLOUDFLARE_LIVE_ACCEPTANCE_2026_09_19.md",
  "docs/archive/roadmap-precanonical/ROADMAP_V0.md",
  "docs/archive/roadmap-precanonical/ROADMAP_LIVING_SCENES_V1.md",
  "docs/archive/roadmap-precanonical/ROADMAP_GATE1_VERIFY_2026_10_01.md",
]) assert.ok(fs.existsSync(path.join(root, archived)), archived + " archive artifact must remain");

for (const pointer of [
  "docs/DUMPSTER_LEDGER_V0.md",
  "docs/REPLAY_LAB_V1.md",
  "docs/RAT_WATCH_V0_LIVE_SUBSCRIPTION_ACCEPTANCE_2026_09_19.md",
  "docs/TELEGRAM_RAT_CLOUDFLARE_LIVE_ACCEPTANCE_2026_09_19.md",
  "docs/BINRAT_LAUNCH_CONFIG_V0.md",
  "docs/LAUNCH_MECHANICS_HOSTILE_REVIEW_V0.md",
  "docs/LAUNCH_MECHANICS_VERIFICATION_V0.md",
]) assert.match(read(pointer).slice(0, 500), /LEGACY POINTER/);

for (const removed of [
  "docs/ASSET_BIBLE_V0.md",
  "docs/ASSET_INVENTORY_V0.md",
  "docs/ASSET_PRODUCTION_BRIEF_V1.md",
  "docs/LIVE_READ_V0.md",
  "docs/PUBLIC_READ_PLANE.md",
  "docs/TELEGRAM_RATBOT_V0.md",
  "docs/SHARE_CARDS_V0.md",
  "docs/CLOUDFLARE_WEB_LIVE_ACCEPTANCE_2026_09_19.md",
  "docs/BINRAT_LAUNCH_CONFIG_HOSTILE_REVIEW_V0.md",
  "docs/BINRAT_LAUNCH_EXECUTION_REHEARSAL_V0.md",
]) assert.equal(fs.existsSync(path.join(root, removed)), false, removed + " must be archive-only");

assert.match(read("docs/BRAND_ASSET.md").slice(0, 600), /HASH \/ PROVENANCE RECEIPT, NOT CURRENT PRODUCT OR VISUAL AUTHORITY/);

process.stdout.write("BINRAT DOC AUTHORITY: PASS\n");
