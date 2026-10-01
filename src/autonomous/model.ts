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
export interface DiscoveryLaunchContext {
  launchId: string;
  token: string;
  symbol: string;
  name: string;
  blockNumber: string;
}
export interface DiscoveryDetails {
  ruleVersion: 'RATS_CREATOR_RECURRENCE_V1' | 'RATS_PONS_DEPLOYER_RECURRENCE_V1';
  reasons: DiscoveryReason[];
  sourceCheckpoint: string;
  /** New Pons discovery receipts may retain up to three prior launches for
   * human-facing Trash Trail context. Older receipts remain valid without it. */
  previousLaunches?: DiscoveryLaunchContext[];
}
export interface Receipt {
  version: 'binrat.finding/1';
  findingId: string; caseId: string; shareId: string;
  chainId: number; subject: Entity;
  timestamp: { blockNumber: string; eventTime: null; ingestedAtMs: number };
  epistemicClass: 'OBSERVED' | 'DERIVED';
  claim: 'INDEXED_LAUNCH_EVIDENCE' | 'CREATOR_LAUNCH_OBSERVED';
  evidenceRefs: EvidenceRef[];
  coverage: { status: 'PARTIAL'; scope: 'ARCPAD_INDEXED_LAUNCHES' | 'PONS_V2_INDEXED_LAUNCHES'; asOfBlock: string; limit: number };
  source: 'ARCPAD' | 'PONS_V2'; createdAt: number;
  discovery?: DiscoveryDetails;
}

export function parseTarget(input: string): Entity {
  const raw = input.trim();
  if (raw.length > 160) throw new Error('MALFORMED_TARGET');
  const parts = raw.split(':');
  let chainId = 4663;
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
  if (chainId !== 5042 && chainId !== 4663) throw new Error('UNSUPPORTED_CHAIN');
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
    coverage: { status: 'PARTIAL' as const, scope: (subject.chainId === 4663 ? 'PONS_V2_INDEXED_LAUNCHES' : 'ARCPAD_INDEXED_LAUNCHES') as Receipt['coverage']['scope'], asOfBlock, limit: 5 },
    source: (subject.chainId === 4663 ? 'PONS_V2' : 'ARCPAD') as Receipt['source'],
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
    `${r.source === 'PONS_V2' ? 'Robinhood/Pons' : 'Arc'} ${r.chainId} · ${r.subject.entityType} ${r.subject.entityId}`,
    ...r.evidenceRefs.map(e => `OBSERVED: ${r.source === 'PONS_V2' ? 'Pons reported deployer' : 'ArcPad reported creator'} ${e.creator}\nlaunch ${e.launchId}\nblock ${e.blockNumber} · tx ${e.txHash} · log ${e.logIndex}`),
    mode === 'ALERT' ? 'DERIVED: the reported creator exactly matches your explicit future watch.' :
      `DERIVED: ${r.evidenceRefs.length} referenced launch record(s) match this subject.`,
    ...discovery,
    `Coverage: PARTIAL · ${r.source === 'PONS_V2' ? 'indexed Pons V2 launches only' : 'indexed ArcPad launches only'} · up to ${r.coverage.limit} records · as of block ${r.coverage.asOfBlock}.`,
    'UNKNOWN: human identity, intent, safety and future outcome. Same address != same human identity.',
    `caseId: ${r.caseId}`,
    `shareId: ${r.shareId}`,
    mode === 'WHY' ? r.evidenceRefs.map(e => `source: ${e.observationId}\nfact: ${e.factId}\ndigest: ${e.evidenceDigest}\nblock hash: ${e.blockHash}`).join('\n') : `/why ${r.caseId}`,
    mode === 'DIG' ? `/watch ${r.chainId}:CREATOR:${r.evidenceRefs[0]!.creator}` : '',
    `/share ${r.caseId}`
  ].filter(Boolean).join('\n\n');
}
