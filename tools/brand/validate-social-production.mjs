#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURES = path.join(ROOT, "docs/design/brand-v1/social-production-v1/fixtures.json");
const data = JSON.parse(fs.readFileSync(FIXTURES, "utf8"));

const STATES = new Set(["COMPLETE", "PARTIAL", "UNKNOWN", "MISSING"]);
const LIMITS = {
  common: { fixtureId:48, sourceLabel:28, sourceValue:120, cta:24 },
  receipt: { receiptId:24, headline:38, literalExplanation:170, deployer:96, observation:96 },
  "case-file": { caseId:24, headline:42, literalSummary:200, factMin:3, factMax:5, factLabel:18, factValue:96 },
  "rat-found": { headline:24, literalFinding:150, evidenceStrip:96 }
};
const CTA = {
  OPEN_RECEIPTS:"OPEN RECEIPTS →",
  OPEN_CASE:"OPEN CASE →",
  DIG_DEEPER:"DIG DEEPER →"
};
const FORBIDDEN = [
  /smart money/i, /\balpha\b/i, /good buy/i, /bad buy/i, /buy now/i, /sell now/i,
  /\bape\b/i, /safe score/i, /rug score/i, /scammer/i, /rugger/i,
  /guaranteed/i, /profitability/i
];

const errors=[];
const fail=(id,msg)=>errors.push(`${id}: ${msg}`);
const isString=(v)=>typeof v==="string" && v.length>0;
const textFields=(obj)=>JSON.stringify(obj);

if (data.schemaVersion !== "binrat.social-fixtures/1") fail("root","wrong fixture schemaVersion");
if (data.proof !== "DEMO / NON-LIVE") fail("root","proof must be DEMO / NON-LIVE");
if (!Array.isArray(data.fixtures)) fail("root","fixtures must be an array");

const seen = new Set();
const familyCounts = new Map();
const coverageSeen = new Set();
const headlineMaxSeen = new Set();

for (const f of data.fixtures || []) {
  const id=f.fixtureId || "<missing-id>";
  if (seen.has(id)) fail(id,"duplicate fixtureId");
  seen.add(id);

  if (f.schemaVersion !== "binrat.social/1") fail(id,"wrong social schemaVersion");
  if (f.proof !== "DEMO / NON-LIVE") fail(id,"fixture must remain DEMO / NON-LIVE");
  if (!["receipt","case-file","rat-found"].includes(f.family)) {
    fail(id,`unknown family ${f.family}`);
    continue;
  }
  familyCounts.set(f.family,(familyCounts.get(f.family)||0)+1);

  if (!isString(f.headline)) fail(id,"headline required");
  if (!STATES.has(f.coverage)) fail(id,"invalid coverage");
  else coverageSeen.add(f.coverage);

  if (!f.source || !isString(f.source.label) || !isString(f.source.value) || !STATES.has(f.source.state)) {
    fail(id,"source label/value/state required");
  } else {
    if (f.source.label.length > LIMITS.common.sourceLabel) fail(id,"source label over limit");
    if (f.source.value.length > LIMITS.common.sourceValue) fail(id,"source value over limit");
  }

  if (!f.cta || CTA[f.cta.action] !== f.cta.label) fail(id,"CTA action/label pair invalid");
  if (f.cta?.label?.length > LIMITS.common.cta) fail(id,"CTA over limit");
  if (id.length > LIMITS.common.fixtureId) fail(id,"fixtureId over limit");

  const bad=FORBIDDEN.find((rx)=>rx.test(textFields(f)));
  if (bad) fail(id,`forbidden public-copy pattern ${bad}`);

  if (f.family === "receipt") {
    const L=LIMITS.receipt;
    if (!isString(f.receiptId) || f.receiptId.length>L.receiptId) fail(id,"receiptId invalid/over limit");
    if (f.headline.length>L.headline) fail(id,"receipt headline over limit");
    if (f.headline.length===L.headline) headlineMaxSeen.add("receipt");
    if (!isString(f.literalExplanation) || f.literalExplanation.length>L.literalExplanation) fail(id,"literalExplanation invalid/over limit");
    if (!isString(f.deployer) || f.deployer.length>L.deployer) fail(id,"deployer invalid/over limit");
    if (!isString(f.observation) || f.observation.length>L.observation) fail(id,"observation invalid/over limit");
  }

  if (f.family === "case-file") {
    const L=LIMITS["case-file"];
    if (!isString(f.caseId) || f.caseId.length>L.caseId) fail(id,"caseId invalid/over limit");
    if (f.headline.length>L.headline) fail(id,"case headline over limit");
    if (f.headline.length===L.headline) headlineMaxSeen.add("case-file");
    if (!isString(f.literalSummary) || f.literalSummary.length>L.literalSummary) fail(id,"literalSummary invalid/over limit");
    if (f.evidenceBoundary !== "PATTERN · NOT A VERDICT") fail(id,"evidenceBoundary must be exact canonical boundary");
    if (!Array.isArray(f.facts) || f.facts.length<L.factMin || f.facts.length>L.factMax) fail(id,"case facts must contain 3–5 rows");
    for (const fact of f.facts || []) {
      if (!isString(fact.label) || fact.label.length>L.factLabel) fail(id,"case fact label invalid/over limit");
      if (!isString(fact.value) || fact.value.length>L.factValue) fail(id,"case fact value invalid/over limit");
      if (fact.state && !STATES.has(fact.state)) fail(id,"case fact state invalid");
    }
  }

  if (f.family === "rat-found") {
    const L=LIMITS["rat-found"];
    if (f.headline.length>L.headline) fail(id,"rat-found headline over limit");
    if (f.headline.length===L.headline) headlineMaxSeen.add("rat-found");
    if (!isString(f.literalFinding) || f.literalFinding.length>L.literalFinding) fail(id,"literalFinding invalid/over limit");
    if (!isString(f.evidenceStrip) || f.evidenceStrip.length>L.evidenceStrip) fail(id,"evidenceStrip invalid/over limit");
    if (!String(f.evidenceStrip).includes(f.coverage)) fail(id,"evidenceStrip must spell out coverage");
  }
}

for (const family of ["receipt","case-file","rat-found"]) {
  if ((familyCounts.get(family)||0) < 3) fail("matrix",`${family} needs at least 3 fixtures`);
  if (!headlineMaxSeen.has(family)) fail("matrix",`${family} lacks exact max-length headline fixture`);
}
for (const state of STATES) if (!coverageSeen.has(state)) fail("matrix",`coverage state ${state} not exercised`);

const corpus=JSON.stringify(data.fixtures);
if (!data.fixtures.some((f)=>f.family==="receipt" && f.deployer.length<=12)) fail("matrix","very short deployer fixture missing");
if (!data.fixtures.some((f)=>f.family==="receipt" && f.deployer.length>=64)) fail("matrix","long address/hash-like fixture missing");
if (!/1 retained demo launch/.test(corpus)) fail("matrix","1-launch case missing");
if (!/12 retained demo launches/.test(corpus)) fail("matrix","12-launch case missing");
if (!data.fixtures.some((f)=>f.source.value.length>=100)) fail("matrix","overlong source mutation missing");

if (errors.length) {
  console.error("SOCIAL PRODUCTION VALIDATION FAIL");
  for (const e of errors) console.error("- "+e);
  process.exit(1);
}

console.log(`SOCIAL PRODUCTION VALIDATION PASS · ${data.fixtures.length} fixtures · ${[...STATES].join("/")}`);
