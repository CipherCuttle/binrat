import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {sha256Hex} from '../src/evidence/canonical.js';
import {loadQueryPack,queryPacket,validateQueryTask,selectLargestFunding,admitQuerySelection,
  scoreQuerySelection,nextQueryBenchmark,type QuerySelection} from '../src/workforce/nextQuery.js';

async function seal<T extends object>(value:T,field:string):Promise<T> {
  const copy={...value} as Record<string,unknown>;delete copy[field];
  return {...copy,[field]:await sha256Hex(copy)} as T;
}
const choose=(task:Awaited<ReturnType<typeof validateQueryTask>>,index=0):QuerySelection=>({
  schemaVersion:'binrat.next-query-output/1',taskId:task.taskId,taskDigest:task.taskDigest,decision:'SELECT',
  queryId:task.candidates[index]!.queryId,evidenceRefs:[task.candidates[index]!.fundingReceipt.id],
  reasonCodes:['RELATIVE_PRIORITY'],uncertainty:'HIGH',authorityRequested:'NONE'});

test('frozen query packs regenerate with quotas, independent identities and valid task receipts',async()=>{
  const development=await loadQueryPack('development'),evaluation=await loadQueryPack('evaluation');
  assert.equal(development.packDigest,'8ee4b2ec4e7c38c4f258332bdd95bdaea82e450d205a337e4a65ad775a4fabd9');
  assert.equal(evaluation.packDigest,'af25f8cd40b26dde06174366c9a1e8f01f0e772278486f9797964837c0372809');
  const ids=new Set(development.cases.flatMap(c=>c.task.candidates.map(q=>q.fundingReceipt.to)));
  assert.equal(development.cases.length,12);assert.equal(evaluation.cases.length,24);
  for(const c of evaluation.cases) for(const q of c.task.candidates) assert.ok(!ids.has(q.fundingReceipt.to));
  for(const stratum of ['ONE_ELIGIBLE','MULTIPLE_ELIGIBLE','NO_ELIGIBLE','COVERAGE_AND_BUDGET']) {
    assert.equal(development.cases.filter(c=>c.stratum===stratum).length,3);
    assert.equal(evaluation.cases.filter(c=>c.stratum===stratum).length,6);
  }
});

test('selector packet excludes future results, oracle labels and unsupported metadata',async()=>{
  const c=(await loadQueryPack('development')).cases[0]!;
  const packet=await queryPacket(c.task);
  assert.deepEqual(Object.keys(packet).sort(),['schemaVersion','provenance','taskId','decisionBlock','budget','candidates','taskDigest'].sort());
  const text=JSON.stringify(packet);
  for(const outcome of Object.values(c.outcomes)) {
    assert.ok(!text.includes(outcome.history.id));
    for(const later of outcome.later) assert.ok(!text.includes(later.id));
  }
  await assert.rejects(validateQueryTask({...c.task,expected:c.outcomes}),/QUERY_TASK_CONTRACT_INVALID/);
});

test('future funding, forged claims and malformed query windows fail even after resealing',async()=>{
  const original=(await loadQueryPack('development')).cases[0]!.task;
  for(const variant of ['future','claim','window','canonical','duplicate']) {
    const t=structuredClone(original),q=t.candidates[0]!;
    if(variant==='future') q.fundingReceipt.availableAtBlock=String(BigInt(t.decisionBlock)+1n);
    if(variant==='claim') q.fundingClaim.subject.entityId=t.candidates[1]!.fundingReceipt.to;
    if(variant==='window') q.toBlock=q.fundingReceipt.blockNumber;
    if(variant==='canonical') q.canonicalBlockHash='0x'+'0'.repeat(64);
    if(variant==='duplicate') t.candidates[1]=structuredClone(q);
    q.fundingReceipt=await seal(q.fundingReceipt,'digest');
    await assert.rejects(validateQueryTask(await seal(t,'taskDigest')),/QUERY_TASK_BINDING_INVALID/);
  }
});

test('baseline ranks only visible value and resolves ties independently of catalog order',async()=>{
  let t=structuredClone((await loadQueryPack('development')).cases[0]!.task);
  for(const q of t.candidates) {q.fundingReceipt.valueWei='100';q.fundingReceipt=await seal(q.fundingReceipt,'digest');}
  t=await seal(t,'taskDigest');
  const chosen=await selectLargestFunding(t);
  assert.equal(chosen.queryId,t.candidates.map(c=>c.queryId).sort()[0]);
  t.candidates.reverse();t=await seal(t,'taskDigest');
  assert.equal((await selectLargestFunding(t)).queryId,chosen.queryId);
});

test('selection admission binds task snapshot, receipt, query and authority before execution',async()=>{
  const c=(await loadQueryPack('development')).cases[0]!,valid=choose(c.task);
  assert.equal((await admitQuerySelection(c.task,JSON.stringify(valid))).rejection,null);
  const variants=[{taskId:'foreign-task'},{taskDigest:'0'.repeat(64)},{queryId:'foreign-query'},
    {evidenceRefs:[c.task.candidates[1]!.fundingReceipt.id]},{authorityRequested:'CAPITAL'},
    {claims:[c.task.candidates[0]!.fundingClaim]},{queryId:[valid.queryId,valid.queryId]}];
  for(const change of variants) {
    const result=await scoreQuerySelection(c,JSON.stringify({...valid,...change}));
    assert.ok(result.rejection);assert.equal(result.queried,0);assert.equal(result.toolCalls,0);
    assert.equal(result.handoffs,0);assert.equal(result.recovered,false);
  }
  for(const raw of ['{"taskId":"one","taskId":"two"}','x'.repeat(4097)]) {
    assert.equal((await scoreQuerySelection(c,raw)).queried,0);
  }
});

