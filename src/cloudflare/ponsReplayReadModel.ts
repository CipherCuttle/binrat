import type { Hex, LaunchObserved } from '../core/types.js';
import type { ProvenanceFact } from '../intelligence/provenance.js';
import { ROBINHOOD_CHAIN_ID } from '../pons/chain.js';
import { parsePonsOutcomeObservationReceipt, type PonsOutcomeBlockPoint, type PonsOutcomeObservationReceipt } from '../pons/outcomeReceipts.js';
import { buildPonsReplaySnapshot, type PonsReplayLaunchEvidenceInput, type PonsReplaySnapshot } from '../pons/replayLab.js';
import { parsePonsTokenIdentityReceipt, type PonsTokenIdentityReceipt } from '../pons/tokenIdentity.js';
import type { D1DatabaseLike, D1PreparedStatementLike } from './d1Types.js';

export interface PonsReplayBlockPointReader {
  getBlockPoint(blockNumber:bigint):Promise<PonsOutcomeBlockPoint>;
}

export interface ReadPonsReplayOptions {
  targetLaunchId:string;
  asOfBlock:bigint;
  maxPreviousLaunches?:number;
}

const DEFAULT_MAX_PREVIOUS_LAUNCHES=100;

export async function readPonsReplaySnapshot(
  db:D1DatabaseLike,
  blockSource:PonsReplayBlockPointReader,
  options:ReadPonsReplayOptions
):Promise<PonsReplaySnapshot> {
  if (!/^[0-9a-f]{64}$/i.test(options.targetLaunchId)) throw new Error('PONS_REPLAY_TARGET_ID_INVALID');
  if (options.asOfBlock<0n) throw new Error('PONS_REPLAY_AS_OF_BLOCK_INVALID');
  const maxPrevious=options.maxPreviousLaunches??DEFAULT_MAX_PREVIOUS_LAUNCHES;
  if (!Number.isSafeInteger(maxPrevious)||maxPrevious<1||maxPrevious>500) throw new Error('PONS_REPLAY_READ_LIMIT_INVALID');

  const checkpoint=await db.prepare(
    'SELECT block_number,block_hash FROM chain_checkpoints WHERE chain_id=? LIMIT 1'
  ).bind(ROBINHOOD_CHAIN_ID).first<{block_number:string;block_hash:Hex}>();
  if (!checkpoint) throw new Error('PONS_REPLAY_CHECKPOINT_MISSING');
  const checkpointBlock=BigInt(checkpoint.block_number);
  if (checkpointBlock<options.asOfBlock) throw new Error('PONS_REPLAY_CHECKPOINT_BEHIND_AS_OF');

  const pointCache=new Map<string,PonsOutcomeBlockPoint>();
  const point=async(blockNumber:bigint):Promise<PonsOutcomeBlockPoint>=>{
    const key=blockNumber.toString();
    const existing=pointCache.get(key);
    if (existing) return existing;
    const loaded=await blockSource.getBlockPoint(blockNumber);
    if (loaded.blockNumber!==blockNumber) throw new Error('PONS_REPLAY_BLOCK_NUMBER_DRIFT:'+key);
    if (!Number.isSafeInteger(loaded.timestampMs)||loaded.timestampMs<0) throw new Error('PONS_REPLAY_BLOCK_TIMESTAMP_INVALID:'+key);
    pointCache.set(key,loaded);
    return loaded;
  };

  const asOf=await point(options.asOfBlock);
  if (options.asOfBlock===checkpointBlock && asOf.blockHash.toLowerCase()!==checkpoint.block_hash.toLowerCase()) {
    throw new Error('PONS_REPLAY_CHECKPOINT_REORG');
  }

  const targetRow=await readLaunchRow(db.prepare(
    "SELECT launch_id,event_id,chain_id,block_number,block_hash,source,launcher,tx_hash,log_index,token,creator,pool,name,symbol,image_uri,website,twitter,telegram,observed_at_ms FROM launches WHERE chain_id=? AND source='PONS_V2' AND launch_id=? LIMIT 1"
  ).bind(ROBINHOOD_CHAIN_ID,options.targetLaunchId.toLowerCase()));

  if (!targetRow || BigInt(targetRow.block_number)>options.asOfBlock) {
    return buildPonsReplaySnapshot({targetLaunchId:options.targetLaunchId,asOf,target:null,previous:[]});
  }

  const targetLaunch=fromLaunchRow(targetRow);
  const countRow=await db.prepare(
    "SELECT COUNT(*) AS n FROM launches WHERE chain_id=? AND source='PONS_V2' AND creator=? AND (CAST(block_number AS INTEGER)<CAST(? AS INTEGER) OR (CAST(block_number AS INTEGER)=CAST(? AS INTEGER) AND (log_index<? OR (log_index=? AND launch_id<?)))) AND CAST(block_number AS INTEGER)<=CAST(? AS INTEGER)"
  ).bind(
    ROBINHOOD_CHAIN_ID,targetLaunch.creator.toLowerCase(),targetLaunch.blockNumber.toString(),
    targetLaunch.blockNumber.toString(),targetLaunch.logIndex,targetLaunch.logIndex,targetLaunch.launchId,
    options.asOfBlock.toString()
  ).first<{n:number}>();
  const previousCount=Number(countRow?.n??0);
  if (!Number.isSafeInteger(previousCount)||previousCount<0) throw new Error('PONS_REPLAY_COHORT_COUNT_INVALID');
  if (previousCount>maxPrevious) throw new Error('PONS_REPLAY_COHORT_LIMIT_EXCEEDED:'+previousCount);

  const previousRows=await db.prepare(
    "SELECT launch_id,event_id,chain_id,block_number,block_hash,source,launcher,tx_hash,log_index,token,creator,pool,name,symbol,image_uri,website,twitter,telegram,observed_at_ms FROM launches WHERE chain_id=? AND source='PONS_V2' AND creator=? AND (CAST(block_number AS INTEGER)<CAST(? AS INTEGER) OR (CAST(block_number AS INTEGER)=CAST(? AS INTEGER) AND (log_index<? OR (log_index=? AND launch_id<?)))) AND CAST(block_number AS INTEGER)<=CAST(? AS INTEGER) ORDER BY CAST(block_number AS INTEGER) DESC,log_index DESC,launch_id DESC"
  ).bind(
    ROBINHOOD_CHAIN_ID,targetLaunch.creator.toLowerCase(),targetLaunch.blockNumber.toString(),
    targetLaunch.blockNumber.toString(),targetLaunch.logIndex,targetLaunch.logIndex,targetLaunch.launchId,
    options.asOfBlock.toString()
  ).all<LaunchRow>();
  if (!previousRows.success) throw new Error('PONS_REPLAY_COHORT_QUERY_FAILED');
  const previousLaunches=(previousRows.results??[]).map(fromLaunchRow);
  if (previousLaunches.length!==previousCount) throw new Error('PONS_REPLAY_COHORT_COUNT_DRIFT');

  const hydrate=async(launch:LaunchObserved):Promise<PonsReplayLaunchEvidenceInput>=>{
    const launchPoint=await point(launch.blockNumber);
    if (launchPoint.blockHash.toLowerCase()!==launch.blockHash.toLowerCase()) throw new Error('PONS_REPLAY_LAUNCH_REORG:'+launch.launchId);

    const provenance=await readProvenanceFact(db,launch,options.asOfBlock,point);
    const tokenIdentity=await readTokenIdentity(db,launch,options.asOfBlock,point);
    const observations=await readObservations(db,launch,options.asOfBlock,point);
    return {
      launch,
      launchTimestampMs:launchPoint.timestampMs,
      provenanceFact:provenance,
      tokenIdentity,
      observations
    };
  };

  const target=await hydrate(targetLaunch);
  const previous=[] as PonsReplayLaunchEvidenceInput[];
  for (const launch of previousLaunches) previous.push(await hydrate(launch));
  return buildPonsReplaySnapshot({targetLaunchId:options.targetLaunchId,asOf,target,previous});
}

