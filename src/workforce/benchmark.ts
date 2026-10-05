/** Offline measurement only. Never imported by production or capture execution. */
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {canonicalJson, sha256Hex} from '../evidence/canonical.js';
import {replay, type EvalCase} from './offline.js';
import {validateProposal, type ProposalAdmission} from './proposal.js';
import type {Claim} from './contracts.js';
import type {InvestigatorOutput} from './competence.js';

interface Golden { eligibleAlert: boolean; allowedClaims: Claim[];
  expectedHandoff: InvestigatorOutput['handoff']; expectedError: string | null }
interface HoldoutCase {caseId: string; stratum: string; variant: string; fixture: EvalCase; throughBlock: string;
  untrustedText: Array<{sourceId: string; text: string}>; expected: Golden; caseDigest: string}
interface Manifest {schemaVersion: string; provenance: string; seed: string; registrationDigest: string;
  generatorDigest: string; cases: HoldoutCase[]; manifestDigest: string}
interface Outcome {caseId: string; eligible: boolean; alert: boolean; safety: boolean; complete: boolean;
  error: string | null; rejections: string[]}
const json = (path: string): any => JSON.parse(readFileSync(path, 'utf8'));
const compactHandoff = (h: NonNullable<ProposalAdmission['acceptedHandoff']>) => ({subject: h.subject,
  createdAtBlock: h.createdAtBlock, afterBlock: h.afterBlock, evidenceRefs: h.evidenceRefs});
const expectedError = (error: unknown): string => error instanceof Error ? error.message.split(':')[0]! : 'UNKNOWN_ERROR';
function artifactsSafe(golden: Golden, claims: Claim[], changes: Claim[], handoffs: InvestigatorOutput['handoff'][], alert: boolean) {
  const allowed = new Set(golden.allowedClaims.map(canonicalJson));
  const additions = new Set(golden.allowedClaims.filter(c => ['PONS_REPORTED_DEPLOYER_LAUNCH', 'FUNDING_PRECEDES_LAUNCH'].includes(c.kind)).map(canonicalJson));
  return claims.every(c => allowed.has(canonicalJson(c))) && changes.every(c => additions.has(canonicalJson(c))) &&
    handoffs.every(h => canonicalJson(h) === canonicalJson(golden.expectedHandoff)) && (!alert || golden.eligibleAlert);
}
function aggregate(rows: Outcome[]) {
  const eligible = rows.filter(r => r.eligible).length;
  const recovered = rows.filter(r => r.eligible && r.alert && r.safety).length;
  return {cases: rows.length, eligible, recovered, missedEligible: eligible - recovered,
    falseAlerts: rows.filter(r => !r.eligible && r.alert).length, unsafeArtifacts: rows.filter(r => !r.safety).length,
    complete: rows.filter(r => r.complete).length, exceptions: rows.filter(r => r.error !== null).length,
    safetyPass: rows.every(r => r.safety), usefulnessPass: recovered === eligible,
    pipelinePass: rows.every(r => r.safety && r.complete)};
}
const suppress = (c: HoldoutCase): Outcome => ({caseId: c.caseId, eligible: c.expected.eligibleAlert,
  alert: false, safety: true, complete: !c.expected.eligibleAlert, error: null, rejections: []});
async function evaluate(c: HoldoutCase, raw?: string): Promise<Outcome> {
  try {
    if (raw !== undefined) {
      const a = await validateProposal(c.fixture, raw, {throughBlock: c.throughBlock});
      const safe = artifactsSafe(c.expected, a.acceptedClaims, a.acceptedCaseChanges,
        a.acceptedHandoff ? [compactHandoff(a.acceptedHandoff)] : [], a.acceptedAlert === 'ALERT');
      const full = c.expected.allowedClaims.every(g => a.acceptedClaims.some(p => canonicalJson(g) === canonicalJson(p))) &&
        canonicalJson(a.acceptedHandoff ? compactHandoff(a.acceptedHandoff) : null) === canonicalJson(c.expected.expectedHandoff);
      return {caseId: c.caseId, eligible: c.expected.eligibleAlert, alert: a.acceptedAlert === 'ALERT', safety: safe,
        complete: safe && !c.expected.expectedError && full && a.acceptedAlert === (c.expected.eligibleAlert ? 'ALERT' : 'SUPPRESS'),
        error: null, rejections: a.rejections.map(r => `${r.artifact}:${r.reason}`)};
    }
    const r = await replay(c.fixture, {throughBlock: c.throughBlock});
    const safe = artifactsSafe(c.expected, r.claims, r.alert.decision === 'ALERT' ? r.caseDiff?.addedClaims ?? [] : [],
      r.handoffs.map(compactHandoff), r.alert.decision === 'ALERT') && r.usage.toolCalls <= c.fixture.job.budget.maxToolCalls &&
      r.usage.handoffs <= c.fixture.job.budget.maxHandoffs && r.usage.modelCalls === 0 && r.usage.costMicrousd === 0;
    const full = canonicalJson(r.claims) === canonicalJson(c.expected.allowedClaims) &&
      canonicalJson(r.handoffs.map(compactHandoff)) === canonicalJson(c.expected.expectedHandoff ? [c.expected.expectedHandoff] : []);
    return {caseId: c.caseId, eligible: c.expected.eligibleAlert, alert: r.alert.decision === 'ALERT', safety: safe,
      complete: safe && !c.expected.expectedError && full && (r.alert.decision === 'ALERT') === c.expected.eligibleAlert,
      error: null, rejections: []};
  } catch (error) {
    const code = expectedError(error), intended = code === c.expected.expectedError;
    return {caseId: c.caseId, eligible: c.expected.eligibleAlert, alert: false, safety: intended,
      complete: intended, error: code, rejections: []};
  }
}

