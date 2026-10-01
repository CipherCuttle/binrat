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

const language = read("docs/PRODUCT_LANGUAGE.md");
assert.match(language, /DEPLOYER/);
assert.match(language, /Degen decides attention\. Receipts decide truth\./i);
assert.match(language, /deployer → creator/);

const doctrine = read("docs/TOKEN_LAUNCH_DOCTRINE.md");
assert.doesNotMatch(doctrine, /Preferred current launch rail: ArcPad standard launch/);
assert.match(doctrine, /does \*\*not\*\* select or freeze the current token-launch rail/);
assert.match(doctrine, /Pons V2 on Robinhood Chain `4663`/);

for (const file of [
  "docs/ROADMAP_V0.md",
  "docs/ROADMAP_LIVING_SCENES_V1.md",
  "docs/ROADMAP_LIVING_SCENES_ASSET_PLAN_V1.md",
  "docs/ROADMAP_LIVING_SCENES_IMPLEMENTATION_PLAN_V1.md",
  "docs/ROADMAP_LIVING_SCENES_REDTEAM_V1.md",
]) assert.match(read(file).slice(0, 900), /SUPERSEDED/);

for (const receipt of [
  "docs/ROADMAP_GATE1_VERIFY_2026_10_01.md",
  "docs/ROADMAP_G6_RECOVERY_GATE0.md",
  "docs/ROADMAP_G6_RECOVERY_RECEIPT_2026_10_01.md",
]) assert.ok(fs.existsSync(path.join(root, receipt)), receipt + " historical receipt must remain");

process.stdout.write("BINRAT DOC AUTHORITY: PASS\n");
