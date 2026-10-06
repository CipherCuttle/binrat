import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { canonicalJson, sha256Hex } from '../src/evidence/canonical.js';
import { LocalRatJobs, MAX_LOCAL_ADVANCES, type LocalSnapshot } from '../src/workforce/localJob.js';
import type { EvalCase, JobReceipt } from '../src/workforce/offline.js';

const fixture = (): EvalCase => JSON.parse(readFileSync('test/fixtures/workforce/sniffer-funding-to-pons-v1.json', 'utf8'));
function workspace(t: { after: (fn: () => void) => void }) {
  const dir = mkdtempSync(join(tmpdir(), 'binrat-local-job-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { dir, path: join(dir, 'jobs.sqlite') };
}
async function reseal<T extends object>(value: T, field = 'digest'): Promise<T> {
  const content = { ...value } as Record<string, unknown>; delete content[field];
  return { ...content, [field]: await sha256Hex(content) } as T;
}

test('durable job reopens, preserves origin usage and creates one evidence-bound Case and prepared notification', async t => {
  const { path } = workspace(t), f = fixture();
  let store = new LocalRatJobs(path, { create: true });
  const initial = await store.create(f); assert.equal(initial.phase, 'READY');
  const first = await store.advance(f.job.jobId, '100');
  assert.equal(first.phase, 'WAITING'); assert.equal(first.receipt!.usage.toolCalls, 1);
  assert.equal(first.localCase, null); assert.equal(first.notification, null);
  store.close(); store = new LocalRatJobs(path);
  const handoff = await store.advance(f.job.jobId, '101');
  assert.equal(handoff.receipt!.handoffs.length, 1); assert.equal(handoff.receipt!.usage.toolCalls, 2);
  assert.deepEqual(await store.advance(f.job.jobId, '101'), handoff);
  store.close(); store = new LocalRatJobs(path);
  const found = await store.advance(f.job.jobId, '125');
  assert.equal(found.phase, 'FOUND'); assert.equal(found.receipt!.usage.toolCalls, 5);
  assert.equal(found.localCase!.findingId, found.receipt!.alert.findingId);
  assert.equal(found.notification!.state, 'PREPARED_ONLY'); assert.equal(found.notification!.deliveryAuthorized, false);
  assert.deepEqual(await store.advance(f.job.jobId, '130'), found);
  assert.deepEqual(await store.cancel(f.job.jobId), found);
  store.close(); store = new LocalRatJobs(path, { readOnly: true });
  assert.equal((await store.inspect(f.job.jobId)).notification!.id, found.notification!.id);
  const exported = store.exportEvidence(f.job.jobId) as { journal: unknown[] };
  assert.equal(exported.journal.length, 4); store.close();
});

test('answers cannot change job identity; creation cannot reset or replace an existing job', async t => {
  const { path } = workspace(t), f = fixture(), store = new LocalRatJobs(path, { create: true });
  t.after(() => store.close());
  await store.create(f); const saved = await store.advance(f.job.jobId, '101');
  f.expected = { status: 'EXHAUSTED', alert: 'SUPPRESS', claimKinds: [], maxToolCalls: 0, maxHandoffs: 0 };
  assert.deepEqual(await store.create(f), saved);
  f.job.budget.maxToolCalls++;
  await assert.rejects(store.create(f), /LOCAL_JOB_ID_CONFLICT/);
  assert.equal((await store.inspect(f.job.jobId)).usage.toolCalls, 2);
});

test('cancellation survives restart and prevents stale concurrent work from publishing a finding', async t => {
  const { path } = workspace(t), f = fixture(), a = new LocalRatJobs(path, { create: true }), b = new LocalRatJobs(path);
  await a.create(f);
  const racingAdvance = a.advance(f.job.jobId, '125');
  const cancelled = await b.cancel(f.job.jobId);
  assert.equal(cancelled.phase, 'CANCELLED');
  await assert.rejects(racingAdvance, /LOCAL_REVISION_CONFLICT/);
  a.close(); b.close();
  const reopened = new LocalRatJobs(path); t.after(() => reopened.close());
  assert.deepEqual(await reopened.advance(f.job.jobId, '130'), cancelled);
  assert.equal((await reopened.inspect(f.job.jobId)).localCase, null);
});

test('expiry distinguishes no finding in a declared replay window from missing history coverage', async t => {
  const { path } = workspace(t), store = new LocalRatJobs(path, { create: true }); t.after(() => store.close());
  const empty = fixture(); empty.job.jobId = 'empty-window'; empty.events = [];
  await store.create(empty); const expired = await store.advance(empty.job.jobId, '130');
  assert.equal(expired.phase, 'EXPIRED'); assert.equal(expired.outcome, 'NO_FINDING_IN_REPLAY_WINDOW');
  const partial = fixture(); partial.job.jobId = 'missing-history'; partial.events = [partial.events[0]!];
  await store.create(partial); const incomplete = await store.advance(partial.job.jobId, '130');
  assert.equal(incomplete.phase, 'EXPIRED'); assert.equal(incomplete.outcome, 'INCOMPLETE_COVERAGE');
  assert.equal(incomplete.notification, null); assert.equal(incomplete.localCase, null);
});

test('origin tool and handoff budgets survive restart and exhaustion never prepares a Case or notification', async t => {
  const { path } = workspace(t);
  for (const mode of ['tools', 'handoffs']) {
    const f = fixture(); f.job.jobId = `exhaust-${mode}`;
    if (mode === 'tools') f.job.budget.maxToolCalls = 2; else f.job.budget.maxHandoffs = 0;
    let store = new LocalRatJobs(path, { create: true }); await store.create(f);
    await store.advance(f.job.jobId, '100'); store.close(); store = new LocalRatJobs(path);
    const exhausted = await store.advance(f.job.jobId, '125');
    assert.equal(exhausted.phase, 'EXHAUSTED'); assert.equal(exhausted.outcome, 'TOOL_BUDGET_EXHAUSTED');
    assert.ok(exhausted.receipt!.usage.toolCalls <= f.job.budget.maxToolCalls);
    assert.ok(exhausted.receipt!.usage.handoffs <= f.job.budget.maxHandoffs);
    assert.equal(exhausted.localCase, null); assert.equal(exhausted.notification, null);
    assert.deepEqual(await store.advance(f.job.jobId, '130'), exhausted); store.close();
  }
});

test('future bad seal halts only when visible, retains the verified prefix and cannot be retried', async t => {
  const { path } = workspace(t), f = fixture(); f.events[2]!.digest = '0'.repeat(64);
  const store = new LocalRatJobs(path, { create: true }); await store.create(f);
  const prefix = await store.advance(f.job.jobId, '101'); assert.equal(prefix.phase, 'WAITING');
  const halt = await store.advance(f.job.jobId, '125');
  assert.equal(halt.phase, 'HALTED'); assert.equal(halt.outcome, 'SOURCE_REJECTED'); assert.ok(halt.failure);
  assert.deepEqual(halt.receipt, prefix.receipt); assert.equal(halt.localCase, null);
  store.close(); const reopened = new LocalRatJobs(path); t.after(() => reopened.close());
  assert.deepEqual(await reopened.advance(f.job.jobId, '125'), halt);
  assert.ok(canonicalJson(reopened.exportEvidence(f.job.jobId)).includes('launch-1'));
});

test('malformed and backwards boundaries cannot mutate a checkpoint', async t => {
  const { path } = workspace(t), f = fixture(), store = new LocalRatJobs(path, { create: true }); t.after(() => store.close());
  await store.create(f); const saved = await store.advance(f.job.jobId, '101');
  for (const boundary of ['100', '89', '131', '0102', '-1', '1e2', '']) {
    await assert.rejects(store.advance(f.job.jobId, boundary), /LOCAL_BOUNDARY_INVALID/);
  }
  assert.equal((await store.inspect(f.job.jobId)).digest, saved.digest);
});

test('bounded local advances stop the job even when no logical tool is needed', async t => {
  const { path } = workspace(t), f = fixture(); f.events = [];
  const store = new LocalRatJobs(path, { create: true }); t.after(() => store.close()); await store.create(f);
  let snapshot: LocalSnapshot | undefined;
  for (let index = 0; index < MAX_LOCAL_ADVANCES; index++) snapshot = await store.advance(f.job.jobId, String(90 + index));
  assert.equal(snapshot!.phase, 'EXHAUSTED'); assert.equal(snapshot!.outcome, 'LOCAL_STEP_LIMIT');
  assert.equal(snapshot!.receipt!.usage.toolCalls, 0);
  assert.deepEqual(await store.advance(f.job.jobId, '130'), snapshot);
});

test('read-only commands do not create a DB; other SQLite databases are rejected without modification', t => {
  const { path } = workspace(t);
  assert.throws(() => new LocalRatJobs(path, { readOnly: true })); assert.equal(existsSync(path), false);
  assert.throws(() => new LocalRatJobs(':memory:', { create: true }), /LOCAL_DB_PATH_REQUIRED/);
  const foreign = new Database(path); foreign.exec('CREATE TABLE production_receipts (id TEXT)'); foreign.close();
  const before = readFileSync(path);
  assert.throws(() => new LocalRatJobs(path, { create: true }), /LOCAL_DB_OWNERSHIP_REQUIRED/);
  assert.deepEqual(readFileSync(path), before);
});

test('re-sealed false usage and missing journal records fail closed while raw evidence remains exportable', async t => {
  const { path } = workspace(t), f = fixture(), store = new LocalRatJobs(path, { create: true });
  await store.create(f); const saved = await store.advance(f.job.jobId, '101'); store.close();
  const forgedReceipt = await reseal({ ...saved.receipt!, usage: { ...saved.receipt!.usage, toolCalls: 0 } }, 'receiptId') as JobReceipt;
  const forged = await reseal({ ...saved, receipt: forgedReceipt });
  const db = new Database(path); db.prepare('UPDATE local_rat_journal SET snapshot_json = ? WHERE revision = 1').run(canonicalJson(forged)); db.close();
  const reopened = new LocalRatJobs(path); t.after(() => reopened.close());
  await assert.rejects(reopened.inspect(f.job.jobId), /LOCAL_CHECKPOINT_INVALID/);
  await assert.rejects(reopened.advance(f.job.jobId, '125'), /LOCAL_CHECKPOINT_INVALID/);
  assert.ok(reopened.exportEvidence(f.job.jobId));
  const edit = new Database(path); edit.prepare('DELETE FROM local_rat_journal WHERE revision = 1').run(); edit.close();
  await assert.rejects(reopened.inspect(f.job.jobId), /LOCAL_JOURNAL_INVALID/);
});

test('unknown re-sealed journal actions and extra action fields are rejected', async t => {
  const { path } = workspace(t), f = fixture(), store = new LocalRatJobs(path, { create: true });
  await store.create(f); const saved = await store.advance(f.job.jobId, '101'); store.close();
  for (const action of [{ kind: 'UNKNOWN', throughBlock: '101' }, { kind: 'ADVANCE', throughBlock: '101', delivery: true }]) {
    const forged = await reseal({ ...saved, action });
    const db = new Database(path); db.prepare('UPDATE local_rat_journal SET snapshot_json = ? WHERE revision = 1').run(canonicalJson(forged)); db.close();
    const reopened = new LocalRatJobs(path);
    await assert.rejects(reopened.inspect(f.job.jobId), /LOCAL_ACTION_INVALID/); reopened.close();
  }
});

test('separate CLI processes create, leave, reopen and return a finding without network or secret input', t => {
  const { path, dir } = workspace(t), f = fixture(), source = join(dir, 'fixture.json'); writeFileSync(source, JSON.stringify(f));
  const run = (command: string, ...extra: string[]) => {
    const child = spawnSync(process.execPath, ['scripts/local-rat-job.mjs', command, '--db', path, ...extra], { encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr); return JSON.parse(child.stdout) as LocalSnapshot;
  };
  assert.equal(run('create', '--fixture', source).phase, 'READY');
  assert.equal(run('advance', '--job-id', f.job.jobId, '--through-block', '101').phase, 'WAITING');
  assert.equal(run('inspect', '--job-id', f.job.jobId).phase, 'WAITING');
  assert.equal(run('advance', '--job-id', f.job.jobId, '--through-block', '125').phase, 'FOUND');
  const returned = run('inspect', '--job-id', f.job.jobId);
  assert.equal(returned.notification!.deliveryAuthorized, false); assert.equal(returned.receipt!.usage.modelCalls, 0);
});
