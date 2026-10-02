import { canonicalJson } from '../evidence/canonical.js';
import type { Hex } from '../core/types.js';
import {
  verifyPonsPrelaunchNativeInboundReceipt,
  type PonsFundingLaunch,
  type PonsFundingStore,
  type PonsPrelaunchNativeInboundReceipt
} from '../pons/fundingProvenance.js';
import type { D1DatabaseLike, D1ResultLike } from './d1Types.js';

export class D1PonsFundingStore implements PonsFundingStore {
  constructor(private readonly db:D1DatabaseLike) {}

  async listPending(limit:number,nowMs:number):Promise<PonsFundingLaunch[]> {
    const result=await this.db.prepare(`
      WITH checkpoint AS (
        SELECT CAST(block_number AS INTEGER) AS tip
        FROM chain_checkpoints WHERE chain_id=4663 LIMIT 1
      )
      SELECT l.launch_id,l.creator,l.block_number,l.block_hash
      FROM launches l
      LEFT JOIN pons_funding_receipts r ON r.launch_id=l.launch_id
      LEFT JOIN pons_funding_scan_state s ON s.launch_id=l.launch_id
      LEFT JOIN pons_funding_retry_state f ON f.launch_id=l.launch_id
      WHERE l.chain_id=4663
        AND l.source='PONS_V2'
        AND r.launch_id IS NULL
        AND s.launch_id IS NULL
        AND (f.launch_id IS NULL OR f.retry_after_ms<=?)
        AND CAST(l.block_number AS INTEGER)<=COALESCE((SELECT tip FROM checkpoint),-1)
        AND CAST(l.block_number AS INTEGER)>=(
          SELECT CASE WHEN tip>200000 THEN tip-200000 ELSE 0 END FROM checkpoint
        )
      ORDER BY CAST(l.block_number AS INTEGER) DESC,l.log_index DESC,l.launch_id DESC
      LIMIT ?
    `).bind(nowMs,limit).all<{
      launch_id:string;
      creator:Hex;
      block_number:string;
      block_hash:Hex;
    }>();
    if (!result.success) throw new Error('PONS_FUNDING_QUERY_FAILED');
    return (result.results ?? []).map(row=>({
      launchId:row.launch_id,
      deployer:row.creator.toLowerCase() as Hex,
      blockNumber:BigInt(row.block_number),
      blockHash:row.block_hash.toLowerCase() as Hex
    }));
  }

