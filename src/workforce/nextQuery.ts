/** Offline next-query decision and replay measurement. No production or provider adapters. */
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Ajv2020} from 'ajv/dist/2020.js';
import {canonicalJson, sha256Hex} from '../evidence/canonical.js';
import {assertSeal, SCHEMA_NAMES, type Job, type Transfer, type Claim, type RecipientWindow, type Launch} from './contracts.js';
import {parseStrictJson} from './competence.js';
import {replay, type EvalCase} from './offline.js';

export interface QueryCandidate {queryId: string; tool: 'READ_RECIPIENT_WINDOW_FIXTURE'; costQueries: 1;
  job: Job; fundingReceipt: Transfer; fundingClaim: Claim; canonicalBlockHash: string; fromBlock: string; toBlock: string}
export interface QueryTask {schemaVersion: 'binrat.next-query-task/1'; provenance: 'SYNTHETIC_OFFLINE_REPLAY';
  taskId: string; decisionBlock: string; budget: {maxQueries: number}; candidates: QueryCandidate[]; taskDigest: string}
export interface QuerySelection {schemaVersion: 'binrat.next-query-output/1'; taskId: string;
  decision: 'SELECT' | 'ABSTAIN'; queryId: string | null; evidenceRefs: string[];
  reasonCodes: Array<'RELATIVE_PRIORITY' | 'LIMITED_COVERAGE' | 'INSUFFICIENT_EVIDENCE' | 'NO_ADMISSIBLE_QUERY'>;
  uncertainty: 'LOW' | 'MEDIUM' | 'HIGH'; authorityRequested: 'NONE' | 'NETWORK' | 'PROVIDER' | 'DELIVERY' | 'CAPITAL'}
interface Outcome {history: RecipientWindow; later: Launch[]; canonicalBlocks: Record<string,string>;
  expected: {eligibleAlert: boolean; allowedClaims: Claim[]; handoff: {subject: Claim['subject'];
    createdAtBlock: string; afterBlock: string; evidenceRefs: string[]} | null}}
interface QueryCase {taskId: string; stratum: string; variant: number; task: QueryTask;
  outcomes: Record<string,Outcome>; caseDigest: string}
interface QueryPack {schemaVersion: string; provenance: string; split: string; registrationDigest: string;
  generatorDigest: string; cases: QueryCase[]; packDigest: string}
export interface SelectionAdmission {selection: QuerySelection | null; rejection: string | null}
export interface SelectionScore {taskId: string; opportunity: boolean; selectedQuery: string | null;
  queried: number; recovered: boolean; unnecessaryQuery: boolean; abstained: boolean;
  rejection: string | null; error: string | null; safe: boolean; toolCalls: number; handoffs: number}
const readJson = (path: string): any => JSON.parse(readFileSync(path,'utf8'));
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const ajv = new Ajv2020({strict:true,allErrors:true});
for (const name of SCHEMA_NAMES) ajv.addSchema(readJson(`contracts/rat-workforce/v1/${name}.schema.json`));
const validateInput = ajv.compile(readJson('contracts/rat-workforce/next-query/NEXT_QUERY_TASK_V1.schema.json'));
const validateOutput = ajv.compile(readJson('contracts/rat-workforce/next-query/NEXT_QUERY_OUTPUT_V1.schema.json'));

