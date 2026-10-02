const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projection = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../src/roadmap/roadmapProjection.json"), "utf8"));
const data = fs.readFileSync(path.resolve(__dirname, "../src/roadmap/roadmapData.ts"), "utf8");
const expected = ["sniff", "remember", "investigate", "watch", "connect", "autonomous_rat"];

assert.equal(projection.schemaVersion, "binrat.roadmap-v2-candidate/1");
assert.equal(projection.status, "EXPERIENTIAL_CAPABILITY_SEQUENCE_NOT_LIVE_STATUS");
assert.deepEqual(projection.sequence, expected);
for (const title of ["SNIFF", "REMEMBER", "INVESTIGATE", "WATCH", "CONNECT", "AUTONOMOUS RAT"]) assert.match(data, new RegExp(`title: "${title}"`));
for (const forbidden of [/CAPABILITY_MANIFEST/i, /pons_live_intelligence/i, /data-roadmap-status/i, /BUILDING/i]) assert.doesNotMatch(data, forbidden);
assert.match(data, /missing evidence into truth/);
process.stdout.write("BINRAT ROADMAP V2 CONTENT AUTHORITY: PASS\n");
