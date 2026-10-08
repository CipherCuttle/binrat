import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const lab = readFileSync(new URL("../src/VisualLab.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/visual-lab.css", import.meta.url), "utf8");
const fixtures = readFileSync(new URL("../src/visual-lab-fixtures.ts", import.meta.url), "utf8");

for (const marker of [
  'SYNTHETIC · NO LIVE EVIDENCE',
  'RAT ZERO FOUND SOMETHING.',
  'SMELLS FAMILIAR.',
  'WHAT',
  'TRAIL',
  'RECEIPTS',
  'NEXT',
  'Where enabled, Watch can bring you back',
  'WATCH IS NOT TRIPWIRE',
  'TRIPWIRE',
  'BUILDING',
  'SNIFFER',
  'PROVING',
]) {
  if (!(lab + fixtures).includes(marker)) throw new Error(`VISUAL_LAB_MARKER_MISSING:${marker}`);
}

for (const material of ['glass', 'refract', 'pearl']) {
  if (!lab.includes(`"${material}"`) || !css.includes(`data-material="${material}"`)) {
    throw new Error(`VISUAL_LAB_MATERIAL_MISSING:${material}`);
  }
}

if (!app.includes('get("visual") === "lab"') || !app.includes('page: "visual-lab"')) {
  throw new Error("VISUAL_LAB_ROUTE_MISSING");
}
if (!lab.includes('/crew/rat-avatar-48.png') || !lab.includes('/crew/tripwire.png') || !lab.includes('/crew/sniffer.png')) {
  throw new Error("VISUAL_LAB_CANONICAL_CREW_ASSETS_MISSING");
}
if (/\b(fetch|XMLHttpRequest|WebSocket)\s*\(/.test(lab + fixtures)) throw new Error("VISUAL_LAB_NETWORK_ACCESS");
if (/\b(BUY NOW|APY|SAFE SCORE|RUG PROBABILITY|GUARANTEED SAFE)\b/i.test(lab)) {
  throw new Error("VISUAL_LAB_UNSUPPORTED_PRODUCT_CLAIM");
}
if (!css.includes("backdrop-filter") || !["vl-hero-surface", "vl-evidence-surface", "vl-utility"].every((name) => lab.includes(name) && css.includes(name))) {
  throw new Error("VISUAL_LAB_HOLOGRAPHIC_MATERIAL_MISSING");
}
if (!css.includes("@media (prefers-reduced-motion:reduce)")) {
  throw new Error("VISUAL_LAB_REDUCED_MOTION_GUARD_MISSING");
}

// Original source artwork must survive binary-safe transfer unchanged.
const artworkRoot = new URL("../public/visual-lab/", import.meta.url);
const originals = JSON.parse(readFileSync(new URL("originals.json", artworkRoot), "utf8"));
if (originals.length !== 10) throw new Error("VISUAL_LAB_ORIGINAL_PACK_INCOMPLETE");
for (const asset of originals) {
  const bytes = readFileSync(new URL(asset.path, artworkRoot));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== asset.bytes || sha256 !== asset.sha256) {
    throw new Error(`VISUAL_LAB_ORIGINAL_BYTES_CHANGED:${asset.path}`);
  }
}
for (const path of [
  "scene/alley-bg-desktop.webp", "scene/alley-bg-mobile.webp",
  "foreground/ratzero-dumpster-desktop.webp", "foreground/ratzero-dumpster-mobile.webp",
  "foreground/foreground-trash.webp",
  "case-scenes/case-neon-alley.webp",
]) {
  const bytes = readFileSync(new URL(path, artworkRoot));
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error(`VISUAL_LAB_RENDER_ASSET_INVALID:${path}`);
  }
  if (!lab.includes(path)) throw new Error(`VISUAL_LAB_RENDER_ASSET_NOT_IMPORTED:${path}`);
}
if (/vl-sky|vl-city|vl-grid-glow|vl-ground-glow/.test(lab + css)) {
  throw new Error("VISUAL_LAB_PLACEHOLDER_WORLD_RETAINED");
}
if ((lab.match(/className="vl-rat-scene"/g) || []).length !== 1) {
  throw new Error("VISUAL_LAB_DUPLICATE_RAT_FOREGROUND");
}
if (!lab.includes("ILLUSTRATION ONLY") || /vl-case-art-grid/.test(lab + css)) {
  throw new Error("VISUAL_LAB_CASE_ART_BOUNDARY_MISSING");
}
if (!lab.includes('get("visualDebug") === "1"') || !lab.includes('{debug &&')) throw new Error("VISUAL_LAB_DEBUG_CONTROLS_NOT_GATED");

execFileSync(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./check-visual-lab-fixtures.ts", import.meta.url))], { stdio: "inherit" });

if (!app.includes("PonsCasePreview") || !app.includes('get("ponsPreview") === "1"')) throw new Error("PONS_PREVIEW_ROUTE_NOT_ISOLATED");
execFileSync(process.execPath, ["--test", fileURLToPath(new URL("./check-pons-readonly-preview.mjs", import.meta.url))], { stdio: "inherit" });
execFileSync(process.execPath, ["--test", fileURLToPath(new URL("./check-pons-preview-proxy.mjs", import.meta.url))], { stdio: "inherit" });
console.log("BINRAT visual lab invariants: PASS");
