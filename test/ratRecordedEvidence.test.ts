import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { sha256Hex, canonicalJson } from '../src/evidence/canonical.js';
import { assertRecordedSource, replayRecorded, type RecordedSource } from '../src/workforce/recorded.js';
import { LocalRatJobs } from '../src/workforce/localJob.js';
const fixturePath = 'test/fixtures/workforce/recorded/pons-funding-a-bundle-v1.json';
const fixture = (): RecordedSource => JSON.parse(readFileSync(fixturePath,'utf8'));
async function seal(f: RecordedSource) { const content = {...f}; delete (content as Partial<RecordedSource>).digest; f.digest = await sha256Hex(content); return f; }
function workspace(t: { after: (f: () => void) => void }) {
  const dir = mkdtempSync(join(tmpdir(),'binrat-recorded-')); t.after(() => rmSync(dir,{recursive:true,force:true})); return join(dir,'job.sqlite');
}

test('real recording bytes bind to bundle; retrospective replay never fabricates historical availability or freshness', async () => {
  const f = fixture(); assert.deepEqual(f.recording,JSON.parse(readFileSync('test/fixtures/workforce/recorded/pons-funding-a-rpc-v1.json','utf8')));
  await assertRecordedSource(f);
  for (const block of [f.job.window.fromBlock, BigInt(f.recording.responses[3]!.response.result && (f.recording.responses[3]!.response.result as any).blockNumber).toString(),(BigInt(f.job.window.toBlock)-1n).toString()]) {
    const prefix = await replayRecorded(f,block); assert.deepEqual(prefix.claims,[]); assert.deepEqual(prefix.evidence,[]);
    assert.deepEqual(prefix.handoffs,[]); assert.equal(prefix.caseDiff,null); assert.equal(prefix.alert.decision,'SUPPRESS'); assert.equal(prefix.usage.toolCalls,0);
  }
  const r = await replayRecorded(f,f.job.window.toBlock);
  assert.equal(r.alert.reason,'RETROSPECTIVE_RELATION'); assert.equal(r.alert.decision,'ALERT'); assert.equal(r.usage.toolCalls,4);
  assert.deepEqual(r.claims.map(c => c.kind),['NATIVE_TRANSFER_OBSERVED','PONS_REPORTED_DEPLOYER_LAUNCH','FUNDING_PRECEDES_LAUNCH']);
  assert.ok(r.claims.every(c => c.scope === 'RECORDED_RPC_RESPONSES_ONLY' && c.evidenceRefs.every(id => r.evidence.some(e => e.id === id))));
  assert.ok(r.evidence.every(e => e.availableAtBlock === f.job.window.toBlock)); assert.deepEqual(r.handoffs,[]);
  assert.equal(r.observation.predictionEstablished,false); assert.equal(r.observation.recipientFreshnessEstablished,false);
  assert.equal(r.observation.authentication,'PROVIDER_REPORTED_NOT_CONSENSUS_PROVEN');
  assert.equal(r.caseDiff!.fundingReceipt.sourceAddress,f.job.subject.entityId);
});

test('recorded import, leave, restart and return preserve one Case and one prepared notification', async t => {
  const path = workspace(t), f = fixture(); let store = new LocalRatJobs(path,{create:true});
  await store.createRecorded(f); const prefix = await store.advance(f.job.jobId,(BigInt(f.job.window.toBlock)-1n).toString());
  assert.equal(prefix.mode,'LOCAL_RECORDED_REPLAY'); assert.equal(prefix.phase,'WAITING'); store.close();
  store = new LocalRatJobs(path); const found = await store.advance(f.job.jobId,f.job.window.toBlock);
  assert.equal(found.phase,'FOUND'); assert.equal(found.localCase!.provenance,'RECORDED_RPC_RETROSPECTIVE');
  assert.equal(found.notification!.deliveryAuthorized,false); assert.match(found.notification!.text,/No earlier prediction or recipient freshness/);
  assert.deepEqual(await store.createRecorded(f),found); assert.deepEqual(await store.advance(f.job.jobId,f.job.window.toBlock),found);
  store.close(); store = new LocalRatJobs(path,{readOnly:true});
  assert.equal((await store.inspect(f.job.jobId)).notification!.id,found.notification!.id);
  const raw = store.exportEvidence(f.job.jobId) as {job:{source_json:string};journal:unknown[]};
  assert.equal(raw.journal.length,3); assert.equal(JSON.parse(raw.job.source_json).digest,f.digest); store.close();
});

test('all origin budgets exhaust deterministically before Case and notification admission', async t => {
  const path = workspace(t), store = new LocalRatJobs(path,{create:true}); t.after(() => store.close());
  for (const max of [0,1,2,3]) {
    const f = fixture(); f.job.jobId = `recorded-budget-${max}`; f.job.budget.maxToolCalls = max; await seal(f);
    await store.createRecorded(f); const result = await store.advance(f.job.jobId,f.job.window.toBlock);
    assert.equal(result.phase,'EXHAUSTED'); assert.equal(result.receipt!.usage.toolCalls,max);
    assert.equal(result.localCase,null); assert.equal(result.notification,null); assert.equal(result.receipt!.caseDiff,null);
    assert.deepEqual(await store.advance(f.job.jobId,f.job.window.toBlock),result);
  }
});

