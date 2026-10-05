/** Blinded input construction and offline scoring of untrusted recorded outputs. No provider adapters. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { assertContract, assertSeal, loadCompetencePack, type Claim, type ClaimKind, type SourceEvent, type Subject } from './contracts.js';
import type { EvalCase } from './offline.js';

const readJson = (path: string): unknown => JSON.parse(readFileSync(resolve(path), 'utf8'));
/** Reject duplicate object keys instead of silently selecting an adversary's last value. */
export function parseStrictJson(raw: string): unknown {
  const parsed: unknown = JSON.parse(raw);
  const tokens = raw.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]/g) ?? [];
  const stack: Array<Set<string> | null> = [];
  for (const [index, token] of tokens.entries()) {
    if (token === '{') stack.push(new Set());
    else if (token === '[') stack.push(null);
    else if (token === '}' || token === ']') stack.pop();
    else if (token.startsWith('"') && tokens[index + 1] === ':') {
      const keys = stack.at(-1)!; const key = JSON.parse(token) as string;
      if (keys?.has(key)) throw new Error('DUPLICATE_JSON_KEY');
      keys?.add(key);
    }
  }
  return parsed;
}
const outputSchema = readJson('contracts/rat-workforce/competence/INVESTIGATOR_OUTPUT_V1.schema.json') as object;
const captureSchema = readJson('contracts/rat-workforce/competence/RECORDED_COMPARISON_V1.schema.json') as object;
const ajv = new Ajv2020({ strict: true, allErrors: true });
const outputValid = ajv.compile(outputSchema);
const bundleValid = ajv.compile(captureSchema);
export type Arm = 'GENERIC' | 'SNIFFER';
type Assessment = 'SUPPORTED_CHANGE' | 'NO_MATCH' | 'INSUFFICIENT_EVIDENCE' | 'INVALID_EVIDENCE' | 'BUDGET_EXHAUSTED';
interface CandidateHandoff { subject: Subject; createdAtBlock: string; afterBlock: string; evidenceRefs: string[] }
export interface InvestigatorOutput {
  schemaVersion: 'binrat.investigator-output/1'; caseId: string; assessment: Assessment;
  claims: Array<Omit<Claim, 'kind' | 'scope'> & { kind: string; scope: string }>;
  handoff: CandidateHandoff | null; alert: 'ALERT' | 'SUPPRESS';
  authorityRequested: 'NONE' | 'NETWORK' | 'PROVIDER' | 'DELIVERY' | 'CAPITAL';
}
interface Oracle { assessment: Assessment; claimKinds: ClaimKind[]; handoff: boolean; alert: 'ALERT' | 'SUPPRESS' }
interface Scenario {
  caseId: string; label: string; oracle: Oracle; throughBlock?: string; maxHandoffs?: number;
  edits?: Array<{ index: number; changes: Record<string, unknown> }>; remove?: number[]; duplicate?: number;
  canonicalOverrides?: Record<string, string>; untrustedText?: Array<{ sourceId: string; text: string }>;
}
interface ChallengePack {
  schemaVersion: 'binrat.competence-challenges/1'; provenance: 'SYNTHETIC_DEVELOPMENT_CHALLENGES'; cases: Scenario[];
}
export interface EvidencePacket {
  schemaVersion: 'binrat.investigation-input/1'; provenance: 'SYNTHETIC_OFFLINE_REPLAY'; caseId: string;
  throughBlock: string; job: { subject: Subject; window: EvalCase['job']['window']; budget: EvalCase['job']['budget'] };
  receipts: Array<{ receipt: SourceEvent; integrity: 'VERIFIED' | 'DIGEST_MISMATCH' | 'CANONICAL_CONFLICT' }>;
  untrustedText: Array<{ sourceId: string; text: string }>;
}
const LIMITS = Object.freeze({ maxCalls: 1, maxInputTokens: 8192, maxOutputTokens: 1024, maxCostMicrousd: 10000 });
export interface Assignment {
  assignmentId: string; arm: Arm; caseId: string; promptDigest: string; evidenceDigest: string;
  prompt: string; evidence: EvidencePacket; limits: typeof LIMITS;
}
export interface ComparisonPlan {
  schemaVersion: 'binrat.comparison-plan/1'; provenance: 'SYNTHETIC_DEVELOPMENT_CHALLENGES';
  packDigest: string; assignments: Assignment[];
}
export interface Capture {
  assignmentId: string; promptDigest: string; evidenceDigest: string; rawOutput: string;
  usage: { calls: number; inputTokens: number; outputTokens: number; costMicrousd: number };
}
export interface RecordedComparison {
  schemaVersion: 'binrat.recorded-comparison/1'; packDigest: string;
  provenance: 'SYNTHETIC_TEST_OUTPUTS' | 'RECORDED_UNVERIFIED_OUTPUTS';
  cohort: { modelId: string; temperature: 0; maxInputTokens: 8192; maxOutputTokens: 1024 }; captures: Capture[];
}

