/** Deterministic admission of untrusted investigator proposals. Offline only. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { canonicalJson } from '../evidence/canonical.js';
import { parseStrictJson, type InvestigatorOutput } from './competence.js';
import { replay, type EvalCase } from './offline.js';
import type { Claim, Handoff } from './contracts.js';

const outputSchema = JSON.parse(readFileSync(resolve('contracts/rat-workforce/competence/INVESTIGATOR_OUTPUT_V1.schema.json'), 'utf8')) as object;
const validateOutput = new Ajv2020({ strict: true, allErrors: true }).compile(outputSchema);

export interface ProposalRejection { artifact: 'OUTPUT' | 'CLAIM' | 'HANDOFF' | 'ALERT'; reason: string; evidenceRefs: string[] }
export interface ProposalAdmission {
  schemaVersion: 'binrat.proposal-admission/1'; provenance: 'SYNTHETIC_OFFLINE_REPLAY';
  acceptedClaims: Claim[]; acceptedCaseChanges: Claim[]; acceptedHandoff: Handoff | null;
  acceptedAlert: 'ALERT' | 'SUPPRESS' | null; rejections: ProposalRejection[];
  factsReceiptId: string;
}

const refs = (value: unknown): string[] => value && typeof value === 'object' &&
  Array.isArray((value as { evidenceRefs?: unknown }).evidenceRefs)
  ? ((value as { evidenceRefs: unknown[] }).evidenceRefs.filter((v): v is string => typeof v === 'string')) : [];

/**
 * Recompute admissible facts from the sealed job and receipts. Raw model text is
 * parsed strictly and never repaired. Untrusted source text is not an input.
 */
