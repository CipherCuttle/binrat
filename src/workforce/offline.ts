/** Pure bounded replay. No RPC, provider, DB, queue, Telegram or wallet adapters. */
import type { Hex, LaunchObserved } from '../core/types.js';
import { deriveEventId, deriveLaunchId } from '../core/identity.js';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { buildProvenanceFact } from '../intelligence/provenance.js';
import { buildPonsPrelaunchNativeInboundReceipt, verifyPonsPrelaunchNativeInboundReceipt } from '../pons/fundingProvenance.js';
import { makeReceipt, type Receipt } from '../autonomous/model.js';
import {
  assertContract, assertSeal, loadCompetencePack, type Budget, type Claim, type ClaimKind, type CompetencePack,
  type Handoff, type Job, type Launch, type RatId, type RecipientWindow, type SourceEvent, type Subject,
  type Tool, type Transfer, type Usage
} from './contracts.js';

export interface EvalCase {
  schemaVersion: 'binrat.eval-case/1'; evalId: string; provenance: 'SYNTHETIC_OFFLINE_REPLAY';
  job: Job; events: SourceEvent[]; canonicalBlocks: Record<string, string>;
  expected: { status: JobReceipt['status']; alert: 'ALERT' | 'SUPPRESS'; claimKinds: ClaimKind[]; maxToolCalls: number; maxHandoffs: number };
}
export interface Trace { sequence: number; ratId: RatId; tool: Tool; atBlock: string }
export interface JobReceipt {
  schemaVersion: 'binrat.rat-job-receipt/1'; provenance: 'SYNTHETIC_OFFLINE_REPLAY'; receiptId: string;
  jobId: string; inputDigest: string; competenceDigest: string; throughBlock: string; status: 'DONE' | 'SLEEPING' | 'DEGRADED' | 'EXHAUSTED';
  coverage: 'PARTIAL_DECLARED_FIXTURE_WINDOW'; claims: Claim[]; evidence: SourceEvent[]; handoffs: Handoff[];
  caseDiff: { beforeDigest: string; afterDigest: string; addedClaims: Claim[]; launchReceipt: Receipt } | null;
  alert: { decision: 'ALERT' | 'SUPPRESS'; reason: 'SUPPORTED_FUTURE_LAUNCH' | 'NO_SUPPORTED_CHANGE' | 'PARTIAL_COVERAGE' | 'BUDGET_EXHAUSTED'; findingId: string | null };
  usage: Usage; trace: Trace[];
}
const scope = 'DECLARED_FIXTURE_WINDOW_ONLY' as const;
const wallet = (id: string): Subject => ({ chainId: 4663, entityType: 'WALLET', entityId: id });
const creator = (id: string): Subject => ({ chainId: 4663, entityType: 'CREATOR', entityId: id });
const claim = (kind: ClaimKind, subject: Subject, evidenceRefs: string[]): Claim => ({ kind, subject, evidenceRefs, scope });
// Reviewed capability ceiling. Editing a profile or re-sealing a manifest cannot expand it.
const TOOL_POLICY: Readonly<Record<RatId, readonly Tool[]>> = {
  SNIFFER: ['READ_TRANSFER_FIXTURE', 'READ_RECIPIENT_WINDOW_FIXTURE'],
  RAT_ZERO: ['READ_PONS_LAUNCH_FIXTURE', 'BUILD_CASE_DIFF', 'DECIDE_ALERT'],
  TRIPWIRE: ['DECIDE_ALERT']
};

