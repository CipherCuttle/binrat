import type { Hex, LaunchObserved } from '../core/types.js';
import {
  parsePonsOutcomeObservationReceipt,
  type PonsOutcomeBlockPoint,
  type PonsOutcomeObservationReceipt
} from '../pons/outcomeReceipts.js';
import {
  buildPonsRatTrapProjection,
  type PonsRatTrapProjection,
  type PonsRatTrapTokenIdentityProjection
} from '../pons/ratTrapProjection.js';
import { parsePonsTokenIdentityReceipt } from '../pons/tokenIdentity.js';
import { ROBINHOOD_CHAIN_ID } from '../pons/chain.js';
import type { D1DatabaseLike, D1PreparedStatementLike } from './d1Types.js';

export interface PonsRatTrapBlockPointReader {
  getBlockPoint(blockNumber: bigint): Promise<PonsOutcomeBlockPoint>;
}

export interface ReadPonsRatTrapProjectionOptions {
  currentLaunchId: string;
  asOfBlock: bigint;
  maxPreviousLaunches?: number;
}

const DEFAULT_MAX_PREVIOUS_LAUNCHES = 100;

export async function readPonsRatTrapProjection(
  db: D1DatabaseLike,
  blockSource: PonsRatTrapBlockPointReader,
  options: ReadPonsRatTrapProjectionOptions
): Promise<PonsRatTrapProjection> {
  const maxPreviousLaunches = options.maxPreviousLaunches ?? DEFAULT_MAX_PREVIOUS_LAUNCHES;
  if (
    !Number.isSafeInteger(maxPreviousLaunches) ||
    maxPreviousLaunches < 1 ||
    maxPreviousLaunches > 500
  ) {
    throw new Error('PONS_RAT_TRAP_READ_LIMIT_INVALID');
  }
  if (options.asOfBlock < 0n) throw new Error('PONS_RAT_TRAP_AS_OF_BLOCK_INVALID');

  const checkpoint = await db.prepare(
    'SELECT block_number,block_hash FROM chain_checkpoints WHERE chain_id=? LIMIT 1'
  ).bind(ROBINHOOD_CHAIN_ID).first<{block_number:string;block_hash:Hex}>();
  if (!checkpoint) throw new Error('PONS_RAT_TRAP_CHECKPOINT_MISSING');
  const checkpointBlock = BigInt(checkpoint.block_number);
  if (checkpointBlock < options.asOfBlock) {
    throw new Error('PONS_RAT_TRAP_CHECKPOINT_BEHIND_AS_OF');
  }

  const currentRow = await readLaunchRow(
    db.prepare(`
      SELECT launch_id,event_id,chain_id,block_number,block_hash,source,launcher,tx_hash,log_index,
             token,creator,pool,name,symbol,image_uri,website,twitter,telegram,observed_at_ms
      FROM launches
      WHERE chain_id=? AND source='PONS_V2' AND launch_id=?
      LIMIT 1
    `).bind(ROBINHOOD_CHAIN_ID, options.currentLaunchId)
  );
  if (!currentRow) throw new Error('PONS_RAT_TRAP_CURRENT_LAUNCH_MISSING');
  const currentLaunch = fromLaunchRow(currentRow);
  if (currentLaunch.blockNumber > options.asOfBlock) {
    throw new Error('PONS_RAT_TRAP_CURRENT_LAUNCH_AFTER_AS_OF');
  }

  const previousCountRow = await db.prepare(`
    SELECT COUNT(*) AS n
    FROM launches
    WHERE chain_id=?
      AND source='PONS_V2'
      AND creator=?
      AND (
        CAST(block_number AS INTEGER) < CAST(? AS INTEGER)
        OR (
          CAST(block_number AS INTEGER) = CAST(? AS INTEGER)
          AND (
            log_index < ?
            OR (log_index = ? AND launch_id < ?)
          )
        )
      )
      AND CAST(block_number AS INTEGER) <= CAST(? AS INTEGER)
  `).bind(
    ROBINHOOD_CHAIN_ID,
    currentLaunch.creator.toLowerCase(),
    currentLaunch.blockNumber.toString(),
    currentLaunch.blockNumber.toString(),
    currentLaunch.logIndex,
    currentLaunch.logIndex,
    currentLaunch.launchId,
    options.asOfBlock.toString()
  ).first<{n:number}>();
  const previousCount = Number(previousCountRow?.n ?? 0);
  if (!Number.isSafeInteger(previousCount) || previousCount < 0) {
    throw new Error('PONS_RAT_TRAP_COHORT_COUNT_INVALID');
  }
  if (previousCount > maxPreviousLaunches) {
    throw new Error(`PONS_RAT_TRAP_COHORT_LIMIT_EXCEEDED:${previousCount}`);
  }

  const previousResult = await db.prepare(`
    SELECT launch_id,event_id,chain_id,block_number,block_hash,source,launcher,tx_hash,log_index,
           token,creator,pool,name,symbol,image_uri,website,twitter,telegram,observed_at_ms
    FROM launches
    WHERE chain_id=?
      AND source='PONS_V2'
      AND creator=?
      AND (
        CAST(block_number AS INTEGER) < CAST(? AS INTEGER)
        OR (
          CAST(block_number AS INTEGER) = CAST(? AS INTEGER)
          AND (
            log_index < ?
            OR (log_index = ? AND launch_id < ?)
          )
        )
      )
      AND CAST(block_number AS INTEGER) <= CAST(? AS INTEGER)
    ORDER BY CAST(block_number AS INTEGER) DESC,log_index DESC,launch_id DESC
  `).bind(
    ROBINHOOD_CHAIN_ID,
    currentLaunch.creator.toLowerCase(),
    currentLaunch.blockNumber.toString(),
    currentLaunch.blockNumber.toString(),
    currentLaunch.logIndex,
    currentLaunch.logIndex,
    currentLaunch.launchId,
    options.asOfBlock.toString()
  ).all<LaunchRow>();
  if (!previousResult.success) throw new Error('PONS_RAT_TRAP_COHORT_QUERY_FAILED');
  const previousLaunches = (previousResult.results ?? []).map(fromLaunchRow);
  if (previousLaunches.length !== previousCount) {
    throw new Error('PONS_RAT_TRAP_COHORT_COUNT_DRIFT');
  }

  const allLaunches = [currentLaunch, ...previousLaunches];
  const canonicalLaunchTimestampMsByLaunch = new Map<string, number>();
  const blockPoints = new Map<string, PonsOutcomeBlockPoint>();
  for (const launch of allLaunches) {
    const key = launch.blockNumber.toString();
    let point = blockPoints.get(key);
    if (!point) {
      point = await blockSource.getBlockPoint(launch.blockNumber);
      if (point.blockNumber !== launch.blockNumber) {
        throw new Error(`PONS_RAT_TRAP_BLOCK_NUMBER_DRIFT:${launch.launchId}`);
      }
      blockPoints.set(key, point);
    }
    if (point.blockHash.toLowerCase() !== launch.blockHash.toLowerCase()) {
      throw new Error(`PONS_RAT_TRAP_LAUNCH_REORG:${launch.launchId}`);
    }
    canonicalLaunchTimestampMsByLaunch.set(launch.launchId, point.timestampMs);
  }

  const asOfPoint = await blockSource.getBlockPoint(options.asOfBlock);
  if (asOfPoint.blockNumber !== options.asOfBlock) {
    throw new Error('PONS_RAT_TRAP_AS_OF_BLOCK_NUMBER_DRIFT');
  }
  if (
    options.asOfBlock === checkpointBlock &&
    asOfPoint.blockHash.toLowerCase() !== checkpoint.block_hash.toLowerCase()
  ) {
    throw new Error('PONS_RAT_TRAP_CHECKPOINT_REORG');
  }

  const receiptsByLaunch = await readReceiptsForLaunches(
    db,
    previousLaunches.map((launch) => launch.launchId)
  );
  const tokenIdentityByLaunch = await readTokenIdentitiesForLaunches(
    db,
    blockSource,
    previousLaunches,
    options.asOfBlock
  );

  return buildPonsRatTrapProjection({
    currentLaunch,
    launches: allLaunches,
    receiptsByLaunch,
    canonicalLaunchTimestampMsByLaunch,
    tokenIdentityByLaunch,
    asOfBlock: options.asOfBlock,
    asOfTimestampMs: asOfPoint.timestampMs
  });
}