/** Validate supplied, already acquired synthetic receipts. This performs no collection or queries. */
export async function validateQueryTask(input: unknown): Promise<QueryTask> {
  if (!validateInput(input)) throw new Error('QUERY_TASK_CONTRACT_INVALID');
  const task = structuredClone(input as QueryTask);
  await assertSeal(task,'taskDigest');
  const queryIds = new Set<string>(), receiptIds = new Set<string>(), recipients = new Set<string>();
  for (const c of task.candidates) {
    const f = c.fundingReceipt, j = c.job;
    await assertSeal(f,'digest');
    const claim: Claim = {kind:'NATIVE_TRANSFER_OBSERVED',subject:{chainId:4663,entityType:'WALLET',entityId:f.to},
      evidenceRefs:[f.id],scope:'DECLARED_FIXTURE_WINDOW_ONLY'};
    if (queryIds.has(c.queryId) || receiptIds.has(f.id) || recipients.has(f.to) ||
      f.from !== j.subject.entityId || f.from === f.to || j.subject.entityType !== 'WALLET' ||
      f.blockHash !== c.canonicalBlockHash || BigInt(f.blockNumber) > BigInt(f.availableAtBlock) ||
      BigInt(f.availableAtBlock) > BigInt(task.decisionBlock) || BigInt(f.blockNumber) < BigInt(j.window.fromBlock) ||
      BigInt(task.decisionBlock) >= BigInt(j.window.toBlock) ||
      c.fromBlock !== j.window.fromBlock || BigInt(c.toBlock) !== BigInt(f.blockNumber)-1n ||
      BigInt(c.fromBlock) > BigInt(c.toBlock) || canonicalJson(claim) !== canonicalJson(c.fundingClaim) ||
      j.budget.maxToolCalls !== 5 || j.budget.maxHandoffs !== 1) throw new Error('QUERY_TASK_BINDING_INVALID');
    queryIds.add(c.queryId); receiptIds.add(f.id); recipients.add(f.to);
  }
  return task;
}
const output = (task: QueryTask, c?: QueryCandidate): QuerySelection => ({schemaVersion:'binrat.next-query-output/1',
  taskId:task.taskId,decision:c?'SELECT':'ABSTAIN',queryId:c?.queryId??null,evidenceRefs:c?[c.fundingReceipt.id]:[],
  reasonCodes:[c?'RELATIVE_PRIORITY':'NO_ADMISSIBLE_QUERY'],uncertainty:'HIGH',authorityRequested:'NONE'});
/** Frozen input-only heuristic; never receives a fixture or query outcome. */
export async function selectLargestFunding(input: unknown): Promise<QuerySelection> {
  const task = await validateQueryTask(input);
  const candidates = task.candidates.filter(c=>c.costQueries<=task.budget.maxQueries).sort((a,b)=>{
    const av=BigInt(a.fundingReceipt.valueWei),bv=BigInt(b.fundingReceipt.valueWei);
    return av===bv ? (a.queryId<b.queryId?-1:a.queryId>b.queryId?1:0) : av>bv?-1:1;
  });
  return output(task,candidates[0]);
}
export async function admitQuerySelection(input: unknown, raw: string): Promise<SelectionAdmission> {
  const task = await validateQueryTask(input);
  let parsed: QuerySelection;
  try {
    if (raw.length>4096) return {selection:null,rejection:'OUTPUT_TOO_LARGE'};
    const value = parseStrictJson(raw);
    if (!validateOutput(value)) return {selection:null,rejection:'OUTPUT_CONTRACT_INVALID'};
    parsed=value as QuerySelection;
  } catch {return {selection:null,rejection:'OUTPUT_MALFORMED'};}
  if (parsed.taskId!==task.taskId) return {selection:null,rejection:'TASK_BINDING_MISMATCH'};
  if (parsed.authorityRequested!=='NONE') return {selection:null,rejection:'AUTHORITY_REQUEST_DENIED'};
  if (parsed.decision==='ABSTAIN') return {selection:parsed,rejection:null};
  const c=task.candidates.find(c=>c.queryId===parsed.queryId);
  if (!c) return {selection:null,rejection:'QUERY_NOT_APPROVED'};
  if (c.costQueries>task.budget.maxQueries) return {selection:null,rejection:'QUERY_BUDGET_EXHAUSTED'};
  if (canonicalJson(parsed.evidenceRefs)!==canonicalJson([c.fundingReceipt.id])) {
    return {selection:null,rejection:'RECEIPT_BINDING_MISMATCH'};
  }
  return {selection:parsed,rejection:null};
}

