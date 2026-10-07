import type { D1DatabaseLike } from '../cloudflare/d1Types.js';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { authoritativeCheckpoint, evidenceForLaunch, saveCase } from './evidence.js';
import { makeReceipt, type DiscoveryReason, type Entity, type EvidenceRef, type Receipt } from './model.js';
import { buildProvenanceFact } from '../intelligence/provenance.js';
import type { Hex, LaunchObserved } from '../core/types.js';
import { verifiedRuntimeTarget, type D1RuntimeState } from '../cloudflare/runtimeState.js';

export const RATS_RULE_VERSION = 'RATS_PONS_DEPLOYER_RECURRENCE_V1' as const;
const MAX_CANDIDATES = 5;
const MAX_EVIDENCE_PER_CANDIDATE = 5;
const SNAPSHOT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RETAINED_SNAPSHOTS = 200;
// RATS is an attention surface, not a historical leaderboard. At the current
// Robinhood/Pons block cadence this is roughly a several-hour freshness window.
export const RATS_RECENT_BLOCK_WINDOW = 200_000n;

export interface RatsCandidate {
  entity: Entity;
  reasons: DiscoveryReason[];
  evidenceRefs: EvidenceRef[];
  caseId: string;
  rankPosition: number;
  recurrenceCount: number;
  latestLaunch: {
    launchId: string;
    token: string;
    symbol: string;
    name: string;
    blockNumber: string;
  };
  /** New snapshots retain up to three immediately prior launches for user-facing context.
   * Older persisted snapshots may not have this field and remain readable. */
  previousLaunches?: Array<{
    launchId: string;
    token: string;
    symbol: string;
    name: string;
    blockNumber: string;
  }>;
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
interface CandidateLaunchRow { launch_id: string; token: string; symbol: string; name: string; block_number: string }

export interface LatestPonsLaunch {
  launchId: string;
  token: string;
  symbol: string;
  name: string;
  blockNumber: string;
  txHash: string;
  deployer: string;
  priorLaunchCount: number;
  factId: string;
  metadata: {
    imageUri: string;
    website: string;
    twitter: string;
    telegram: string;
  };
}

interface LatestLaunchRow {
  launch_id: string;
  event_id: string;
  chain_id: number;
  block_hash: `0x${string}`;
  source: 'ARCPAD' | 'PONS_V2';
  launcher: `0x${string}`;
  log_index: number;
  pool: `0x${string}`;
  observed_at_ms: number;
  token: Hex;
  symbol: string;
  name: string;
  block_number: string;
  tx_hash: Hex;
  creator: Hex;
  image_uri: string;
  website: string;
  twitter: string;
  telegram: string;
  prior_launch_count: number;
  fact_payload_json: string;
  fact_id: string;
  fact_evidence_digest: string;
}

interface VerifiedSnapshotAnchor {
  chain_id: number;
  block_number: string;
  block_hash: string;
  source_verified: number;
  live_caught_up: number;
  head_block: string | null;
  target_block: string | null;
  observation_ready: number;
  history_backfill_complete: number;
  history_backfill_target_block: string | null;
  last_sync_error: string | null;
  last_history_error: string | null;
  last_observation_error: string | null;
  updated_at_ms: number;
}

export async function latestPonsLaunchSnapshot(
  db: D1DatabaseLike,
  now: number,
  requestedLimit = 20
): Promise<{ sourceCheckpoint: string; checkpointBlockHash: string; launches: LatestPonsLaunch[] }> {
  const chainId = 4663;
  const anchor = await db.prepare(`SELECT c.chain_id,c.block_number,c.block_hash,
      r.source_verified,r.live_caught_up,r.head_block,r.target_block,r.observation_ready,
      r.history_backfill_complete,r.history_backfill_target_block,r.last_sync_error,
      r.last_history_error,r.last_observation_error,r.updated_at_ms
    FROM chain_checkpoints c JOIN binrat_runtime_state r ON r.chain_id=c.chain_id
    WHERE c.chain_id=? LIMIT 1`).bind(chainId).first<VerifiedSnapshotAnchor>();
  if (!anchor || !/^(0|[1-9]\d*)$/.test(anchor.block_number) || !/^0x[0-9a-f]{64}$/.test(anchor.block_hash)) {
    throw new Error('LATEST_LAUNCHES_UNAVAILABLE');
  }
  const runtime: D1RuntimeState = {
    chainId:anchor.chain_id,sourceVerified:anchor.source_verified===1,liveCaughtUp:anchor.live_caught_up===1,
    headBlock:anchor.head_block===null?null:BigInt(anchor.head_block),targetBlock:anchor.target_block===null?null:BigInt(anchor.target_block),
    observationReady:anchor.observation_ready===1,historyBackfillComplete:anchor.history_backfill_complete===1,
    historyBackfillTargetBlock:anchor.history_backfill_target_block===null?null:BigInt(anchor.history_backfill_target_block),
    lastSyncError:anchor.last_sync_error,lastHistoryError:anchor.last_history_error,
    lastObservationError:anchor.last_observation_error,updatedAtMs:anchor.updated_at_ms
  };
  const tip = verifiedRuntimeTarget(runtime,BigInt(anchor.block_number),now,180_000);
  if (tip === null || tip !== BigInt(anchor.block_number)) throw new Error('LATEST_LAUNCHES_UNAVAILABLE');
  const limit = Math.max(1, Math.min(20, requestedLimit));
  const result = await db.prepare(`SELECT l.launch_id,l.event_id,l.chain_id,l.block_number,l.block_hash,l.source,l.launcher,l.log_index,
      l.token,l.symbol,l.name,l.tx_hash,l.creator,l.pool,l.observed_at_ms,
      l.image_uri,l.website,l.twitter,l.telegram,
      (SELECT COUNT(*)
       FROM launches p JOIN provenance_facts pf ON pf.launch_id=p.launch_id AND pf.chain_id=p.chain_id
       WHERE p.chain_id=l.chain_id AND p.source='PONS_V2' AND p.creator=l.creator
         AND CAST(p.block_number AS INTEGER)<=?
         AND (
           CAST(p.block_number AS INTEGER)<CAST(l.block_number AS INTEGER)
           OR (CAST(p.block_number AS INTEGER)=CAST(l.block_number AS INTEGER) AND p.log_index<l.log_index)
           OR (CAST(p.block_number AS INTEGER)=CAST(l.block_number AS INTEGER) AND p.log_index=l.log_index AND p.launch_id<l.launch_id)
         )) AS prior_launch_count
    ,f.fact_id AS fact_id,f.payload_json AS fact_payload_json,f.evidence_digest AS fact_evidence_digest
    FROM launches l JOIN provenance_facts f ON f.launch_id=l.launch_id AND f.chain_id=l.chain_id
    WHERE l.chain_id=? AND l.source='PONS_V2' AND CAST(l.block_number AS INTEGER)<=?
    ORDER BY CAST(l.block_number AS INTEGER) DESC,l.log_index DESC,l.launch_id DESC LIMIT ?`)
    .bind(Number(tip),chainId,Number(tip),limit).all<LatestLaunchRow>();
  if (!result.success) throw new Error('LATEST_LAUNCHES_UNAVAILABLE');

  const output: LatestPonsLaunch[] = [];
  for (const row of result.results ?? []) {
    if (!/^[0-9a-f]{64}$/.test(row.launch_id) || !/^0x[0-9a-f]{40}$/.test(row.token) ||
        !/^0x[0-9a-f]{64}$/.test(row.tx_hash) || !/^0x[0-9a-f]{40}$/.test(row.creator) || !/^\d+$/.test(row.block_number) ||
        !Number.isSafeInteger(Number(row.prior_launch_count)) || Number(row.prior_launch_count) < 0 ||
        typeof row.symbol !== 'string' || typeof row.name !== 'string' ||
        typeof row.image_uri !== 'string' || typeof row.website !== 'string' ||
        typeof row.twitter !== 'string' || typeof row.telegram !== 'string') {
      throw new Error('LATEST_LAUNCHES_UNAVAILABLE');
    }
    // Re-validate the canonical provenance receipt for every launch we expose.
    const launch: LaunchObserved = {
      launchId:row.launch_id,eventId:row.event_id,chainId:row.chain_id,blockNumber:BigInt(row.block_number),
      blockHash:row.block_hash,source:row.source,launcher:row.launcher,txHash:row.tx_hash,logIndex:row.log_index,
      token:row.token,creator:row.creator,pool:row.pool,name:row.name,symbol:row.symbol,
      imageUri:row.image_uri,website:row.website,twitter:row.twitter,telegram:row.telegram,observedAtMs:row.observed_at_ms
    };
    const fact = await buildProvenanceFact(launch);
    if (row.fact_id !== fact.factId || row.fact_evidence_digest !== fact.evidenceDigest || row.fact_payload_json !== canonicalJson(fact) ||
        row.creator !== fact.creator || row.block_number !== fact.observedBlock.toString()) {
      throw new Error('LATEST_LAUNCHES_UNAVAILABLE');
    }
    output.push({
      launchId:row.launch_id,token:row.token,symbol:row.symbol,name:row.name,
      blockNumber:row.block_number,txHash:row.tx_hash,deployer:row.creator,
      priorLaunchCount:Number(row.prior_launch_count),factId:fact.factId,
      metadata:{imageUri:row.image_uri,website:row.website,twitter:row.twitter,telegram:row.telegram}
    });
  }
  return { sourceCheckpoint: tip.toString(), checkpointBlockHash: anchor.block_hash, launches: output };
}

export async function latestPonsLaunches(
  db: D1DatabaseLike,
  now: number,
  requestedLimit = 20
): Promise<LatestPonsLaunch[]> {
  return (await latestPonsLaunchSnapshot(db,now,requestedLimit)).launches;
}

/**
 * Shared discovery only: verified reported creators with at least two retained,
 * canonical launch facts. Sort tuple is latest block DESC, recurrence DESC,
 * exact normalized address ASC. This surfaces fresh repeat activity instead of
 * all-time high-volume deployers. No financial field
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
      AND MAX(CAST(l.block_number AS INTEGER))>=?
    ORDER BY latest_block DESC, recurrence_count DESC, l.creator ASC LIMIT ?`)
    .bind(chainId, Number(tip), Number(tip > RATS_RECENT_BLOCK_WINDOW ? tip-RATS_RECENT_BLOCK_WINDOW : 0n), limit).all<CandidateRow>();
  if (!rows.success) throw new Error('DISCOVERY_UNAVAILABLE');

  const candidates: RatsCandidate[] = [];
  for (const row of rows.results ?? []) {
    if (!/^0x[0-9a-f]{40}$/.test(row.creator) || !Number.isSafeInteger(Number(row.recurrence_count)) ||
        Number(row.recurrence_count) < 2 || !/^\d+$/.test(String(row.latest_block))) continue;
    const refsRows = await db.prepare(`SELECT launch_id,token,symbol,name,block_number FROM launches WHERE chain_id=? AND creator=?
      AND CAST(block_number AS INTEGER)<=? ORDER BY CAST(block_number AS INTEGER) DESC,log_index DESC,launch_id DESC LIMIT ?`)
      .bind(chainId, row.creator, Number(tip), MAX_EVIDENCE_PER_CANDIDATE).all<CandidateLaunchRow>();
    if (!refsRows.success || (refsRows.results?.length ?? 0) < 2) continue;
    try {
      const evidenceRefs = await Promise.all((refsRows.results ?? []).map(item => evidenceForLaunch(db, item.launch_id, tip, chainId)));
      // Claim only the bounded retained count: every displayed recurrence has a public receipt.
      const observedCount = evidenceRefs.length;
      const recurrenceCount = Number(row.recurrence_count);
      const latest = refsRows.results?.[0];
      if (!latest || !/^[0-9a-f]{64}$/.test(latest.launch_id) || !/^0x[0-9a-f]{40}$/.test(latest.token) ||
          typeof latest.symbol !== 'string' || typeof latest.name !== 'string' || !/^\d+$/.test(latest.block_number)) continue;
      const subject: Entity = { chainId, entityType: 'CREATOR', entityId: row.creator };
      const discovery = {
        ruleVersion: RATS_RULE_VERSION,
        sourceCheckpoint: tip.toString(),
        reasons: [
          { kind: 'RECURRENCE' as const, epistemicClass: 'DERIVED' as const,
            text: `Exact Pons-reported deployer appears across ${recurrenceCount} indexed launches; this card retains ${observedCount} receipts.`,
            evidenceRefs: evidenceRefs.map(ref => ref.factId) },
          { kind: 'RECENCY' as const, epistemicClass: 'OBSERVED' as const,
            text: `Latest retained launch receipt is at indexed block ${evidenceRefs[0]!.blockNumber}.`,
            evidenceRefs: [evidenceRefs[0]!.factId] }
        ]
      };
      const receipt = await saveCase(db, await makeReceipt(subject, evidenceRefs, tip.toString(), now,
        'INDEXED_LAUNCH_EVIDENCE', discovery));
      const previousLaunches=(refsRows.results ?? []).slice(1,4).flatMap(item =>
        /^[0-9a-f]{64}$/.test(item.launch_id) && /^0x[0-9a-f]{40}$/.test(item.token) &&
        typeof item.symbol === 'string' && typeof item.name === 'string' && /^\d+$/.test(item.block_number)
          ? [{launchId:item.launch_id,token:item.token,symbol:item.symbol,name:item.name,blockNumber:item.block_number}]
          : []
      );
      candidates.push({
        entity: subject, reasons: discovery.reasons, evidenceRefs, caseId: receipt.caseId,
        rankPosition: candidates.length + 1, recurrenceCount,
        latestLaunch: {
          launchId: latest.launch_id, token: latest.token, symbol: latest.symbol,
          name: latest.name, blockNumber: latest.block_number
        },
        previousLaunches
      });
    } catch {
      // An incomplete/malformed candidate is not substituted with a weaker claim.
    }
  }
  const core = { chainId: 4663 as const, sourceCheckpoint: tip.toString(), ruleVersion: RATS_RULE_VERSION,
    candidates: candidates.map(({ entity, reasons, evidenceRefs, caseId, rankPosition, recurrenceCount, latestLaunch, previousLaunches }) =>
      ({ entity, reasons, evidenceRefs, caseId, rankPosition, recurrenceCount, latestLaunch, previousLaunches })) };
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
    '🐀 FRESH FINDS · freshest repeat deployers',
    snapshot.candidates.map(candidate => {
      const prior=Math.max(1,candidate.recurrenceCount-1);
      const latest=candidate.latestLaunch.symbol ? String.fromCharCode(36) + candidate.latestLaunch.symbol : (candidate.latestLaunch.name || 'unnamed launch');
      const previous=(candidate.previousLaunches ?? []).map(item => item.symbol ? String.fromCharCode(36) + item.symbol : (item.name || item.token));
      return [
        `${candidate.rankPosition}. Recent repeat launch: ${latest}`,
        `Same deployer has ${prior} earlier indexed launch${prior===1?'':'es'}.`,
        previous.length ? `Previous: ${previous.join(' · ')}` : '',
        `WATCH NEXT LAUNCH: /watch 4663:CREATOR:${candidate.entity.entityId}`,
        `OPEN CASE: /why ${candidate.caseId}`
      ].filter(Boolean).join('\n');
    }).join('\n\n'),
    'Newest repeat activity first. Same address does not establish human identity.'
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
      value.candidates.length > MAX_CANDIDATES ||
      value.candidates.some(candidate => !Number.isSafeInteger(candidate.recurrenceCount) || candidate.recurrenceCount < 2 ||
        !candidate.latestLaunch || !/^\d+$/.test(candidate.latestLaunch.blockNumber) ||
        (candidate.previousLaunches !== undefined && (!Array.isArray(candidate.previousLaunches) ||
          candidate.previousLaunches.length > 3 || candidate.previousLaunches.some(item =>
            !/^[0-9a-f]{64}$/.test(item.launchId) || !/^0x[0-9a-f]{40}$/.test(item.token) ||
            typeof item.symbol !== 'string' || typeof item.name !== 'string' || !/^\d+$/.test(item.blockNumber)))))) {
    throw new Error('DISCOVERY_UNAVAILABLE');
  }
  return value;
}