async function readReceiptsForLaunches(
  db: D1DatabaseLike,
  launchIds: readonly string[]
): Promise<Map<string, PonsOutcomeObservationReceipt[]>> {
  const result = new Map<string, PonsOutcomeObservationReceipt[]>();
  if (!launchIds.length) return result;

  const placeholders = launchIds.map(() => '?').join(',');
  const rows = await db.prepare(`
    SELECT launch_id,payload_json
    FROM pons_outcome_receipts
    WHERE chain_id=?
      AND launch_id IN (${placeholders})
    ORDER BY launch_id,horizon_ms,observation_version,observation_id
  `).bind(ROBINHOOD_CHAIN_ID, ...launchIds).all<{launch_id:string;payload_json:string}>();
  if (!rows.success) throw new Error('PONS_RAT_TRAP_RECEIPT_QUERY_FAILED');

  for (const row of rows.results ?? []) {
    if (!launchIds.includes(row.launch_id)) {
      throw new Error('PONS_RAT_TRAP_RECEIPT_SCOPE_DRIFT');
    }
    const receipt = await parsePonsOutcomeObservationReceipt(row.payload_json);
    const list = result.get(row.launch_id) ?? [];
    list.push(receipt);
    result.set(row.launch_id, list);
  }
  return result;
}