  async put(receipt:PonsPrelaunchNativeInboundReceipt):Promise<'INSERTED'|'DUPLICATE'> {
    await verifyPonsPrelaunchNativeInboundReceipt(receipt);
    await this.assertLaunchAuthority({
      launchId:receipt.launchId,
      deployer:receipt.deployer,
      blockNumber:receipt.launchBlock,
      blockHash:receipt.launchBlockHash
    });
    const payload=canonicalJson(receipt);
    const result=await this.db.prepare(`
      INSERT OR IGNORE INTO pons_funding_receipts (
        funding_id,funding_version,chain_id,launch_id,deployer,launch_block,launch_block_hash,
        source_address,transfer_tx_hash,transfer_block,transfer_block_hash,transfer_timestamp_ms,
        value_wei,evidence_digest,payload_json
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      receipt.fundingId,receipt.fundingVersion,receipt.chainId,receipt.launchId,receipt.deployer,
      receipt.launchBlock.toString(),receipt.launchBlockHash,receipt.sourceAddress,receipt.transferTxHash,
      receipt.transferBlock.toString(),receipt.transferBlockHash,receipt.transferTimestampMs,
      receipt.valueWei.toString(),receipt.evidenceDigest,payload
    ).run();
    if (changes(result)===1) {
      await this.db.prepare('DELETE FROM pons_funding_retry_state WHERE launch_id=?')
        .bind(receipt.launchId).run();
      return 'INSERTED';
    }

    const existing=await this.db.prepare(`
      SELECT funding_id,evidence_digest,payload_json
      FROM pons_funding_receipts
      WHERE funding_id=? OR launch_id=?
      LIMIT 1
    `).bind(receipt.fundingId,receipt.launchId)
      .first<{funding_id:string;evidence_digest:string;payload_json:string}>();
    if (!existing ||
        existing.funding_id!==receipt.fundingId ||
        existing.evidence_digest!==receipt.evidenceDigest ||
        existing.payload_json!==payload) {
      throw new Error(`PONS_FUNDING_CONFLICT:${receipt.launchId}`);
    }
    return 'DUPLICATE';
  }

  async markNoMatch(
    launch:PonsFundingLaunch,
    checkedAtMs:number
  ):Promise<'INSERTED'|'DUPLICATE'> {
    if (!Number.isSafeInteger(checkedAtMs) || checkedAtMs<0) {
      throw new Error('PONS_FUNDING_SCAN_TIME_INVALID');
    }
    await this.assertLaunchAuthority(launch);
    await this.db.prepare('DELETE FROM pons_funding_retry_state WHERE launch_id=?')
      .bind(launch.launchId).run();
    const result=await this.db.prepare(`
      INSERT OR IGNORE INTO pons_funding_scan_state (
        launch_id,chain_id,deployer,launch_block,launch_block_hash,status,checked_at_ms
      ) VALUES (?,4663,?,?,?,'NO_MATCH',?)
    `).bind(
      launch.launchId,
      launch.deployer.toLowerCase(),
      launch.blockNumber.toString(),
      launch.blockHash.toLowerCase(),
      checkedAtMs
    ).run();
    if (changes(result)===1) return 'INSERTED';

    const existing=await this.db.prepare(`
      SELECT deployer,launch_block,launch_block_hash,status
      FROM pons_funding_scan_state
      WHERE launch_id=?
      LIMIT 1
    `).bind(launch.launchId).first<{
      deployer:string;
      launch_block:string;
      launch_block_hash:string;
      status:string;
    }>();
    if (!existing ||
        existing.deployer!==launch.deployer.toLowerCase() ||
        existing.launch_block!==launch.blockNumber.toString() ||
        existing.launch_block_hash!==launch.blockHash.toLowerCase() ||
        existing.status!=='NO_MATCH') {
      throw new Error(`PONS_FUNDING_SCAN_CONFLICT:${launch.launchId}`);
    }
    return 'DUPLICATE';
  }

  async markRetry(
    launch:PonsFundingLaunch,
    code:string,
    retryAfterMs:number,
    nowMs:number
  ):Promise<void> {
    if (!/^[A-Z0-9_]{1,120}$/.test(code)) throw new Error('PONS_FUNDING_FAILURE_CODE_INVALID');
    if (!Number.isSafeInteger(retryAfterMs) || retryAfterMs<nowMs) {
      throw new Error('PONS_FUNDING_RETRY_TIME_INVALID');
    }
    if (!Number.isSafeInteger(nowMs) || nowMs<0) throw new Error('PONS_FUNDING_RETRY_TIME_INVALID');
    await this.assertLaunchAuthority(launch);
    const result=await this.db.prepare(`
      INSERT INTO pons_funding_retry_state (
        launch_id,launch_block_hash,failure_count,retry_after_ms,last_error,updated_at_ms
      ) VALUES (?,?,?,?,?,?)
      ON CONFLICT(launch_id) DO UPDATE SET
        launch_block_hash=excluded.launch_block_hash,
        failure_count=pons_funding_retry_state.failure_count+1,
        retry_after_ms=excluded.retry_after_ms,
        last_error=excluded.last_error,
        updated_at_ms=excluded.updated_at_ms
    `).bind(
      launch.launchId,launch.blockHash.toLowerCase(),1,retryAfterMs,code,nowMs
    ).run();
    if (!result.success) throw new Error('PONS_FUNDING_RETRY_WRITE_FAILED');
  }

  async countRemaining():Promise<number> {
    const row=await this.db.prepare(`
      WITH checkpoint AS (
        SELECT CAST(block_number AS INTEGER) AS tip
        FROM chain_checkpoints WHERE chain_id=4663 LIMIT 1
      )
      SELECT COUNT(*) AS n
      FROM launches l
      LEFT JOIN pons_funding_receipts r ON r.launch_id=l.launch_id
      LEFT JOIN pons_funding_scan_state s ON s.launch_id=l.launch_id
      WHERE l.chain_id=4663
        AND l.source='PONS_V2'
        AND r.launch_id IS NULL
        AND s.launch_id IS NULL
        AND CAST(l.block_number AS INTEGER)<=COALESCE((SELECT tip FROM checkpoint),-1)
        AND CAST(l.block_number AS INTEGER)>=(
          SELECT CASE WHEN tip>200000 THEN tip-200000 ELSE 0 END FROM checkpoint
        )
    `).first<{n:number}>();
    return Number(row?.n ?? 0);
  }

  private async assertLaunchAuthority(launch:PonsFundingLaunch):Promise<void> {
    const row=await this.db.prepare(`
      SELECT creator,block_number,block_hash
      FROM launches
      WHERE chain_id=4663 AND source='PONS_V2' AND launch_id=?
      LIMIT 1
    `).bind(launch.launchId).first<{
      creator:string;
      block_number:string;
      block_hash:string;
    }>();
    if (!row ||
        row.creator.toLowerCase()!==launch.deployer.toLowerCase() ||
        row.block_number!==launch.blockNumber.toString() ||
        row.block_hash.toLowerCase()!==launch.blockHash.toLowerCase()) {
      throw new Error(`PONS_FUNDING_LAUNCH_AUTHORITY_MISMATCH:${launch.launchId}`);
    }
  }
}

function changes(result:D1ResultLike):number {
  return Number(result.meta?.changes ?? 0);
}