export async function validateProposal(input: unknown, rawOutput: string,
  options: { throughBlock?: string } = {}): Promise<ProposalAdmission> {
  const facts = await replay(input, { throughBlock: options.throughBlock });
  const fixture = input as EvalCase;
  const presentedRefs = [...new Set(fixture.events.filter(e => BigInt(e.availableAtBlock) <= BigInt(facts.throughBlock))
    .map(e => e.id))];
  const canonicalConflicts = fixture.events.filter(e => BigInt(e.availableAtBlock) <= BigInt(facts.throughBlock) &&
    fixture.canonicalBlocks[e.blockNumber] !== e.blockHash).map(e => e.id);
  const acceptedClaims: Claim[] = [], acceptedCaseChanges: Claim[] = [], rejections: ProposalRejection[] = [];
  let output: InvestigatorOutput | null = null;
  try {
    const parsed = parseStrictJson(rawOutput);
    if (validateOutput(parsed)) output = parsed as InvestigatorOutput;
  } catch { /* malformed proposals remain rejected, without answer repair */ }
  if (!output) {
    rejections.push({ artifact: 'OUTPUT', reason: 'MALFORMED_OR_INVALID_OUTPUT', evidenceRefs: [] });
    return { schemaVersion: 'binrat.proposal-admission/1', provenance: 'SYNTHETIC_OFFLINE_REPLAY',
      acceptedClaims, acceptedCaseChanges, acceptedHandoff: null, acceptedAlert: null, rejections,
      factsReceiptId: facts.receiptId };
  }
  if (output.caseId !== fixture.evalId) {
    rejections.push({ artifact: 'OUTPUT', reason: 'CASE_BINDING_MISMATCH', evidenceRefs: [] });
  }
  if (output.authorityRequested !== 'NONE') {
    rejections.push({ artifact: 'OUTPUT', reason: 'AUTHORITY_REQUEST_DENIED', evidenceRefs: [] });
  }
  if (rejections.length) {
    return { schemaVersion: 'binrat.proposal-admission/1', provenance: 'SYNTHETIC_OFFLINE_REPLAY',
      acceptedClaims, acceptedCaseChanges, acceptedHandoff: null, acceptedAlert: null, rejections,
      factsReceiptId: facts.receiptId };
  }
  const factClaims = new Map(facts.claims.map(c => [canonicalJson(c), c]));
  const caseClaims = new Map((facts.alert.decision === 'ALERT' ? facts.caseDiff?.addedClaims ?? [] : [])
    .map(c => [canonicalJson(c), c]));
  const proposedCaseClaims = new Map((facts.caseDiff?.addedClaims ?? []).map(c => [canonicalJson(c), c]));
  const proposedSeen = new Set<string>();
  for (const proposed of output.claims) {
    const key = canonicalJson(proposed);
    if (proposedSeen.has(key)) {
      rejections.push({ artifact: 'CLAIM', reason: 'DUPLICATE_PROPOSAL', evidenceRefs: refs(proposed) });
      continue;
    }
    proposedSeen.add(key);
    const supported = factClaims.get(key);
    if (!supported) {
      rejections.push({ artifact: 'CLAIM', reason: 'UNSUPPORTED_OR_MISBOUND_CLAIM', evidenceRefs: refs(proposed) });
      continue;
    }
    acceptedClaims.push(supported);
    const change = caseClaims.get(key);
    if (change) acceptedCaseChanges.push(change);
    else if (proposedCaseClaims.has(key)) {
      rejections.push({ artifact: 'CLAIM', reason: 'CASE_CHANGE_NOT_ADMISSIBLE', evidenceRefs: refs(proposed) });
    }
  }

  let acceptedHandoff: Handoff | null = null;
  if (output.handoff) {
    const matching = facts.handoffs.find(h => h.subject.entityId === output!.handoff!.subject.entityId &&
      h.subject.entityType === output!.handoff!.subject.entityType &&
      h.createdAtBlock === output!.handoff!.createdAtBlock && h.afterBlock === output!.handoff!.afterBlock &&
      canonicalJson(h.evidenceRefs) === canonicalJson(output!.handoff!.evidenceRefs));
    if (matching && output.caseId === fixture.evalId) acceptedHandoff = matching;
    else rejections.push({ artifact: 'HANDOFF', reason: 'HANDOFF_NOT_ADMISSIBLE', evidenceRefs: refs(output.handoff) });
  }

  let acceptedAlert: 'ALERT' | 'SUPPRESS' | null = null;
  if (output.caseId !== fixture.evalId) {
    rejections.push({ artifact: 'ALERT', reason: 'CASE_BINDING_MISMATCH', evidenceRefs: facts.caseDiff?.addedClaims.flatMap(c => c.evidenceRefs) ?? [] });
  } else if (output.alert === 'SUPPRESS') acceptedAlert = 'SUPPRESS';
  else if (rejections.length === 0 && facts.alert.decision === 'ALERT' && facts.caseDiff &&
    facts.caseDiff.addedClaims.every(c => acceptedCaseChanges.some(a => canonicalJson(a) === canonicalJson(c)))) {
    acceptedAlert = 'ALERT';
  } else {
    const reason = facts.status === 'EXHAUSTED' ? 'BUDGET_EXHAUSTED' : canonicalConflicts.length ? 'CANONICAL_CONFLICT' :
      facts.status === 'DEGRADED' ? 'INSUFFICIENT_COVERAGE' : facts.alert.decision === 'ALERT' ?
        'PROPOSAL_INCOMPLETE_OR_UNSUPPORTED' : 'NO_ELIGIBLE_FINDING';
    rejections.push({ artifact: 'ALERT', reason,
      evidenceRefs: canonicalConflicts.length ? canonicalConflicts :
        facts.caseDiff?.addedClaims.flatMap(c => c.evidenceRefs) ?? presentedRefs });
  }
  return { schemaVersion: 'binrat.proposal-admission/1', provenance: 'SYNTHETIC_OFFLINE_REPLAY',
    acceptedClaims, acceptedCaseChanges, acceptedHandoff, acceptedAlert, rejections, factsReceiptId: facts.receiptId };
}
