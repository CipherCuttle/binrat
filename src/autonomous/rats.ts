import type { D1DatabaseLike } from '../cloudflare/d1Types.js';
import { sha256Hex } from '../evidence/canonical.js';
import { authoritativeCheckpoint, evidenceForLaunch, saveCase } from './evidence.js';
import { makeReceipt, type DiscoveryReason, type Entity, type EvidenceRef, type Receipt } from './model.js';

export const RATS_RULE_VERSION = 'RATS_PONS_DEPLOYER_RECURRENCE_V1' as const;
const MAX_CANDIDATES = 5;
const MAX_EVIDENCE_PER_CANDIDATE = 5;
const SNAPSHOT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RETAINED_SNAPSHOTS = 200;

export interface RatsCandidate {
  entity: Entity;
  reasons: DiscoveryReason[];
  evidenceRefs: EvidenceRef[];
  caseId: string;
  rankPosition: number;
}
export interface RatsSnapshot {
  discoveryId: string;
  chainId: 4663;
  generatedAt: number;
  sourceCheckpoint: string;
  coverage: Receipt['coverage'];
  ruleVersion: typeof RATS_RULE_VERSION;
  candidates: RatsCandidate[];
}

interface CandidateRow { creator: string; recurrence_count: number; latest_block: string }

/**
 * Shared discovery only: verified reported creators with at least two retained,
 * canonical launch facts. Sort tuple is recurrence DESC, latest block DESC,
 * retained evidence count DESC, exact normalized address ASC. No financial field
 * or opaque composite score participates in this ranking.
 */
export async function discoverRats(db: D1DatabaseLike, now: number, candidateLimit = MAX_CANDIDATES): Promise<RatsSnapshot> {
  const chainId = 4663;
  const tip = await authoritativeCheckpoint(db, now, chainId);
  const limit = Math.max(1, Math.min(MAX_CANDIDATES, candidateLimit));
  await pruneSnapshots(db, now);
  const rows = await db.prepare(`SELECT l.creator, COUNT(DISTINCT l.launch_id) AS recurrence_count,
      MAX(CAST(l.block_number AS INTEGER)) AS latest_block
    FROM launches l JOIN provenance_facts f ON f.launch_id=l.launch_id AND f.chain_id=l.chain_id
    WHERE l.chain_id=? AND l.source='PONS_V2' AND CAST(l.block_number AS INTEGER)<=?
    GROUP BY l.creator HAVING COUNT(DISTINCT l.launch_id)>=2
    ORDER BY recurrence_count DESC, latest_block DESC, l.creator ASC LIMIT ?`)
    .bind(chainId, Number(tip), limit).all<CandidateRow>();
  if (!rows.success) throw new Error('DISCOVERY_UNAVAILABLE');

  const candidates: RatsCandidate[] = [];
  for (const row of rows.results ?? []) {
    if (!/^0x[0-9a-f]{40}$/.test(row.creator) || !Number.isSafeInteger(Number(row.recurrence_count)) ||
        Number(row.recurrence_count) < 2 || !/^\d+$/.test(String(row.latest_block))) continue;
    const refsRows = await db.prepare(`SELECT launch_id FROM launches WHERE chain_id=? AND creator=?
      AND CAST(block_number AS INTEGER)<=? ORDER BY CAST(block_number AS INTEGER) DESC,log_index DESC,launch_id DESC LIMIT ?`)
      .bind(chainId, row.creator, Number(tip), MAX_EVIDENCE_PER_CANDIDATE).all<{ launch_id: string }>();
    if (!refsRows.success || (refsRows.results?.length ?? 0) < 2) continue;
    try {
      const evidenceRefs = await Promise.all((refsRows.results ?? []).map(item => evidenceForLaunch(db, item.launch_id, tip, chainId)));
      // Claim only the bounded retained count: every displayed recurrence has a public receipt.
      const observedCount = evidenceRefs.length;
      const subject: Entity = { chainId, entityType: 'CREATOR', entityId: row.creator };
      const discovery = {
        ruleVersion: RATS_RULE_VERSION,
        sourceCheckpoint: tip.toString(),
        reasons: [
          { kind: 'RECURRENCE' as const, epistemicClass: 'DERIVED' as const,
            text: `Exact Pons-reported deployer appears across ${observedCount} retained indexed launches.`,
            evidenceRefs: evidenceRefs.map(ref => ref.factId) },
          { kind: 'RECENCY' as const, epistemicClass: 'OBSERVED' as const,
            text: `Latest retained launch receipt is at indexed block ${evidenceRefs[0]!.blockNumber}.`,
            evidenceRefs: [evidenceRefs[0]!.factId] }
        ]
      };
      const receipt = await saveCase(db, await makeReceipt(subject, evidenceRefs, tip.toString(), now,
        'INDEXED_LAUNCH_EVIDENCE', discovery));
      candidates.push({ entity: subject, reasons: discovery.reasons, evidenceRefs, caseId: receipt.caseId,
        rankPosition: candidates.length + 1 });
    } catch {
      // An incomplete/malformed candidate is not substituted with a weaker claim.
    }
  }
  const core = { chainId: 4663 as const, sourceCheckpoint: tip.toString(), ruleVersion: RATS_RULE_VERSION,
    candidates: candidates.map(({ entity, reasons, evidenceRefs, caseId, rankPosition }) =>
      ({ entity, reasons, evidenceRefs, caseId, rankPosition })) };
  const discoveryId = await sha256Hex(core);
  const existing = await db.prepare('SELECT snapshot_json FROM rat_v11_pons_discovery_snapshots WHERE discovery_id=? AND expires_at_ms>?')
    .bind(discoveryId, now).first<{ snapshot_json: string }>();
  if (existing) return parseSnapshot(existing.snapshot_json);
  const snapshot: RatsSnapshot = {
    discoveryId, chainId:4663, generatedAt: now, sourceCheckpoint: tip.toString(),
    coverage: { status:'PARTIAL', scope:'PONS_V2_INDEXED_LAUNCHES', asOfBlock:tip.toString(), limit:MAX_EVIDENCE_PER_CANDIDATE },
    ruleVersion: RATS_RULE_VERSION, candidates
  };
  const saved = await db.prepare(`INSERT OR IGNORE INTO rat_v11_pons_discovery_snapshots
    (discovery_id,chain_id,source_checkpoint,rule_version,coverage_status,snapshot_json,generated_at_ms,expires_at_ms)
    VALUES (?,?,?,?,?,?,?,?)`).bind(discoveryId,4663,tip.toString(),RATS_RULE_VERSION,'PARTIAL',JSON.stringify(snapshot),now,now+SNAPSHOT_RETENTION_MS).run();
  if (!saved.success) throw new Error('DISCOVERY_WRITE_FAILED');
  await pruneSnapshots(db, now);
  return snapshot;
}

