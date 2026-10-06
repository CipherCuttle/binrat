/** Separately registered finite observation. No service, scheduler, model or delivery adapter. */
import {captureTerminal,type ProspectiveState} from './prospective.js';
import {ProspectiveJournal,type PublicReadTransport} from './prospectiveJournal.js';

export const INDEXED_OBSERVATION_V1=Object.freeze({
  schemaVersion:'binrat.indexed-observation-policy/1',
  objective:'OBSERVE_FUNDING_HANDOFF_AND_STRICTLY_LATER_PONS_LAUNCH',
  initialWaitMs:60_000,observationIntervalMs:60_000,maxRunMs:12*60_000,
  maxDiscoveryRanges:4,minDiscoveryRemainingCalls:28,
  maxRpcCalls:48,noRetries:true,coverage:'PROVIDER_INDEXED_CANDIDATES_ONLY',
  subjectSelection:'SAME_PREVIOUSLY_FROZEN_FUNDER_FIRST_RETURNED_QUALIFYING_CANDIDATE',
  model:false,delivery:false,capital:false,
} as const);
export type ObservationStop='JOURNAL_TERMINAL'|'DISCOVERY_RANGE_LIMIT'|'RESERVED_VERIFICATION_BUDGET'|'WALL_TIME_LIMIT'|'LAUNCH_RANGE_LIMIT'|'HANDOFF_TIME_LIMIT';
export interface ObservationResult {state:ProspectiveState;stopReason:ObservationStop}

export async function observeIndexedFunding(store:ProspectiveJournal,transport:PublicReadTransport,
  pause:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
  now:()=>number=()=>Date.now(),onBoundary:(state:ProspectiveState)=>Promise<void>=async()=>{}):Promise<ObservationResult>{
  const saved=store.export();
  if(JSON.parse((saved.manifest as {json:string}).json).schemaVersion!=='binrat.prospective-capture/3')throw new Error('INDEXED_OBSERVATION_V3_REQUIRED');
  if((saved.calls as unknown[]).length!==0)throw new Error('INDEXED_OBSERVATION_FRESH_JOURNAL_REQUIRED');
  const deadline=now()+INDEXED_OBSERVATION_V1.maxRunMs;
  const bounded:PublicReadTransport=async request=>{
    // Reservation comes first. This is a future observation wait, never a failed-call retry.
    if(request.id===4)await pause(INDEXED_OBSERVATION_V1.initialWaitMs);
    if(now()>=deadline)return {rawResponse:'',error:'INDEXED_OBSERVATION_TIME_LIMIT'};
    return transport(request);
  };
  for(let steps=0;steps<48;steps++){
    const state=await store.step(bounded,now);
    await onBoundary(structuredClone(state)); // Persist before later reads; the writer cannot mutate replay control state.
    if(captureTerminal(state))return {state,stopReason:'JOURNAL_TERMINAL'};
    if(state.stage==='INDEX_HEAD'){
      if(state.indexedDiscovery!.ranges.length>=INDEXED_OBSERVATION_V1.maxDiscoveryRanges)return {state,stopReason:'DISCOVERY_RANGE_LIMIT'};
      // From INDEX_HEAD: up to 21 reads for a third-page candidate/handoff, then 7 for a positive launch.
      if(48-state.rpcCalls<INDEXED_OBSERVATION_V1.minDiscoveryRemainingCalls)return {state,stopReason:'RESERVED_VERIFICATION_BUDGET'};
    }
    if(now()>=deadline)return {state,stopReason:'WALL_TIME_LIMIT'};
    if(state.stage==='INDEX_HEAD'||state.stage==='WATCH_HEAD')await pause(INDEXED_OBSERVATION_V1.observationIntervalMs);
  }
  throw new Error('INDEXED_OBSERVATION_STEP_LIMIT');
}

