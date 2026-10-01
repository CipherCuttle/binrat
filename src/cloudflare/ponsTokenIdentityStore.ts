import { canonicalJson } from '../evidence/canonical.js';
import type { Hex } from '../core/types.js';
import type {
  PonsTokenIdentityLaunch,
  PonsTokenIdentityReceipt,
  PonsTokenIdentityStore
} from '../pons/tokenIdentity.js';
import type { D1DatabaseLike, D1ResultLike } from './d1Types.js';

export class D1PonsTokenIdentityStore implements PonsTokenIdentityStore {
  constructor(private readonly db:D1DatabaseLike) {}

  async getCheckpoint():Promise<{blockNumber:bigint;blockHash:Hex}|null> {
    const row=await this.db.prepare(
      'SELECT block_number,block_hash FROM chain_checkpoints WHERE chain_id=4663 LIMIT 1'
    ).first<{block_number:string;block_hash:Hex}>();
    return row ? {blockNumber:BigInt(row.block_number),blockHash:row.block_hash} : null;
  }

  async listMissing(limit:number):Promise<PonsTokenIdentityLaunch[]> {
    const result=await this.db.prepare(`
      WITH checkpoint AS (
        SELECT CAST(block_number AS INTEGER) AS tip
        FROM chain_checkpoints WHERE chain_id=4663 LIMIT 1
      ),
      fresh_repeaters AS (
        SELECT l.creator
        FROM launches l
        WHERE l.chain_id=4663 AND l.source='PONS_V2'
        GROUP BY l.creator
        HAVING COUNT(DISTINCT l.launch_id)>=2
           AND MAX(CAST(l.block_number AS INTEGER))>=(
             SELECT CASE WHEN tip>200000 THEN tip-200000 ELSE 0 END FROM checkpoint
           )
      )
      SELECT l.launch_id,l.token
      FROM launches l
      JOIN fresh_repeaters r ON r.creator=l.creator
      LEFT JOIN pons_token_identity_receipts i ON i.launch_id=l.launch_id
      WHERE l.chain_id=4663 AND l.source='PONS_V2' AND i.launch_id IS NULL
      ORDER BY CAST(l.block_number AS INTEGER) DESC,l.log_index DESC,l.launch_id DESC
      LIMIT ?
    `).bind(limit).all<{launch_id:string;token:Hex}>();
    if (!result.success) throw new Error('PONS_TOKEN_IDENTITY_QUERY_FAILED');
    return (result.results ?? []).map(row=>({launchId:row.launch_id,token:row.token.toLowerCase() as Hex}));
  }

  async put(receipt:PonsTokenIdentityReceipt):Promise<'INSERTED'|'DUPLICATE'> {
    const payload=canonicalJson(receipt);
    const result=await this.db.prepare(`
      INSERT OR IGNORE INTO pons_token_identity_receipts (
        identity_id,identity_version,chain_id,launch_id,token,observed_block,observed_block_hash,
        name,symbol,decimals,total_supply,evidence_digest,payload_json
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      receipt.identityId,receipt.identityVersion,receipt.chainId,receipt.launchId,receipt.token,
      receipt.observedBlock.toString(),receipt.observedBlockHash,receipt.name,receipt.symbol,
      receipt.decimals,receipt.totalSupply.toString(),receipt.evidenceDigest,payload
    ).run();
    if (changes(result)===1) return 'INSERTED';
    const existing=await this.db.prepare(`
      SELECT identity_id,evidence_digest,payload_json
      FROM pons_token_identity_receipts
      WHERE identity_id=? OR launch_id=?
      LIMIT 1
    `).bind(receipt.identityId,receipt.launchId)
      .first<{identity_id:string;evidence_digest:string;payload_json:string}>();
    if (!existing || existing.identity_id!==receipt.identityId ||
        existing.evidence_digest!==receipt.evidenceDigest || existing.payload_json!==payload) {
      throw new Error(`PONS_TOKEN_IDENTITY_CONFLICT:${receipt.launchId}`);
    }
    return 'DUPLICATE';
  }
}

function changes(result:D1ResultLike):number {
  return Number(result.meta?.changes ?? 0);
}
