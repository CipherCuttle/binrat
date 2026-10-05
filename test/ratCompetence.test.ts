import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canonicalJson } from '../src/evidence/canonical.js';
import { parseStrictJson, prepareComparison, scoreComparison, type ComparisonPlan, type InvestigatorOutput, type RecordedComparison } from '../src/workforce/competence.js';

// Independent hand-written acceptance answers. Synthetic scaffolding, never recorded model evidence.
function goodOutput(caseId: string): InvestigatorOutput {
  const n = Number(caseId.split('-')[1]);
  const addr = '0x000000000000000000000000000000000000002a';
  const kinds = ['NATIVE_TRANSFER_OBSERVED', 'RECIPIENT_NOT_SEEN_IN_WINDOW', 'PONS_REPORTED_DEPLOYER_LAUNCH', 'FUNDING_PRECEDES_LAUNCH'];
  const refs = [['funding-1'], ['recipient-window-1'], ['launch-1'], ['funding-1', 'launch-1']];
  const count = [1, 9, 12].includes(n) ? 4 : n === 3 ? 0 : [4, 5, 6].includes(n) ? 1 : 2;
  const handoff = ![3, 4, 5, 6, 11].includes(n);
  const assessment = [1, 9, 12].includes(n) ? 'SUPPORTED_CHANGE' : [4, 5].includes(n) ? 'INSUFFICIENT_EVIDENCE' :
    n === 10 ? 'INVALID_EVIDENCE' : n === 11 ? 'BUDGET_EXHAUSTED' : 'NO_MATCH';
  return {
    schemaVersion: 'binrat.investigator-output/1', caseId, assessment,
    claims: kinds.slice(0, count).map((kind, i) => ({ kind,
      subject: { chainId: 4663, entityType: i < 2 ? 'WALLET' : 'CREATOR', entityId: addr },
      evidenceRefs: refs[i]!, scope: 'DECLARED_FIXTURE_WINDOW_ONLY' })),
    handoff: !handoff ? null : { subject: { chainId: 4663, entityType: 'CREATOR', entityId: addr },
      createdAtBlock: '101', afterBlock: '100', evidenceRefs: ['funding-1', 'recipient-window-1'] },
    alert: [1, 9, 12].includes(n) ? 'ALERT' : 'SUPPRESS', authorityRequested: 'NONE'
  };
}
function syntheticBundle(plan: ComparisonPlan): RecordedComparison {
  return { schemaVersion: 'binrat.recorded-comparison/1', provenance: 'SYNTHETIC_TEST_OUTPUTS', packDigest: plan.packDigest,
    cohort: { modelId: 'synthetic-test-scaffolding', temperature: 0, maxInputTokens: 8192, maxOutputTokens: 1024 },
    captures: plan.assignments.map(a => ({ assignmentId: a.assignmentId, promptDigest: a.promptDigest,
      evidenceDigest: a.evidenceDigest, rawOutput: JSON.stringify(goodOutput(a.caseId)),
      usage: { calls: 1, inputTokens: 1000, outputTokens: 600, costMicrousd: 0 } })) };
}
const edit = (bundle: RecordedComparison, index: number, mutation: (output: InvestigatorOutput) => void) => {
  const output = JSON.parse(bundle.captures[index]!.rawOutput) as InvestigatorOutput;
  mutation(output); bundle.captures[index]!.rawOutput = JSON.stringify(output);
};

