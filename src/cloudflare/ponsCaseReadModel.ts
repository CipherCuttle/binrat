import type { Hex } from '../core/types.js';
import type { PonsOutcomeBlockPoint } from '../pons/outcomeReceipts.js';
import { buildTrashTrailPresentation } from '../pons/ratTrapPresentation.js';
import {
  readPonsRatTrapProjection,
  type PonsRatTrapBlockPointReader
} from './ponsRatTrapReadModel.js';
import {
  readPonsReplaySnapshot,
  type PonsReplayBlockPointReader
} from './ponsReplayReadModel.js';
import {
  readPonsFundingRecurrence
} from './ponsFundingRecurrenceReadModel.js';
import type { D1DatabaseLike } from './d1Types.js';
import {
  buildBinratCaseModel,
  type BinratCaseModel,
  type BinratCaseCurrentLaunch
} from '../pons/caseModel.js';
import { ROBINHOOD_CHAIN_ID } from '../pons/chain.js';

export interface ReadBinratPonsCaseOptions {
  currentLaunchId:string;
  asOfBlock:bigint;
  maxPreviousLaunches?:number;
  maxRelatedFundingLaunches?:number;
}

export type BinratPonsCaseBlockPointReader =
  PonsRatTrapBlockPointReader &
  PonsReplayBlockPointReader;

interface CurrentLaunchRow {
  launch_id:string;
  token:Hex;
  creator:Hex;
  name:string;
  symbol:string;
  block_number:string;
  block_hash:Hex;
}

export async function readBinratPonsCase(
  db:D1DatabaseLike,
  blockSource:BinratPonsCaseBlockPointReader,
  options:ReadBinratPonsCaseOptions
):Promise<BinratCaseModel> {
  if(!/^[0-9a-f]{64}$/i.test(options.currentLaunchId)) {
    throw new Error('BINRAT_CASE_ADAPTER_LAUNCH_ID_INVALID');
  }
  if(options.asOfBlock<0n) throw new Error('BINRAT_CASE_ADAPTER_BLOCK_INVALID');

  const source=new MemoizedBlockPointReader(blockSource);

  const replay=await readPonsReplaySnapshot(db,source,{
    targetLaunchId:options.currentLaunchId,
    asOfBlock:options.asOfBlock,
    maxPreviousLaunches:options.maxPreviousLaunches
  });
  if(!replay.targetLaunchKnown||!replay.targetLaunch) {
    throw new Error('BINRAT_CASE_ADAPTER_TARGET_NOT_KNOWN');
  }

  const projection=await readPonsRatTrapProjection(db,source,{
    currentLaunchId:options.currentLaunchId,
    asOfBlock:options.asOfBlock,
    maxPreviousLaunches:options.maxPreviousLaunches
  });
  const trashTrail=buildTrashTrailPresentation(projection);

  const funding=await readPonsFundingRecurrence(db,{
    currentLaunchId:options.currentLaunchId,
    asOfBlock:options.asOfBlock,
    maxRelatedLaunches:options.maxRelatedFundingLaunches
  });

  const currentRow=await db.prepare(
    "SELECT launch_id,token,creator,name,symbol,block_number,block_hash FROM launches WHERE chain_id=? AND source='PONS_V2' AND launch_id=? LIMIT 1"
  ).bind(
    ROBINHOOD_CHAIN_ID,
    options.currentLaunchId.toLowerCase()
  ).first<CurrentLaunchRow>();
  if(!currentRow) throw new Error('BINRAT_CASE_ADAPTER_CURRENT_LAUNCH_MISSING');

  assertSiblingAgreement({
    launchId:options.currentLaunchId,
    asOfBlock:options.asOfBlock,
    row:currentRow,
    replay,
    projection,
    funding
  });

  const current=buildCurrentLaunch(currentRow,replay.targetLaunch.tokenIdentity);

  return buildBinratCaseModel({
    current,
    asOfBlock:options.asOfBlock,
    trashTrail:{
      targetLaunchId:projection.currentLaunchId,
      asOfBlock:projection.asOfBlock.toString(),
      presentationVersion:trashTrail.presentationVersion,
      previousLaunches:trashTrail.summary.previousLaunches,
      launchesWithAnyMemory:trashTrail.summary.launchesWithAnyMemory,
      launchesWithFullMemory:trashTrail.summary.launchesWithFullMemory,
      coverageText:trashTrail.summary.coverageText,
      canOfferRatWatch:trashTrail.summary.canOfferRatWatch
    },
    replay:{
      targetLaunchId:replay.targetLaunchId,
      asOfBlock:replay.asOfBlock,
      replayVersion:replay.replayVersion,
      semantics:replay.semantics,
      targetLaunchKnown:replay.targetLaunchKnown,
      outputDigest:replay.outputDigest
    },
    funding
  });
}

