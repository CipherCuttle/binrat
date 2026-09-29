import { sha256Hex } from '../evidence/canonical.js';

export type EntityType = 'CREATOR' | 'WALLET' | 'TOKEN' | 'LAUNCH';
export interface Entity { chainId: number; entityType: EntityType; entityId: string }
export type EpistemicClass = 'OBSERVED' | 'DERIVED' | 'PATTERN' | 'UNKNOWN';
export type Attention = 'IGNORE' | 'REMEMBER' | 'BRIEF' | 'ALERT';
export interface EvidenceRef {
  launchId: string; observationId: string; blockNumber: string; blockHash: string;
  txHash: string; logIndex: number; creator: string; token: string;
  factId: string; evidenceDigest: string; ingestedAtMs: number;
}
export interface DiscoveryReason {
  kind: 'RECURRENCE' | 'RECENCY';
  epistemicClass: 'DERIVED' | 'OBSERVED';
  text: string;
  evidenceRefs: string[];
}
export interface DiscoveryDetails {
  ruleVersion: 'RATS_CREATOR_RECURRENCE_V1';
  reasons: DiscoveryReason[];
  sourceCheckpoint: string;
}
export interface Receipt {
  version: 'binrat.finding/1';
  findingId: string; caseId: string; shareId: string;
  chainId: number; subject: Entity;
  timestamp: { blockNumber: string; eventTime: null; ingestedAtMs: number };
  epistemicClass: 'OBSERVED' | 'DERIVED';
  claim: 'INDEXED_LAUNCH_EVIDENCE' | 'CREATOR_LAUNCH_OBSERVED';
  evidenceRefs: EvidenceRef[];
  coverage: { status: 'PARTIAL'; scope: 'ARCPAD_INDEXED_LAUNCHES'; asOfBlock: string; limit: number };
  source: 'ARCPAD'; createdAt: number;
  discovery?: DiscoveryDetails;
}

export function parseTarget(input: string): Entity {
  const raw = input.trim();
  if (raw.length > 160) throw new Error('MALFORMED_TARGET');
  const parts = raw.split(':');
  let chainId = 5042;
  let entityType: EntityType;
  let entityId: string;
  if (parts.length === 1) {
    entityId = raw.toLowerCase();
    entityType = /^[0-9a-f]{64}$/.test(entityId) ? 'LAUNCH' : 'CREATOR';
  } else if (parts.length === 3 && /^[1-9]\d{0,8}$/.test(parts[0]!)) {
    chainId = Number(parts[0]);
    entityType = parts[1]!.toUpperCase() as EntityType;
    entityId = parts[2]!.toLowerCase();
  } else throw new Error('MALFORMED_TARGET');
  if (!['CREATOR','WALLET','TOKEN','LAUNCH'].includes(entityType)) throw new Error('UNSUPPORTED_ENTITY');
  if (!(entityType === 'LAUNCH' ? /^[0-9a-f]{64}$/ : /^0x[0-9a-f]{40}$/).test(entityId)) {
    throw new Error('MALFORMED_TARGET');
  }
  if (chainId !== 5042) throw new Error('UNSUPPORTED_CHAIN');
  return { chainId, entityType, entityId };
}
export function entityKey(entity: Entity): string {
  return `${entity.chainId}:${entity.entityType}:${entity.entityId}`;
}

export async function makeReceipt(
  subject: Entity, refs: EvidenceRef[], asOfBlock: string, now: number,
  claim: Receipt['claim'] = 'INDEXED_LAUNCH_EVIDENCE', discovery?: DiscoveryDetails
): Promise<Receipt> {
  if (!refs.length) throw new Error('EVIDENCE_UNAVAILABLE');
  const content = {
    version: 'binrat.finding/1' as const, chainId: subject.chainId, subject,
    timestamp: { blockNumber: refs[0]!.blockNumber, eventTime: null, ingestedAtMs: refs[0]!.ingestedAtMs },
    epistemicClass: 'OBSERVED' as const, claim, evidenceRefs: refs,
    coverage: { status: 'PARTIAL' as const, scope: 'ARCPAD_INDEXED_LAUNCHES' as const, asOfBlock, limit: 5 },
    source: 'ARCPAD' as const,
    ...(discovery ? { discovery } : {})
  };
  const id = await sha256Hex(content);
  return { ...content, findingId: id, caseId: id, shareId: id.slice(0, 40), createdAt: now };
}

export function attentionDecision(canonical: boolean, explicitFutureWatch: boolean): Attention {
  return !canonical ? 'IGNORE' : explicitFutureWatch ? 'ALERT' : 'REMEMBER';
}

export function renderReceipt(r: Receipt, mode: 'DIG' | 'WHY' | 'ALERT'): string {
  const discovery = r.discovery ? [
    ...r.discovery.reasons.map(reason => `${reason.epistemicClass}: ${reason.text}`),
    `Discovery rule: ${r.discovery.ruleVersion} · source checkpoint ${r.discovery.sourceCheckpoint}.`
  ] : [];
  return [
    mode === 'ALERT' ? '🐀 FOUND SOMETHING.' : mode === 'WHY' ? '🐀 receipts, not guesses.' : '🐀 dug through it.',
    `Arc ${r.chainId} · ${r.subject.entityType} ${r.subject.entityId}`,
    ...r.evidenceRefs.map(e => `OBSERVED: ArcPad reported creator ${e.creator}\nlaunch ${e.launchId}\nblock ${e.blockNumber} · tx ${e.txHash} · log ${e.logIndex}`),
    mode === 'ALERT' ? 'DERIVED: the reported creator exactly matches your explicit future watch.' :
      `DERIVED: ${r.evidenceRefs.length} referenced launch record(s) match this subject.`,
    ...discovery,
    `Coverage: PARTIAL · indexed ArcPad launches only · up to ${r.coverage.limit} records · as of block ${r.coverage.asOfBlock}.`,
    'UNKNOWN: human identity, intent, safety and future outcome. Same address != same human identity.',
    `caseId: ${r.caseId}`,
    `shareId: ${r.shareId}`,
    mode === 'WHY' ? r.evidenceRefs.map(e => `source: ${e.observationId}\nfact: ${e.factId}\ndigest: ${e.evidenceDigest}\nblock hash: ${e.blockHash}`).join('\n') : `/why ${r.caseId}`,
    mode === 'DIG' ? `/watch 5042:CREATOR:${r.evidenceRefs[0]!.creator}` : '',
    `/share ${r.caseId}`
  ].filter(Boolean).join('\n\n');
}
