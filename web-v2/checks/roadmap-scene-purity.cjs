const assert = require("node:assert/strict");
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
assert.match(stage, /data-scene-art="empty"/, "R1 must leave a deliberately empty scene-art shell");

process.stdout.write("BINRAT ROADMAP SCENE PURITY: PASS\n");
