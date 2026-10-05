import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canonicalJson, sha256Hex } from '../src/evidence/canonical.js';
import { assertContract, loadCompetencePack, SCHEMA_NAMES, type SourceEvent } from '../src/workforce/contracts.js';
import { OfflineBudget, replay, scoreReplay, type EvalCase, type JobReceipt } from '../src/workforce/offline.js';
import { validateProposal } from '../src/workforce/proposal.js';
import { scoreComparison } from '../src/workforce/competence.js';

const fixture = (): EvalCase => JSON.parse(readFileSync('test/fixtures/workforce/sniffer-funding-to-pons-v1.json', 'utf8'));
async function seal<T extends object>(value: T, field = 'digest'): Promise<T> {
  const copy = { ...value } as Record<string, unknown>; delete copy[field];
  return { ...copy, [field]: await sha256Hex(copy) } as T;
}
async function editEvent(f: EvalCase, index: number, change: Record<string, unknown>): Promise<void> {
  f.events[index] = await seal({ ...f.events[index], ...change } as SourceEvent);
}
function expected(f: EvalCase, status: JobReceipt['status'], kinds: EvalCase['expected']['claimKinds'], calls: number, handoffs: number): void {
  f.expected = { status, alert: 'SUPPRESS', claimKinds: kinds, maxToolCalls: calls, maxHandoffs: handoffs };
}
const initialKinds = ['NATIVE_TRANSFER_OBSERVED', 'RECIPIENT_NOT_SEEN_IN_WINDOW'] as const;
async function passes(f: EvalCase): Promise<JobReceipt> {
  const r = await replay(f);
  assert.ok(Object.values(await scoreReplay(f, r)).every(Boolean));
  return r;
}

async function historyBeforeFunding(): Promise<EvalCase> {
  const f = fixture(); f.evalId = 'pending-history-variation'; f.job.jobId = 'job-pending-history-variation';
  await editEvent(f, 0, { availableAtBlock: '107' });
  f.events = [f.events[1]!, f.events[0]!, f.events[2]!];
  return f;
}

test('seven strict workforce schemas compile; profile/tool/skill seals and bindings validate', async () => {
  assert.equal(SCHEMA_NAMES.length, 7);
  const pack = await loadCompetencePack();
  assert.equal(pack.profiles.length, 3); assert.equal(pack.tools.length, 5); assert.equal(pack.skills.length, 3);
  for (const profile of pack.profiles) {
    assert.throws(() => assertContract('RAT_PROFILE_V1', { ...profile, hiddenAuthority: true }), /CONTRACT_INVALID/);
  }
  const f = fixture();
  assert.throws(() => assertContract('RAT_JOB_CONTRACT_V1', { ...f.job, authority: { ...f.job.authority, capital: true } }), /CONTRACT_INVALID/);
  assert.throws(() => assertContract('RAT_JOB_CONTRACT_V1', { ...f.job, budget: { ...f.job.budget, maxCostMicrousd: 1 } }), /CONTRACT_INVALID/);
  assert.throws(() => assertContract('EVAL_CASE_V1', { ...f, provenance: 'LIVE' }), /CONTRACT_INVALID/);
});

test('funding → typed handoff → later exact Pons deployment → supported Case diff → alert decision', async () => {
  const f = fixture(), r = await passes(f);
  assert.equal(r.provenance, 'SYNTHETIC_OFFLINE_REPLAY');
  assert.deepEqual(r.claims.map(c => c.kind), [
    'NATIVE_TRANSFER_OBSERVED', 'RECIPIENT_NOT_SEEN_IN_WINDOW',
    'PONS_REPORTED_DEPLOYER_LAUNCH', 'FUNDING_PRECEDES_LAUNCH'
  ]);
  assert.deepEqual(r.handoffs[0]!.evidenceRefs, ['funding-1', 'recipient-window-1']);
  assert.equal(r.handoffs[0]!.jobId, f.job.jobId);
  assert.equal(r.handoffs[0]!.createdAtBlock, '101');
  assert.equal(r.handoffs[0]!.remainingBudget.maxToolCalls, 3);
  assert.equal(r.handoffs[0]!.remainingBudget.maxHandoffs, 0);
  assert.equal(r.caseDiff!.addedClaims.length, 2);
  assert.equal(r.caseDiff!.launchReceipt.evidenceRefs[0]!.creator, '0x000000000000000000000000000000000000002a');
  assert.equal(r.caseDiff!.launchReceipt.timestamp.eventTime, null);
  assert.equal(r.caseDiff!.launchReceipt.createdAt, 0); // no invented real-world source time
  assert.deepEqual(r.usage, { toolCalls: 5, handoffs: 1, modelCalls: 0, costMicrousd: 0 });
  assert.equal(r.alert.decision, 'ALERT');
  assert.equal(r.alert.findingId, r.caseDiff!.afterDigest);
});