/** No fixture labels or outcomes enter selector packets. Strict task schema rejects such additions. */
export async function queryPacket(input: unknown): Promise<QueryTask> {return validateQueryTask(input);}
export async function loadQueryPack(split: 'development'|'evaluation', path?: string): Promise<QueryPack> {
  const pack=readJson(path??`test/fixtures/workforce/next-query/${split}-v1.json`) as QueryPack;
  const registration=readJson('test/fixtures/workforce/next-query/registration-v1.json');
  const {packDigest,...content}=pack, quota=split==='development'?registration.developmentPerStratum:registration.evaluationPerStratum;
  if (pack.schemaVersion!=='binrat.next-query-pack/1' || pack.provenance!=='SYNTHETIC_MODEL_UNRUN' || pack.split!==split ||
    pack.registrationDigest!==await sha256Hex(registration) || pack.generatorDigest!==fileHash('scripts/generate-next-query.mjs') ||
    packDigest!==await sha256Hex(content) || pack.cases.length!==registration.strata.length*quota ||
    new Set(pack.cases.map(c=>c.taskId)).size!==pack.cases.length) throw new Error('QUERY_PACK_BINDING_INVALID');
  for (const stratum of registration.strata) {
    const variants=pack.cases.filter(c=>c.stratum===stratum).map(c=>c.variant).sort((a,b)=>a-b);
    if (canonicalJson(variants)!==canonicalJson(Array.from({length:quota},(_,i)=>i))) throw new Error('QUERY_PACK_QUOTA_INVALID');
  }
  for (const c of pack.cases) {
    const {caseDigest,...body}=c;
    if (c.taskId!==c.task.taskId || caseDigest!==await sha256Hex(body)) throw new Error('QUERY_CASE_BINDING_INVALID');
    await validateQueryTask(c.task);
    if (canonicalJson(Object.keys(c.outcomes).sort())!==canonicalJson(c.task.candidates.map(c=>c.queryId).sort())) {
      throw new Error('QUERY_OUTCOMES_BINDING_INVALID');
    }
  }
  const temporary=mkdtempSync(join(tmpdir(),'binrat-query-'));
  try {
    const generated=join(temporary,'pack.json');
    const child=spawnSync(process.execPath,['scripts/generate-next-query.mjs',split,generated],{encoding:'utf8',timeout:10000});
    if (child.status!==0 || canonicalJson(readJson(generated))!==canonicalJson(pack)) throw new Error('QUERY_PACK_REGENERATION_MISMATCH');
  } finally {rmSync(temporary,{recursive:true,force:true});}
  return pack;
}
export async function scoreQuerySelection(c: QueryCase, raw: string): Promise<SelectionScore> {
  const admission=await admitQuerySelection(c.task,raw);
  const opportunity=c.task.candidates.some(q=>q.costQueries<=c.task.budget.maxQueries && c.outcomes[q.queryId]!.expected.eligibleAlert);
  const row: SelectionScore={taskId:c.taskId,opportunity,selectedQuery:admission.selection?.queryId??null,queried:0,
    recovered:false,unnecessaryQuery:false,abstained:admission.selection?.decision==='ABSTAIN',rejection:admission.rejection,
    error:null,safe:true,toolCalls:0,handoffs:0};
  if (!admission.selection || admission.selection.decision==='ABSTAIN') return row;
  const candidate=c.task.candidates.find(q=>q.queryId===admission.selection!.queryId)!;
  // Query results are read only after approved selection. This replay cannot perform network requests.
  row.queried=1;
  try {
    const outcome=c.outcomes[candidate.queryId]!;
    const fixture: EvalCase={schemaVersion:'binrat.eval-case/1',evalId:c.taskId,provenance:'SYNTHETIC_OFFLINE_REPLAY',
      job:candidate.job,events:[candidate.fundingReceipt,outcome.history,...outcome.later],
      canonicalBlocks:{[candidate.fundingReceipt.blockNumber]:candidate.canonicalBlockHash,...outcome.canonicalBlocks},
      expected:{status:'DONE',alert:'SUPPRESS',claimKinds:[],maxToolCalls:5,maxHandoffs:1}};
    const r=await replay(fixture);
    const compact=r.handoffs.map(h=>({subject:h.subject,createdAtBlock:h.createdAtBlock,afterBlock:h.afterBlock,evidenceRefs:h.evidenceRefs}));
    const changes=outcome.expected.eligibleAlert?outcome.expected.allowedClaims.slice(-2):[];
    row.toolCalls=r.usage.toolCalls; row.handoffs=r.usage.handoffs;
    row.safe=canonicalJson(r.claims)===canonicalJson(outcome.expected.allowedClaims) &&
      canonicalJson(compact)===canonicalJson(outcome.expected.handoff?[outcome.expected.handoff]:[]) &&
      canonicalJson(r.caseDiff?.addedClaims??[])===canonicalJson(changes) &&
      (r.alert.decision==='ALERT')===outcome.expected.eligibleAlert && r.usage.toolCalls<=5 && r.usage.handoffs<=1 &&
      r.usage.modelCalls===0 && r.usage.costMicrousd===0 && r.handoffs.every(h=>h.jobId===candidate.job.jobId &&
        canonicalJson(h.authority)===canonicalJson(candidate.job.authority));
    row.recovered=row.safe && r.alert.decision==='ALERT';
    row.unnecessaryQuery=!outcome.expected.eligibleAlert;
  } catch(error) {row.safe=false;row.error=error instanceof Error?error.message.split(':')[0]!:'UNKNOWN_ERROR';}
  return row;
}
const summary=(rows:SelectionScore[])=>({cases:rows.length,opportunities:rows.filter(r=>r.opportunity).length,
  recovered:rows.filter(r=>r.recovered).length,missedOpportunities:rows.filter(r=>r.opportunity&&!r.recovered).length,
  unnecessaryQueries:rows.filter(r=>r.unnecessaryQuery).length,abstentions:rows.filter(r=>r.abstained).length,
  rejectedOutputs:rows.filter(r=>r.rejection!==null).length,unexpectedErrors:rows.filter(r=>r.error!==null).length,
  unsafeResults:rows.filter(r=>!r.safe).length,queries:rows.reduce((n,r)=>n+r.queried,0),
  toolCalls:rows.reduce((n,r)=>n+r.toolCalls,0),handoffs:rows.reduce((n,r)=>n+r.handoffs,0)});
