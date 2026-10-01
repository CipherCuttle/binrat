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
    const oldestLimit=Math.ceil(limit/2);
    const newestLimit=Math.floor(limit/2);
    const result = await this.db.prepare(`
      WITH incomplete AS (
        SELECT l.launch_id,l.token,l.pool,l.block_number,l.block_hash,l.log_index,
               CAST(l.block_number AS INTEGER) AS block_sort
        FROM launches l
        LEFT JOIN pons_outcome_receipts r
          ON r.launch_id=l.launch_id
         AND r.observation_version=?
         AND r.horizon_ms IN (300000,3600000,86400000)
        WHERE l.chain_id=4663 AND l.source='PONS_V2'
        GROUP BY l.launch_id,l.token,l.pool,l.block_number,l.block_hash,l.log_index
        HAVING COUNT(DISTINCT r.horizon_ms)<3
      ),
      oldest AS (
        SELECT * FROM incomplete
        ORDER BY block_sort ASC,log_index ASC,launch_id ASC
        LIMIT ?
      ),
      newest AS (
        SELECT * FROM incomplete
        ORDER BY block_sort DESC,log_index DESC,launch_id DESC
        LIMIT ?
      ),
      selected AS (
        SELECT * FROM oldest
        UNION
        SELECT * FROM newest
      )
      SELECT launch_id,token,pool,block_number,block_hash
      FROM selected
      ORDER BY block_sort ASC,log_index ASC,launch_id ASC
      LIMIT ?
    `).bind(PONS_OUTCOME_OBSERVATION_VERSION, oldestLimit, newestLimit, limit)
      .all<{
        launch_id: string;
        token: Hex;
        pool: Hex;
        block_number: string;
        block_hash: Hex;
      }>();
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
      SELECT payload_json
      FROM pons_outcome_receipts
      WHERE chain_id=4663 AND launch_id=?
      ORDER BY horizon_ms,observation_version,observation_id
    `).bind(launchId).all<{payload_json: string}>();
    if (!result.success) throw new Error('PONS_OUTCOME_LIST_QUERY_FAILED');
    const receipts: PonsOutcomeObservationReceipt[] = [];
    for (const row of result.results ?? []) {
      receipts.push(await parsePonsOutcomeObservationReceipt(row.payload_json));
    }
    return receipts;
  }

  async put(receipt: PonsOutcomeObservationReceipt): Promise<'INSERTED' | 'DUPLICATE'> {
    const payload = canonicalJson(receipt);
    const result = await this.db.prepare(`
      INSERT OR IGNORE INTO pons_outcome_receipts (
        observation_id,observation_version,chain_id,launch_id,token,curve,horizon_ms,
        target_timestamp_ms,observed_block,observed_block_hash,observed_timestamp_ms,
        phase,pair_token,quote_decimals,estimated_fdv_quote_raw,status,evidence_digest,payload_json
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
      payload
    ).run();
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
