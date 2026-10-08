/**
 * Exploratory baseline, separate from frozen Pressure V0 and preregistered
 * blocker-closure V1. No production integration or empirical efficacy claim.
 */
export const DATED_LAUNCH_BASELINE_V1 = 'BINRAT_DATED_LAUNCH_BASELINE_V1' as const;
export type LaunchDateStatus = 'SCHEDULE_WITHIN_30D' | 'NO_30D_DATE' | 'INSUFFICIENT_EVIDENCE';
export type LaunchDateEventKind = 'SCHEDULED' | 'RESCHEDULED' | 'CANCELLED';

export interface DatedLaunchEvent {
  projectId: string;
  targetId: string;
  event: LaunchDateEventKind;
  observedOn: string;
  publishedOn: string;
  launchOn: string | null;
  sourceRef: string;
  sourceOrigin: string;
}

export interface DatedLaunchReplay {
  projectId: string;
  targetId: string;
  asOf: string;
  coverage: 'VERIFIED' | 'PARTIAL';
  events: readonly DatedLaunchEvent[];
}
export interface DatedLaunchResult {
  version: typeof DATED_LAUNCH_BASELINE_V1;
  state: LaunchDateStatus;
  scheduledFor: string | null;
  ignoredFuture: number;
  consideredEvents: number;
}

/** Explicit calendar days only; no ambiguous "soon", quarter or month claim. */
export function evaluateDatedLaunchBaseline(input: DatedLaunchReplay): DatedLaunchResult {
  const now=day(input.asOf);
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(input.projectId) || !input.targetId.trim()) {
    throw new Error('LAUNCH_DATE_TARGET_INVALID');
  }
  const entries: Array<{data:DatedLaunchEvent;time:number}> = [];
  let ignoredFuture=0;
  for(const event of input.events){
    if(!event.projectId.trim() || !event.targetId.trim() || !event.sourceOrigin.trim() ||
       !/^https:\/\//.test(event.sourceRef)) throw new Error('LAUNCH_DATE_SOURCE_INVALID');
    if(event.event==='CANCELLED' ? event.launchOn!==null : event.launchOn===null)
       throw new Error('LAUNCH_DATE_EVENT_INVALID');
    if(event.launchOn!==null) day(event.launchOn);
    const time=Math.max(day(event.observedOn),day(event.publishedOn));
    if(time>now){ignoredFuture++;continue;}
    if(event.projectId===input.projectId && event.targetId===input.targetId) {
      entries.push({data:event,time});
    }
  }
  const result=(state:LaunchDateStatus,scheduledFor:string|null=null):DatedLaunchResult=>({
    version:DATED_LAUNCH_BASELINE_V1,state,scheduledFor,ignoredFuture,consideredEvents:entries.length
  });
  if(input.coverage==='PARTIAL') return result('INSUFFICIENT_EVIDENCE');
  if(input.coverage!=='VERIFIED') throw new Error('LAUNCH_DATE_COVERAGE_INVALID');
  if(entries.length===0) return result('NO_30D_DATE');
  entries.sort((a,b)=>a.time-b.time || a.data.sourceRef.localeCompare(b.data.sourceRef));
  const newest=entries.at(-1)!;
  // Conflict at day granularity: source order cannot manufacture chronology.
  const latest=entries.filter(x=>x.time===newest.time);
  const claims=new Set(latest.map(x=>x.data.event+':'+x.data.launchOn));
  if(claims.size>1) return result('INSUFFICIENT_EVIDENCE');
  const current=newest.data;
  if(current.event==='CANCELLED' || current.launchOn===null) return result('NO_30D_DATE');
  const days=(day(current.launchOn)-now)/86400000;
  // Event itself must predate the announced future event at evaluation cutoff.
  return days>0 && days<=30?result('SCHEDULE_WITHIN_30D',current.launchOn):result('NO_30D_DATE');
}
function day(value:string):number{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('LAUNCH_DATE_INVALID');
  const ms=Date.parse(value+'T00:00:00Z');
  if(!Number.isFinite(ms) || new Date(ms).toISOString().slice(0,10)!==value)
    throw new Error('LAUNCH_DATE_INVALID');
  return ms;
}
