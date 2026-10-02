import { canonicalJson } from '../evidence/canonical.js';
import type { Hex } from '../core/types.js';
import { verifyPonsPrelaunchNativeInboundReceipt } from '../pons/fundingProvenance.js';
import type { PonsFundingLaunch, PonsPrelaunchNativeInboundReceipt } from '../pons/fundingProvenance.js';
import type { PonsFundingScanStore } from '../pons/fundingSync.js';
import type { D1DatabaseLike, D1ResultLike } from './d1Types.js';

type ScanState='FOUND'|'NONE'|'FAILED';

export class D1PonsFundingStore implements PonsFundingScanStore {
  constructor(private readonly db:D1DatabaseLike) {}

  async listCandidates(limit:number, nowMs:number):Promise<PonsFundingLaunch[]> {
    const result=await this.db.prepare(`
      WITH checkpoint AS (
        SELECT CAST(block_number AS INTEGER) AS tip
        FROM chain_checkpoints WHERE chain_id=4663 LIMIT 1
      )
      SELECT l.launch_id,l.creator,l.block_number,l.block_hash
      FROM launches l
      LEFT JOIN pons_funding_scan_state s ON s.launch_id=l.launch_id
      WHERE l.chain_id=4663
        AND l.source='PONS_V2'
        AND CAST(l.block_number AS INTEGER)<=COALESCE((SELECT tip FROM checkpoint),-1)
        AND CAST(l.block_number AS INTEGER)>=COALESCE(
          (SELECT CASE WHEN tip>200000 THEN tip-200000 ELSE 0 END FROM checkpoint),
          0
        )
        AND (
          s.launch_id IS NULL OR
          (s.state='FAILED' AND s.retry_after_ms<=?)
        )
      ORDER BY CAST(l.block_number AS INTEGER) DESC,l.log_index DESC,l.launch_id DESC
      LIMIT ?
    `).bind(nowMs,limit).all<{
      launch_id:string;
      creator:Hex;
      block_number:string;
      block_hash:Hex;
    }>();
    if (!result.success) throw new Error('PONS_FUNDING_CANDIDATE_QUERY_FAILED');
    return (result.results ?? []).map(row=>({
      launchId:row.launch_id,
      deployer:row.creator.toLowerCase() as Hex,
      blockNumber:BigInt(row.block_number),
      blockHash:row.block_hash.toLowerCase() as Hex
    }));
  }

  async countRemaining(_nowMs:number):Promise<number> {
    const row=await this.db.prepare(`
      WITH checkpoint AS (
        SELECT CAST(block_number AS INTEGER) AS tip
        FROM chain_checkpoints WHERE chain_id=4663 LIMIT 1
      )
      SELECT COUNT(*) AS n
      FROM launches l
      LEFT JOIN pons_funding_scan_state s ON s.launch_id=l.launch_id
      WHERE l.chain_id=4663
        AND l.source='PONS_V2'
        AND CAST(l.block_number AS INTEGER)<=COALESCE((SELECT tip FROM checkpoint),-1)
        AND CAST(l.block_number AS INTEGER)>=COALESCE(
          (SELECT CASE WHEN tip>200000 THEN tip-200000 ELSE 0 END FROM checkpoint),
          0
        )
        AND (s.launch_id IS NULL OR s.state='FAILED')
    `).first<{n:number}>();
    return Number(row?.n ?? 0);
  }

  async put(receipt:PonsPrelaunchNativeInboundReceipt):Promise<'INSERTED'|'DUPLICATE'> {
    await verifyPonsPrelaunchNativeInboundReceipt(receipt);
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
    if (changes(result)===1) return 'INSERTED';

    const existing=await this.db.prepare(`
      SELECT funding_id,evidence_digest,payload_json
      FROM pons_funding_receipts
      WHERE funding_id=? OR launch_id=?
      LIMIT 1
    `).bind(receipt.fundingId,receipt.launchId)
      .first<{funding_id:string;evidence_digest:string;payload_json:string}>();
    if (
      !existing ||
      existing.funding_id!==receipt.fundingId ||
      existing.evidence_digest!==receipt.evidenceDigest ||
      existing.payload_json!==payload
    ) {
      throw new Error(`PONS_FUNDING_RECEIPT_CONFLICT:${receipt.launchId}`);
    }
    return 'DUPLICATE';
  }

  async markComplete(
    launch:PonsFundingLaunch,
    state:'FOUND'|'NONE',
    nowMs:number
  ):Promise<void> {
    const existing=await this.scanState(launch.launchId);
    if (existing) {
      this.assertSameLaunchHash(existing.launch_block_hash,launch.blockHash,launch.launchId);
      if (existing.state===state) return;
      if (existing.state!=='FAILED') throw new Error(`PONS_FUNDING_SCAN_CONFLICT:${launch.launchId}`);
    }
    await this.db.prepare(`
      INSERT INTO pons_funding_scan_state (
        launch_id,launch_block_hash,state,failure_count,retry_after_ms,last_error,updated_at_ms
      ) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(launch_id) DO UPDATE SET
        launch_block_hash=excluded.launch_block_hash,
        state=excluded.state,
        failure_count=0,
        retry_after_ms=0,
        last_error=NULL,
        updated_at_ms=excluded.updated_at_ms
    `).bind(
      launch.launchId,launch.blockHash.toLowerCase(),state,0,0,null,nowMs
    ).run();
  }

  async markFailure(
    launch:PonsFundingLaunch,
    code:string,
    retryAfterMs:number,
    nowMs:number
  ):Promise<void> {
    if (!/^[A-Z0-9_]{1,120}$/.test(code)) throw new Error('PONS_FUNDING_FAILURE_CODE_INVALID');
    const existing=await this.scanState(launch.launchId);
    if (existing) {
      this.assertSameLaunchHash(existing.launch_block_hash,launch.blockHash,launch.launchId);
      if (existing.state!=='FAILED') return;
    }
    await this.db.prepare(`
      INSERT INTO pons_funding_scan_state (
        launch_id,launch_block_hash,state,failure_count,retry_after_ms,last_error,updated_at_ms
      ) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(launch_id) DO UPDATE SET
        launch_block_hash=excluded.launch_block_hash,
        state='FAILED',
        failure_count=pons_funding_scan_state.failure_count+1,
        retry_after_ms=excluded.retry_after_ms,
        last_error=excluded.last_error,
        updated_at_ms=excluded.updated_at_ms
    `).bind(
      launch.launchId,launch.blockHash.toLowerCase(),'FAILED',1,retryAfterMs,code,nowMs
    ).run();
  }

  private async scanState(launchId:string):Promise<{
    launch_block_hash:Hex;
    state:ScanState;
  }|null> {
    return this.db.prepare(`
      SELECT launch_block_hash,state
      FROM pons_funding_scan_state
      WHERE launch_id=?
      LIMIT 1
    `).bind(launchId).first<{launch_block_hash:Hex;state:ScanState}>();
  }

  private assertSameLaunchHash(existing:Hex,current:Hex,launchId:string):void {
    if (existing.toLowerCase()!==current.toLowerCase()) {
      throw new Error(`PONS_FUNDING_SCAN_HASH_CONFLICT:${launchId}`);
    }
  }
}

function changes(result:D1ResultLike):number {
  return Number(result.meta?.changes ?? 0);
}