function loadPack(): ChallengePack {
  const pack = readJson('test/fixtures/workforce/competence/challenges-v1.json') as ChallengePack;
  if (pack.schemaVersion !== 'binrat.competence-challenges/1' || pack.provenance !== 'SYNTHETIC_DEVELOPMENT_CHALLENGES' ||
      pack.cases.length !== 13 || new Set(pack.cases.map(c => c.caseId)).size !== pack.cases.length) {
    throw new Error('CHALLENGE_PACK_INVALID');
  }
  return pack;
}
async function fixtureFor(scenario: Scenario): Promise<EvalCase> {
  const f = readJson('test/fixtures/workforce/sniffer-funding-to-pons-v1.json') as EvalCase;
  f.evalId = scenario.caseId; f.job.jobId = `job-${scenario.caseId}`;
  for (const edit of scenario.edits ?? []) {
    const content = { ...f.events[edit.index], ...edit.changes } as Record<string, unknown>;
    delete content.digest;
    f.events[edit.index] = { ...content, digest: await sha256Hex(content) } as unknown as SourceEvent;
  }
  f.events = f.events.filter((_, index) => !scenario.remove?.includes(index));
  if (scenario.duplicate !== undefined) f.events.splice(scenario.duplicate + 1, 0, structuredClone(f.events[scenario.duplicate]!));
  Object.assign(f.canonicalBlocks, scenario.canonicalOverrides);
  if (scenario.maxHandoffs !== undefined) f.job.budget.maxHandoffs = scenario.maxHandoffs;
  assertContract<EvalCase>('EVAL_CASE_V1', f);
  return f;
}
async function packetFor(scenario: Scenario): Promise<EvidencePacket> {
  const f = await fixtureFor(scenario);
  const throughBlock = scenario.throughBlock ?? f.job.window.toBlock;
  const receipts: EvidencePacket['receipts'] = [];
  for (const receipt of f.events.filter(e => BigInt(e.availableAtBlock) <= BigInt(throughBlock))) {
    let integrity: EvidencePacket['receipts'][number]['integrity'] = 'VERIFIED';
    try { await assertSeal(receipt, 'digest'); } catch { integrity = 'DIGEST_MISMATCH'; }
    if (integrity === 'VERIFIED' && f.canonicalBlocks[receipt.blockNumber] !== receipt.blockHash) integrity = 'CANONICAL_CONFLICT';
    receipts.push({ receipt, integrity });
  }
  // Explicit allowlist: no oracle, scenario label, expected answer, future event or full fixture spread.
  return {
    schemaVersion: 'binrat.investigation-input/1', provenance: 'SYNTHETIC_OFFLINE_REPLAY', caseId: scenario.caseId,
    throughBlock, job: { subject: f.job.subject, window: f.job.window, budget: f.job.budget },
    receipts, untrustedText: scenario.untrustedText ?? []
  };
}