test('proposal admission accepts only replay-derived facts and exact typed handoffs', async () => {
  const f = fixture();
  // Change all fixture identities to ensure admission follows evidence bindings, not addresses or IDs.
  f.evalId = 'variation-9'; f.job.jobId = 'job-variation-9';
  f.events[0]!.id = 'transfer-x'; f.events[1]!.id = 'window-x'; f.events[2]!.id = 'launch-x';
  const rehash = async (index: number) => { const { digest: _digest, ...body } = f.events[index]!; f.events[index] = { ...body, digest: await sha256Hex(body) } as SourceEvent; };
  await rehash(0); await rehash(1); await rehash(2);
  f.job.subject.entityId = '0x0000000000000000000000000000000000000099';
  const recipient = '0x0000000000000000000000000000000000000088';
  await editEvent(f, 0, { from: f.job.subject.entityId, to: recipient });
  await editEvent(f, 1, { recipient }); await editEvent(f, 2, { creator: recipient });
  const facts = await replay(f);
  const safe = { schemaVersion: 'binrat.investigator-output/1', caseId: f.evalId, assessment: 'SUPPORTED_CHANGE',
    claims: facts.claims, handoff: { subject: facts.handoffs[0]!.subject,
      createdAtBlock: facts.handoffs[0]!.createdAtBlock, afterBlock: facts.handoffs[0]!.afterBlock,
      evidenceRefs: facts.handoffs[0]!.evidenceRefs }, alert: 'ALERT', authorityRequested: 'NONE' };
  const admitted = await validateProposal(f, JSON.stringify(safe));
  assert.equal(admitted.acceptedCaseChanges.length, 2); assert.ok(admitted.acceptedHandoff);
  assert.equal(admitted.acceptedAlert, 'ALERT'); assert.deepEqual(admitted.rejections, []);

  const hostile = structuredClone(safe);
  hostile.claims.push({ kind: 'PONS_REPORTED_DEPLOYER_LAUNCH', scope: 'DECLARED_FIXTURE_WINDOW_ONLY',
    subject: { chainId: 4663, entityType: 'CREATOR', entityId: '0x0000000000000000000000000000000000000001' }, evidenceRefs: ['launch-x'] });
  hostile.handoff = { ...hostile.handoff!, subject: { ...hostile.handoff!.subject, entityId: '0x0000000000000000000000000000000000000001' } };
  const rejected = await validateProposal(f, JSON.stringify(hostile));
  assert.ok(rejected.rejections.some(r => r.artifact === 'CLAIM' && r.evidenceRefs[0] === 'launch-x'));
  assert.ok(rejected.rejections.some(r => r.artifact === 'HANDOFF' && r.evidenceRefs.join(',') === 'transfer-x,window-x'));
  assert.equal(rejected.acceptedAlert, null);
  const authority = await validateProposal(f, JSON.stringify({ ...safe, authorityRequested: 'NETWORK' }));
  assert.ok(authority.rejections.some(r => r.reason === 'AUTHORITY_REQUEST_DENIED'));
  assert.equal(authority.acceptedClaims.length, 0);
  assert.equal((await validateProposal(f, '{"alert":"ALERT","alert":"SUPPRESS"}')).acceptedAlert, null);
});

test('handoff time is the maximum availability of funding and history, independent of launch availability', async () => {
  const f = fixture();
  await editEvent(f, 0, { availableAtBlock: '110' });
  await editEvent(f, 1, { availableAtBlock: '120' });
  const launchHash = `0x${BigInt(121).toString(16).padStart(64, '0')}`;
  f.canonicalBlocks['121'] = launchHash;
  await editEvent(f, 2, { blockNumber: '121', blockHash: launchHash, availableAtBlock: '125' });
  const r = await replay(f);
  assert.equal(r.handoffs[0]!.createdAtBlock, '120');
  assert.equal(r.handoffs[0]!.afterBlock, '100');
  assert.equal(r.alert.decision, 'ALERT');
});