test('zero query budget admits abstention and rejects selection with no materialization',async()=>{
  const c=(await loadQueryPack('development')).cases.find(c=>c.task.budget.maxQueries===0)!;
  const baseline=await selectLargestFunding(c.task);
  assert.equal(baseline.decision,'ABSTAIN');
  assert.equal((await admitQuerySelection(c.task,JSON.stringify(baseline))).rejection,null);
  const result=await scoreQuerySelection(c,JSON.stringify(choose(c.task)));
  assert.equal(result.rejection,'QUERY_BUDGET_EXHAUSTED');assert.equal(result.queried,0);
});

test('after an approved query, only its continuation is replayed within five tools and one handoff',async()=>{
  const c=(await loadQueryPack('development')).cases.find(c=>c.stratum==='ONE_ELIGIBLE')!;
  const index=c.task.candidates.findIndex(q=>c.outcomes[q.queryId]!.expected.eligibleAlert);
  const selected=c.task.candidates[index]!;
  for(const q of c.task.candidates.filter(q=>q.queryId!==selected.queryId)) c.outcomes[q.queryId]!.history.digest='0'.repeat(64);
  const result=await scoreQuerySelection(c,JSON.stringify(choose(c.task,index)));
  assert.equal(result.recovered,true);assert.equal(result.safe,true);assert.equal(result.complete,true);
  assert.equal(result.queried,1);assert.equal(result.toolCalls,5);assert.equal(result.handoffs,1);
});

test('a safe missed finding is incomplete usefulness rather than an unsafe artifact',async()=>{
  const c=(await loadQueryPack('development')).cases.find(c=>c.stratum==='NO_ELIGIBLE')!;
  c.outcomes[c.task.candidates[0]!.queryId]!.expected.eligibleAlert=true;
  const result=await scoreQuerySelection(c,JSON.stringify(choose(c.task)));
  assert.equal(result.safe,true);assert.equal(result.complete,false);assert.equal(result.recovered,false);
  assert.equal(result.falseAlert,false);
});

test('resealed outcome tampering fails pack regeneration; generator cannot overwrite the frozen pack',async()=>{
  const p=await loadQueryPack('development'),c=p.cases[0]!;
  c.outcomes[c.task.candidates[0]!.queryId]!.expected.eligibleAlert=!c.outcomes[c.task.candidates[0]!.queryId]!.expected.eligibleAlert;
  Object.assign(c,await seal(c,'caseDigest'));
  const modified=await seal(p,'packDigest'),dir=mkdtempSync(join(tmpdir(),'binrat-query-tamper-'));
  try {
    const path=join(dir,'pack.json');writeFileSync(path,JSON.stringify(modified));
    await assert.rejects(loadQueryPack('development',path),/QUERY_PACK_REGENERATION_MISMATCH/);
  } finally {rmSync(dir,{recursive:true,force:true});}
  const child=spawnSync(process.execPath,['scripts/generate-next-query.mjs','development',
    'test/fixtures/workforce/next-query/development-v1.json'],{encoding:'utf8'});
  assert.notEqual(child.status,0);assert.match(child.stderr,/EEXIST/);
});

test('offline reports separate baseline headroom from model competence and retain all cases',async()=>{
  const previous=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('TEST_QUERY_NETWORK_DENIED');};
  try {
    for(const split of ['development','evaluation'] as const) {
      const r=await nextQueryBenchmark(split),n=split==='development'?12:24;
      assert.deepEqual(r,JSON.parse(readFileSync(`test/fixtures/workforce/next-query/${split}-results-v1.json`,'utf8')));
      assert.equal(r.pipelinePass,true);assert.equal(r.modelCalls,0);assert.equal(r.modelCostMicrousd,0);
      assert.equal(r.modelCompetence,'UNPROVEN');assert.equal(r.summaries.LARGEST_FUNDING!.cases,n);
      assert.equal(r.paidComparisonReady,false);assert.equal(r.datasetQualification,'FAILED_INDEX_PROXY');
      assert.equal(r.metadataShortcutAudit.summary.recovered,split==='development'?8:16);
      assert.equal(r.summaries.ORACLE_CEILING!.recovered,split==='development'?8:16);
      assert.equal(r.summaries.LARGEST_FUNDING!.recovered,split==='development'?4:11);
      assert.equal(r.summaries.ALWAYS_ABSTAIN!.queries,0);assert.equal(r.probes.count,n*5);
      assert.equal(r.probes.policyFailures,0);
      for(const arm of Object.values(r.summaries)) {assert.equal(arm.falseAlerts,0);assert.equal(arm.unsafeResults,0);assert.equal(arm.unexpectedErrors,0);}
    }
  } finally {globalThis.fetch=previous;}
});