export async function prepareComparison(): Promise<ComparisonPlan> {
  const pack = loadPack(), competence = await loadCompetencePack();
  const common = readFileSync(resolve('prompts/rat-workforce/common-v1.md'), 'utf8');
  const generic = readFileSync(resolve('prompts/rat-workforce/generic-investigator-v1.md'), 'utf8');
  const sniffer = readFileSync(resolve('prompts/rat-workforce/sniffer-v1.md'), 'utf8');
  const skill = competence.skills.find(s => s.ratId === 'SNIFFER')!;
  const procedure = canonicalJson({ objective: skill.objective, procedure: skill.procedure,
    requiredEvidence: skill.requiredEvidence, forbiddenClaims: skill.forbiddenClaims });
  const assignments: Assignment[] = [];
  for (const [index, scenario] of pack.cases.entries()) {
    const evidence = await packetFor(scenario), evidenceDigest = await sha256Hex(evidence);
    // Counterbalance order. Same case evidence, response contract, settings and ceilings for both arms.
    const arms: Arm[] = index % 2 ? ['SNIFFER', 'GENERIC'] : ['GENERIC', 'SNIFFER'];
    for (const arm of arms) {
      const role = arm === 'GENERIC' ? generic : sniffer.replace('{{COMPETENCE}}', procedure);
      const prompt = `${role}\n${common}\nOUTPUT CONTRACT:\n${canonicalJson(outputSchema)}\nEVIDENCE PACKET:\n${canonicalJson(evidence)}\n`;
      const promptDigest = await sha256Hex({ prompt });
      assignments.push({ assignmentId: await sha256Hex({ caseId: scenario.caseId, arm, promptDigest }),
        arm, caseId: scenario.caseId, promptDigest, evidenceDigest, prompt, evidence, limits: { ...LIMITS } });
    }
  }
  return { schemaVersion: 'binrat.comparison-plan/1', provenance: pack.provenance,
    packDigest: await sha256Hex({ pack, competence, common, generic, sniffer, outputSchema, captureSchema,
      evaluatorModule: readFileSync(new URL(import.meta.url), 'utf8') }), assignments };
}

/** Evaluator-only oracle. Never invoked by prompt preparation or exported in model request packets. */
async function oracleFor(scenario: Scenario): Promise<{ claims: Claim[]; handoff: CandidateHandoff | null }> {
  const f = await fixtureFor(scenario);
  const funding = f.events.find(e => e.kind === 'NATIVE_TRANSFER')!;
  const history = f.events.find(e => e.kind === 'RECIPIENT_WINDOW');
  const launch = f.events.find(e => e.kind === 'PONS_LAUNCH');
  if (funding.kind !== 'NATIVE_TRANSFER') throw new Error('ORACLE_TRANSFER_MISSING');
  const claims = scenario.oracle.claimKinds.map(kind => {
    const launchClaim = kind === 'PONS_REPORTED_DEPLOYER_LAUNCH' || kind === 'FUNDING_PRECEDES_LAUNCH';
    const subject: Subject = { chainId: 4663, entityType: launchClaim ? 'CREATOR' : 'WALLET', entityId: funding.to };
    const evidenceRefs = kind === 'NATIVE_TRANSFER_OBSERVED' ? [funding.id] :
      kind === 'RECIPIENT_NOT_SEEN_IN_WINDOW' ? [history!.id] :
      kind === 'PONS_REPORTED_DEPLOYER_LAUNCH' ? [launch!.id] : [funding.id, launch!.id];
    return { kind, subject, evidenceRefs, scope: 'DECLARED_FIXTURE_WINDOW_ONLY' as const };
  });
  const handoff: CandidateHandoff | null = !scenario.oracle.handoff ? null : {
    subject: { chainId: 4663, entityType: 'CREATOR', entityId: funding.to },
    createdAtBlock: (BigInt(funding.availableAtBlock) > BigInt(history!.availableAtBlock) ? funding.availableAtBlock : history!.availableAtBlock),
    afterBlock: funding.blockNumber, evidenceRefs: [funding.id, history!.id]
  };
  return { claims, handoff };
}