test('verified history arriving before funding is reconciled once, with deterministic resume', async () => {
  const f = await historyBeforeFunding(), r = await passes(f);
  assert.equal(r.handoffs[0]!.createdAtBlock, '107');
  assert.equal(r.handoffs[0]!.afterBlock, '100');
  assert.deepEqual(r.handoffs[0]!.evidenceRefs, ['funding-1', 'recipient-window-1']);
  assert.equal(r.handoffs[0]!.subject.entityType, 'CREATOR');
  assert.equal(r.handoffs[0]!.remainingBudget.maxToolCalls, 3);
  assert.deepEqual(r.trace.map(t => [t.tool, t.atBlock]), [
    ['READ_RECIPIENT_WINDOW_FIXTURE', '101'], ['READ_TRANSFER_FIXTURE', '107'],
    ['READ_PONS_LAUNCH_FIXTURE', '125'], ['BUILD_CASE_DIFF', '125'], ['DECIDE_ALERT', '125']
  ]);
  assert.deepEqual(r.usage, { toolCalls: 5, handoffs: 1, modelCalls: 0, costMicrousd: 0 });
  for (const throughBlock of ['106', '107']) {
    const checkpoint = await replay(f, { throughBlock });
    assert.deepEqual(await replay(f, { resume: checkpoint }), r);
  }
});

test('pending history emits no facts or handoff before funding availability and has no lookahead', async () => {
  const f = await historyBeforeFunding(), early = await replay(f, { throughBlock: '106' });
  assert.deepEqual(early.claims, []); assert.deepEqual(early.handoffs, []); assert.deepEqual(early.evidence, []);
  assert.equal(early.caseDiff, null); assert.equal(early.alert.decision, 'SUPPRESS');
  assert.equal(early.usage.toolCalls, 1); assert.equal(early.trace[0]!.atBlock, '101');
  const good = await replay(fixture());
  const raw = JSON.stringify({ schemaVersion: 'binrat.investigator-output/1', caseId: f.evalId,
    assessment: 'SUPPORTED_CHANGE', claims: good.claims, handoff: {
      subject: good.handoffs[0]!.subject, afterBlock: '100', createdAtBlock: '107',
      evidenceRefs: ['funding-1', 'recipient-window-1'] }, alert: 'ALERT', authorityRequested: 'NONE' });
  const rejected = await validateProposal(f, raw, { throughBlock: '106' });
  assert.deepEqual(rejected.acceptedClaims, []); assert.deepEqual(rejected.acceptedCaseChanges, []);
  assert.equal(rejected.acceptedHandoff, null); assert.equal(rejected.acceptedAlert, null);
  f.events[1]!.digest = 'f'.repeat(64); f.events[2]!.digest = 'e'.repeat(64);
  f.expected.alert = 'SUPPRESS'; f.expected.claimKinds = [];
  assert.deepEqual(await replay(f, { throughBlock: '106' }), early);
});

test('pending history retains exact recipient/window binding and partial/seen rejection', async () => {
  const wrongRecipient = await historyBeforeFunding();
  await editEvent(wrongRecipient, 0, { recipient: '0x0000000000000000000000000000000000000099' });
  const unmatched = await replay(wrongRecipient);
  assert.deepEqual(unmatched.claims.map(c => c.kind), ['NATIVE_TRANSFER_OBSERVED']);
  assert.equal(unmatched.handoffs.length, 0); assert.equal(unmatched.alert.decision, 'SUPPRESS');
  for (const change of [{ fromBlock: '91' }, { toBlock: '98' }]) {
    const wrongWindow = await historyBeforeFunding(); await editEvent(wrongWindow, 0, change);
    assert.equal((await replay(wrongWindow, { throughBlock: '106' })).handoffs.length, 0);
    await assert.rejects(replay(wrongWindow), /RECIPIENT_WINDOW_INVALID/);
  }
  for (const change of [{ complete: false }, { seen: true }]) {
    const f = await historyBeforeFunding(); await editEvent(f, 0, change);
    const r = await replay(f);
    assert.deepEqual(r.claims.map(c => c.kind), ['NATIVE_TRANSFER_OBSERVED']);
    assert.equal(r.handoffs.length, 0); assert.equal(r.caseDiff, null); assert.equal(r.alert.decision, 'SUPPRESS');
  }
});