async function readTokenIdentitiesForLaunches(
  db: D1DatabaseLike,
  blockSource: PonsRatTrapBlockPointReader,
  launches: readonly LaunchObserved[],
  asOfBlock: bigint
): Promise<Map<string, PonsRatTrapTokenIdentityProjection>> {
  const result = new Map<string, PonsRatTrapTokenIdentityProjection>();
  if (!launches.length) return result;

  const table = await db.prepare(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='pons_token_identity_receipts'"
  ).first<{n:number}>();
  if (Number(table?.n ?? 0) !== 1) return result;

  const byLaunch = new Map(launches.map((launch) => [launch.launchId, launch]));
  const launchIds = launches.map((launch) => launch.launchId);
  const placeholders = launchIds.map(() => '?').join(',');
  const rows = await db.prepare(`
    SELECT launch_id,payload_json
    FROM pons_token_identity_receipts
    WHERE chain_id=?
      AND launch_id IN (${placeholders})
    ORDER BY launch_id
  `).bind(ROBINHOOD_CHAIN_ID, ...launchIds).all<{launch_id:string;payload_json:string}>();
  if (!rows.success) throw new Error('PONS_RAT_TRAP_IDENTITY_QUERY_FAILED');

  for (const row of rows.results ?? []) {
    const launch = byLaunch.get(row.launch_id);
    if (!launch) throw new Error('PONS_RAT_TRAP_IDENTITY_SCOPE_DRIFT');
    const receipt = await parsePonsTokenIdentityReceipt(row.payload_json);
    if (receipt.launchId !== launch.launchId || receipt.token.toLowerCase() !== launch.token.toLowerCase()) {
      throw new Error(`PONS_RAT_TRAP_IDENTITY_LAUNCH_MISMATCH:${launch.launchId}`);
    }
    if (receipt.observedBlock > asOfBlock) continue;
    const point = await blockSource.getBlockPoint(receipt.observedBlock);
    if (point.blockNumber !== receipt.observedBlock || point.blockHash.toLowerCase() !== receipt.observedBlockHash.toLowerCase()) {
      throw new Error(`PONS_RAT_TRAP_IDENTITY_REORG:${launch.launchId}`);
    }
    result.set(launch.launchId, {
      identityId: receipt.identityId,
      name: receipt.name,
      symbol: receipt.symbol,
      decimals: receipt.decimals,
      observedBlock: receipt.observedBlock,
      evidenceDigest: receipt.evidenceDigest
    });
  }
  return result;
}

async function readLaunchRow(statement: D1PreparedStatementLike): Promise<LaunchRow | null> {
  return statement.first<LaunchRow>();
}

interface LaunchRow {
  launch_id:string;
  event_id:string;
  chain_id:number;
  block_number:string;
  block_hash:Hex;
  source:'PONS_V2';
  launcher:Hex;
  tx_hash:Hex;
  log_index:number;
  token:Hex;
  creator:Hex;
  pool:Hex;
  name:string;
  symbol:string;
  image_uri:string;
  website:string;
  twitter:string;
  telegram:string;
  observed_at_ms:number;
}

function fromLaunchRow(row: LaunchRow): LaunchObserved {
  return {
    launchId:row.launch_id,
    eventId:row.event_id,
    chainId:row.chain_id,
    blockNumber:BigInt(row.block_number),
    blockHash:row.block_hash.toLowerCase() as Hex,
    source:row.source,
    launcher:row.launcher.toLowerCase() as Hex,
    txHash:row.tx_hash.toLowerCase() as Hex,
    logIndex:row.log_index,
    token:row.token.toLowerCase() as Hex,
    creator:row.creator.toLowerCase() as Hex,
    pool:row.pool.toLowerCase() as Hex,
    name:row.name,
    symbol:row.symbol,
    imageUri:row.image_uri,
    website:row.website,
    twitter:row.twitter,
    telegram:row.telegram,
    observedAtMs:row.observed_at_ms
  };
}
