/** Owner-only portable authority. This never grants historical publication authority. */
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { verifyCaseEnvelope, validateCaseRecord, type CaseEnvelope, type CaseRecord } from './caseEvidence.js';

export const FORWARD_V1 = 'binrat.pons-forward/1' as const;
export const FORWARD_FACTORY = '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e';
export const FORWARD_CODE_HASH = '0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84';
// Poll authority/anchor/recheck reads plus one exact-filter getLogs request.
// Each covered block still needs its header and complete receipt proof.
export const FORWARD_POLL_FIXED_REQUESTS = 11;
export const FORWARD_LIMITS = Object.freeze({ requests: 50, admissionRequests: 8,
  blocks: Math.floor((50 - FORWARD_POLL_FIXED_REQUESTS) / 2),
  events: 20, transactionsPerBlock: 128, logsPerBlock: 1024, freshnessMs: 60_000, confirmations: 2 });
export type ForwardState = 'HISTORY_INCOMPLETE' | 'FORWARD_COVERAGE_VERIFIED' | 'NO_EVENT_YET' |
  'SOURCE_UNAVAILABLE' | 'COVERAGE_UNKNOWN' | 'REORG_BLOCKED' | 'CASE_RETURN_UNAVAILABLE' | 'CANCELLED' | 'PROVIDER_RECONCILED';
