#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_PATH = path.join(ROOT, "docs/design/brand-v1/copy-fixtures.json");
const COPY_PATH = path.join(ROOT, "docs/design/brand-v1/COPY_LIBRARY.md");
const data = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
const copy = fs.readFileSync(COPY_PATH, "utf8");

const errors = [];
const fail = (msg) => errors.push(msg);

if (data.schema_version !== 1) fail("copy fixture schema_version must be 1");
if (!Array.isArray(data.hard_banned_regex) || data.hard_banned_regex.length === 0) {
  fail("hard_banned_regex must be non-empty");
}

const regexById = new Map();
for (const spec of data.hard_banned_regex || []) {
  try {
    regexById.set(spec.id, new RegExp(spec.pattern, "i"));
  } catch (error) {
    fail(`regex ${spec.id} does not compile: ${error.message}`);
  }
}

const probes = {
  trade_imperative: {
    yes: ["BUY token now", "APE IN", "SELL this coin now"],
    no: ["Open receipts", "This is not a buy recommendation"]
  },
  financial_guarantee: {
    yes: ["Guaranteed returns", "Guarantees APY"],
    no: ["Returns are not guaranteed", "Coverage is PARTIAL"]
  },
  safe_rug_verdict: {
    yes: ["safe score", "RUG verdict", "safe"],
    no: ["safety is not established", "Open case"]
  },
  unrestricted_autonomy: {
    yes: ["Fully autonomous", "The Rat trades for you"],
    no: ["Scoped autonomous workflow", "Attributable actions"]
  },
  generic_ai_alpha: {
    yes: ["AI-powered alpha", "Powered by AI trading intelligence"],
    no: ["Derived relationship", "Open evidence"]
  },
  identity_overreach: {
    yes: ["same person", "their other launches", "this founder"],
    no: ["same deployer", "common human identity is not established"]
  },
  intent_overreach: {
    yes: ["trying to hide", "dumping on buyers", "baiting buyers"],
    no: ["behavior observed", "intent is unknown"]
  },
  coverage_erasure: {
    yes: ["looks clean", "all clear", "complete history"],
    no: ["No match in current indexed coverage", "Coverage is PARTIAL"]
  }
};

for (const [id, cases] of Object.entries(probes)) {
  const rx = regexById.get(id);
  if (!rx) {
    fail(`missing regex ${id}`);
    continue;
  }
  for (const sample of cases.yes) {
    rx.lastIndex = 0;
    if (!rx.test(sample)) fail(`regex ${id} missed positive probe: ${sample}`);
  }
  for (const sample of cases.no) {
    rx.lastIndex = 0;
    if (rx.test(sample)) fail(`regex ${id} false-positive probe: ${sample}`);
  }
}

const expectedSocial = {
  schema_version: "binrat.social/1",
  coverage_states: ["COMPLETE","PARTIAL","UNKNOWN","MISSING"],
  evidence_states: ["OBSERVED","DERIVED","PATTERN","UNKNOWN","COMPLETE","PARTIAL","UNVERIFIED","MISSING"],
  cta_labels: ["OPEN RECEIPTS →","OPEN CASE →","DIG DEEPER →"],
  families: {
    receipt: {headline_chars:38,literal_chars:170},
    "case-file": {headline_chars:42,literal_chars:200,fact_rows_min:3,fact_rows_max:5},
    "rat-found": {headline_chars:24,literal_chars:150,evidence_strips:1}
  }
};
const contract = data.social_card_contract || {};
for (const key of ["schema_version","coverage_states","evidence_states","cta_labels","families"]) {
  if (JSON.stringify(contract[key]) !== JSON.stringify(expectedSocial[key])) {
    fail(`social_card_contract.${key} drifted from binrat.social/1 compatibility envelope`);
  }
}

const semanticRequirements = new Map(
  (data.semantic_upgrades || []).map((row) => [row.from, new Set(row.must_not_become || [])])
);
const requireUpgrade = (from, value) => {
  if (!semanticRequirements.get(from)?.has(value)) fail(`semantic upgrade guard missing: ${from} -> ${value}`);
};
for (const v of ["creator","founder","dev"]) requireUpgrade("deployer",v);
for (const v of ["human","person","team"]) requireUpgrade("address",v);
for (const v of ["skill","expertise","profitability","winning"]) requireUpgrade("recurrence",v);
for (const v of ["safe","clean","benign"]) requireUpgrade("missing",v);

const requiredCopySnippets = [
  "### Social-card renderer compatibility",
  "headline 42 characters; narrative 200 characters; 3–5 fact rows",
  "RECEIPT / CASE FILE / RAT FOUND SOMETHING cards accept only \`OPEN RECEIPTS →\`, \`OPEN CASE →\`, or \`DIG DEEPER →\`"
];
for (const snippet of requiredCopySnippets) {
  if (!copy.includes(snippet)) fail(`COPY_LIBRARY missing compatibility text: ${snippet}`);
}
for (const stale of [
  "2–4 high-value facts",
  "narrative 220 characters; 4 fact rows maximum on share cards"
]) {
  if (copy.includes(stale)) fail(`COPY_LIBRARY retains stale social-card rule: ${stale}`);
}

if (data.recommended_max?.case_file_post?.literal_chars > expectedSocial.families["case-file"].literal_chars) {
  fail("case_file_post recommended literal budget exceeds rendered card hard max");
}

if (errors.length) {
  console.error("COPY LIBRARY VALIDATION FAIL");
  for (const error of errors) console.error("- " + error);
  process.exit(1);
}

console.log(JSON.stringify({
  validation:"PASS",
  regexes:regexById.size,
  rejectFixtures:(data.reject_fixtures || []).length,
  socialSchema:contract.schema_version,
  socialCtas:contract.cta_labels
}, null, 2));