test('missing evidence, conflicting chain payloads and forbidden authority reject even after resealing', async () => {
  const mutations: ((f: RecordedSource) => void)[] = [
    f => { f.recording.responses.pop(); },
    f => { f.job.authority.network = true as false; },
    f => { f.job.budget.maxHandoffs = 1; },
    f => { f.provenance = 'SYNTHETIC_OFFLINE_REPLAY' as any; },
    f => { f.recording.responses[0]!.response.result = '0x1'; },
    f => { (f.recording.responses[2]!.response.result as any).chainId = '0x1'; },
    f => { (f.recording.responses[7]!.response.result as any).to = '0x'+'0'.repeat(40); },
    f => { f.recording.responses[1]!.response.result = '0x00'; },
    f => { (f.recording.responses[2]!.response.result as any).from = '0x'+'0'.repeat(40); },
    f => { (f.recording.responses[4]!.response.result as any).hash = '0x'+'0'.repeat(64); },
    f => { (f.recording.responses[4]!.response.result as any).transactions = []; },
    f => { (f.recording.responses[7]!.response.result as any).status = '0x0'; },
    f => { (f.recording.responses[3]!.response.result as any).status = '0x0'; },
    f => { f.recording.responses[8]!.receivedAt = '2026-10-02T00:00:00Z'; },
    f => { f.job.window.toBlock = f.job.window.fromBlock; },
    f => { f.recording.responses[3]!.request.params = ['0x'+'0'.repeat(64)]; },
    f => { (f.recording.responses[3]!.response.result as any).logs[0].removed = true; },
    f => { f.recording.responses[2]!.response.error = {code:1}; },
    f => { f.recording.responses[3]!.receivedAt = '2026-99-99T00:00:00Z'; }
  ];
  for (const mutate of mutations) { const f = fixture(); mutate(f); await seal(f); await assert.rejects(assertRecordedSource(f)); }
  const badDigest = fixture(); badDigest.digest = '0'.repeat(64); await assert.rejects(assertRecordedSource(badDigest),/DIGEST_MISMATCH/);
});

test('an unbound launch halts with original responses retained and cannot retry or prepare an alert', async t => {
  const path = workspace(t), f = fixture(); (f.recording.responses[3]!.response.result as any).logs = []; await seal(f);
  const store = new LocalRatJobs(path,{create:true}); t.after(() => store.close()); await store.createRecorded(f);
  const halt = await store.advance(f.job.jobId,f.job.window.toBlock); assert.equal(halt.phase,'HALTED');
  assert.equal(halt.failure,'RECORDED_LAUNCH_BINDING_INVALID'); assert.equal(halt.notification,null); assert.equal(halt.localCase,null);
  assert.deepEqual(await store.advance(f.job.jobId,f.job.window.toBlock),halt);
  assert.ok(canonicalJson(store.exportEvidence(f.job.jobId)).includes(f.digest));
});

test('source digest conflicts and resealed false checkpoint usage fail closed; export remains available', async t => {
  const path = workspace(t), f = fixture(), store = new LocalRatJobs(path,{create:true});
  await store.createRecorded(f); const found = await store.advance(f.job.jobId,f.job.window.toBlock);
  const changed = fixture(); changed.job.budget.maxToolCalls++; await seal(changed); await assert.rejects(store.createRecorded(changed),/LOCAL_JOB_ID_CONFLICT/);
  store.close(); const forged = structuredClone(found); forged.receipt!.usage.toolCalls = 0;
  const receipt = {...forged.receipt!}; delete (receipt as any).receiptId; forged.receipt!.receiptId = await sha256Hex(receipt);
  const snapshot = {...forged}; delete (snapshot as any).digest; forged.digest = await sha256Hex(snapshot);
  const db = new Database(path); db.prepare('UPDATE local_rat_journal SET snapshot_json=? WHERE revision=1').run(canonicalJson(forged)); db.close();
  const reopened = new LocalRatJobs(path,{readOnly:true}); t.after(() => reopened.close());
  await assert.rejects(reopened.inspect(f.job.jobId),/LOCAL_CHECKPOINT_INVALID/); assert.ok(reopened.exportEvidence(f.job.jobId));
});

test('recorded CLI imports without any key, model or network adapter', t => {
  const path = workspace(t), f = fixture();
  const run = (command: string,...args: string[]) => {
    const child = spawnSync(process.execPath,['scripts/local-rat-job.mjs',command,'--db',path,...args],{encoding:'utf8'});
    assert.equal(child.status,0,child.stderr); return JSON.parse(child.stdout);
  };
  assert.equal(run('import-recorded','--bundle',fixturePath).mode,'LOCAL_RECORDED_REPLAY');
  assert.equal(run('advance','--job-id',f.job.jobId,'--through-block',f.job.window.toBlock).phase,'FOUND');
  assert.equal(run('inspect','--job-id',f.job.jobId).receipt.observation.predictionEstablished,false);
  assert.equal(run('export','--job-id',f.job.jobId).mode,'UNVERIFIED_LOCAL_JOURNAL_EXPORT');
});


test('synthetic imports retain their declared replay window instead of inheriting demo block numbers', async t => {
  const path = workspace(t), store = new LocalRatJobs(path,{create:true}); t.after(() => store.close());
  const source = JSON.parse(readFileSync('test/fixtures/workforce/sniffer-funding-to-pons-v1.json','utf8'));
  source.job.jobId = 'non-demo-window'; source.events = []; source.job.window = {fromBlock:'500',toBlock:'540'};
  await store.create(source); assert.deepEqual((await store.inspect(source.job.jobId)).replaySteps,['540']);
});
