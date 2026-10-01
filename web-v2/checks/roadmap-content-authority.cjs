const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const roadmapPath = path.resolve(__dirname, "../../docs/ROADMAP.md");
const projectionPath = path.resolve(__dirname, "../src/roadmap/roadmapProjection.json");
const dataPath = path.resolve(__dirname, "../src/roadmap/roadmapData.ts");

const roadmap = fs.readFileSync(roadmapPath, "utf8");
const projection = JSON.parse(fs.readFileSync(projectionPath, "utf8"));
const dataSource = fs.readFileSync(dataPath, "utf8");

assert.equal(projection.authority, "docs/ROADMAP.md");
assert.equal(projection.languageAuthority, "docs/PRODUCT_LANGUAGE.md");
assert.match(dataSource, /CAPABILITY_MANIFEST_V0\.json/, "roadmap status projection must bind to the canonical capability manifest");

const sectionPattern = /^## (\d{2}) — ([^\n]+)\n\n> \*\*(.+)\*\*\n\n([^\n]+)\n\nStable capability IDs:\n\n((?:- `[^`]+`\n?)+)/gm;
const sections = [...roadmap.matchAll(sectionPattern)].map((match) => ({
  index: Number(match[1]),
  title: match[2],
  headline: match[3],
  literal: match[4],
  features: [...match[5].matchAll(/- `([^`]+)`/g)].map((feature) => feature[1]),
}));

assert.equal(sections.length, 6, "canonical roadmap must expose six chapters");
assert.equal(projection.stages.length, 6, "UI roadmap projection must expose six chapters");

const expectedIds = ["sniff", "remember", "watch", "hunt", "organize", "autonomous_rat"];
assert.deepEqual(projection.stages.map((stage) => stage.id), expectedIds, "UI roadmap chapter IDs/order must stay canonical");

for (let index = 0; index < sections.length; index += 1) {
  const section = sections[index];
  const stage = projection.stages[index];

  assert.equal(stage.index, section.index, "chapter index drift at " + stage.id);
  assert.equal(stage.title, section.title, "chapter title drift at " + stage.id);
  assert.equal(stage.headline, section.headline, "chapter headline drift at " + stage.id);
  assert.equal(stage.literal, section.literal, "chapter literal explanation drift at " + stage.id);
  assert.deepEqual(
    stage.features.map((feature) => feature.id),
    section.features,
    "capability ID/order drift at " + stage.id,
  );

  for (const feature of stage.features) {
    assert.equal(typeof feature.label, "string");
    assert.ok(feature.label.trim().length > 0, "feature label missing for " + feature.id);
    assert.ok(!Object.prototype.hasOwnProperty.call(feature, "status"),
      "status must not be authored in roadmap projection: " + feature.id);
  }
}

const hunt = projection.stages.find((stage) => stage.id === "hunt");
assert.equal(
  hunt.ratLine,
  "DEGEN DECIDES ATTENTION. RECEIPTS DECIDE TRUTH.",
  "HUNT truth/attention anchor must stay canonical",
);

process.stdout.write("BINRAT ROADMAP CONTENT AUTHORITY: PASS\n");