async function readProvenanceFact(
  db:D1DatabaseLike,launch:LaunchObserved,asOfBlock:bigint,point:(blockNumber:bigint)=>Promise<PonsOutcomeBlockPoint>
):Promise<ProvenanceFact|null> {
  const row=await db.prepare(
    'SELECT fact_id,chain_id,launch_id,creator,observed_block,observed_block_hash,log_index,source_event_id,evidence_digest FROM provenance_facts WHERE chain_id=? AND launch_id=? LIMIT 1'
  ).bind(ROBINHOOD_CHAIN_ID,launch.launchId).first<FactRow>();
  if (!row) return null;
  const observedBlock=BigInt(row.observed_block);
  if (observedBlock>asOfBlock) return null;
  const observed=await point(observedBlock);
  if (observed.blockHash.toLowerCase()!==row.observed_block_hash.toLowerCase()) throw new Error('PONS_REPLAY_PROVENANCE_REORG:'+launch.launchId);
  return {
    factId:row.fact_id,kind:'PONS_REPORTED_DEPLOYER',chainId:row.chain_id,launchId:row.launch_id,
    creator:row.creator.toLowerCase() as Hex,observedBlock,
    observedBlockHash:row.observed_block_hash.toLowerCase() as Hex,logIndex:row.log_index,
    sourceEventId:row.source_event_id,evidenceDigest:row.evidence_digest
  };
}