export interface ForwardPoint { block: string; hash: string; parentHash: string; receiptsRoot: string; timestampMs: number }
export interface LiveSourcePolicyV2 {
  kind: 'ALCHEMY_LOGS_RECONCILED_V2'; canaryId: string; ownerId: string; tariffDigest: string;
  finality: 'FINALIZED_TAG'; maxRangeBlocks: number; auditMs: number; absenceProven: false;
}
export interface ForwardAuthority {
  schemaVersion: typeof FORWARD_V1; chainId: 4663; factory: string; factoryCodeHash: string;
  ownerId: string; chatId: number; generation: string; deployer: string; consentAtMs: number;
  originalCase: CaseEnvelope;
  historicalCheckpoint: { block: string; hash: string };
  historicalGap: { state: 'UNKNOWN_COVERAGE'; fromBlock: string; throughBlock: string };
  boundary: ForwardPoint;
  liveSource?: LiveSourcePolicyV2;
}
export interface ForwardRange {
  schemaVersion: typeof FORWARD_V1; generation: string; deployer: string;
  fromBlock: string; throughBlock: string; predecessor: ForwardPoint; headers: ForwardPoint[];
  previousReceiptDigest: string | null; verifiedAtMs: number;
  completeness: { kind: 'FULL_BLOCK_RECEIPTS_V1'; blocks: number; transactions: number;
    matchingEvents: number; responseDigest: string } | {
    kind: 'PROVIDER_RECONCILED_V2'; blocks: number; transactions: number; matchingEvents: number; responseDigest: string;
    absenceProven: false; policyDigest: string; finalized: ForwardPoint; verifiedPositiveBlocks: string[];
    subscriptionEpoch: number; logSetDigest: string; hintsDigest: string;
  };
}
export interface ForwardCaseMaterial {
  schemaVersion: typeof FORWARD_V1; reconstruction: 'OWNER_FORWARD_FINDING_V1';
  authority: ForwardAuthority; range: ForwardRange; rangeDigest: string; record: CaseRecord;
}
export interface ForwardCaseEnvelope { material: ForwardCaseMaterial; digest: string }
export interface ForwardStatus {
  schemaVersion: typeof FORWARD_V1; authority: ForwardAuthority; state: ForwardState;
  historyState: 'HISTORY_INCOMPLETE'; historicalGapState: 'UNKNOWN_COVERAGE';
  cursor: { block: string; hash: string }; latestReceiptDigest: string | null;
  sourceVerifiedAtMs: number | null; sourceTargetBlock: string | null; failure: string | null;
  scope: 'OWNER_EXACT_DEPLOYER_FORWARD_ONLY';
  caseReturns: { caseId: string; generation: string; digest: string }[];
  coverageStatement?: 'PROVIDER_RECONCILED_ABSENCE_UNKNOWN';
}
export function forwardRequire(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}
const hash = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-f]{64}$/.test(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const block = (v: unknown): v is string => typeof v === 'string' && /^(0|[1-9]\d*)$/.test(v) && BigInt(v) <= BigInt(Number.MAX_SAFE_INTEGER);
const time = (v: number) => Number.isSafeInteger(v) && v >= 0;
export function validateForwardPoint(p: ForwardPoint) {
  forwardRequire(p && block(p.block) && hash(p.hash) && hash(p.parentHash) && hash(p.receiptsRoot) && time(p.timestampMs), 'FORWARD_POINT_INVALID');
}
export async function verifyForwardAuthority(a: ForwardAuthority) {
  forwardRequire(a && a.schemaVersion === FORWARD_V1 && a.chainId === 4663 && a.factory === FORWARD_FACTORY &&
    a.factoryCodeHash === FORWARD_CODE_HASH && Number.isSafeInteger(a.chatId) && a.chatId > 0 &&
    a.ownerId === `telegram:${a.chatId}` && /^[0-9a-f-]{36}$/.test(a.generation) &&
    /^0x[0-9a-f]{40}$/.test(a.deployer) && time(a.consentAtMs), 'FORWARD_AUTHORITY_INVALID');
  validateForwardPoint(a.boundary);
  forwardRequire(a.boundary.timestampMs >= a.consentAtMs && block(a.historicalCheckpoint.block) &&
    hash(a.historicalCheckpoint.hash) && BigInt(a.boundary.block) > BigInt(a.historicalCheckpoint.block) &&
    a.historicalGap.state === 'UNKNOWN_COVERAGE' && a.historicalGap.fromBlock === String(BigInt(a.historicalCheckpoint.block) + 1n) &&
    a.historicalGap.throughBlock === a.boundary.block, 'FORWARD_HISTORY_SCOPE_INVALID');
  const original = a.originalCase;
  if (a.liveSource) {
    const p = a.liveSource;
    forwardRequire(p.kind === 'ALCHEMY_LOGS_RECONCILED_V2' && /^[A-Za-z0-9_-]{1,80}$/.test(p.canaryId) &&
      p.ownerId === a.ownerId && id(p.tariffDigest) && p.finality === 'FINALIZED_TAG' && p.absenceProven === false &&
      Number.isSafeInteger(p.maxRangeBlocks) && p.maxRangeBlocks > 0 && p.maxRangeBlocks <= 50000 &&
      Number.isSafeInteger(p.auditMs) && p.auditMs > 0 && p.auditMs <= 60000, 'FORWARD_LIVE_POLICY_INVALID');
  }
  await verifyCaseEnvelope(original, original.material.caseId, original.material.publication);
  forwardRequire(original.material.publication.checkpointBlock === a.historicalCheckpoint.block &&
    original.material.publication.checkpointBlockHash === a.historicalCheckpoint.hash &&
    original.material.records.some(r => r.launch.launchId === original.material.caseId && r.launch.creator === a.deployer),
  'FORWARD_ORIGINAL_CASE_INVALID');
  return a;
}
export async function verifyForwardRange(r: ForwardRange, a: ForwardAuthority) {
  forwardRequire(r && r.schemaVersion === FORWARD_V1 && r.generation === a.generation && r.deployer === a.deployer &&
    block(r.fromBlock) && block(r.throughBlock) && time(r.verifiedAtMs) &&
    r.verifiedAtMs >= a.consentAtMs && (r.previousReceiptDigest === null || id(r.previousReceiptDigest)), 'FORWARD_RANGE_INVALID');
  validateForwardPoint(r.predecessor);
  const count = Number(BigInt(r.throughBlock) - BigInt(r.fromBlock) + 1n);
  if (r.completeness?.kind === 'PROVIDER_RECONCILED_V2') {
    const c = r.completeness, p = a.liveSource;
    forwardRequire(p && count > 0 && count <= p.maxRangeBlocks && c.absenceProven === false &&
      c.policyDigest === await sha256Hex(p) && c.blocks === count && id(c.responseDigest) && id(c.logSetDigest) && id(c.hintsDigest) &&
      Number.isSafeInteger(c.subscriptionEpoch) && c.subscriptionEpoch >= 0 &&
      Number.isSafeInteger(c.matchingEvents) && c.matchingEvents >= 0 && c.matchingEvents <= FORWARD_LIMITS.events &&
      Number.isSafeInteger(c.transactions) && c.transactions >= 0 && c.transactions <= FORWARD_LIMITS.events * FORWARD_LIMITS.transactionsPerBlock &&
      BigInt(r.predecessor.block) + 1n === BigInt(r.fromBlock) && BigInt(r.fromBlock) > BigInt(a.boundary.block),
    'FORWARD_LIVE_RANGE_INVALID');
    validateForwardPoint(c.finalized);
    forwardRequire(BigInt(c.finalized.block) >= BigInt(r.throughBlock) && c.finalized.timestampMs <= r.verifiedAtMs &&
      r.headers.length > 0 && r.headers.length <= FORWARD_LIMITS.events + 1 &&
      Array.isArray(c.verifiedPositiveBlocks) && c.verifiedPositiveBlocks.length <= FORWARD_LIMITS.events &&
      new Set(c.verifiedPositiveBlocks).size === c.verifiedPositiveBlocks.length &&
      c.verifiedPositiveBlocks.length <= c.matchingEvents &&
      (c.matchingEvents === 0 ? c.verifiedPositiveBlocks.length === 0 : c.verifiedPositiveBlocks.length > 0), 'FORWARD_FINALITY_UNAVAILABLE');
    const seen = new Set<string>();
    for (const h of r.headers) {
      validateForwardPoint(h);
      forwardRequire(!seen.has(h.block) && BigInt(h.block) >= BigInt(r.fromBlock) && BigInt(h.block) <= BigInt(r.throughBlock) &&
        h.timestampMs >= r.predecessor.timestampMs && h.timestampMs <= c.finalized.timestampMs, 'FORWARD_LIVE_HEADER_INVALID');
      seen.add(h.block);
    }
    forwardRequire(r.headers.at(-1)!.block === r.throughBlock && c.verifiedPositiveBlocks.every(b => seen.has(b)) &&
      r.headers.every(h => h.block === r.throughBlock || c.verifiedPositiveBlocks.includes(h.block)), 'FORWARD_LIVE_HEADER_INVALID');
    if (r.throughBlock === c.finalized.block) forwardRequire(r.headers.at(-1)!.hash === c.finalized.hash, 'FORWARD_FINALITY_DRIFT');
    if (r.predecessor.block === a.boundary.block) forwardRequire(r.predecessor.hash === a.boundary.hash &&
      r.predecessor.timestampMs === a.boundary.timestampMs && r.previousReceiptDigest === null, 'FORWARD_BOUNDARY_DRIFT');
    return r; // Provider-reconciled continuity only; never an absence/completeness proof.
  }
  forwardRequire(!a.liveSource, 'FORWARD_LIVE_POLICY_MISMATCH');
  forwardRequire(count > 0 && count <= FORWARD_LIMITS.blocks && r.headers.length === count &&
    BigInt(r.predecessor.block) + 1n === BigInt(r.fromBlock) && BigInt(r.fromBlock) > BigInt(a.boundary.block), 'FORWARD_RANGE_DISCONTIGUOUS');
  if (r.predecessor.block === a.boundary.block) forwardRequire(r.predecessor.hash === a.boundary.hash &&
    r.predecessor.timestampMs === a.boundary.timestampMs && r.previousReceiptDigest === null, 'FORWARD_BOUNDARY_DRIFT');
  for (let i = 0; i < count; i++) {
    const p = r.headers[i]; validateForwardPoint(p);
    forwardRequire(BigInt(p.block) === BigInt(r.fromBlock) + BigInt(i) &&
      p.parentHash === (i ? r.headers[i - 1].hash : r.predecessor.hash) &&
      p.timestampMs >= (i ? r.headers[i - 1].timestampMs : r.predecessor.timestampMs) &&
      p.timestampMs <= r.verifiedAtMs, 'FORWARD_RANGE_HEADER_INVALID');
  }
  const c = r.completeness;
  forwardRequire(c?.kind === 'FULL_BLOCK_RECEIPTS_V1' && c.blocks === count &&
    Number.isSafeInteger(c.transactions) && c.transactions >= 0 && c.transactions <= count * FORWARD_LIMITS.transactionsPerBlock &&
    Number.isSafeInteger(c.matchingEvents) && c.matchingEvents >= 0 && c.matchingEvents <= FORWARD_LIMITS.events && id(c.responseDigest),
  'FORWARD_COMPLETENESS_UNAVAILABLE');
  return r;
}
/** Verifies durable portable evidence, independently of the public Case API.
 * Source canonicality is attested by the trusted local range verifier, as with
 * historical Cases; the envelope digest is integrity, not a chain signature. */
export async function verifyForwardCase(value: unknown, expected: { ownerId: string; generation: string; caseId: string }): Promise<ForwardCaseEnvelope> {
  forwardRequire(value && typeof value === 'object' && JSON.stringify(value).length <= 131072, 'CASE_RETURN_UNAVAILABLE');
  const e = value as ForwardCaseEnvelope, m = e.material;
  forwardRequire(m?.schemaVersion === FORWARD_V1 && m.reconstruction === 'OWNER_FORWARD_FINDING_V1' &&
    m.authority.ownerId === expected.ownerId && m.authority.generation === expected.generation &&
    m.record.launch.launchId === expected.caseId && id(e.digest) && await sha256Hex(m) === e.digest,
  'CASE_RETURN_UNAVAILABLE');
  await verifyForwardAuthority(m.authority);
  await verifyForwardRange(m.range, m.authority);
  const record = await validateCaseRecord(m.record), l = record.launch;
  const header = m.range.headers.find(p => p.block === l.blockNumber);
  if (m.range.completeness.kind === 'PROVIDER_RECONCILED_V2') forwardRequire(
    m.range.completeness.verifiedPositiveBlocks.includes(l.blockNumber), 'CASE_RETURN_UNAVAILABLE');
  forwardRequire(m.rangeDigest === await sha256Hex(m.range) && header?.hash === l.blockHash &&
    header.timestampMs > m.authority.consentAtMs && l.creator === m.authority.deployer &&
    BigInt(l.blockNumber) > BigInt(m.authority.boundary.block) && m.range.completeness.matchingEvents > 0,
  'CASE_RETURN_UNAVAILABLE');
  return JSON.parse(canonicalJson(e)) as ForwardCaseEnvelope;
}