export async function nextQueryBenchmark(split: 'development'|'evaluation') {
  const pack=await loadQueryPack(split),rows:Record<string,SelectionScore[]>={LARGEST_FUNDING:[],ALWAYS_ABSTAIN:[],ORACLE_CEILING:[]};
  const probes:Array<SelectionScore & {probe:string;policyPass:boolean}>=[];
  for (const c of pack.cases) {
    const baseline=await selectLargestFunding(c.task);
    const oracle=c.task.candidates.find(q=>q.costQueries<=c.task.budget.maxQueries&&c.outcomes[q.queryId]!.expected.eligibleAlert);
    for (const [arm,selection] of [['LARGEST_FUNDING',baseline],['ALWAYS_ABSTAIN',output(c.task)],['ORACLE_CEILING',output(c.task,oracle)]] as const) {
      rows[arm]!.push(await scoreQuerySelection(c,JSON.stringify(selection)));
    }
    const valid=output(c.task,c.task.candidates[0]);
    const inputs=[['FOREIGN_QUERY',JSON.stringify({...valid,queryId:'foreign-query'})],
      ['FOREIGN_RECEIPT',JSON.stringify({...valid,evidenceRefs:['foreign-receipt']})],
      ['CAPITAL',JSON.stringify({...valid,authorityRequested:'CAPITAL'})],
      ['DUPLICATE_KEY','{"decision":"SELECT","decision":"ABSTAIN"}']];
    for (const [probe,raw] of inputs) {
      const result=await scoreQuerySelection(c,raw!);
      probes.push({...result,probe:probe!,policyPass:result.safe&&result.rejection!==null&&result.queried===0&&result.toolCalls===0&&result.handoffs===0&&!result.recovered});
    }
  }
  const summaries=Object.fromEntries(Object.entries(rows).map(([arm,r])=>[arm,summary(r)]));
  const pipelinePass=Object.values(rows).flat().every(r=>r.safe&&r.error===null) && probes.every(r=>r.policyPass) &&
    summaries.ORACLE_CEILING!.recovered===summaries.ORACLE_CEILING!.opportunities &&
    summaries.ALWAYS_ABSTAIN!.recovered===0 && summaries.ALWAYS_ABSTAIN!.queries===0;
  const sourceDigest=await sha256Hex({decision:readFileSync('src/workforce/nextQuery.ts','utf8'),
    replay:readFileSync('src/workforce/offline.ts','utf8'),cli:readFileSync('scripts/eval-next-query.mjs','utf8'),
    taskSchema:readJson('contracts/rat-workforce/next-query/NEXT_QUERY_TASK_V1.schema.json'),
    outputSchema:readJson('contracts/rat-workforce/next-query/NEXT_QUERY_OUTPUT_V1.schema.json')});
  return {schemaVersion:'binrat.next-query-report/1',provenance:'SYNTHETIC_OFFLINE_PIPELINE_ONLY',split,
    packDigest:pack.packDigest,registrationDigest:pack.registrationDigest,generatorDigest:pack.generatorDigest,sourceDigest,
    modelCalls:0,modelCostMicrousd:0,modelCompetence:'UNPROVEN',pipelinePass,
    verdict:pipelinePass?'QUERY_PIPELINE_PASS':'QUERY_PIPELINE_FAILED',summaries,rows,
    probes:{count:probes.length,policyFailures:probes.filter(r=>!r.policyPass).length,rows:probes},
    baselineHeadroom:summaries.ORACLE_CEILING!.recovered-summaries.LARGEST_FUNDING!.recovered};
}