/** Navigation reuses this exact persisted discovery receipt; it never trusts callback candidate data. */
export async function loadRatsSnapshot(db: D1DatabaseLike, discoveryId: string, now: number): Promise<RatsSnapshot> {
  if (!/^[0-9a-f]{64}$/.test(discoveryId)) throw new Error('DISCOVERY_UNAVAILABLE');
  const row = await db.prepare(`SELECT snapshot_json FROM rat_v11_pons_discovery_snapshots
    WHERE discovery_id=? AND expires_at_ms>?`).bind(discoveryId,now).first<{snapshot_json:string}>();
  if (!row) throw new Error('DISCOVERY_UNAVAILABLE');
  const snapshot = parseSnapshot(row.snapshot_json);
  if (snapshot.discoveryId !== discoveryId) throw new Error('DISCOVERY_UNAVAILABLE');
  return snapshot;
}

export function renderRats(snapshot: RatsSnapshot): string {
  if (snapshot.candidates.length === 0) return [
    '🐀 empty paws. No repeated Pons-reported deployers in the current indexed coverage.',
    `Coverage: PARTIAL · indexed Pons V2 launches only · as of block ${snapshot.sourceCheckpoint}.`,
    'No profitability, safety or identity conclusion.'
  ].join('\n\n');
  return [
    '🐀 RATS WORTH WATCHING',
    snapshot.candidates.map(candidate => [
      `${candidate.rankPosition}. Robinhood/Pons 4663 · DEPLOYER ${candidate.entity.entityId}`,
      'Observed / derived:',
      ...candidate.reasons.map(reason => `• ${reason.text}`),
      'Coverage: PARTIAL · indexed Pons V2 launches only.',
      `WHY: /why ${candidate.caseId}`,
      `WATCH: /watch 4663:CREATOR:${candidate.entity.entityId}`,
      `SHARE: /share ${candidate.caseId}`
    ].join('\n')).join('\n\n'),
    `Discovery ${snapshot.discoveryId.slice(0,12)} · source checkpoint ${snapshot.sourceCheckpoint}.`,
    '🐀 receipts, not guesses. Same address != same human identity.'
  ].join('\n\n');
}

async function pruneSnapshots(db: D1DatabaseLike, now: number): Promise<void> {
  const expired = await db.prepare('DELETE FROM rat_v11_pons_discovery_snapshots WHERE expires_at_ms<=?').bind(now).run();
  const bounded = await db.prepare(`DELETE FROM rat_v11_pons_discovery_snapshots WHERE discovery_id IN (
    SELECT discovery_id FROM rat_v11_pons_discovery_snapshots ORDER BY generated_at_ms DESC,discovery_id DESC LIMIT -1 OFFSET ?
  )`).bind(MAX_RETAINED_SNAPSHOTS).run();
  if (!expired.success || !bounded.success) throw new Error('DISCOVERY_RETENTION_FAILED');
}

function parseSnapshot(input: string): RatsSnapshot {
  const value = JSON.parse(input) as RatsSnapshot;
  if (value.chainId !== 4663 || value.ruleVersion !== RATS_RULE_VERSION || !Array.isArray(value.candidates) ||
      value.candidates.length > MAX_CANDIDATES) throw new Error('DISCOVERY_UNAVAILABLE');
  return value;
}
