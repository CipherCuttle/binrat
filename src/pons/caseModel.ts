import { sha256Hex } from '../evidence/canonical.js';
import type { Hex } from '../core/types.js';
import { ROBINHOOD_CHAIN_ID } from './chain.js';
import type { PonsFundingRecurrenceReadModel } from '../cloudflare/ponsFundingRecurrenceReadModel.js';

export const BINRAT_CASE_MODEL_VERSION='BINRAT_CASE_MODEL_V1' as const;

export type BinratCaseFactKind=
  |'SAME_FUNDING_SOURCE'
  |'PRIOR_LAUNCH_HISTORY'
  |'OUTCOME_MEMORY'
  |'PRELAUNCH_FUNDING_OBSERVED';

export interface BinratTrashTrailCaseInput {
  targetLaunchId:string;
  asOfBlock:string;
  presentationVersion:string;
  previousLaunches:number;
  launchesWithAnyMemory:number;
  launchesWithFullMemory:number;
  coverageText:string;
  canOfferRatWatch:boolean;
}

export interface BinratReplayCaseInput {
  targetLaunchId:string;
  asOfBlock:string;
  replayVersion:string;
  semantics:'KNOWABLE_AS_OF_BLOCK';
  targetLaunchKnown:boolean;
  outputDigest:string;
}

export interface BinratCaseCurrentLaunch {
  chainId:typeof ROBINHOOD_CHAIN_ID;
  launchId:string;
  token:Hex;
  deployer:Hex;
  label:string;
  labelSource:'PERSISTED_TOKEN_IDENTITY'|'CANONICAL_LAUNCH'|'TOKEN_ADDRESS';
}

export interface BinratCaseFact {
  kind:BinratCaseFactKind;
  evidenceClass:'OBSERVED'|'DERIVED';
  label:string;
  detail:string;
  evidence:{
    source:'TRASH_TRAIL'|'FUNDING_RECURRENCE';
    version:string;
    refs:string[];
  };
  caveat:string|null;
}

export interface BinratCaseHandoff {
  kind:'TRASH_TRAIL'|'REPLAY'|'WATCH_DEPLOYER';
  label:string;
  available:true;
  targetLaunchId:string;
  targetAddress:Hex|null;
}

export interface BinratCaseModel {
  caseVersion:typeof BINRAT_CASE_MODEL_VERSION;
  chainId:typeof ROBINHOOD_CHAIN_ID;
  asOfBlock:string;
  current:BinratCaseCurrentLaunch;
  facts:BinratCaseFact[];
  handoffs:BinratCaseHandoff[];
  coverage:{
    trashTrail:'AVAILABLE'|'NOT_PROVIDED';
    replay:'AVAILABLE'|'NOT_PROVIDED';
    funding:'POSITIVE_FACTS'|'NO_POSITIVE_FACT'|'NOT_PROVIDED';
  };
  boundaries:{
    evidenceOnly:string;
    fundingAbsence:string;
    deployerIdentity:string;
    recommendation:string;
    caseDigest:string;
  };
  caseDigest:string;
}