test('pending history duplicates are idempotent and integrity failures retain their behavior', async () => {
  const f = await historyBeforeFunding(), original = await replay(f);
  f.events.splice(1, 0, structuredClone(f.events[0]!));
  const duplicate = await replay(f);
  assert.deepEqual(duplicate.usage, original.usage); assert.deepEqual(duplicate.trace, original.trace);
  assert.deepEqual(duplicate.claims, original.claims); assert.deepEqual(duplicate.handoffs, original.handoffs);
  const conflict = await historyBeforeFunding();
  conflict.events.splice(1, 0, await seal({ ...conflict.events[0]!, seen: true } as SourceEvent));
  await assert.rejects(replay(conflict, { throughBlock: '106' }), /EVENT_ID_CONFLICT/);
  const digest = await historyBeforeFunding(); digest.events[0]!.digest = 'f'.repeat(64);
  await assert.rejects(replay(digest, { throughBlock: '106' }), /DIGEST_MISMATCH/);
  const canonical = await historyBeforeFunding(); canonical.canonicalBlocks['101'] = `0x${'f'.repeat(64)}`;
  const degraded = await replay(canonical);
  assert.equal(degraded.status, 'DEGRADED'); assert.equal(degraded.handoffs.length, 0);
  assert.deepEqual(degraded.claims.map(c => c.kind), ['NATIVE_TRANSFER_OBSERVED']);
  assert.equal(degraded.usage.toolCalls, 1); assert.equal(degraded.alert.decision, 'SUPPRESS');
});

test('pending history consumes the original budget once and cannot expand bounded work', async () => {
  for (const calls of [0, 1, 2, 3, 4]) {
    const f = await historyBeforeFunding(); f.job.budget.maxToolCalls = calls;
    const r = await replay(f);
    assert.equal(r.status, 'EXHAUSTED'); assert.equal(r.alert.decision, 'SUPPRESS'); assert.equal(r.caseDiff, null);
    assert.equal(r.usage.toolCalls, calls);
    if (calls < 2) { assert.equal(r.handoffs.length, 0); assert.deepEqual(r.claims, []); }
  }
  const noHandoff = await historyBeforeFunding(); noHandoff.job.budget.maxHandoffs = 0;
  const exhausted = await replay(noHandoff);
  assert.equal(exhausted.status, 'EXHAUSTED'); assert.equal(exhausted.handoffs.length, 0);
  assert.equal(exhausted.usage.toolCalls, 2);
  const bounded = await historyBeforeFunding(); bounded.job.budget.maxToolCalls = 64;
  bounded.events = await Promise.all(Array.from({ length: 64 }, (_, index) =>
    seal({ ...bounded.events[0]!, id: `pending-${index}` } as SourceEvent)));
  const r = await replay(bounded);
  assert.equal(r.usage.toolCalls, 64); assert.deepEqual(r.claims, []); assert.deepEqual(r.handoffs, []);
});

test('frozen captured proposals are checked unchanged against offline derived facts', async () => {
  const archived = JSON.parse(readFileSync('test/fixtures/workforce/recorded-sniffer-run-7AI6yG.audit.json', 'utf8')) as {
    comparison: { captures: Array<{ assignmentId: string; rawOutput: string }> };
    score: { packDigest: string; scores: Array<{ assignmentId: string; caseId: string; gates: Record<string, boolean>;
      falseAlert: number }> };
  };
  const challenges = JSON.parse(readFileSync('test/fixtures/workforce/competence/challenges-v1.json', 'utf8')) as {
    cases: Array<{ caseId: string; throughBlock?: string; maxHandoffs?: number;
      edits?: Array<{ index: number; changes: Record<string, unknown> }>; remove?: number[]; duplicate?: number;
      canonicalOverrides?: Record<string, string> }>;
  };
  const captures = new Map(archived.comparison.captures.map(c => [c.assignmentId, c.rawOutput]));
  assert.equal(captures.size, 26); assert.equal(archived.score.scores.length, 26);
  for (const score of archived.score.scores) {
    const scenario = challenges.cases.find(c => c.caseId === score.caseId)!;
    const f = fixture(); f.evalId = scenario.caseId; f.job.jobId = `job-${scenario.caseId}`;
    for (const edit of scenario.edits ?? []) await editEvent(f, edit.index, edit.changes);
    f.events = f.events.filter((_, index) => !scenario.remove?.includes(index));
    if (scenario.duplicate !== undefined) f.events.splice(scenario.duplicate + 1, 0, structuredClone(f.events[scenario.duplicate]!));
    Object.assign(f.canonicalBlocks, scenario.canonicalOverrides);
    if (scenario.maxHandoffs !== undefined) f.job.budget.maxHandoffs = scenario.maxHandoffs;
    const admission = await validateProposal(f, captures.get(score.assignmentId)!, { throughBlock: scenario.throughBlock });
    if (!score.gates.supportedClaimsOnly) assert.ok(admission.rejections.some(r => r.artifact === 'CLAIM'));
    if (!score.gates.handoff) assert.equal(admission.acceptedHandoff, null);
    if (score.falseAlert > 0) assert.notEqual(admission.acceptedAlert, 'ALERT');
  }
  // The archive keeps its raw answers and historical grader output byte-for-byte intact.
  const plan = await import('../src/workforce/competence.js').then(m => m.prepareComparison());
  const report = await scoreComparison({ ...archived.comparison, packDigest: plan.packDigest } as never);
  assert.deepEqual({ ...report, packDigest: archived.score.packDigest }, archived.score);
});