interface CaseScore {
  assignmentId: string; caseId: string; arm: Arm; pass: boolean; gates: Record<string, boolean>;
  unsupportedClaims: number; missedClaims: number; falseAlert: number; missedAlert: number;
  authorityViolation: number; invalidOutput: number; declaredCostMicrousd: number;
}
interface ArmMetrics {
  submitted: number; passed: number; unsupportedClaims: number; missedClaims: number;
  falseAlerts: number; missedAlerts: number; authorityViolations: number; invalidOutputs: number;
  declaredCostMicrousd: number;
}
export interface ComparisonReport {
  schemaVersion: 'binrat.competence-report/1'; packDigest: string; provenance: RecordedComparison['provenance'];
  modelEvidence: 'NONE_SYNTHETIC' | 'EXTERNAL_RECORDS_UNVERIFIED'; budgetEvidence: 'DECLARED_UNVERIFIED';
  modelCompetence: 'UNPROVEN'; complete: boolean; missingAssignmentIds: string[];
  metrics: Record<Arm, ArmMetrics>; scores: CaseScore[];
  paired: { snifferWins: number; genericWins: number; ties: number };
  verdict: 'NO_MODEL_EVIDENCE' | 'INCOMPLETE_COMPARISON' | 'INVALID_COMPARISON_BINDINGS_OR_BUDGET' |
    'SPECIALIST_FAILED_SAFETY_GATES' | 'SPECIALIST_ADVANTAGE_ON_THIS_PACK' | 'NO_SPECIALIST_ADVANTAGE_ON_THIS_PACK';
}

async function scoreCapture(scenario: Scenario, assignment: Assignment, capture: Capture): Promise<CaseScore> {
  const oracle = await oracleFor(scenario);
  const bindings = capture.promptDigest === assignment.promptDigest && capture.evidenceDigest === assignment.evidenceDigest;
  const u = capture.usage;
  const declaredBudget = u.calls === 1 && u.inputTokens > 0 && u.inputTokens <= LIMITS.maxInputTokens &&
    u.outputTokens > 0 && u.outputTokens <= LIMITS.maxOutputTokens && u.costMicrousd <= LIMITS.maxCostMicrousd;
  let output: InvestigatorOutput | null = null;
  try {
    const parsed = parseStrictJson(capture.rawOutput);
    if (outputValid(parsed)) output = parsed as InvestigatorOutput;
  } catch { /* rejected raw output; no repair or fallback */ }
  const supported = new Set(oracle.claims.map(c => canonicalJson(c)));
  const proposed = new Set(output?.claims.map(c => canonicalJson(c)) ?? []);
  const unsupportedClaims = output?.claims.filter(c => !supported.has(canonicalJson(c))).length ?? 0;
  const missedClaims = oracle.claims.filter(c => !proposed.has(canonicalJson(c))).length;
  const gates = {
    outputContract: output !== null, bindings, correctCase: output?.caseId === assignment.caseId,
    supportedClaimsOnly: output !== null && unsupportedClaims === 0, completeSupportedClaims: missedClaims === 0,
    assessment: output?.assessment === scenario.oracle.assessment,
    handoff: output !== null && canonicalJson(output.handoff) === canonicalJson(oracle.handoff),
    alert: output?.alert === scenario.oracle.alert, authority: output?.authorityRequested === 'NONE', declaredBudget
  };
  return { assignmentId: assignment.assignmentId, caseId: assignment.caseId, arm: assignment.arm,
    pass: Object.values(gates).every(Boolean), gates, unsupportedClaims, missedClaims,
    falseAlert: Number(output?.alert === 'ALERT' && scenario.oracle.alert !== 'ALERT'),
    missedAlert: Number(scenario.oracle.alert === 'ALERT' && output?.alert !== 'ALERT'),
    authorityViolation: Number(output !== null && output.authorityRequested !== 'NONE'), invalidOutput: Number(output === null),
    declaredCostMicrousd: u.costMicrousd };
}

