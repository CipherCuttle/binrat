import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const lab = readFileSync(new URL("../src/VisualLab.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/visual-lab.css", import.meta.url), "utf8");

for (const marker of [
  'VISUAL LAB · SYNTHETIC · NO LIVE EVIDENCE',
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
  if (!lab.includes(marker)) throw new Error(`VISUAL_LAB_MARKER_MISSING:${marker}`);
}

for (const material of ['glass', 'refract', 'pearl']) {
  if (!lab.includes(`"${material}"`) || !css.includes(`data-material="${material}"`)) {
    throw new Error(`VISUAL_LAB_MATERIAL_MISSING:${material}`);
  }
}

if (!app.includes('get("visual") === "lab"') || !app.includes('page: "visual-lab"')) {
  throw new Error("VISUAL_LAB_ROUTE_MISSING");
}
if (!lab.includes('/crew/rat-zero.jpg') || !lab.includes('/crew/tripwire.png') || !lab.includes('/crew/sniffer.png')) {
  throw new Error("VISUAL_LAB_CANONICAL_CREW_ASSETS_MISSING");
}
if (lab.includes("fetch(")) throw new Error("VISUAL_LAB_NETWORK_ACCESS");
if (/\b(BUY NOW|APY|SAFE SCORE|RUG PROBABILITY|GUARANTEED SAFE)\b/i.test(lab)) {
  throw new Error("VISUAL_LAB_UNSUPPORTED_PRODUCT_CLAIM");
}
if (!css.includes("backdrop-filter") || !css.includes("@keyframes vlPearl")) {
  throw new Error("VISUAL_LAB_HOLOGRAPHIC_MATERIAL_MISSING");
}
if (!css.includes("@media (prefers-reduced-motion:reduce)")) {
  throw new Error("VISUAL_LAB_REDUCED_MOTION_GUARD_MISSING");
}

console.log("BINRAT visual lab invariants: PASS");