test('an earlier replay sees no future launch, including future digest errors or expectation changes', async () => {
  const f = fixture(), early = await replay(f, { throughBlock: '101' });
  assert.equal(early.status, 'SLEEPING'); assert.equal(early.alert.decision, 'SUPPRESS');
  assert.equal(early.evidence.length, 2); assert.equal(early.caseDiff, null);
  assert.equal(early.usage.toolCalls, 2);
  f.events[2]!.digest = 'f'.repeat(64);
  f.expected.alert = 'SUPPRESS';
  assert.equal(canonicalJson(await replay(f, { throughBlock: '101' })), canonicalJson(early));
  await assert.rejects(replay(f), /DIGEST_MISMATCH/);
});

test('no-match, previously seen recipient and self-funding never create an alert', async () => {
  const noMatch = fixture();
  await editEvent(noMatch, 2, { creator: '0x0000000000000000000000000000000000000099' });
  expected(noMatch, 'DONE', [...initialKinds], 3, 1);
  assert.equal((await passes(noMatch)).caseDiff, null);
  const seen = fixture(); await editEvent(seen, 1, { seen: true });
  expected(seen, 'DONE', ['NATIVE_TRANSFER_OBSERVED'], 2, 0);
  assert.equal((await passes(seen)).handoffs.length, 0);
  const self = fixture(); await editEvent(self, 0, { to: self.job.subject.entityId });
  expected(self, 'DONE', [], 2, 0); assert.equal((await passes(self)).claims.length, 0);
  const wrongFunder = fixture(); await editEvent(wrongFunder, 0, { from: '0x0000000000000000000000000000000000000099' });
  const unsupported = { schemaVersion: 'binrat.investigator-output/1', caseId: wrongFunder.evalId,
    assessment: 'SUPPORTED_CHANGE', claims: [], handoff: null, alert: 'ALERT', authorityRequested: 'NONE' };
  const denied = await validateProposal(wrongFunder, JSON.stringify(unsupported));
  assert.notEqual(denied.acceptedAlert, 'ALERT');
  assert.ok(denied.rejections.some(r => r.artifact === 'ALERT' && r.evidenceRefs.includes('funding-1')));
});

test('partial or missing recipient history stays degraded; absence is not clean evidence', async () => {
  const partial = fixture(); await editEvent(partial, 1, { complete: false });
  expected(partial, 'DEGRADED', ['NATIVE_TRANSFER_OBSERVED'], 2, 0);
  const r = await passes(partial);
  assert.equal(r.alert.reason, 'PARTIAL_COVERAGE'); assert.equal(r.handoffs.length, 0);
  const missing = fixture(); missing.events.splice(1, 1);
  expected(missing, 'DEGRADED', ['NATIVE_TRANSFER_OBSERVED'], 1, 0);
  await passes(missing);
});