/** Reservations charge attempts before their work. Retries use this same origin ledger. */
export class OfflineBudget {
  private readonly job: Job;
  private readonly toolsByRat: Map<RatId, Set<string>>;
  private calls: Trace[] = [];
  private handoffCount = 0;
  constructor(job: Job, pack: CompetencePack) {
    assertContract<Job>('RAT_JOB_CONTRACT_V1', job);
    this.job = structuredClone(job);
    this.toolsByRat = new Map(pack.profiles.map(p => [p.ratId, new Set(p.toolRefs.map(ref =>
      pack.tools.find(t => t.id === ref.id && t.manifestDigest === ref.digest)?.tool ?? 'INVALID'))]));
  }
  reserve(ratId: RatId, tool: string, atBlock: string): void {
    if (!this.toolsByRat.get(ratId)?.has(tool) || !TOOL_POLICY[ratId]?.includes(tool as Tool)) {
      throw new Error('TOOL_AUTHORITY_DENIED');
    }
    if (!/^(0|[1-9][0-9]{0,19})$/.test(atBlock) || BigInt(atBlock) < BigInt(this.job.window.fromBlock) ||
        BigInt(atBlock) > BigInt(this.job.window.toBlock)) throw new Error('JOB_BOUNDARY_INVALID');
    if (this.calls.length >= this.job.budget.maxToolCalls) throw new Error('BUDGET_EXHAUSTED');
    this.calls.push({ sequence: this.calls.length + 1, ratId, tool: tool as Tool, atBlock });
  }
  reserveHandoff(): void {
    if (this.handoffCount >= this.job.budget.maxHandoffs) throw new Error('BUDGET_EXHAUSTED');
    this.handoffCount++;
  }
  get usage(): Usage { return { toolCalls: this.calls.length, handoffs: this.handoffCount, modelCalls: 0, costMicrousd: 0 }; }
  get trace(): Trace[] { return structuredClone(this.calls); }
  get remaining(): Budget {
    return { ...this.job.budget, maxToolCalls: this.job.budget.maxToolCalls - this.calls.length,
      maxHandoffs: this.job.budget.maxHandoffs - this.handoffCount };
  }
}

async function validateEval(input: unknown): Promise<EvalCase> {
  assertContract<EvalCase>('EVAL_CASE_V1', input);
  const value = structuredClone(input);
  if (value.job.subject.entityType !== 'WALLET' || BigInt(value.job.window.fromBlock) > BigInt(value.job.window.toBlock)) {
    throw new Error('JOB_SCOPE_INVALID');
  }
  // Check digests and source chronology only when each event becomes visible.
  // Validating the whole future source here could leak a later failure into an earlier decision.
  return value;
}

async function launchReceipt(event: Launch, throughBlock: string): Promise<Receipt> {
  const identity = { chainId: 4663, source: 'PONS_V2' as const, launcher: event.launcher as Hex,
    txHash: event.txHash as Hex, token: event.token as Hex, logIndex: event.logIndex };
  const launch: LaunchObserved = {
    ...identity, launchId: await deriveLaunchId(identity), eventId: await deriveEventId(identity),
    blockNumber: BigInt(event.blockNumber), blockHash: event.blockHash as Hex,
    observedAtMs: 0, creator: event.creator as Hex, pool: event.pool as Hex,
    name: '', symbol: '', imageUri: '', website: '', twitter: '', telegram: ''
  };
  const fact = await buildProvenanceFact(launch);
  return makeReceipt(creator(event.creator), [{
    launchId: launch.launchId, observationId: launch.eventId, blockNumber: event.blockNumber,
    blockHash: event.blockHash, txHash: event.txHash, logIndex: event.logIndex,
    creator: event.creator, token: event.token, factId: fact.factId, evidenceDigest: fact.evidenceDigest, ingestedAtMs: 0
  }], throughBlock, 0, 'CREATOR_LAUNCH_OBSERVED');
}

