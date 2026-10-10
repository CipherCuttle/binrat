import { canonicalJson } from '../evidence/canonical.js';
import {
  PONS_OUTCOME_OBSERVATION_VERSION,
  parsePonsOutcomeObservationReceipt,
  type PonsOutcomeObservationLaunch,
  type PonsOutcomeObservationReceipt,
  type PonsOutcomeObservationStore
} from '../pons/outcomeReceipts.js';
import type { Hex } from '../core/types.js';
import type { D1DatabaseLike, D1ResultLike } from './d1Types.js';

export class D1PonsOutcomeObservationStore implements PonsOutcomeObservationStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async getCheckpoint(): Promise<{blockNumber: bigint; blockHash: Hex} | null> {
    const row = await this.db.prepare(
      'SELECT block_number,block_hash FROM chain_checkpoints WHERE chain_id=4663 LIMIT 1'
    ).first<{block_number: string; block_hash: Hex}>();
    return row
      ? {blockNumber: BigInt(row.block_number), blockHash: row.block_hash.toLowerCase() as Hex}
      : null;
  }

  async listCandidates(limit: number): Promise<PonsOutcomeObservationLaunch[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('PONS_OUTCOME_CANDIDATE_LIMIT_INVALID');
    }
    const result = await this.db.prepare(RECENT_OUTCOME_CANDIDATES_SQL).bind(limit)
      .all<{launch_id:string;token:Hex;pool:Hex;block_number:string;block_hash:Hex}>();
    if (!result.success) throw new Error('PONS_OUTCOME_CANDIDATE_QUERY_FAILED');
    return (result.results ?? []).map((row) => ({
      launchId: row.launch_id,
      token: row.token.toLowerCase() as Hex,
      curve: row.pool.toLowerCase() as Hex,
      blockNumber: BigInt(row.block_number),
      blockHash: row.block_hash.toLowerCase() as Hex
    }));
  }

  async listForLaunch(launchId: string): Promise<PonsOutcomeObservationReceipt[]> {
    const result = await this.db.prepare(`
      SELECT *,CASE WHEN length(payload_json)<=8192 THEN payload_json END AS bounded_payload
      FROM pons_outcome_receipts
      WHERE chain_id=4663 AND launch_id=?
      AND observation_version='BINRAT_PONS_OUTCOME_OBSERVATION_V1' AND horizon_ms IN (300000,3600000,86400000)
      ORDER BY horizon_ms LIMIT 3
    `).bind(launchId).all<Record<string,unknown>>();
    if (!result.success) throw new Error('PONS_OUTCOME_LIST_QUERY_FAILED');
    const receipts: PonsOutcomeObservationReceipt[] = [];
    for (const row of result.results ?? []) {
      if (typeof row.bounded_payload!=='string') throw new Error('PONS_OUTCOME_STORED_BINDING_INVALID');
      const r=await parsePonsOutcomeObservationReceipt(row.bounded_payload);
      const columns:Record<string,unknown>={observation_id:r.observationId,observation_version:r.observationVersion,
        chain_id:r.chainId,launch_id:r.launchId,token:r.token,curve:r.curve,horizon_ms:r.horizonMs,
        target_timestamp_ms:r.targetTimestampMs,observed_block:r.observedBlock.toString(),observed_block_hash:r.observedBlockHash,
        observed_timestamp_ms:r.observedTimestampMs,phase:r.phase,pair_token:r.pairToken,quote_decimals:r.quoteDecimals,
        estimated_fdv_quote_raw:r.estimatedFdvQuoteRaw?.toString()??null,status:r.status,evidence_digest:r.evidenceDigest};
      if (Object.entries(columns).some(([key,value])=>row[key]!==value)) throw new Error('PONS_OUTCOME_STORED_BINDING_INVALID');
      receipts.push(r);
    }
    return receipts;
  }

  async put(receipt: PonsOutcomeObservationReceipt): Promise<'INSERTED' | 'DUPLICATE'> {
    return this.write(receipt);
  }

  async putAuthorized(receipt:PonsOutcomeObservationReceipt,pilotId:string,nowMs:number,owner:string):Promise<'INSERTED'|'DUPLICATE'> {
    return this.write(receipt,{pilotId,nowMs,owner});
  }

  private async write(receipt:PonsOutcomeObservationReceipt,auth?:{pilotId:string;nowMs:number;owner:string}):Promise<'INSERTED'|'DUPLICATE'> {
    const payload = canonicalJson(receipt);
    const result = await this.db.prepare(`
      INSERT OR IGNORE INTO pons_outcome_receipts (
        observation_id,observation_version,chain_id,launch_id,token,curve,horizon_ms,
        target_timestamp_ms,observed_block,observed_block_hash,observed_timestamp_ms,
        phase,pair_token,quote_decimals,estimated_fdv_quote_raw,status,evidence_digest,payload_json
       ) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? ${auth ? `WHERE EXISTS (
        SELECT 1 FROM pons_outcome_pilots WHERE pilot_id=? AND enabled=1 AND valid_from_ms<=? AND expires_ms>?
        AND EXISTS (SELECT 1 FROM binrat_sync_leases WHERE lease_name='binrat:pons-sync' AND owner_token=? AND lease_until_ms>?)
        AND EXISTS (SELECT 1 FROM binrat_sync_leases WHERE lease_name='binrat:pons-outcome' AND owner_token=? AND lease_until_ms>?)
      )` : ''}
    `).bind(
      receipt.observationId,
      receipt.observationVersion,
      receipt.chainId,
      receipt.launchId,
      receipt.token,
      receipt.curve,
      receipt.horizonMs,
      receipt.targetTimestampMs,
      receipt.observedBlock.toString(),
      receipt.observedBlockHash,
      receipt.observedTimestampMs,
      receipt.phase,
      receipt.pairToken,
      receipt.quoteDecimals,
      receipt.estimatedFdvQuoteRaw?.toString() ?? null,
      receipt.status,
      receipt.evidenceDigest,
      payload,
      ...(auth ? [auth.pilotId,auth.nowMs,auth.nowMs,auth.owner,auth.nowMs,auth.owner,auth.nowMs] : [])
    ).run();
    if (!result.success) throw new Error('PONS_OUTCOME_WRITE_FAILED');
    if (auth) {
      const p=await this.db.prepare('SELECT enabled,expires_ms FROM pons_outcome_pilots WHERE pilot_id=?').bind(auth.pilotId).first<{enabled:number;expires_ms:number}>();
      if (!p || p.enabled!==1 || p.expires_ms<=auth.nowMs) throw new Error('PONS_OUTCOME_NOT_AUTHORIZED');
    }
    if (changes(result) === 1) return 'INSERTED';

    const existing = await this.db.prepare(`
      SELECT observation_id,evidence_digest,payload_json
      FROM pons_outcome_receipts
      WHERE observation_id=?
         OR (launch_id=? AND horizon_ms=? AND observation_version=?)
      LIMIT 1
    `).bind(
      receipt.observationId,
      receipt.launchId,
      receipt.horizonMs,
      receipt.observationVersion
    ).first<{observation_id: string; evidence_digest: string; payload_json: string}>();
    if (
      !existing ||
      existing.observation_id !== receipt.observationId ||
      existing.evidence_digest !== receipt.evidenceDigest ||
      existing.payload_json !== payload
    ) {
      throw new Error(`PONS_OUTCOME_OBSERVATION_CONFLICT:${receipt.launchId}:${receipt.horizonMs}`);
    }
    return 'DUPLICATE';
  }
}

function changes(result: D1ResultLike): number {
  return Number(result.meta?.changes ?? 0);
}

// Bounded fallback for offline/legacy callers. The controlled Worker uses exact due jobs.
export const RECENT_OUTCOME_CANDIDATES_SQL = `SELECT launch_id,token,pool,block_number,block_hash
 FROM launches INDEXED BY idx_launches_chain_source_block_numeric
 WHERE chain_id=4663 AND source='PONS_V2'
 ORDER BY CAST(block_number AS INTEGER) DESC,log_index DESC,launch_id DESC LIMIT ?`;