/** Opt-in V4 experiment. Legacy V1 policy and function above are unchanged. */
export const RESERVED_FOLLOWUP_V1=Object.freeze({
  schemaVersion:'binrat.indexed-observation-policy/2',
  objective:'OBSERVE_FUNDING_HANDOFF_AND_STRICTLY_LATER_PONS_LAUNCH',
  initialWaitMs:60_000,observationIntervalMs:60_000,maxRunMs:20*60_000,
  maxDiscoveryRanges:5,minDiscoveryRemainingCalls:73,maxLaunchRanges:10,maxHandoffMs:15*60_000,
  reservedLaunchCalls:52,maxRpcCalls:96,noRetries:true,coverage:'PROVIDER_INDEXED_CANDIDATES_ONLY',
  subjectSelection:'SAME_PREVIOUSLY_FROZEN_FUNDER_FIRST_RETURNED_QUALIFYING_CANDIDATE',
  model:false,delivery:false,capital:false,
} as const);
export async function observeReservedFollowup(store:ProspectiveJournal,transport:PublicReadTransport,
  pause:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
  now:()=>number=()=>Date.now(),onBoundary:(state:ProspectiveState)=>Promise<void>=async()=>{}){
  const saved=store.export(),manifest=JSON.parse((saved.manifest as {json:string}).json);
  if(manifest.schemaVersion!=='binrat.prospective-capture/4')throw new Error('RESERVED_FOLLOWUP_V4_REQUIRED');
  if((saved.calls as unknown[]).length!==0)throw new Error('RESERVED_FOLLOWUP_FRESH_JOURNAL_REQUIRED');
  const policy=RESERVED_FOLLOWUP_V1,deadline=now()+policy.maxRunMs;
  let handoffDeadline=Infinity,lastCursor:string|null=null,completedEmptyLaunchRanges=0;
  const bounded:PublicReadTransport=async request=>{
    if(request.id===4)await pause(policy.initialWaitMs);
    if(now()>=deadline||now()>=handoffDeadline)return {rawResponse:'',error:'RESERVED_FOLLOWUP_TIME_LIMIT'};
    const reply=await transport(request);
    // Retain a late raw body, but do not admit evidence received beyond the registered bound.
    return now()>=deadline||now()>=handoffDeadline?{rawResponse:reply.rawResponse,error:'RESERVED_FOLLOWUP_TIME_LIMIT'}:reply;
  };
  const result=(state:ProspectiveState,stopReason:ObservationStop)=>({state,stopReason,completedEmptyLaunchRanges});
  for(let steps=0;steps<96;steps++){
    const state=await store.step(bounded,now);await onBoundary(structuredClone(state));
    if(captureTerminal(state))return result(state,'JOURNAL_TERMINAL');
    if(state.handoff){
      handoffDeadline=state.handoff.createdAtMs+policy.maxHandoffMs;
      if(lastCursor===null)lastCursor=state.handoff.afterBlock;
      if(state.stage==='WATCH_HEAD'&&state.cursor!==lastCursor){completedEmptyLaunchRanges++;lastCursor=state.cursor;}
      if(completedEmptyLaunchRanges>=policy.maxLaunchRanges)return result(state,'LAUNCH_RANGE_LIMIT');
    }else if(state.stage==='INDEX_HEAD'){
      if(state.indexedDiscovery!.ranges.length>=policy.maxDiscoveryRanges)return result(state,'DISCOVERY_RANGE_LIMIT');
      // 21 reads through worst third-page handoff + nine empty cycles (45) + one positive cycle (7).
      if(96-state.rpcCalls<policy.minDiscoveryRemainingCalls)return result(state,'RESERVED_VERIFICATION_BUDGET');
    }
    if(now()>=deadline)return result(state,'WALL_TIME_LIMIT');
    if(now()>=handoffDeadline)return result(state,'HANDOFF_TIME_LIMIT');
    if(state.stage==='INDEX_HEAD'||state.stage==='WATCH_HEAD')await pause(policy.observationIntervalMs);
  }
  throw new Error('RESERVED_FOLLOWUP_STEP_LIMIT');
}