/** One bounded recipient and one finding. Resume replays and verifies its checkpoint, never trusts counters. */
export async function replay(input: unknown, options: { throughBlock?: string; resume?: JobReceipt } = {}): Promise<JobReceipt> {
  const fixture = await validateEval(input);
  const throughBlock = options.throughBlock ?? fixture.job.window.toBlock;
  if (!/^(0|[1-9][0-9]{0,19})$/.test(throughBlock) || BigInt(throughBlock) < BigInt(fixture.job.window.fromBlock) ||
      BigInt(throughBlock) > BigInt(fixture.job.window.toBlock)) throw new Error('REPLAY_BOUNDARY_INVALID');
  if (options.resume) {
    if (BigInt(options.resume.throughBlock) > BigInt(throughBlock)) throw new Error('RESUME_BOUNDARY_INVALID');
    const rebuilt = await replay(fixture, { throughBlock: options.resume.throughBlock });
    if (canonicalJson(rebuilt) !== canonicalJson(options.resume)) throw new Error('RESUME_RECEIPT_INVALID');
  }
  const pack = await loadCompetencePack();
  const budget = new OfflineBudget(fixture.job, pack);
  const evidence: SourceEvent[] = [], claims: Claim[] = [], handoffs: Handoff[] = [];
  const seen = new Map<string, string>();
  let funding: Transfer | null = null, history: RecipientWindow | null = null;
  let diff: JobReceipt['caseDiff'] = null;
  let degraded = false, exhausted = false, lastAvailable = BigInt(fixture.job.window.fromBlock);
  let alert: JobReceipt['alert'] = { decision: 'SUPPRESS', reason: 'NO_SUPPORTED_CHANGE', findingId: null };
  for (const event of fixture.events) {
    if (BigInt(event.availableAtBlock) > BigInt(throughBlock)) continue;
    if (BigInt(event.availableAtBlock) < lastAvailable || BigInt(event.blockNumber) > BigInt(event.availableAtBlock) ||
        BigInt(event.blockNumber) < BigInt(fixture.job.window.fromBlock)) throw new Error('EVENT_CHRONOLOGY_INVALID');
    lastAvailable = BigInt(event.availableAtBlock);
    await assertSeal(event, 'digest');
    // A canonical conflict invalidates this receipt, not already verified prefix facts.
    if (fixture.canonicalBlocks[event.blockNumber] !== event.blockHash) { degraded = true; continue; }
    if (seen.has(event.id)) {
      if (seen.get(event.id) !== event.digest) throw new Error('EVENT_ID_CONFLICT');
      continue;
    }
    seen.set(event.id, event.digest);
    if (exhausted || diff) continue;
    try {
      if (event.kind === 'NATIVE_TRANSFER' && !funding) {
        budget.reserve('SNIFFER', 'READ_TRANSFER_FIXTURE', event.availableAtBlock);
        if (event.from !== fixture.job.subject.entityId || event.from === event.to) continue;
        funding = event; evidence.push(event);
        claims.push(claim('NATIVE_TRANSFER_OBSERVED', wallet(event.to), [event.id]));
      } else if (event.kind === 'RECIPIENT_WINDOW' && funding && !history) {
        budget.reserve('SNIFFER', 'READ_RECIPIENT_WINDOW_FIXTURE', event.availableAtBlock);
        if (event.recipient !== funding.to) continue;
        if (BigInt(event.fromBlock) !== BigInt(fixture.job.window.fromBlock) ||
            BigInt(event.toBlock) !== BigInt(funding.blockNumber) - 1n) throw new Error('RECIPIENT_WINDOW_INVALID');
        history = event; evidence.push(event);
        if (!event.complete) { degraded = true; continue; }
        if (event.seen) continue;
        claims.push(claim('RECIPIENT_NOT_SEEN_IN_WINDOW', wallet(event.recipient), [event.id]));
        budget.reserveHandoff();
        const content: Omit<Handoff, 'handoffId'> = {
          schemaVersion: 'binrat.rat-handoff/1', jobId: fixture.job.jobId, fromRat: 'SNIFFER', toRat: 'RAT_ZERO',
          objective: 'CHECK_FUTURE_PONS_LAUNCH', subject: creator(funding.to),
          createdAtBlock: BigInt(funding.availableAtBlock) > BigInt(event.availableAtBlock)
            ? funding.availableAtBlock : event.availableAtBlock,
          afterBlock: funding.blockNumber, evidenceRefs: [funding.id, event.id],
          authority: fixture.job.authority, remainingBudget: budget.remaining
        };
        const handoff: Handoff = { ...content, handoffId: await sha256Hex(content) };
        assertContract<Handoff>('RAT_HANDOFF_V1', handoff); handoffs.push(handoff);
      } else if (event.kind === 'PONS_LAUNCH' && funding && handoffs.length) {
        budget.reserve('RAT_ZERO', 'READ_PONS_LAUNCH_FIXTURE', event.availableAtBlock);
        if (event.creator !== funding.to || BigInt(event.blockNumber) <= BigInt(funding.blockNumber) ||
            BigInt(event.blockNumber) <= BigInt(handoffs[0]!.createdAtBlock)) continue;
        const receipt = await launchReceipt(event, throughBlock);
        // Reuse the existing retrospective receipt only now that both observations exist.
        const linked = await buildPonsPrelaunchNativeInboundReceipt({
          launch: { launchId: receipt.evidenceRefs[0]!.launchId, deployer: event.creator as Hex,
            blockNumber: BigInt(event.blockNumber), blockHash: event.blockHash as Hex },
          sourceAddress: funding.from as Hex, transferTxHash: funding.txHash as Hex,
          transferBlock: BigInt(funding.blockNumber), transferBlockHash: funding.blockHash as Hex,
          transferTimestampMs: 0, valueWei: BigInt(funding.valueWei)
        });
        await verifyPonsPrelaunchNativeInboundReceipt(linked);
        budget.reserve('RAT_ZERO', 'BUILD_CASE_DIFF', event.availableAtBlock);
        const additions = [claim('PONS_REPORTED_DEPLOYER_LAUNCH', creator(event.creator), [event.id]),
          claim('FUNDING_PRECEDES_LAUNCH', creator(event.creator), [funding.id, event.id])];
        const beforeDigest = await sha256Hex(claims);
        const afterDigest = await sha256Hex([...claims, ...additions]);
        // Reserve the alert decision before admitting any published finding artifact.
        budget.reserve('RAT_ZERO', 'DECIDE_ALERT', event.availableAtBlock);
        diff = { beforeDigest, afterDigest, addedClaims: additions, launchReceipt: receipt };
        evidence.push(event); claims.push(...additions);
        alert = { decision: 'ALERT', reason: 'SUPPORTED_FUTURE_LAUNCH', findingId: afterDigest };
      }
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'BUDGET_EXHAUSTED') throw error;
      exhausted = true;
    }
  }
  if (funding && !history) degraded = true;
  if (exhausted) alert = { decision: 'SUPPRESS', reason: 'BUDGET_EXHAUSTED', findingId: null };
  else if (degraded) alert = { decision: 'SUPPRESS', reason: 'PARTIAL_COVERAGE', findingId: null };
  const content: Omit<JobReceipt, 'receiptId'> = {
    schemaVersion: 'binrat.rat-job-receipt/1', provenance: 'SYNTHETIC_OFFLINE_REPLAY', jobId: fixture.job.jobId,
    inputDigest: await sha256Hex({ job: fixture.job, evalId: fixture.evalId,
      events: fixture.events.filter(e => BigInt(e.availableAtBlock) <= BigInt(throughBlock)),
      canonicalBlocks: Object.fromEntries(fixture.events.filter(e => BigInt(e.availableAtBlock) <= BigInt(throughBlock))
        .map(e => [e.blockNumber, fixture.canonicalBlocks[e.blockNumber]])) }),
    competenceDigest: await sha256Hex(pack),
    throughBlock, status: exhausted ? 'EXHAUSTED' : degraded ? 'DEGRADED' :
      BigInt(throughBlock) < BigInt(fixture.job.window.toBlock) && !diff ? 'SLEEPING' : 'DONE',
    coverage: 'PARTIAL_DECLARED_FIXTURE_WINDOW', claims, evidence, handoffs, caseDiff: diff, alert,
    usage: budget.usage, trace: budget.trace
  };
  const result = { ...content, receiptId: await sha256Hex(content) };
  assertContract<JobReceipt>('RAT_JOB_RECEIPT_V1', result);
  return result;
}