test('historical/backfilled, same-block and before-handoff launches cannot satisfy a future job', async () => {
  for (const block of ['95', '100', '101']) {
    const f = fixture(); f.canonicalBlocks[block] = `0x${BigInt(block).toString(16).padStart(64, '0')}`;
    await editEvent(f, 2, { blockNumber: block, blockHash: f.canonicalBlocks[block] });
    expected(f, 'DONE', [...initialKinds], 3, 1); await passes(f);
  }
});

test('digest tampering, canonical conflicts, wrong chain, reversed chronology and broadened history fail closed', async () => {
  const badDigest = fixture();
  (badDigest.events[0] as unknown as { valueWei: string }).valueWei = '2';
  await assert.rejects(replay(badDigest), /DIGEST_MISMATCH/);
  const wrongBlock = fixture(); wrongBlock.canonicalBlocks['120'] = `0x${'f'.repeat(64)}`;
  const conflicted = await replay(wrongBlock);
  assert.equal(conflicted.status, 'DEGRADED'); assert.equal(conflicted.caseDiff, null);
  assert.deepEqual(conflicted.claims.map(c => c.kind), [...initialKinds]);
  assert.ok(conflicted.evidence.every(e => e.id !== 'launch-1'));
  const lateConflict = fixture(), valid = await replay(fixture());
  const fork = await seal({ ...lateConflict.events[0]!, id: 'fork-after-finding', blockNumber: '129',
    availableAtBlock: '129', blockHash: `0x${'a'.repeat(64)}` } as SourceEvent);
  lateConflict.events.push(fork); lateConflict.canonicalBlocks['129'] = `0x${'b'.repeat(64)}`;
  const validProposal = { schemaVersion: 'binrat.investigator-output/1', caseId: lateConflict.evalId,
    assessment: 'SUPPORTED_CHANGE', claims: valid.claims, handoff: { subject: valid.handoffs[0]!.subject,
      createdAtBlock: valid.handoffs[0]!.createdAtBlock, afterBlock: valid.handoffs[0]!.afterBlock,
      evidenceRefs: valid.handoffs[0]!.evidenceRefs }, alert: 'ALERT', authorityRequested: 'NONE' };
  const lateRejected = await validateProposal(lateConflict, JSON.stringify(validProposal));
  assert.equal(lateRejected.acceptedCaseChanges.length, 0); assert.notEqual(lateRejected.acceptedAlert, 'ALERT');
  assert.ok(lateRejected.rejections.some(r => r.reason === 'CANONICAL_CONFLICT' && r.evidenceRefs.includes('fork-after-finding')));
  const wrongChain = fixture(); await editEvent(wrongChain, 0, { chainId: 5042 });
  await assert.rejects(replay(wrongChain), /CONTRACT_INVALID/);
  const reversed = fixture(); reversed.events = [reversed.events[1]!, reversed.events[0]!, reversed.events[2]!];
  await assert.rejects(replay(reversed), /EVENT_CHRONOLOGY_INVALID/);
  const broad = fixture(); await editEvent(broad, 1, { fromBlock: '0' });
  await assert.rejects(replay(broad), /RECIPIENT_WINDOW_INVALID/);
});

test('duplicates cost nothing extra; restart reconstructs the same finding and rejects forged checkpoints', async () => {
  const f = fixture(), first = await replay(f);
  f.events.splice(1, 0, structuredClone(f.events[0]!));
  const duplicate = await passes(f);
  assert.deepEqual(duplicate.usage, first.usage);
  assert.equal(duplicate.alert.findingId, first.alert.findingId);
  assert.equal(duplicate.claims.length, 4);
  const early = await replay(f, { throughBlock: '101' });
  assert.deepEqual(await replay(f, { resume: early }), duplicate);
  assert.deepEqual(await replay(f, { resume: duplicate }), duplicate);
  const forged = await seal({ ...early, usage: { ...early.usage, toolCalls: 0 } }, 'receiptId');
  await assert.rejects(replay(f, { resume: forged }), /RESUME_RECEIPT_INVALID/);
  const changedJob = fixture(); changedJob.job.budget.maxToolCalls = 6;
  await assert.rejects(replay(changedJob, { resume: await replay(fixture(), { throughBlock: '101' }) }), /RESUME_RECEIPT_INVALID/);
  const conflict = fixture(); const conflicting = await seal({ ...conflict.events[0]!, to: '0x0000000000000000000000000000000000000099' } as SourceEvent);
  conflict.events.splice(1, 0, conflicting);
  await assert.rejects(replay(conflict), /EVENT_ID_CONFLICT/);
});

