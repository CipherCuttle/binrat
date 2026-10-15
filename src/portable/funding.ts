import { PortableDatabase } from './sqlite.js';
import { canonicalJson } from '../evidence/canonical.js';
import { verifyPonsPrelaunchNativeInboundReceipt, type PonsPrelaunchNativeInboundReceipt } from '../pons/fundingProvenance.js';

/** One indexed, size-bounded canonical funding receipt. Related-funder traversal
 * is explicitly unavailable until a bounded materialized projection exists.
 * Never run the old source-address join/sort over unlimited history on HTTP. */
export async function readFunding(database: PortableDatabase, launchId: string, checkpoint: string) {
  const strings = ['funding_id','funding_version','launch_id','deployer','launch_block','launch_block_hash','source_address',
    'transfer_tx_hash','transfer_block','transfer_block_hash','value_wei','evidence_digest'];
  const columns = strings.map(c => `CASE WHEN length(f.${c})<=256 THEN f.${c} END AS ${c}`).join(',');
  const row = database.sql.prepare(`SELECT ${columns},f.chain_id,f.transfer_timestamp_ms,
    CASE WHEN length(f.payload_json)<=8192 THEN f.payload_json END AS bounded_payload,
    l.creator AS canonical_deployer,l.block_number AS canonical_block,l.block_hash AS canonical_hash
    FROM pons_funding_receipts f JOIN launches l ON l.launch_id=f.launch_id
    WHERE f.launch_id=? AND l.chain_id=4663 AND l.source='PONS_V2' LIMIT 1`).get(launchId) as Record<string, unknown> | undefined;
  const base = { schemaVersion: 'binrat.pons-funding-recurrence/0.1', chainId: 4663, asOfBlock: checkpoint,
    currentLaunchId: launchId, sameFundingSource: null,
    recurrenceCoverage: { status: 'PARTIAL', verifiedReceipts: 0, truncated: true },
    relatedFundingState: 'UNSUPPORTED', caveat: 'Related funding history is unavailable; exact source-address evidence does not establish common ownership.' };
  if (!row) return { ...base, currentFunding: null, fundingState: 'MISSING' };
  if (!row.bounded_payload) throw new Error('FUNDING_BUDGET_EXCEEDED');
  const raw = JSON.parse(String(row.bounded_payload));
  const receipt = { ...raw, launchBlock: BigInt(raw.launchBlock), transferBlock: BigInt(raw.transferBlock),
    valueWei: BigInt(raw.valueWei) } as PonsPrelaunchNativeInboundReceipt;
  await verifyPonsPrelaunchNativeInboundReceipt(receipt);
  const binding: Record<string, string> = { fundingId: 'funding_id', fundingVersion: 'funding_version', chainId: 'chain_id',
    launchId: 'launch_id', deployer: 'deployer', launchBlock: 'launch_block', launchBlockHash: 'launch_block_hash',
    sourceAddress: 'source_address', transferTxHash: 'transfer_tx_hash', transferBlock: 'transfer_block',
    transferBlockHash: 'transfer_block_hash', transferTimestampMs: 'transfer_timestamp_ms', valueWei: 'value_wei', evidenceDigest: 'evidence_digest' };
  if (canonicalJson(receipt) !== row.bounded_payload || Object.entries(binding).some(([key, column]) => raw[key] !== row[column]) ||
      receipt.launchId !== launchId || receipt.deployer !== row.canonical_deployer || receipt.launchBlock.toString() !== row.canonical_block ||
      receipt.launchBlockHash !== row.canonical_hash || receipt.launchBlock > BigInt(checkpoint)) throw new Error('FUNDING_SOURCE_BINDING_INVALID');
  return { ...base, currentFunding: { sourceAddress: receipt.sourceAddress, transferTxHash: receipt.transferTxHash,
    transferBlock: receipt.transferBlock.toString(), transferTimestampMs: receipt.transferTimestampMs, valueWei: receipt.valueWei.toString() },
    recurrenceCoverage: { status: 'PARTIAL', verifiedReceipts: 1, truncated: true }, fundingState: 'VERIFIED_RETAINED_RECEIPT' };
}