/** Acceptance oracle: named boolean gates, not a flattering weighted score. */
export async function scoreReplay(input: unknown, candidate: unknown): Promise<Record<string, boolean>> {
  const fixture = await validateEval(input);
  assertContract<JobReceipt>('RAT_JOB_RECEIPT_V1', candidate);
  const r = candidate;
  let sealed = true;
  try { await assertSeal(r, 'receiptId'); } catch { sealed = false; }
  const admitted = new Map(r.evidence.map(e => [e.id, e]));
  const visible = fixture.events.filter(e => BigInt(e.availableAtBlock) <= BigInt(r.throughBlock));
  const receiptCompleteness = r.evidence.every(e => visible.some(v => canonicalJson(v) === canonicalJson(e)) &&
    fixture.canonicalBlocks[e.blockNumber] === e.blockHash) &&
    r.claims.every(c => c.evidenceRefs.every(id => admitted.has(id))) &&
    fixture.expected.claimKinds.every(kind => r.claims.some(c => c.kind === kind));
  const supported = (c: Claim): boolean => {
    const refs = c.evidenceRefs.map(id => admitted.get(id));
    if (c.kind === 'NATIVE_TRANSFER_OBSERVED') {
      const t = refs[0]; return refs.length === 1 && t?.kind === 'NATIVE_TRANSFER' && t.to === c.subject.entityId &&
        t.from === fixture.job.subject.entityId && t.from !== t.to;
    }
    if (c.kind === 'RECIPIENT_NOT_SEEN_IN_WINDOW') {
      const h = refs[0]; return refs.length === 1 && h?.kind === 'RECIPIENT_WINDOW' && h.complete && !h.seen &&
        h.recipient === c.subject.entityId && h.fromBlock === fixture.job.window.fromBlock;
    }
    if (c.kind === 'PONS_REPORTED_DEPLOYER_LAUNCH') {
      const l = refs[0]; return refs.length === 1 && l?.kind === 'PONS_LAUNCH' && l.creator === c.subject.entityId;
    }
    const [t, l] = refs;
    return refs.length === 2 && t?.kind === 'NATIVE_TRANSFER' && l?.kind === 'PONS_LAUNCH' &&
      t.to === l.creator && l.creator === c.subject.entityId && BigInt(t.blockNumber) < BigInt(l.blockNumber);
  };
  const correctHandoffs = r.handoffs.every(h => {
    const t = admitted.get(h.evidenceRefs[0]!), w = admitted.get(h.evidenceRefs[1]!);
    return h.jobId === fixture.job.jobId && t?.kind === 'NATIVE_TRANSFER' && w?.kind === 'RECIPIENT_WINDOW' &&
      t.to === h.subject.entityId && w.recipient === t.to && w.complete && !w.seen &&
      h.afterBlock === t.blockNumber && BigInt(h.createdAtBlock) >= BigInt(w.availableAtBlock) &&
      h.remainingBudget.maxToolCalls <= fixture.job.budget.maxToolCalls &&
      h.remainingBudget.maxHandoffs < fixture.job.budget.maxHandoffs;
  });
  const launchRefs = r.evidence.filter((e): e is Launch => e.kind === 'PONS_LAUNCH');
  const chronology = r.trace.every(t => BigInt(t.atBlock) <= BigInt(r.throughBlock)) &&
    r.handoffs.every(h => h.evidenceRefs.every(id => BigInt(admitted.get(id)?.availableAtBlock ?? '99999999999999999999') <= BigInt(h.createdAtBlock))) &&
    launchRefs.every(l => r.handoffs.some(h => h.subject.entityId === l.creator && BigInt(h.createdAtBlock) < BigInt(l.blockNumber)));
  const pack = await loadCompetencePack();
  const ledger = new OfflineBudget(fixture.job, pack);
  let budgetAdherence = true;
  try {
    for (const t of r.trace) ledger.reserve(t.ratId, t.tool, t.atBlock);
    for (const _h of r.handoffs) ledger.reserveHandoff();
    budgetAdherence = canonicalJson(ledger.usage) === canonicalJson(r.usage) &&
      r.usage.toolCalls <= fixture.expected.maxToolCalls && r.usage.handoffs <= fixture.expected.maxHandoffs;
  } catch { budgetAdherence = false; }
  const diff = r.caseDiff;
  const before = r.claims.filter(c => !diff?.addedClaims.some(a => canonicalJson(a) === canonicalJson(c)));
  const caseDiffIntegrity = !diff ? r.alert.decision === 'SUPPRESS' :
    diff.beforeDigest === await sha256Hex(before) && diff.afterDigest === await sha256Hex(r.claims) &&
    diff.addedClaims.every(supported) && r.alert.findingId === diff.afterDigest &&
    launchRefs.length === 1 && canonicalJson(diff.launchReceipt) === canonicalJson(await launchReceipt(launchRefs[0]!, r.throughBlock));
  let replayIntegrity = false;
  try { replayIntegrity = canonicalJson(r) === canonicalJson(await replay(fixture, { throughBlock: r.throughBlock })); }
  catch { /* malformed source evidence is a failed gate */ }
  return {
    sealed, chronology, receiptCompleteness, unsupportedClaims: r.claims.every(supported),
    handoffCorrectness: correctHandoffs, budgetAdherence, caseDiffIntegrity, replayIntegrity,
    expectedOutcome: r.status === fixture.expected.status && r.alert.decision === fixture.expected.alert &&
      canonicalJson(r.claims.map(c => c.kind).sort()) === canonicalJson([...fixture.expected.claimKinds].sort())
  };
}
