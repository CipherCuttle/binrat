import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canonicalJson, sha256Hex } from '../src/evidence/canonical.js';
import { assertContract, loadCompetencePack, SCHEMA_NAMES, type SourceEvent } from '../src/workforce/contracts.js';
import { OfflineBudget, replay, scoreReplay, type EvalCase, type JobReceipt } from '../src/workforce/offline.js';

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
  expected(self, 'DONE', [], 1, 0); assert.equal((await passes(self)).claims.length, 0);
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
  await assert.rejects(replay(wrongBlock), /CANONICAL_BLOCK_MISMATCH/);
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
