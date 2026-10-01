const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../src/roadmap");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const files = walk(root).filter((file) => /\.(tsx?|css)$/i.test(file));
const forbidden = [
  /<svg\b/i,
  /<canvas\b/i,
  /\.svg(?:["'\s)]|$)/i,
  /SceneHardware/,
  /roadmap-scene__room/,
  /roadmap-scene__terminal/,
  /roadmap-radar/,
  /roadmap-terminal-lines/,
  /roadmap-terminal-led/,
  /roadmap-scene__rat/,
  /roadmap-scene__lamp/,
  /roadmap-archive/,
  /roadmap-paper-stack/,
];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    assert.ok(
      !pattern.test(source),
      `roadmap scene purity violation in ${path.relative(root, file)}: ${pattern}`,
    );
  }
}

const stage = fs.readFileSync(path.join(root, "RoadmapStage.tsx"), "utf8");
const sniffScene = fs.readFileSync(path.join(root, "SniffScene.tsx"), "utf8");
const manifest = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, "../../docs/design/roadmap-v1/manifest.json"),
  "utf8",
));
const sniffAsset = path.join(root, "assets/sniff/sniff-base.webp");
const assetFiles = walk(path.join(root, "assets"))
  .filter((file) => /\.(?:webp|png|jpe?g|gif|avif)$/i.test(file))
  .map((file) => path.relative(root, file));

assert.match(stage, /stage\.id === "sniff"/, "SNIFF must be the only rendered raster scene");
assert.match(stage, /<SniffScene\s*\/>/, "SNIFF must render through its dedicated scene component");
assert.match(stage, /data-scene-art="empty"/, "unimplemented stages must retain an empty scene-art shell");
assert.match(sniffScene, /import sniffBase from "\.\/assets\/sniff\/sniff-base\.webp"/, "SNIFF must use its approved raster asset");
assert.match(sniffScene, /<img[\s\S]*src=\{sniffBase\}[\s\S]*alt=""[\s\S]*\/>/, "SNIFF must render the authored raster directly");
assert.doesNotMatch(sniffScene, /<\/?(?!img\b)[a-z][^>]*>/i, "SNIFF may not add decorative DOM scene primitives");
assert.deepEqual(assetFiles, ["assets/sniff/sniff-base.webp"], "only the approved SNIFF raster may exist at this gate");
assert.equal(
  crypto.createHash("sha256").update(fs.readFileSync(sniffAsset)).digest("hex"),
  manifest.scenes.sniff.sha256,
  "SNIFF raster must match the approved roadmap manifest",
);

process.stdout.write("BINRAT ROADMAP SCENE PURITY: PASS\n");
