import { canonicalJson } from '../evidence/canonical.js';
import type { Hex } from '../core/types.js';
import {
  PONS_PRELAUNCH_NATIVE_INBOUND_VERSION,
  verifyPonsPrelaunchNativeInboundReceipt,
  type PonsPrelaunchNativeInboundReceipt
} from '../pons/fundingProvenance.js';
import { ROBINHOOD_CHAIN_ID } from '../pons/chain.js';
import type { D1DatabaseLike } from './d1Types.js';

export const PONS_FUNDING_RECURRENCE_SCHEMA_VERSION='binrat.pons-funding-recurrence/0.1' as const;

interface FundingRow {
  funding_id:string;
  funding_version:string;
  chain_id:number;
  launch_id:string;
  deployer:Hex;
  launch_block:string;
  launch_block_hash:Hex;
  source_address:Hex;
  transfer_tx_hash:Hex;
  transfer_block:string;
  transfer_block_hash:Hex;
  transfer_timestamp_ms:number;
  value_wei:string;
  evidence_digest:string;
  payload_json:string;
  canonical_deployer:Hex;
  canonical_block:string;
  canonical_hash:Hex;
}

export interface PonsFundingRecurrenceReadModel {
  schemaVersion:typeof PONS_FUNDING_RECURRENCE_SCHEMA_VERSION;
  chainId:typeof ROBINHOOD_CHAIN_ID;
  asOfBlock:string;
  currentLaunchId:string;
  currentFunding:null|{
    sourceAddress:Hex;
    transferTxHash:Hex;
    transferBlock:string;
    transferTimestampMs:number;
    valueWei:string;
  };
  sameFundingSource:null|{
    label:'SAME FUNDING SOURCE';
    sourceAddress:Hex;
    distinctDeployersAtLeast:number;
    distinctLaunchesAtLeast:number;
    relatedLaunches:Array<{
      launchId:string;
      deployer:Hex;
      launchBlock:string;
      transferBlock:string;
      valueWei:string;
    }>;
  };
  recurrenceCoverage:{
    status:'COMPLETE'|'PARTIAL';
    verifiedReceipts:number;
    truncated:boolean;
  };
  caveat:string;
}

export async function readPonsFundingRecurrence(
  db:D1DatabaseLike,
  input:{currentLaunchId:string;asOfBlock:bigint;maxRelatedLaunches?:number}
):Promise<PonsFundingRecurrenceReadModel> {
  if (!/^[0-9a-f]{64}$/i.test(input.currentLaunchId)) {
    throw new Error('PONS_FUNDING_RECURRENCE_LAUNCH_ID_INVALID');
  }
  if (input.asOfBlock<0n) throw new Error('PONS_FUNDING_RECURRENCE_BLOCK_INVALID');
  const maxRelated=input.maxRelatedLaunches ?? 25;
  if (!Number.isSafeInteger(maxRelated) || maxRelated<2 || maxRelated>100) {
    throw new Error('PONS_FUNDING_RECURRENCE_LIMIT_INVALID');
  }

  const currentRow=await db.prepare(`
    SELECT
      f.funding_id,f.funding_version,f.chain_id,f.launch_id,f.deployer,f.launch_block,
      f.launch_block_hash,f.source_address,f.transfer_tx_hash,f.transfer_block,
      f.transfer_block_hash,f.transfer_timestamp_ms,f.value_wei,f.evidence_digest,f.payload_json,
      l.creator AS canonical_deployer,l.block_number AS canonical_block,l.block_hash AS canonical_hash
    FROM pons_funding_receipts f
    JOIN launches l ON l.launch_id=f.launch_id
    WHERE f.launch_id=?
      AND l.chain_id=4663
      AND l.source='PONS_V2'
      AND CAST(l.block_number AS INTEGER)<=?
    LIMIT 1
  `).bind(input.currentLaunchId,input.asOfBlock.toString()).first<FundingRow>();

  if (!currentRow) {
    return emptyModel(input.currentLaunchId,input.asOfBlock);
  }

  const current=await verifiedReceipt(currentRow);
  const result=await db.prepare(`
    SELECT
      f.funding_id,f.funding_version,f.chain_id,f.launch_id,f.deployer,f.launch_block,
      f.launch_block_hash,f.source_address,f.transfer_tx_hash,f.transfer_block,
      f.transfer_block_hash,f.transfer_timestamp_ms,f.value_wei,f.evidence_digest,f.payload_json,
      l.creator AS canonical_deployer,l.block_number AS canonical_block,l.block_hash AS canonical_hash
    FROM pons_funding_receipts f
    JOIN launches l ON l.launch_id=f.launch_id
    WHERE f.chain_id=4663
      AND f.source_address=?
      AND l.chain_id=4663
      AND l.source='PONS_V2'
      AND CAST(l.block_number AS INTEGER)<=?
    ORDER BY CAST(l.block_number AS INTEGER) DESC,l.log_index DESC,l.launch_id DESC
    LIMIT ?
  `).bind(
    current.sourceAddress,
    input.asOfBlock.toString(),
    maxRelated+1
  ).all<FundingRow>();
  if (!result.success) throw new Error('PONS_FUNDING_RECURRENCE_QUERY_FAILED');

  const rows=result.results ?? [];
  const truncated=rows.length>maxRelated;
  const verified:PonsPrelaunchNativeInboundReceipt[]=[];
  for (const row of rows.slice(0,maxRelated)) {
    verified.push(await verifiedReceipt(row));
  }

  if (!verified.some((receipt)=>receipt.launchId===current.launchId)) {
    throw new Error('PONS_FUNDING_RECURRENCE_CURRENT_MISSING');
  }

  const deployers=new Set(verified.map((receipt)=>receipt.deployer.toLowerCase()));
  const launches=new Set(verified.map((receipt)=>receipt.launchId));
  const sameFundingSource=deployers.size>=2 && launches.size>=2
    ? {
        label:'SAME FUNDING SOURCE' as const,
        sourceAddress:current.sourceAddress,
        distinctDeployersAtLeast:deployers.size,
        distinctLaunchesAtLeast:launches.size,
        relatedLaunches:verified.map((receipt)=>({
          launchId:receipt.launchId,
          deployer:receipt.deployer,
          launchBlock:receipt.launchBlock.toString(),
          transferBlock:receipt.transferBlock.toString(),
          valueWei:receipt.valueWei.toString()
        }))
      }
    : null;

  return {
    schemaVersion:PONS_FUNDING_RECURRENCE_SCHEMA_VERSION,
    chainId:ROBINHOOD_CHAIN_ID,
    asOfBlock:input.asOfBlock.toString(),
    currentLaunchId:current.launchId,
    currentFunding:{
      sourceAddress:current.sourceAddress,
      transferTxHash:current.transferTxHash,
      transferBlock:current.transferBlock.toString(),
      transferTimestampMs:current.transferTimestampMs,
      valueWei:current.valueWei.toString()
    },
    sameFundingSource,
    recurrenceCoverage:{
      status:truncated?'PARTIAL':'COMPLETE',
      verifiedReceipts:verified.length,
      truncated
    },
    caveat:'Exact source-address recurrence only; does not establish common ownership, control, team, or person.'
  };
}