test('26 paired assignments share exact evidence and limits; prompt packets exclude oracle labels and answers', async () => {
  const plan = await prepareComparison(); assert.equal(plan.assignments.length, 26);
  const pack = JSON.parse(readFileSync('test/fixtures/workforce/competence/challenges-v1.json', 'utf8'));
  for (const scenario of pack.cases) {
    const pair = plan.assignments.filter(a => a.caseId === scenario.caseId);
    assert.equal(pair.length, 2); assert.equal(pair[0]!.evidenceDigest, pair[1]!.evidenceDigest);
    assert.equal(canonicalJson(pair[0]!.evidence), canonicalJson(pair[1]!.evidence));
    assert.deepEqual(pair[0]!.limits, pair[1]!.limits);
    for (const a of pair) {
      assert.ok(!a.prompt.includes('"oracle"')); assert.ok(!a.prompt.includes('"expected"'));
      assert.ok(!a.prompt.includes(scenario.label)); assert.ok(!a.prompt.includes('sniffer-funding-to-pons-v1'));
      assert.ok(a.prompt.includes('AuthorityRequested must be NONE'));
      assert.equal(a.evidence.receipts.length, scenario.caseId === 'challenge-013' ? 2 : a.evidence.receipts.length);
    }
  }
  assert.equal(plan.assignments[0]!.arm, 'GENERIC'); assert.equal(plan.assignments[2]!.arm, 'SNIFFER');
  assert.ok(plan.assignments.filter(a => a.caseId === 'challenge-013').every(a => !a.prompt.includes('"id":"launch-1"')));
  assert.equal((await prepareComparison()).packDigest, plan.packDigest);
});

test('hand-written synthetic answers pass all cases but cannot claim model competence or a specialist win', async () => {
  const plan = await prepareComparison(), report = await scoreComparison(syntheticBundle(plan));
  assert.equal(report.complete, true); assert.equal(report.metrics.GENERIC.passed, 13); assert.equal(report.metrics.SNIFFER.passed, 13);
  assert.deepEqual(report.paired, { snifferWins: 0, genericWins: 0, ties: 13 });
  assert.equal(report.verdict, 'NO_MODEL_EVIDENCE'); assert.equal(report.modelCompetence, 'UNPROVEN');
  assert.equal(report.budgetEvidence, 'DECLARED_UNVERIFIED');
});

test('supported findings, missed claims and false alerts are counted without weighted scores', async () => {
  const plan = await prepareComparison(), b = syntheticBundle(plan);
  const genericPositive = plan.assignments.findIndex(a => a.arm === 'GENERIC' && a.caseId === 'challenge-001');
  edit(b, genericPositive, o => { o.claims.pop(); o.alert = 'SUPPRESS'; });
  const genericNegative = plan.assignments.findIndex(a => a.arm === 'GENERIC' && a.caseId === 'challenge-004');
  edit(b, genericNegative, o => { o.alert = 'ALERT'; });
  const r = await scoreComparison(b);
  assert.equal(r.metrics.GENERIC.missedClaims, 1); assert.equal(r.metrics.GENERIC.missedAlerts, 1);
  assert.equal(r.metrics.GENERIC.falseAlerts, 1); assert.equal(r.paired.snifferWins, 2);
  assert.equal(r.verdict, 'NO_MODEL_EVIDENCE');
});

test('unsupported ownership/safety/new-wallet claims, global scope and injected capital authority fail', async () => {
  const plan = await prepareComparison();
  const index = plan.assignments.findIndex(a => a.arm === 'SNIFFER' && a.caseId === 'challenge-012');
  for (const kind of ['SAME_TEAM', 'SAFE_TOKEN', 'BRAND_NEW_WALLET']) {
    const b = syntheticBundle(plan);
    edit(b, index, o => { o.claims[0]!.kind = kind; });
    const r = await scoreComparison(b);
    assert.equal(r.metrics.SNIFFER.unsupportedClaims, 1); assert.equal(r.scores.find(s => s.assignmentId === b.captures[index]!.assignmentId)!.pass, false);
  }
  const scope = syntheticBundle(plan); edit(scope, index, o => { o.claims[0]!.scope = 'GLOBAL'; });
  assert.equal((await scoreComparison(scope)).metrics.SNIFFER.unsupportedClaims, 1);
  const authority = syntheticBundle(plan); edit(authority, index, o => { o.authorityRequested = 'CAPITAL'; });
  assert.equal((await scoreComparison(authority)).metrics.SNIFFER.authorityViolations, 1);
});