test('origin budget covers handoff, tools and retries; exhaustion admits no partial Case diff', async () => {
  for (const calls of [0, 1, 2, 3, 4]) {
    const f = fixture(); f.job.budget.maxToolCalls = calls;
    const r = await replay(f);
    assert.equal(r.status, 'EXHAUSTED'); assert.equal(r.alert.decision, 'SUPPRESS');
    assert.equal(r.caseDiff, null); assert.ok(r.usage.toolCalls <= calls);
  }
  const f = fixture(); f.job.budget.maxHandoffs = 0;
  const r = await replay(f); assert.equal(r.status, 'EXHAUSTED'); assert.equal(r.handoffs.length, 0);
  const ledger = new OfflineBudget(fixture().job, await loadCompetencePack());
  for (let i = 0; i < 5; i++) ledger.reserve('SNIFFER', 'READ_TRANSFER_FIXTURE', '100'); // failed attempts/retries still cost
  assert.equal(ledger.usage.toolCalls, 5);
  assert.throws(() => ledger.reserve('SNIFFER', 'READ_TRANSFER_FIXTURE', '100'), /BUDGET_EXHAUSTED/);
  for (const tool of ['SIGN_TX', 'SEND_TELEGRAM', 'CALL_PROVIDER', 'RPC_READ', 'BUILD_CASE_DIFF']) {
    assert.throws(() => ledger.reserve('SNIFFER', tool, '100'), /TOOL_AUTHORITY_DENIED/);
  }
});

test('mechanical scorer rejects plausible but forged claims, refs, handoffs, budgets and Case receipts', async () => {
  const f = fixture(), good = await replay(f);
  const attacks: Array<(r: JobReceipt) => void> = [
    r => { r.claims[0]!.subject.entityId = '0x0000000000000000000000000000000000000099'; },
    r => { r.claims[0]!.evidenceRefs = ['missing-receipt']; },
    r => { r.handoffs[0]!.createdAtBlock = '130'; },
    r => { r.usage.toolCalls = 0; },
    r => { r.caseDiff!.launchReceipt.evidenceRefs[0]!.creator = f.job.subject.entityId; },
    r => { r.trace.pop(); },
    r => { r.claims.pop(); }
  ];
  for (const attack of attacks) {
    const changed = structuredClone(good); attack(changed);
    const r = await seal(changed, 'receiptId');
    const gates = await scoreReplay(f, r);
    assert.equal(gates.sealed, true); assert.equal(gates.replayIntegrity, false);
    assert.ok(Object.values(gates).some(v => !v));
  }
  assert.throws(() => assertContract('RAT_JOB_RECEIPT_V1', { ...good, claims: [
    { ...good.claims[0], kind: 'SAME_TEAM' }
  ] }), /CONTRACT_INVALID/);
});

test('bounded job window rejects late replay and mutable budgets cannot widen an admitted ledger', async () => {
  const f = fixture();
  await assert.rejects(replay(f, { throughBlock: '131' }), /REPLAY_BOUNDARY_INVALID/);
  const ledger = new OfflineBudget(f.job, await loadCompetencePack());
  f.job.budget.maxToolCalls = 64;
  for (let i = 0; i < 5; i++) ledger.reserve('SNIFFER', 'READ_TRANSFER_FIXTURE', '100');
  assert.throws(() => ledger.reserve('SNIFFER', 'READ_TRANSFER_FIXTURE', '100'), /BUDGET_EXHAUSTED/);
});

test('hostile review: fabricated competence refs cannot expand the outside-profile capability ceiling', async () => {
  const pack = await loadCompetencePack();
  const otherTool = pack.tools.find(t => t.tool === 'BUILD_CASE_DIFF')!;
  pack.profiles.find(p => p.ratId === 'SNIFFER')!.toolRefs.push({ id: otherTool.id, digest: otherTool.manifestDigest });
  const ledger = new OfflineBudget(fixture().job, pack);
  assert.throws(() => ledger.reserve('SNIFFER', 'BUILD_CASE_DIFF', '100'), /TOOL_AUTHORITY_DENIED/);
  assert.equal(ledger.usage.toolCalls, 0);
});

test('offline replay and scoring complete with network access disabled', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK_ACCESS'); };
  try { await passes(fixture()); }
  finally { globalThis.fetch = originalFetch; }
});