async function verifiedReceipt(row:FundingRow):Promise<PonsPrelaunchNativeInboundReceipt> {
  let receipt:PonsPrelaunchNativeInboundReceipt;
  try {
    receipt={
      fundingId:row.funding_id,
      fundingVersion:row.funding_version as typeof PONS_PRELAUNCH_NATIVE_INBOUND_VERSION,
      chainId:Number(row.chain_id) as typeof ROBINHOOD_CHAIN_ID,
      launchId:row.launch_id,
      deployer:row.deployer.toLowerCase() as Hex,
      launchBlock:BigInt(row.launch_block),
      launchBlockHash:row.launch_block_hash.toLowerCase() as Hex,
      sourceAddress:row.source_address.toLowerCase() as Hex,
      transferTxHash:row.transfer_tx_hash.toLowerCase() as Hex,
      transferBlock:BigInt(row.transfer_block),
      transferBlockHash:row.transfer_block_hash.toLowerCase() as Hex,
      transferTimestampMs:Number(row.transfer_timestamp_ms),
      valueWei:BigInt(row.value_wei),
      evidenceDigest:row.evidence_digest
    };
  } catch {
    throw new Error('PONS_FUNDING_RECURRENCE_RECEIPT_INVALID');
  }

  await verifyPonsPrelaunchNativeInboundReceipt(receipt);
  if (canonicalJson(receipt)!==row.payload_json) {
    throw new Error('PONS_FUNDING_RECURRENCE_PAYLOAD_MISMATCH');
  }
  if (
    receipt.deployer.toLowerCase()!==row.canonical_deployer.toLowerCase() ||
    receipt.launchBlock!==BigInt(row.canonical_block) ||
    receipt.launchBlockHash.toLowerCase()!==row.canonical_hash.toLowerCase()
  ) {
    throw new Error('PONS_FUNDING_RECURRENCE_CANONICAL_MISMATCH');
  }
  return receipt;
}

function emptyModel(currentLaunchId:string,asOfBlock:bigint):PonsFundingRecurrenceReadModel {
  return {
    schemaVersion:PONS_FUNDING_RECURRENCE_SCHEMA_VERSION,
    chainId:ROBINHOOD_CHAIN_ID,
    asOfBlock:asOfBlock.toString(),
    currentLaunchId,
    currentFunding:null,
    sameFundingSource:null,
    recurrenceCoverage:{status:'COMPLETE',verifiedReceipts:0,truncated:false},
    caveat:'Exact source-address recurrence only; does not establish common ownership, control, team, or person.'
  };
}