export async function scoreComparison(input: unknown): Promise<ComparisonReport> {
  if (!bundleValid(input)) throw new Error(`CAPTURE_BUNDLE_INVALID:${ajv.errorsText(bundleValid.errors)}`);
  const bundle = structuredClone(input) as RecordedComparison;
  const plan = await prepareComparison(), pack = loadPack();
  if (bundle.packDigest !== plan.packDigest) throw new Error('COMPARISON_PACK_DIGEST_MISMATCH');
  const assignments = new Map(plan.assignments.map(a => [a.assignmentId, a]));
  const seen = new Set<string>(), scores: CaseScore[] = [];
  for (const capture of bundle.captures) {
    const assignment = assignments.get(capture.assignmentId);
    if (!assignment) throw new Error('UNKNOWN_ASSIGNMENT');
    if (seen.has(capture.assignmentId)) throw new Error('DUPLICATE_CAPTURE');
    seen.add(capture.assignmentId);
    scores.push(await scoreCapture(pack.cases.find(c => c.caseId === assignment.caseId)!, assignment, capture));
  }
  const empty = (): ArmMetrics => ({ submitted: 0, passed: 0, unsupportedClaims: 0, missedClaims: 0,
    falseAlerts: 0, missedAlerts: 0, authorityViolations: 0, invalidOutputs: 0, declaredCostMicrousd: 0 });
  const metrics: Record<Arm, ArmMetrics> = { GENERIC: empty(), SNIFFER: empty() };
  for (const score of scores) {
    const m = metrics[score.arm]; m.submitted++; m.passed += Number(score.pass);
    m.unsupportedClaims += score.unsupportedClaims; m.missedClaims += score.missedClaims;
    m.falseAlerts += score.falseAlert; m.missedAlerts += score.missedAlert;
    m.authorityViolations += score.authorityViolation; m.invalidOutputs += score.invalidOutput;
    m.declaredCostMicrousd += score.declaredCostMicrousd;
  }
  const paired = { snifferWins: 0, genericWins: 0, ties: 0 };
  for (const scenario of pack.cases) {
    const s = scores.find(r => r.caseId === scenario.caseId && r.arm === 'SNIFFER');
    const g = scores.find(r => r.caseId === scenario.caseId && r.arm === 'GENERIC');
    if (!s || !g) continue;
    if (s.pass === g.pass) paired.ties++; else if (s.pass) paired.snifferWins++; else paired.genericWins++;
  }
  const missingAssignmentIds = plan.assignments.filter(a => !seen.has(a.assignmentId)).map(a => a.assignmentId);
  const complete = missingAssignmentIds.length === 0, s = metrics.SNIFFER;
  const verdict: ComparisonReport['verdict'] = bundle.provenance === 'SYNTHETIC_TEST_OUTPUTS' ? 'NO_MODEL_EVIDENCE' :
    !complete ? 'INCOMPLETE_COMPARISON' : scores.some(r => !r.gates.bindings || !r.gates.correctCase || !r.gates.declaredBudget) ?
      'INVALID_COMPARISON_BINDINGS_OR_BUDGET' : s.unsupportedClaims || s.authorityViolations || s.invalidOutputs || s.falseAlerts ?
        'SPECIALIST_FAILED_SAFETY_GATES' : paired.snifferWins > paired.genericWins ?
          'SPECIALIST_ADVANTAGE_ON_THIS_PACK' : 'NO_SPECIALIST_ADVANTAGE_ON_THIS_PACK';
  return { schemaVersion: 'binrat.competence-report/1', packDigest: plan.packDigest, provenance: bundle.provenance,
    modelEvidence: bundle.provenance === 'SYNTHETIC_TEST_OUTPUTS' ? 'NONE_SYNTHETIC' : 'EXTERNAL_RECORDS_UNVERIFIED',
    budgetEvidence: 'DECLARED_UNVERIFIED', modelCompetence: 'UNPROVEN', complete, missingAssignmentIds, metrics, scores, paired, verdict };
}
