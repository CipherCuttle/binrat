import { canonicalJson } from '../evidence/canonical.js';
import type { D1DatabaseLike, D1ResultLike } from './d1Types.js';
import type { LaunchObserved } from '../core/types.js';
import type { RatRadarSwapReceipt } from '../ratRadar/activity.js';

export class D1RatRadarStore {
  constructor(private readonly db: D1DatabaseLike, private readonly chainId: number) {}

  async ensurePoolCursors(launches: readonly LaunchObserved[], nowMs: number): Promise<void> {
    const statements = launches
      .filter((launch) => launch.chainId === this.chainId)
      .map((launch) => this.db.prepare(`
        INSERT OR IGNORE INTO rat_radar_pool_cursors (
          launch_id,chain_id,next_block,retry_after_ms,failure_count,last_error,updated_at_ms
        ) VALUES (?,?,?,0,0,NULL,?)
      `).bind(
        launch.launchId,
        this.chainId,
        launch.blockNumber.toString(),
        nowMs
      ));
    if (statements.length === 0) return;
    const results = await this.db.batch(statements);
    if (results.some((result) => !result.success)) throw new Error('RAT_RADAR_CURSOR_INIT_FAILED');
  }

  async nextPoolCursor(
    targetBlock: bigint,
    nowMs: number
  ): Promise<{ launchId: string; nextBlock: bigint; failureCount: number } | null> {
    if (targetBlock < 0n) throw new Error('RAT_RADAR_BLOCK_INVALID');
    const row = await this.db.prepare(`
      SELECT launch_id,next_block,failure_count
      FROM rat_radar_pool_cursors
      WHERE chain_id = ?
        AND CAST(next_block AS INTEGER) <= CAST(? AS INTEGER)
        AND retry_after_ms <= ?
      ORDER BY CAST(next_block AS INTEGER), launch_id
      LIMIT 1
    `).bind(
      this.chainId,
      targetBlock.toString(),
      nowMs
    ).first<{ launch_id: string; next_block: string; failure_count: number }>();
    return row ? {
      launchId: row.launch_id,
      nextBlock: BigInt(row.next_block),
      failureCount: row.failure_count
    } : null;
  }

  async advancePoolCursor(
    launchId: string,
    expectedNextBlock: bigint,
    nextBlock: bigint,
    nowMs: number
  ): Promise<void> {
    if (nextBlock <= expectedNextBlock) throw new Error('RAT_RADAR_CURSOR_ADVANCE_INVALID');
    const result = await this.db.prepare(`
      UPDATE rat_radar_pool_cursors
      SET next_block = ?, retry_after_ms = 0, failure_count = 0, last_error = NULL, updated_at_ms = ?
      WHERE chain_id = ? AND launch_id = ? AND next_block = ?
    `).bind(
      nextBlock.toString(),
      nowMs,
      this.chainId,
      launchId,
      expectedNextBlock.toString()
    ).run();
    if (changes(result) !== 1) throw new Error('RAT_RADAR_CURSOR_FENCE_CONFLICT');
  }

  async recordPoolFailure(
    launchId: string,
    expectedNextBlock: bigint,
    code: string,
    retryAfterMs: number,
    nowMs: number
  ): Promise<void> {
    if (!/^[A-Z0-9_:.-]{1,160}$/.test(code)) throw new Error('RAT_RADAR_ERROR_CODE_INVALID');
    if (!Number.isSafeInteger(retryAfterMs) || retryAfterMs < nowMs) {
      throw new Error('RAT_RADAR_RETRY_AFTER_INVALID');
    }
    const result = await this.db.prepare(`
      UPDATE rat_radar_pool_cursors
      SET retry_after_ms = ?,
          failure_count = failure_count + 1,
          last_error = ?,
          updated_at_ms = ?
      WHERE chain_id = ? AND launch_id = ? AND next_block = ?
    `).bind(
      retryAfterMs,
      code,
      nowMs,
      this.chainId,
      launchId,
      expectedNextBlock.toString()
    ).run();
    if (changes(result) !== 1) throw new Error('RAT_RADAR_CURSOR_FENCE_CONFLICT');
  }