/** Visible input only. Oracle-bearing EvalCase.expected and future canonical entries are excluded. */
export function holdoutPacket(c: HoldoutCase) {
  const visible = c.fixture.events.filter(e => BigInt(e.availableAtBlock) <= BigInt(c.throughBlock));
  return {schemaVersion: 'binrat.benchmark-input/1', provenance: 'SYNTHETIC_OFFLINE_REPLAY', caseId: c.caseId,
    job: c.fixture.job, throughBlock: c.throughBlock, receipts: visible,
    canonicalBlocks: Object.fromEntries(visible.map(e => [e.blockNumber, c.fixture.canonicalBlocks[e.blockNumber]])),
    untrustedText: c.untrustedText};
}
export async function loadHoldout(path = 'test/fixtures/workforce/benchmark/holdout-v1.json'): Promise<Manifest> {
  const m = json(path) as Manifest, {manifestDigest, ...content} = m;
  const registration = json('test/fixtures/workforce/benchmark/registration-v1.json');
  if (m.schemaVersion !== 'binrat.offline-holdout/1' || m.provenance !== 'SYNTHETIC_MODEL_UNRUN_HOLDOUT' ||
    m.seed !== registration.seed || m.cases.length !== 40 || new Set(m.cases.map(c => c.caseId)).size !== 40 ||
    manifestDigest !== await sha256Hex(content) || m.registrationDigest !== await sha256Hex(registration) ||
    m.generatorDigest !== createHash('sha256').update(readFileSync('scripts/generate-workforce-holdout.mjs')).digest('hex')) {
    throw new Error('HOLDOUT_BINDING_INVALID');
  }
  for (const [stratum, variants] of Object.entries(registration.strata) as Array<[string, string[]]>) {
    const actual = m.cases.filter(c => c.stratum === stratum).map(c => c.variant).sort();
    if (canonicalJson(actual) !== canonicalJson([...variants].sort())) throw new Error('HOLDOUT_QUOTA_INVALID');
  }
  for (const c of m.cases) {
    if (c.caseId !== c.fixture.evalId || c.caseDigest !== await sha256Hex({fixture: c.fixture,
      throughBlock: c.throughBlock, untrustedText: c.untrustedText, expected: c.expected})) throw new Error('HOLDOUT_CASE_BINDING_INVALID');
  }
  // Re-sealing a fabricated oracle is not enough: reproduce every byte from the frozen generator and seed.
  const temporary = mkdtempSync(join(tmpdir(), 'binrat-holdout-'));
  try {
    const generated = join(temporary, 'manifest.json');
    const child = spawnSync(process.execPath, ['scripts/generate-workforce-holdout.mjs', generated], {encoding: 'utf8', timeout: 10000});
    if (child.status !== 0 || canonicalJson(json(generated)) !== canonicalJson(m)) throw new Error('HOLDOUT_REGENERATION_MISMATCH');
  } finally {rmSync(temporary, {recursive: true, force: true});}
  return m;
}
export async function holdoutBenchmark() {
  const m = await loadHoldout();
  const rows: Record<string, Outcome[]> = {DETERMINISTIC: [], ALWAYS_SUPPRESS: [], SYNTHETIC_ALLOWED_PROPOSAL: []};
  const probes: Outcome[] = [];
  for (const c of m.cases) {
    rows.DETERMINISTIC!.push(await evaluate(c)); rows.ALWAYS_SUPPRESS!.push(suppress(c));
    const proposal: InvestigatorOutput = {schemaVersion: 'binrat.investigator-output/1', caseId: c.caseId,
      assessment: c.expected.eligibleAlert ? 'SUPPORTED_CHANGE' : 'NO_MATCH', claims: c.expected.allowedClaims,
      handoff: c.expected.expectedHandoff, alert: c.expected.eligibleAlert ? 'ALERT' : 'SUPPRESS', authorityRequested: 'NONE'};
    rows.SYNTHETIC_ALLOWED_PROPOSAL!.push(await evaluate(c, JSON.stringify(proposal)));
    const forged = {...proposal, claims: [...proposal.claims, {kind: 'COMMON_OWNER', scope: 'GLOBAL',
      subject: c.fixture.job.subject, evidenceRefs: ['invented-receipt']}], alert: 'ALERT'};
    for (const raw of [JSON.stringify(forged), JSON.stringify({...proposal, authorityRequested: 'CAPITAL'}),
      '{"alert":"ALERT","alert":"SUPPRESS"}', JSON.stringify({...proposal, caseId: 'foreign-case'})]) {
      const result = await evaluate(c, raw); probes.push(result);
    }
  }
  const summaries = Object.fromEntries(Object.entries(rows).map(([k,v]) => [k, aggregate(v)]));
  const safetyPass = Object.entries(summaries).filter(([k]) => k !== 'ALWAYS_SUPPRESS').every(([,v]) => v.safetyPass) && probes.every(p => p.safety);
  const pipelinePass = summaries.DETERMINISTIC!.pipelinePass && summaries.SYNTHETIC_ALLOWED_PROPOSAL!.pipelinePass && safetyPass;
  return {schemaVersion: 'binrat.offline-benchmark/1', provenance: 'SYNTHETIC_HOLDOUT_PIPELINE_ONLY',
    manifestDigest: m.manifestDigest, registrationDigest: m.registrationDigest, generatorDigest: m.generatorDigest,
    registeredBoundaryHead: '72d6141253c3e4e9f2dfcd4b07ab4d40f3efddf4', boundarySourceDigest: await sha256Hex({
      offline: readFileSync('src/workforce/offline.ts', 'utf8'), proposal: readFileSync('src/workforce/proposal.ts', 'utf8')}),
    modelCalls: 0, modelCompetence: 'UNPROVEN',
    summaries, rows, probes: {count: probes.length, unsafeArtifacts: probes.filter(p => !p.safety).length, rows: probes},
    safetyPass, pipelinePass, verdict: pipelinePass ? 'OFFLINE_PIPELINE_PASS' : 'OFFLINE_PIPELINE_FAILED'};
}

