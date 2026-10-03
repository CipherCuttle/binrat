import { buildProvenanceFact } from '../intelligence/provenance.js';
import { canonicalJson } from '../evidence/canonical.js';
import type { LaunchObserved } from '../core/types.js';
import type { D1DatabaseLike } from './d1Types.js';
import { readPublicSnapshot } from './publicSnapshot.js';

const MAX_CREATOR_SUMMARY_LAUNCHES=4;

interface CreatorLaunchRow {
  launch_id:string;event_id:string;chain_id:number;block_number:string;block_hash:`0x${string}`;
  source:'ARCPAD'|'PONS_V2';launcher:`0x${string}`;tx_hash:`0x${string}`;log_index:number;
  token:`0x${string}`;creator:`0x${string}`;pool:`0x${string}`;name:string;symbol:string;
  image_uri:string;website:string;twitter:string;telegram:string;observed_at_ms:number;
  fact_id:string;fact_payload_json:string;fact_evidence_digest:string;
}

export async function readCreatorSummary(db:D1DatabaseLike,address:string):Promise<Record<string,unknown>|null> {
  const creator=address.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(creator)) throw new Error('CREATOR_ADDRESS_INVALID');
  const snapshot=await readPublicSnapshot(db);
  if (!snapshot) return null;
  const rows=await db.prepare(`SELECT l.launch_id,l.event_id,l.chain_id,l.block_number,l.block_hash,l.source,
      l.launcher,l.tx_hash,l.log_index,l.token,l.creator,l.pool,l.name,l.symbol,l.image_uri,l.website,
      l.twitter,l.telegram,l.observed_at_ms,f.fact_id AS fact_id,f.payload_json AS fact_payload_json,
      f.evidence_digest AS fact_evidence_digest
    FROM launches l JOIN provenance_facts f ON f.launch_id=l.launch_id AND f.chain_id=l.chain_id
    WHERE l.chain_id=? AND l.source='PONS_V2' AND l.creator=?
      AND CAST(l.block_number AS INTEGER)<=CAST(? AS INTEGER)
    ORDER BY CAST(l.block_number AS INTEGER) DESC,l.log_index DESC,l.launch_id DESC LIMIT ?`)
    .bind(4663,creator,snapshot.checkpointBlock,MAX_CREATOR_SUMMARY_LAUNCHES)
    .all<CreatorLaunchRow>();
  if (!rows.success) throw new Error('CREATOR_SUMMARY_UNAVAILABLE');
  const launches=[];
  for (const row of rows.results??[]) {
    if (!/^[0-9a-f]{64}$/.test(row.launch_id)||!/^0x[0-9a-f]{40}$/.test(row.creator)||
        !/^(0|[1-9]\d*)$/.test(row.block_number)) throw new Error('CREATOR_SUMMARY_UNAVAILABLE');
    const launch:LaunchObserved={launchId:row.launch_id,eventId:row.event_id,chainId:row.chain_id,
      blockNumber:BigInt(row.block_number),blockHash:row.block_hash,source:row.source,launcher:row.launcher,
      txHash:row.tx_hash,logIndex:row.log_index,token:row.token,creator:row.creator,pool:row.pool,
      name:row.name,symbol:row.symbol,imageUri:row.image_uri,website:row.website,twitter:row.twitter,
      telegram:row.telegram,observedAtMs:row.observed_at_ms};
    const fact=await buildProvenanceFact(launch);
    if (row.fact_id!==fact.factId||row.fact_payload_json!==canonicalJson(fact)||row.fact_evidence_digest!==fact.evidenceDigest) {
      throw new Error('CREATOR_SUMMARY_UNAVAILABLE');
    }
    launches.push({
      launchId:row.launch_id,token:row.token,symbol:row.symbol,name:row.name,blockNumber:row.block_number,
      blockHash:row.block_hash,txHash:row.tx_hash,logIndex:row.log_index,pool:row.pool,
      metadata:{imageUri:row.image_uri,website:row.website,twitter:row.twitter,telegram:row.telegram},
      evidence:{factId:fact.factId,digest:fact.evidenceDigest,sourceEventId:fact.sourceEventId}
    });
  }
  if (launches.length===0) return null;
  return {
    schemaVersion:'binrat.creator-summary/0.1',chainId:4663,reportedCreatorAddress:creator,
    checkpointBlock:snapshot.checkpointBlock,checkpointBlockHash:snapshot.checkpointBlockHash,
    feedDigest:snapshot.feedDigest,
    coverage:{mode:'LATEST_4_VERIFIED_PONS_LAUNCHES',resultLimit:MAX_CREATOR_SUMMARY_LAUNCHES,
      olderLaunchesOmitted:true},
    launches
  };
}