  async putSwap(receipt: RatRadarSwapReceipt): Promise<'INSERTED' | 'DUPLICATE'> {
    if (receipt.chainId !== this.chainId) throw new Error('RAT_RADAR_CHAIN_MISMATCH');
    const launch = await this.db.prepare(`
      SELECT chain_id,pool,token,block_number
      FROM launches
      WHERE launch_id = ?
      LIMIT 1
    `).bind(receipt.launchId).first<{
      chain_id: number;
      pool: string;
      token: string;
      block_number: string;
    }>();
    if (
      !launch ||
      launch.chain_id !== receipt.chainId ||
      launch.pool !== receipt.pool ||
      launch.token !== receipt.token ||
      receipt.blockNumber < BigInt(launch.block_number)
    ) throw new Error('RAT_RADAR_LAUNCH_AUTHORITY_MISMATCH');

    const payload = canonicalJson(receipt);
    const result = await this.db.prepare(INSERT_SWAP_SQL).bind(
      receipt.activityId,
      receipt.version,
      receipt.chainId,
      receipt.launchId,
      receipt.pool,
      receipt.token,
      receipt.token0,
      receipt.token1,
      receipt.blockNumber.toString(),
      receipt.blockHash,
      receipt.txHash,
      receipt.logIndex,
      receipt.sender,
      receipt.recipient,
      receipt.tokenSide,
      receipt.amount0.toString(),
      receipt.amount1.toString(),
      receipt.sqrtPriceX96.toString(),
      receipt.liquidity.toString(),
      receipt.tick,
      receipt.launchedTokenDelta.toString(),
      receipt.launchedTokenFlow,
      receipt.evidenceDigest,
      payload
    ).run();
    if (changes(result) === 1) return 'INSERTED';

    const existing = await this.db.prepare(`
      SELECT activity_id,evidence_digest,payload_json
      FROM rat_radar_swap_receipts
      WHERE activity_id = ?
         OR (chain_id = ? AND pool = ? AND tx_hash = ? AND log_index = ?)
      LIMIT 1
    `).bind(
      receipt.activityId,
      receipt.chainId,
      receipt.pool,
      receipt.txHash,
      receipt.logIndex
    ).first<{ activity_id: string; evidence_digest: string; payload_json: string }>();

    if (
      !existing ||
      existing.activity_id !== receipt.activityId ||
      existing.evidence_digest !== receipt.evidenceDigest ||
      existing.payload_json !== payload
    ) throw new Error(`RAT_RADAR_SWAP_IDENTITY_CONFLICT:${receipt.activityId}`);
    return 'DUPLICATE';
  }

  async getSwap(activityId: string): Promise<RatRadarSwapReceipt | null> {
    const row = await this.db.prepare(`
      SELECT payload_json
      FROM rat_radar_swap_receipts
      WHERE chain_id = ? AND activity_id = ?
      LIMIT 1
    `).bind(this.chainId, activityId).first<{ payload_json: string }>();
    return row ? revive(row.payload_json) : null;
  }

  async listForRecipientThroughBlock(recipient: string, asOfBlock: bigint): Promise<RatRadarSwapReceipt[]> {
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) throw new Error('RAT_RADAR_RECIPIENT_INVALID');
    if (asOfBlock < 0n) throw new Error('RAT_RADAR_BLOCK_INVALID');
    const result = await this.db.prepare(`
      SELECT payload_json
      FROM rat_radar_swap_receipts
      WHERE chain_id = ?
        AND recipient = ?
        AND CAST(block_number AS INTEGER) <= CAST(? AS INTEGER)
      ORDER BY CAST(block_number AS INTEGER), log_index, activity_id
    `).bind(
      this.chainId,
      recipient.toLowerCase(),
      asOfBlock.toString()
    ).all<{ payload_json: string }>();
    if (!result.success) throw new Error('RAT_RADAR_QUERY_FAILED');
    return (result.results ?? []).map((row) => revive(row.payload_json));
  }

  async listThroughBlock(asOfBlock: bigint): Promise<RatRadarSwapReceipt[]> {
    if (asOfBlock < 0n) throw new Error('RAT_RADAR_BLOCK_INVALID');
    const result = await this.db.prepare(`
      SELECT payload_json
      FROM rat_radar_swap_receipts
      WHERE chain_id = ? AND CAST(block_number AS INTEGER) <= CAST(? AS INTEGER)
      ORDER BY CAST(block_number AS INTEGER), log_index, activity_id
    `).bind(this.chainId, asOfBlock.toString()).all<{ payload_json: string }>();
    if (!result.success) throw new Error('RAT_RADAR_QUERY_FAILED');
    return (result.results ?? []).map((row) => revive(row.payload_json));
  }

  async listForLaunch(launchId: string): Promise<RatRadarSwapReceipt[]> {
    const result = await this.db.prepare(`
      SELECT payload_json
      FROM rat_radar_swap_receipts
      WHERE chain_id = ? AND launch_id = ?
      ORDER BY CAST(block_number AS INTEGER), log_index, activity_id
    `).bind(this.chainId, launchId).all<{ payload_json: string }>();
    if (!result.success) throw new Error('RAT_RADAR_QUERY_FAILED');
    return (result.results ?? []).map((row) => revive(row.payload_json));
  }
}

const INSERT_SWAP_SQL = `
  INSERT OR IGNORE INTO rat_radar_swap_receipts (
    activity_id,version,chain_id,launch_id,pool,token,token0,token1,block_number,block_hash,tx_hash,log_index,
    sender,recipient,token_side,amount0,amount1,sqrt_price_x96,liquidity,tick,
    launched_token_delta,launched_token_flow,evidence_digest,payload_json
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

function changes(result: D1ResultLike): number {
  return Number(result.meta?.changes ?? 0);
}

function revive(payload: string): RatRadarSwapReceipt {
  const raw = JSON.parse(payload) as Omit<
    RatRadarSwapReceipt,
    'blockNumber' | 'amount0' | 'amount1' | 'sqrtPriceX96' | 'liquidity' | 'launchedTokenDelta'
  > & {
    blockNumber: string;
    amount0: string;
    amount1: string;
    sqrtPriceX96: string;
    liquidity: string;
    launchedTokenDelta: string;
  };
  return {
    ...raw,
    blockNumber: BigInt(raw.blockNumber),
    amount0: BigInt(raw.amount0),
    amount1: BigInt(raw.amount1),
    sqrtPriceX96: BigInt(raw.sqrtPriceX96),
    liquidity: BigInt(raw.liquidity),
    launchedTokenDelta: BigInt(raw.launchedTokenDelta)
  };
}