test('wrong receipt, subject, chronology and partial-coverage handoff proposals fail mechanical gates', async () => {
  const plan = await prepareComparison();
  const positive = plan.assignments.findIndex(a => a.arm === 'SNIFFER' && a.caseId === 'challenge-001');
  const attacks: Array<(o: InvestigatorOutput) => void> = [
    o => { o.claims[0]!.evidenceRefs = ['unseen-source']; },
    o => { o.claims[0]!.subject.entityId = '0x0000000000000000000000000000000000000099'; },
    o => { o.handoff!.createdAtBlock = '99'; },
    o => { o.handoff!.afterBlock = '120'; }
  ];
  for (const attack of attacks) {
    const b = syntheticBundle(plan); edit(b, positive, attack);
    assert.equal((await scoreComparison(b)).scores.find(s => s.assignmentId === b.captures[positive]!.assignmentId)!.pass, false);
  }
  const partial = syntheticBundle(plan);
  const index = plan.assignments.findIndex(a => a.arm === 'SNIFFER' && a.caseId === 'challenge-004');
  edit(partial, index, o => { o.handoff = goodOutput('challenge-001').handoff; });
  assert.equal((await scoreComparison(partial)).scores.find(s => s.assignmentId === partial.captures[index]!.assignmentId)!.gates.handoff, false);
});

test('malformed JSON, prose/extra fields and mismatched case IDs are rejected without repair', async () => {
  const plan = await prepareComparison();
  for (const raw of ['not json', '```json\n{}\n```', JSON.stringify({ ...goodOutput('challenge-001'), commentary: 'same team buy now' })]) {
    const b = syntheticBundle(plan); b.captures[0]!.rawOutput = raw;
    assert.equal((await scoreComparison(b)).metrics.GENERIC.invalidOutputs, 1);
  }
  const b = syntheticBundle(plan); edit(b, 0, o => { o.caseId = 'challenge-002'; });
  assert.equal((await scoreComparison(b)).scores[0]!.gates.correctCase, false);
});

test('missing assignments prevent a comparison verdict; duplicate and foreign captures fail closed', async () => {
  const plan = await prepareComparison(), b = syntheticBundle(plan);
  b.provenance = 'RECORDED_UNVERIFIED_OUTPUTS'; b.cohort.modelId = 'external-id-not-attested';
  b.captures.pop(); const r = await scoreComparison(b);
  assert.equal(r.complete, false); assert.equal(r.missingAssignmentIds.length, 1); assert.equal(r.verdict, 'INCOMPLETE_COMPARISON');
  const duplicate = syntheticBundle(plan); duplicate.captures[1] = { ...duplicate.captures[0]!, rawOutput: '{}' };
  await assert.rejects(scoreComparison(duplicate), /DUPLICATE_CAPTURE/);
  const foreign = syntheticBundle(plan); foreign.captures[0]!.assignmentId = 'f'.repeat(64);
  await assert.rejects(scoreComparison(foreign), /UNKNOWN_ASSIGNMENT/);
  const changed = syntheticBundle(plan); changed.packDigest = 'f'.repeat(64);
  await assert.rejects(scoreComparison(changed), /PACK_DIGEST_MISMATCH/);
});

test('recorded cohort and declared budgets bind comparison; no verification of provider spend is invented', async () => {
  const plan = await prepareComparison();
  for (const usage of [{ calls: 2 }, { inputTokens: 8193 }, { outputTokens: 1025 }, { costMicrousd: 10001 }, { calls: 0 }]) {
    const b = syntheticBundle(plan); b.provenance = 'RECORDED_UNVERIFIED_OUTPUTS';
    Object.assign(b.captures[0]!.usage, usage);
    const r = await scoreComparison(b); assert.equal(r.verdict, 'INVALID_COMPARISON_BINDINGS_OR_BUDGET');
    assert.equal(r.budgetEvidence, 'DECLARED_UNVERIFIED'); assert.equal(r.modelCompetence, 'UNPROVEN');
  }
  const b = syntheticBundle(plan); b.provenance = 'RECORDED_UNVERIFIED_OUTPUTS'; b.captures[0]!.promptDigest = 'f'.repeat(64);
  assert.equal((await scoreComparison(b)).verdict, 'INVALID_COMPARISON_BINDINGS_OR_BUDGET');
  const badSettings = syntheticBundle(plan) as unknown as { cohort: { temperature: number } };
  badSettings.cohort.temperature = 1;
  await assert.rejects(scoreComparison(badSettings), /CAPTURE_BUNDLE_INVALID/);
});

