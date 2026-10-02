const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../src/roadmap");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});
const sourceFiles = walk(root).filter((file) => /\.(tsx?|css|json)$/i.test(file));
const all = sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const scene = fs.readFileSync(path.join(root, "RoadmapScene.tsx"), "utf8");
const rat = path.resolve(__dirname, "../../docs/design/brand-v1/canon/rat-zero.jpg");

for (const forbidden of [/<svg\b/i, /<canvas\b/i, /\.svg(?:["'\s)]|$)/i, /sniff-base/i, /roadmap-radar/i, /roadmap-terminal/i, /CRT/i, /CAPABILITY_MANIFEST/i, /pons_live_intelligence/i]) {
  assert.ok(!forbidden.test(all), `roadmap visual/purity regression: ${forbidden}`);
}
assert.match(scene, /import ratZero from "\.\.\/\.\.\/\.\.\/docs\/design\/brand-v1\/canon\/rat-zero\.jpg"/);
assert.match(scene, /data-scene-art="canonical-raster"/);
assert.match(scene, /<img\b/);
assert.doesNotMatch(scene, /<(?:svg|canvas|path|polygon|circle)\b/i);
assert.equal(crypto.createHash("sha256").update(fs.readFileSync(rat)).digest("hex"), "43541a9b469fbe46a9b54dccb227cfb21c7fcfade1d96656410b124ded2d3edc");
assert.ok(!fs.existsSync(path.join(root, "assets")), "rejected roadmap pictorial assets must be absent");
assert.doesNotMatch(all, /@keyframes/i, "roadmap must have no permanent animation loop");
process.stdout.write("BINRAT ROADMAP V2 SCENE PURITY: PASS\n");