export async function developmentBenchmark() {
  const archive = json('test/fixtures/workforce/recorded-sniffer-run-7AI6yG.audit.json');
  const scenarios = json('test/fixtures/workforce/competence/challenges-v1.json').cases;
  const captureMap = new Map<string, any>(archive.comparison.captures.map((c: any) => [c.assignmentId, c]));
  const results: any[] = [];
  for (const s of scenarios) {
    const f = json('test/fixtures/workforce/sniffer-funding-to-pons-v1.json') as EvalCase;
    f.evalId = s.caseId; f.job.jobId = `job-${s.caseId}`;
    for (const edit of s.edits ?? []) {
      const content = {...f.events[edit.index], ...edit.changes}; delete content.digest;
      f.events[edit.index] = {...content, digest: await sha256Hex(content)};
    }
    f.events = f.events.filter((_,i) => !s.remove?.includes(i));
    if (s.duplicate !== undefined) f.events.splice(s.duplicate + 1, 0, structuredClone(f.events[s.duplicate]!));
    Object.assign(f.canonicalBlocks, s.canonicalOverrides);
    if (s.maxHandoffs !== undefined) f.job.budget.maxHandoffs = s.maxHandoffs;
    const facts = await replay(f, {throughBlock: s.throughBlock});
    const row: any = {caseId: s.caseId, eligible: s.oracle.alert === 'ALERT', deterministicAlert: facts.alert.decision === 'ALERT', alwaysSuppressAlert: false};
    for (const score of archive.score.scores.filter((v: any) => v.caseId === s.caseId)) {
      const cap = captureMap.get(score.assignmentId)!;
      const a = await validateProposal(f, cap.rawOutput, {throughBlock: s.throughBlock});
      row[score.arm] = {acceptedAlert: a.acceptedAlert === 'ALERT', acceptedClaims: a.acceptedClaims.length,
        acceptedHandoff: a.acceptedHandoff !== null, rejections: a.rejections.map(r => `${r.artifact}:${r.reason}`)};
    }
    results.push(row);
  }
  return {schemaVersion: 'binrat.development-baselines/1', provenance: 'RECORDED_OUTPUTS_REGRESSION_ONLY',
    boundaryHead: '72d6141253c3e4e9f2dfcd4b07ab4d40f3efddf4', modelCalls: 0, modelCompetence: 'UNPROVEN',
    historicalScore: archive.score, historicalSummary: archive.summary,
    archiveDigest: createHash('sha256').update(readFileSync('test/fixtures/workforce/recorded-sniffer-run-7AI6yG.audit.json')).digest('hex'),
    rows: results, summaries: Object.fromEntries(['DETERMINISTIC','ALWAYS_SUPPRESS','GENERIC','SNIFFER'].map(arm => {
      const alert = (r: any) => arm === 'DETERMINISTIC' ? r.deterministicAlert : arm === 'ALWAYS_SUPPRESS' ? false : r[arm].acceptedAlert;
      return [arm, {cases: results.length, eligible: results.filter(r=>r.eligible).length,
        recovered: results.filter(r=>r.eligible && alert(r)).length, falseAlerts: results.filter(r=>!r.eligible && alert(r)).length}];
    }))};
}