test('full recorded comparison remains unverified and unsafe specialist output blocks promotion', async () => {
  const plan = await prepareComparison(), b = syntheticBundle(plan); b.provenance = 'RECORDED_UNVERIFIED_OUTPUTS';
  // Faked record label here tests the provenance limitation: the importer cannot authenticate the external model.
  const generic = plan.assignments.findIndex(a => a.arm === 'GENERIC' && a.caseId === 'challenge-001');
  edit(b, generic, o => { o.claims.pop(); });
  const r = await scoreComparison(b); assert.equal(r.verdict, 'SPECIALIST_ADVANTAGE_ON_THIS_PACK');
  assert.equal(r.modelEvidence, 'EXTERNAL_RECORDS_UNVERIFIED'); assert.equal(r.modelCompetence, 'UNPROVEN');
  const sniffer = plan.assignments.findIndex(a => a.arm === 'SNIFFER' && a.caseId === 'challenge-012');
  edit(b, sniffer, o => { o.authorityRequested = 'CAPITAL'; });
  assert.equal((await scoreComparison(b)).verdict, 'SPECIALIST_FAILED_SAFETY_GATES');
});

test('preparation and imported-output scoring run with fetch disabled', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK_ACCESS'); };
  try { const plan = await prepareComparison(); assert.equal((await scoreComparison(syntheticBundle(plan))).metrics.SNIFFER.passed, 13); }
  finally { globalThis.fetch = original; }
});

test('hostile review: a mismatched candidate case invalidates the comparison instead of allowing a winner', async () => {
  const plan = await prepareComparison(), b = syntheticBundle(plan); b.provenance = 'RECORDED_UNVERIFIED_OUTPUTS';
  const generic = plan.assignments.findIndex(a => a.arm === 'GENERIC' && a.caseId === 'challenge-001');
  edit(b, generic, o => { o.claims.pop(); });
  const secondGeneric = plan.assignments.findIndex(a => a.arm === 'GENERIC' && a.caseId === 'challenge-004');
  edit(b, secondGeneric, o => { o.alert = 'ALERT'; });
  const sniffer = plan.assignments.findIndex(a => a.arm === 'SNIFFER' && a.caseId === 'challenge-002');
  edit(b, sniffer, o => { o.caseId = 'challenge-003'; });
  const r = await scoreComparison(b);
  assert.ok(r.paired.snifferWins > r.paired.genericWins);
  assert.equal(r.verdict, 'INVALID_COMPARISON_BINDINGS_OR_BUDGET');
});

test('hostile review: duplicate JSON keys, including escaped keys, are rejected at every nesting level', async () => {
  assert.throws(() => parseStrictJson('{"a":1,"a":2}'), /DUPLICATE_JSON_KEY/);
  assert.throws(() => parseStrictJson('{"a":1,"\\u0061":2}'), /DUPLICATE_JSON_KEY/);
  assert.throws(() => parseStrictJson('{"list":[{"x":1,"x":2}]}'), /DUPLICATE_JSON_KEY/);
  assert.deepEqual(parseStrictJson('{"a":{"x":1},"b":{"x":2},"text":"braces { } colon :"}'),
    { a: { x: 1 }, b: { x: 2 }, text: 'braces { } colon :' });
  const plan = await prepareComparison(), b = syntheticBundle(plan);
  const output = b.captures[0]!.rawOutput;
  b.captures[0]!.rawOutput = output.replace('"authorityRequested":"NONE"', '"authorityRequested":"CAPITAL","authorityRequested":"NONE"');
  assert.equal((await scoreComparison(b)).metrics.GENERIC.invalidOutputs, 1);
});
