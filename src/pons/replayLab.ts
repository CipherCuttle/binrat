import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import type { Hex, LaunchObserved } from '../core/types.js';
import { buildProvenanceFact, type ProvenanceFact } from '../intelligence/provenance.js';
import { ROBINHOOD_CHAIN_ID } from './chain.js';
import { verifyPonsOutcomeObservationReceipt, type PonsOutcomeObservationReceipt } from './outcomeReceipts.js';
import { verifyPonsTokenIdentityReceipt, type PonsTokenIdentityReceipt } from './tokenIdentity.js';

export const PONS_REPLAY_LAB_VERSION='BINRAT_PONS_REPLAY_LAB_V1' as const;
export const PONS_REPLAY_HORIZONS=[
  {label:'5m',ms:300_000},
  {label:'1h',ms:3_600_000},
  {label:'24h',ms:86_400_000}
] as const;

export type PonsReplayHorizonState='COMPLETE'|'PARTIAL'|'PENDING'|'IMMATURE';

export interface PonsReplayBlockPoint {
  blockNumber:bigint;
  blockHash:Hex;
  timestampMs:number;
}

export interface PonsReplayLaunchEvidenceInput {
  launch:LaunchObserved;
  launchTimestampMs:number;
  provenanceFact:ProvenanceFact|null;
  tokenIdentity:PonsTokenIdentityReceipt|null;
  observations:readonly PonsOutcomeObservationReceipt[];
}

export interface PonsReplayObservation {
  horizonLabel:'5m'|'1h'|'24h';
  horizonMs:number;
  state:PonsReplayHorizonState;
  targetTimestampMs:number;
  observationId:string|null;
  observedBlock:string|null;
  observedBlockHash:Hex|null;
  observedTimestampMs:number|null;
  phase:'CURVE'|'GRADUATED'|null;
  pairToken:Hex|null;
  quoteDecimals:number|null;
  estimatedFdvQuoteRaw:string|null;
  missing:string[];
  evidenceDigest:string|null;
}

export interface PonsReplayLaunchSnapshot {
  launchId:string;
  token:Hex;
  curve:Hex;
  deployer:Hex;
  launchBlock:string;
  launchBlockHash:Hex;
  launchTimestampMs:number;
  provenance:{
    state:'OBSERVED'|'MISSING';
    factId:string|null;
    evidenceDigest:string|null;
  };
  tokenIdentity:null|{
    identityId:string;
    name:string;
    symbol:string;
    decimals:number;
    observedBlock:string;
    observedBlockHash:Hex;
    evidenceDigest:string;
  };
  observations:PonsReplayObservation[];
}

export interface PonsReplaySnapshot {
  replayVersion:typeof PONS_REPLAY_LAB_VERSION;
  chainId:typeof ROBINHOOD_CHAIN_ID;
  semantics:'KNOWABLE_AS_OF_BLOCK';
  targetLaunchId:string;
  asOfBlock:string;
  asOfBlockHash:Hex;
  asOfTimestampMs:number;
  targetLaunchKnown:boolean;
  targetLaunch:PonsReplayLaunchSnapshot|null;
  previousLaunches:PonsReplayLaunchSnapshot[];
  boundaries:{
    noLookahead:string;
    ingestionAudit:string;
    deployerIdentity:string;
    recommendation:string;
  };
  outputDigest:string;
}