async function readTokenIdentity(
  db:D1DatabaseLike,launch:LaunchObserved,asOfBlock:bigint,point:(blockNumber:bigint)=>Promise<PonsOutcomeBlockPoint>
):Promise<PonsTokenIdentityReceipt|null> {
  const row=await db.prepare(
    'SELECT payload_json FROM pons_token_identity_receipts WHERE chain_id=? AND launch_id=? LIMIT 1'
  ).bind(ROBINHOOD_CHAIN_ID,launch.launchId).first<{payload_json:string}>();
  if (!row) return null;
  const receipt=await parsePonsTokenIdentityReceipt(row.payload_json);
  if (receipt.observedBlock>asOfBlock) return null;
  const observed=await point(receipt.observedBlock);
  if (observed.blockHash.toLowerCase()!==receipt.observedBlockHash.toLowerCase()) throw new Error('PONS_REPLAY_IDENTITY_REORG:'+launch.launchId);
  return receipt;
}

async function readObservations(
  db:D1DatabaseLike,launch:LaunchObserved,asOfBlock:bigint,point:(blockNumber:bigint)=>Promise<PonsOutcomeBlockPoint>
):Promise<PonsOutcomeObservationReceipt[]> {
  const rows=await db.prepare(
    'SELECT payload_json FROM pons_outcome_receipts WHERE chain_id=? AND launch_id=? ORDER BY horizon_ms,observation_id'
  ).bind(ROBINHOOD_CHAIN_ID,launch.launchId).all<{payload_json:string}>();
  if (!rows.success) throw new Error('PONS_REPLAY_OUTCOME_QUERY_FAILED');
  const result=[] as PonsOutcomeObservationReceipt[];
  for (const row of rows.results??[]) {
    const receipt=await parsePonsOutcomeObservationReceipt(row.payload_json);
    if (receipt.observedBlock>asOfBlock) continue;
    const observed=await point(receipt.observedBlock);
    if (observed.blockHash.toLowerCase()!==receipt.observedBlockHash.toLowerCase()) throw new Error('PONS_REPLAY_OUTCOME_REORG:'+launch.launchId);
    if (observed.timestampMs!==receipt.observedTimestampMs) throw new Error('PONS_REPLAY_OUTCOME_TIMESTAMP_DRIFT:'+launch.launchId);
    result.push(receipt);
  }
  return result;
}

async function readLaunchRow(statement:D1PreparedStatementLike):Promise<LaunchRow|null> {
  return statement.first<LaunchRow>();
}

interface LaunchRow {
  launch_id:string;event_id:string;chain_id:number;block_number:string;block_hash:Hex;source:'PONS_V2';
  launcher:Hex;tx_hash:Hex;log_index:number;token:Hex;creator:Hex;pool:Hex;name:string;symbol:string;
  image_uri:string;website:string;twitter:string;telegram:string;observed_at_ms:number;
}

interface FactRow {
  fact_id:string;chain_id:number;launch_id:string;creator:Hex;observed_block:string;observed_block_hash:Hex;
  log_index:number;source_event_id:string;evidence_digest:string;
}

function fromLaunchRow(row:LaunchRow):LaunchObserved {
  return {
    launchId:row.launch_id,eventId:row.event_id,chainId:row.chain_id,blockNumber:BigInt(row.block_number),
    blockHash:row.block_hash.toLowerCase() as Hex,source:row.source,launcher:row.launcher.toLowerCase() as Hex,
    txHash:row.tx_hash.toLowerCase() as Hex,logIndex:row.log_index,token:row.token.toLowerCase() as Hex,
    creator:row.creator.toLowerCase() as Hex,pool:row.pool.toLowerCase() as Hex,name:row.name,symbol:row.symbol,
    imageUri:row.image_uri,website:row.website,twitter:row.twitter,telegram:row.telegram,observedAtMs:row.observed_at_ms
  };
}