export async function buildBinratCaseModel(input:{
  current:BinratCaseCurrentLaunch;
  asOfBlock:bigint;
  trashTrail?:BinratTrashTrailCaseInput|null;
  replay?:BinratReplayCaseInput|null;
  funding?:PonsFundingRecurrenceReadModel|null;
}):Promise<BinratCaseModel> {
  assertCurrent(input.current);
  if(input.asOfBlock<0n) throw new Error('BINRAT_CASE_AS_OF_BLOCK_INVALID');
  const asOfBlock=input.asOfBlock.toString();

  if(input.trashTrail) assertTrashTrail(input.trashTrail,input.current.launchId,asOfBlock);
  if(input.replay) assertReplay(input.replay,input.current.launchId,asOfBlock);
  if(input.funding) assertFunding(input.funding,input.current.launchId,asOfBlock);

  const facts:BinratCaseFact[]=[];

  if(input.funding?.sameFundingSource) {
    const recurrence=input.funding.sameFundingSource;
    facts.push({
      kind:'SAME_FUNDING_SOURCE',
      evidenceClass:'DERIVED',
      label:'SAME FUNDING SOURCE',
      detail:`This exact source address funded at least ${recurrence.distinctLaunchesAtLeast} launches across at least ${recurrence.distinctDeployersAtLeast} distinct Pons-reported deployers.`,
      evidence:{
        source:'FUNDING_RECURRENCE',
        version:input.funding.schemaVersion,
        refs:recurrence.relatedLaunches.map((item)=>item.launchId).sort()
      },
      caveat:input.funding.caveat
    });
  }

  if((input.trashTrail?.previousLaunches??0)>0) {
    const count=input.trashTrail!.previousLaunches;
    facts.push({
      kind:'PRIOR_LAUNCH_HISTORY',
      evidenceClass:'DERIVED',
      label:`${count} PRIOR LAUNCH${count===1?'':'ES'}`,
      detail:`This exact Pons-reported deployer has ${count} prior indexed launch${count===1?'':'es'} before this case.`,
      evidence:{
        source:'TRASH_TRAIL',
        version:input.trashTrail!.presentationVersion,
        refs:[input.current.launchId]
      },
      caveat:'Exact deployer-address recurrence only; this is not proof of a human identity or common team.'
    });
  }

  if((input.trashTrail?.launchesWithAnyMemory??0)>0) {
    const remembered=input.trashTrail!.launchesWithAnyMemory;
    const previous=input.trashTrail!.previousLaunches;
    facts.push({
      kind:'OUTCOME_MEMORY',
      evidenceClass:'DERIVED',
      label:'RECEIPTS IN MEMORY',
      detail:`BINRAT has retained outcome evidence for ${remembered} of ${previous} prior launch${previous===1?'':'es'} from this exact deployer.`,
      evidence:{
        source:'TRASH_TRAIL',
        version:input.trashTrail!.presentationVersion,
        refs:[input.current.launchId]
      },
      caveat:'Observed history only; retained 5m / 1h / 24h samples are not ATH, profitability, or prediction.'
    });
  }

  if(input.funding?.currentFunding) {
    facts.push({
      kind:'PRELAUNCH_FUNDING_OBSERVED',
      evidenceClass:'OBSERVED',
      label:'PRE-LAUNCH FUNDING',
      detail:`A direct native transfer into this Pons-reported deployer was verified before launch from ${shortAddress(input.funding.currentFunding.sourceAddress)}.`,
      evidence:{
        source:'FUNDING_RECURRENCE',
        version:input.funding.schemaVersion,
        refs:[input.funding.currentFunding.transferTxHash]
      },
      caveat:'A funding transfer does not establish ownership, control, team membership, or human identity.'
    });
  }

  const handoffs:BinratCaseHandoff[]=[];
  if(input.trashTrail && input.trashTrail.previousLaunches>0) {
    handoffs.push({
      kind:'TRASH_TRAIL',
      label:'OPEN TRASH TRAIL',
      available:true,
      targetLaunchId:input.current.launchId,
      targetAddress:null
    });
  }
  if(input.replay?.targetLaunchKnown) {
    handoffs.push({
      kind:'REPLAY',
      label:'REPLAY THIS MOMENT',
      available:true,
      targetLaunchId:input.current.launchId,
      targetAddress:null
    });
  }
  if(input.trashTrail?.canOfferRatWatch) {
    handoffs.push({
      kind:'WATCH_DEPLOYER',
      label:'WATCH DEPLOYER',
      available:true,
      targetLaunchId:input.current.launchId,
      targetAddress:input.current.deployer
    });
  }

  const core:Omit<BinratCaseModel,'caseDigest'>={
    caseVersion:BINRAT_CASE_MODEL_VERSION,
    chainId:ROBINHOOD_CHAIN_ID,
    asOfBlock,
    current:{
      ...input.current,
      launchId:input.current.launchId.toLowerCase(),
      token:input.current.token.toLowerCase() as Hex,
      deployer:input.current.deployer.toLowerCase() as Hex
    },
    facts,
    handoffs,
    coverage:{
      trashTrail:input.trashTrail?'AVAILABLE':'NOT_PROVIDED',
      replay:input.replay?.targetLaunchKnown?'AVAILABLE':'NOT_PROVIDED',
      funding:input.funding
        ? (input.funding.currentFunding||input.funding.sameFundingSource?'POSITIVE_FACTS':'NO_POSITIVE_FACT')
        :'NOT_PROVIDED'
    },
    boundaries:{
      evidenceOnly:'Case facts are positive evidence-backed observations or derivations only. Missing evidence does not become a negative claim.',
      fundingAbsence:'NO_POSITIVE_FACT means only that this case input contains no positive persisted funding fact; it does not mean the deployer was not funded.',
      deployerIdentity:'A Pons-reported deployer is an onchain address role, not proof of a human identity.',
      recommendation:'No case fact is a safety score, profitability claim, buy/sell signal, or prediction.',
      caseDigest:'The case digest binds this assembled product contract; upstream evidence retains its own authority and receipt semantics.'
    }
  };

  return {...core,caseDigest:await sha256Hex(core)};
}