export async function buildPonsReplaySnapshot(input:{
  targetLaunchId:string;
  asOf:PonsReplayBlockPoint;
  target:PonsReplayLaunchEvidenceInput|null;
  previous:readonly PonsReplayLaunchEvidenceInput[];
}):Promise<PonsReplaySnapshot> {
  assertAsOf(input.asOf);
  if (!/^[0-9a-f]{64}$/i.test(input.targetLaunchId)) throw new Error('PONS_REPLAY_TARGET_ID_INVALID');

  const knownTarget=input.target && input.target.launch.blockNumber<=input.asOf.blockNumber
    ? input.target
    : null;
  if (!knownTarget) {
    if (input.previous.length!==0) throw new Error('PONS_REPLAY_UNKNOWN_TARGET_HAS_HISTORY');
    return finalize({
      replayVersion:PONS_REPLAY_LAB_VERSION,
      chainId:ROBINHOOD_CHAIN_ID,
      semantics:'KNOWABLE_AS_OF_BLOCK',
      targetLaunchId:input.targetLaunchId.toLowerCase(),
      asOfBlock:input.asOf.blockNumber.toString(),
      asOfBlockHash:input.asOf.blockHash.toLowerCase() as Hex,
      asOfTimestampMs:input.asOf.timestampMs,
      targetLaunchKnown:false,
      targetLaunch:null,
      previousLaunches:[],
      boundaries:boundaries()
    });
  }

  assertPonsLaunch(knownTarget.launch);
  if (knownTarget.launch.launchId.toLowerCase()!==input.targetLaunchId.toLowerCase()) {
    throw new Error('PONS_REPLAY_TARGET_ID_MISMATCH');
  }
  const deployer=knownTarget.launch.creator.toLowerCase();
  const previous=[...input.previous].sort((a,b)=>compareLaunchDesc(a.launch,b.launch));
  for (const item of previous) {
    assertPonsLaunch(item.launch);
    if (item.launch.creator.toLowerCase()!==deployer) throw new Error('PONS_REPLAY_DEPLOYER_SCOPE_DRIFT');
    if (!isBeforeLaunch(item.launch,knownTarget.launch)) throw new Error('PONS_REPLAY_PREVIOUS_ORDER_INVALID');
    if (item.launch.blockNumber>input.asOf.blockNumber) throw new Error('PONS_REPLAY_FUTURE_LAUNCH_INPUT');
  }

  const targetLaunch=await projectLaunch(knownTarget,input.asOf);
  const previousLaunches=[] as PonsReplayLaunchSnapshot[];
  for (const item of previous) previousLaunches.push(await projectLaunch(item,input.asOf));

  return finalize({
    replayVersion:PONS_REPLAY_LAB_VERSION,
    chainId:ROBINHOOD_CHAIN_ID,
    semantics:'KNOWABLE_AS_OF_BLOCK',
    targetLaunchId:input.targetLaunchId.toLowerCase(),
    asOfBlock:input.asOf.blockNumber.toString(),
    asOfBlockHash:input.asOf.blockHash.toLowerCase() as Hex,
    asOfTimestampMs:input.asOf.timestampMs,
    targetLaunchKnown:true,
    targetLaunch,
    previousLaunches,
    boundaries:boundaries()
  });
}

async function projectLaunch(
  item:PonsReplayLaunchEvidenceInput,
  asOf:PonsReplayBlockPoint
):Promise<PonsReplayLaunchSnapshot> {
  assertPonsLaunch(item.launch);
  if (!Number.isSafeInteger(item.launchTimestampMs)||item.launchTimestampMs<0) throw new Error('PONS_REPLAY_LAUNCH_TIMESTAMP_INVALID');
  if (item.launch.blockNumber>asOf.blockNumber) throw new Error('PONS_REPLAY_FUTURE_LAUNCH_INPUT');

  let provenance:PonsReplayLaunchSnapshot['provenance']={state:'MISSING',factId:null,evidenceDigest:null};
  if (item.provenanceFact && item.provenanceFact.observedBlock<=asOf.blockNumber) {
    const expected=await buildProvenanceFact(item.launch);
    if (canonicalJson(expected)!==canonicalJson(item.provenanceFact)) throw new Error('PONS_REPLAY_PROVENANCE_INVALID');
    provenance={state:'OBSERVED',factId:item.provenanceFact.factId,evidenceDigest:item.provenanceFact.evidenceDigest};
  }

  let tokenIdentity:PonsReplayLaunchSnapshot['tokenIdentity']=null;
  if (item.tokenIdentity && item.tokenIdentity.observedBlock<=asOf.blockNumber) {
    await verifyPonsTokenIdentityReceipt(item.tokenIdentity);
    if (
      item.tokenIdentity.launchId!==item.launch.launchId ||
      item.tokenIdentity.token.toLowerCase()!==item.launch.token.toLowerCase()
    ) throw new Error('PONS_REPLAY_IDENTITY_LAUNCH_MISMATCH');
    tokenIdentity={
      identityId:item.tokenIdentity.identityId,
      name:item.tokenIdentity.name,
      symbol:item.tokenIdentity.symbol,
      decimals:item.tokenIdentity.decimals,
      observedBlock:item.tokenIdentity.observedBlock.toString(),
      observedBlockHash:item.tokenIdentity.observedBlockHash.toLowerCase() as Hex,
      evidenceDigest:item.tokenIdentity.evidenceDigest
    };
  }

  const byHorizon=new Map<number,PonsOutcomeObservationReceipt>();
  for (const receipt of item.observations) {
    if (receipt.observedBlock>asOf.blockNumber) continue;
    await verifyPonsOutcomeObservationReceipt(receipt);
    if (
      receipt.launchId!==item.launch.launchId ||
      receipt.token.toLowerCase()!==item.launch.token.toLowerCase() ||
      receipt.curve.toLowerCase()!==item.launch.pool.toLowerCase()
    ) throw new Error('PONS_REPLAY_OUTCOME_LAUNCH_MISMATCH');
    if (!PONS_REPLAY_HORIZONS.some((h)=>h.ms===receipt.horizonMs)) continue;
    if (byHorizon.has(receipt.horizonMs)) throw new Error('PONS_REPLAY_DUPLICATE_HORIZON');
    byHorizon.set(receipt.horizonMs,receipt);
  }

  const observations=PONS_REPLAY_HORIZONS.map((horizon):PonsReplayObservation=>{
    const receipt=byHorizon.get(horizon.ms)??null;
    const targetTimestampMs=item.launchTimestampMs+horizon.ms;
    if (!receipt) {
      return {
        horizonLabel:horizon.label,
        horizonMs:horizon.ms,
        state:asOf.timestampMs<targetTimestampMs?'IMMATURE':'PENDING',
        targetTimestampMs,
        observationId:null,observedBlock:null,observedBlockHash:null,observedTimestampMs:null,
        phase:null,pairToken:null,quoteDecimals:null,estimatedFdvQuoteRaw:null,missing:[],evidenceDigest:null
      };
    }
    if (receipt.targetTimestampMs!==targetTimestampMs) throw new Error('PONS_REPLAY_OUTCOME_TARGET_MISMATCH');
    return {
      horizonLabel:horizon.label,
      horizonMs:horizon.ms,
      state:receipt.status,
      targetTimestampMs,
      observationId:receipt.observationId,
      observedBlock:receipt.observedBlock.toString(),
      observedBlockHash:receipt.observedBlockHash.toLowerCase() as Hex,
      observedTimestampMs:receipt.observedTimestampMs,
      phase:receipt.phase,
      pairToken:receipt.pairToken.toLowerCase() as Hex,
      quoteDecimals:receipt.quoteDecimals,
      estimatedFdvQuoteRaw:receipt.estimatedFdvQuoteRaw===null?null:receipt.estimatedFdvQuoteRaw.toString(),
      missing:[...receipt.missing],
      evidenceDigest:receipt.evidenceDigest
    };
  });

  return {
    launchId:item.launch.launchId,
    token:item.launch.token.toLowerCase() as Hex,
    curve:item.launch.pool.toLowerCase() as Hex,
    deployer:item.launch.creator.toLowerCase() as Hex,
    launchBlock:item.launch.blockNumber.toString(),
    launchBlockHash:item.launch.blockHash.toLowerCase() as Hex,
    launchTimestampMs:item.launchTimestampMs,
    provenance,tokenIdentity,observations
  };
}