function assertSiblingAgreement(input:{
  launchId:string;
  asOfBlock:bigint;
  row:CurrentLaunchRow;
  replay:Awaited<ReturnType<typeof readPonsReplaySnapshot>>;
  projection:Awaited<ReturnType<typeof readPonsRatTrapProjection>>;
  funding:Awaited<ReturnType<typeof readPonsFundingRecurrence>>;
}):void {
  const expectedLaunch=input.launchId.toLowerCase();
  const expectedBlock=input.asOfBlock.toString();
  const replayTarget=input.replay.targetLaunch;
  if(!replayTarget) throw new Error('BINRAT_CASE_ADAPTER_REPLAY_TARGET_MISSING');

  if(
    input.row.launch_id.toLowerCase()!==expectedLaunch ||
    input.replay.targetLaunchId.toLowerCase()!==expectedLaunch ||
    input.projection.currentLaunchId.toLowerCase()!==expectedLaunch ||
    input.funding.currentLaunchId.toLowerCase()!==expectedLaunch
  ) {
    throw new Error('BINRAT_CASE_ADAPTER_TARGET_MISMATCH');
  }

  if(
    input.replay.asOfBlock!==expectedBlock ||
    input.projection.asOfBlock.toString()!==expectedBlock ||
    input.funding.asOfBlock!==expectedBlock
  ) {
    throw new Error('BINRAT_CASE_ADAPTER_BLOCK_MISMATCH');
  }

  if(
    input.row.token.toLowerCase()!==replayTarget.token.toLowerCase() ||
    input.row.creator.toLowerCase()!==replayTarget.deployer.toLowerCase() ||
    input.projection.deployer.toLowerCase()!==replayTarget.deployer.toLowerCase()
  ) {
    throw new Error('BINRAT_CASE_ADAPTER_AUTHORITY_MISMATCH');
  }

  if(
    BigInt(input.row.block_number)!==BigInt(replayTarget.launchBlock) ||
    input.row.block_hash.toLowerCase()!==replayTarget.launchBlockHash.toLowerCase()
  ) {
    throw new Error('BINRAT_CASE_ADAPTER_LAUNCH_POINT_MISMATCH');
  }
}

function buildCurrentLaunch(
  row:CurrentLaunchRow,
  identity:NonNullable<Awaited<ReturnType<typeof readPonsReplaySnapshot>>['targetLaunch']>['tokenIdentity']
):BinratCaseCurrentLaunch {
  const receiptSymbol=identity?.symbol.trim()??'';
  const receiptName=identity?.name.trim()??'';
  const canonicalSymbol=row.symbol.trim();
  const canonicalName=row.name.trim();

  if(receiptSymbol) {
    return baseCurrent(row,receiptSymbol.startsWith('$')?receiptSymbol:'$'+receiptSymbol,'PERSISTED_TOKEN_IDENTITY');
  }
  if(receiptName) {
    return baseCurrent(row,receiptName,'PERSISTED_TOKEN_IDENTITY');
  }
  if(canonicalSymbol) {
    return baseCurrent(row,canonicalSymbol.startsWith('$')?canonicalSymbol:'$'+canonicalSymbol,'CANONICAL_LAUNCH');
  }
  if(canonicalName) {
    return baseCurrent(row,canonicalName,'CANONICAL_LAUNCH');
  }
  return baseCurrent(row,shortAddress(row.token),'TOKEN_ADDRESS');
}

function baseCurrent(
  row:CurrentLaunchRow,
  label:string,
  labelSource:BinratCaseCurrentLaunch['labelSource']
):BinratCaseCurrentLaunch {
  return {
    chainId:ROBINHOOD_CHAIN_ID,
    launchId:row.launch_id.toLowerCase(),
    token:row.token.toLowerCase() as Hex,
    deployer:row.creator.toLowerCase() as Hex,
    label,
    labelSource
  };
}

class MemoizedBlockPointReader implements BinratPonsCaseBlockPointReader {
  private readonly cache=new Map<string,Promise<PonsOutcomeBlockPoint>>();

  constructor(private readonly inner:BinratPonsCaseBlockPointReader) {}

  getBlockPoint(blockNumber:bigint):Promise<PonsOutcomeBlockPoint> {
    const key=blockNumber.toString();
    const existing=this.cache.get(key);
    if(existing) return existing;

    const loaded=this.inner.getBlockPoint(blockNumber).then((point)=>{
      if(point.blockNumber!==blockNumber) {
        throw new Error('BINRAT_CASE_ADAPTER_BLOCK_NUMBER_DRIFT:'+key);
      }
      if(!/^0x[0-9a-f]{64}$/i.test(point.blockHash)) {
        throw new Error('BINRAT_CASE_ADAPTER_BLOCK_HASH_INVALID:'+key);
      }
      if(!Number.isSafeInteger(point.timestampMs)||point.timestampMs<0) {
        throw new Error('BINRAT_CASE_ADAPTER_BLOCK_TIMESTAMP_INVALID:'+key);
      }
      return {
        blockNumber:point.blockNumber,
        blockHash:point.blockHash.toLowerCase() as Hex,
        timestampMs:point.timestampMs
      };
    });
    this.cache.set(key,loaded);
    return loaded;
  }
}

function shortAddress(value:string):string {
  return value.length>20?`${value.slice(0,8)}…${value.slice(-6)}`:value;
}