function assertCurrent(current:BinratCaseCurrentLaunch):void {
  if(current.chainId!==ROBINHOOD_CHAIN_ID) throw new Error('BINRAT_CASE_CHAIN_INVALID');
  if(!/^[0-9a-f]{64}$/i.test(current.launchId)) throw new Error('BINRAT_CASE_LAUNCH_ID_INVALID');
  if(!/^0x[0-9a-f]{40}$/i.test(current.token)) throw new Error('BINRAT_CASE_TOKEN_INVALID');
  if(!/^0x[0-9a-f]{40}$/i.test(current.deployer)) throw new Error('BINRAT_CASE_DEPLOYER_INVALID');
  if(typeof current.label!=='string'||current.label.length===0||current.label.length>256) {
    throw new Error('BINRAT_CASE_LABEL_INVALID');
  }
}

function assertTrashTrail(
  value:BinratTrashTrailCaseInput,
  launchId:string,
  asOfBlock:string
):void {
  if(value.targetLaunchId.toLowerCase()!==launchId.toLowerCase()) {
    throw new Error('BINRAT_CASE_TRASH_TRAIL_TARGET_MISMATCH');
  }
  if(value.asOfBlock!==asOfBlock) throw new Error('BINRAT_CASE_TRASH_TRAIL_BLOCK_MISMATCH');
  for(const count of [value.previousLaunches,value.launchesWithAnyMemory,value.launchesWithFullMemory]) {
    if(!Number.isSafeInteger(count)||count<0) throw new Error('BINRAT_CASE_TRASH_TRAIL_COUNT_INVALID');
  }
  if(value.launchesWithAnyMemory>value.previousLaunches||value.launchesWithFullMemory>value.launchesWithAnyMemory) {
    throw new Error('BINRAT_CASE_TRASH_TRAIL_COVERAGE_INVALID');
  }
}

function assertReplay(
  value:BinratReplayCaseInput,
  launchId:string,
  asOfBlock:string
):void {
  if(value.targetLaunchId.toLowerCase()!==launchId.toLowerCase()) {
    throw new Error('BINRAT_CASE_REPLAY_TARGET_MISMATCH');
  }
  if(value.asOfBlock!==asOfBlock) throw new Error('BINRAT_CASE_REPLAY_BLOCK_MISMATCH');
  if(value.semantics!=='KNOWABLE_AS_OF_BLOCK') throw new Error('BINRAT_CASE_REPLAY_SEMANTICS_INVALID');
  if(!value.targetLaunchKnown) throw new Error('BINRAT_CASE_REPLAY_TARGET_NOT_KNOWN');
  if(!/^[0-9a-f]{64}$/i.test(value.outputDigest)) throw new Error('BINRAT_CASE_REPLAY_DIGEST_INVALID');
}

function assertFunding(
  value:PonsFundingRecurrenceReadModel,
  launchId:string,
  asOfBlock:string
):void {
  if(value.chainId!==ROBINHOOD_CHAIN_ID) throw new Error('BINRAT_CASE_FUNDING_CHAIN_INVALID');
  if(value.currentLaunchId.toLowerCase()!==launchId.toLowerCase()) {
    throw new Error('BINRAT_CASE_FUNDING_TARGET_MISMATCH');
  }
  if(value.asOfBlock!==asOfBlock) throw new Error('BINRAT_CASE_FUNDING_BLOCK_MISMATCH');
  if(value.sameFundingSource) {
    if(!value.currentFunding) throw new Error('BINRAT_CASE_FUNDING_RECURRENCE_WITHOUT_CURRENT');
    if(value.sameFundingSource.sourceAddress.toLowerCase()!==value.currentFunding.sourceAddress.toLowerCase()) {
      throw new Error('BINRAT_CASE_FUNDING_SOURCE_MISMATCH');
    }
    if(value.sameFundingSource.distinctDeployersAtLeast<2||value.sameFundingSource.distinctLaunchesAtLeast<2) {
      throw new Error('BINRAT_CASE_FUNDING_RECURRENCE_INVALID');
    }
    const launchIds=new Set(value.sameFundingSource.relatedLaunches.map((item)=>item.launchId));
    const deployers=new Set(value.sameFundingSource.relatedLaunches.map((item)=>item.deployer.toLowerCase()));
    if(!launchIds.has(launchId)) throw new Error('BINRAT_CASE_FUNDING_CURRENT_MISSING');
    if(
      launchIds.size<value.sameFundingSource.distinctLaunchesAtLeast ||
      deployers.size<value.sameFundingSource.distinctDeployersAtLeast
    ) {
      throw new Error('BINRAT_CASE_FUNDING_RECURRENCE_OVERCLAIM');
    }
  }
}

function shortAddress(value:string):string {
  return value.length>20?`${value.slice(0,8)}…${value.slice(-6)}`:value;
}