async function finalize(
  value:Omit<PonsReplaySnapshot,'outputDigest'>
):Promise<PonsReplaySnapshot> {
  return {...value,outputDigest:await sha256Hex(value)};
}

function boundaries():PonsReplaySnapshot['boundaries'] {
  return {
    noLookahead:'Only retained evidence whose observed block is at or before the requested as-of block is included.',
    ingestionAudit:'This proves what retained chain-bound evidence makes knowable as of the block; it does not prove the daemon had already ingested that evidence at the historical wall-clock moment.',
    deployerIdentity:'The Pons-reported deployer is an onchain address role, not proof of a human identity.',
    recommendation:'Replay is evidence reconstruction, not a trading recommendation, risk score, or prediction.'
  };
}

function assertAsOf(point:PonsReplayBlockPoint):void {
  if (point.blockNumber<0n) throw new Error('PONS_REPLAY_AS_OF_BLOCK_INVALID');
  if (!/^0x[0-9a-f]{64}$/i.test(point.blockHash)) throw new Error('PONS_REPLAY_AS_OF_HASH_INVALID');
  if (!Number.isSafeInteger(point.timestampMs)||point.timestampMs<0) throw new Error('PONS_REPLAY_AS_OF_TIMESTAMP_INVALID');
}

function assertPonsLaunch(launch:LaunchObserved):void {
  if (launch.chainId!==ROBINHOOD_CHAIN_ID||launch.source!=='PONS_V2') throw new Error('PONS_REPLAY_LAUNCH_SCOPE_INVALID');
}

function isBeforeLaunch(candidate:LaunchObserved,current:LaunchObserved):boolean {
  if (candidate.blockNumber!==current.blockNumber) return candidate.blockNumber<current.blockNumber;
  if (candidate.logIndex!==current.logIndex) return candidate.logIndex<current.logIndex;
  return candidate.launchId<current.launchId;
}

function compareLaunchDesc(a:LaunchObserved,b:LaunchObserved):number {
  if (a.blockNumber!==b.blockNumber) return a.blockNumber>b.blockNumber?-1:1;
  if (a.logIndex!==b.logIndex) return b.logIndex-a.logIndex;
  return b.launchId.localeCompare(a.launchId);
}
