import type {
  PonsRatTrapLaunchProjection,
  PonsRatTrapObservationProjection,
  PonsRatTrapProjection,
  PonsRatTrapQuoteAsset
} from './ratTrapProjection.js';

export const PONS_RAT_TRAP_PRESENTATION_VERSION='BINRAT_PONS_RAT_TRAP_PRESENTATION_V1' as const;

export type RatTrapLaunchMemoryState='FULL'|'PARTIAL'|'PENDING'|'IMMATURE';

export interface RatTrapPresentationObservation {
  horizonLabel:'5m'|'1h'|'24h';
  state:PonsRatTrapObservationProjection['state'];
  valueText:string|null;
  quoteLabel:string|null;
  missing:string[];
}

export interface RatTrapPresentationLaunch {
  launchId:string;
  label:string;
  memoryState:RatTrapLaunchMemoryState;
  memoryText:string;
  observations:RatTrapPresentationObservation[];
  highestObservedText:string|null;
  highestObservedQualifier:'HIGHEST_SUPPORTED_SAMPLE'|null;
}

export interface RatTrapPresentationSummary {
  previousLaunches:number;
  launchesWithAnyMemory:number;
  launchesWithFullMemory:number;
  launchesPendingMemory:number;
  launchesStillImmature:number;
  coverageText:string;
}

export interface RatTrapPresentation {
  presentationVersion:typeof PONS_RAT_TRAP_PRESENTATION_VERSION;
  heading:'RAT TRAP';
  deck:string;
  summary:RatTrapPresentationSummary;
  launches:RatTrapPresentationLaunch[];
  footer:string;
}

export function buildRatTrapPresentation(
  projection:PonsRatTrapProjection
):RatTrapPresentation {
  const launches=projection.launches.map(presentLaunch);
  const launchesWithAnyMemory=projection.launches.filter(hasAnyReceipt).length;
  const launchesWithFullMemory=launches.filter((item)=>item.memoryState==='FULL').length;
  const launchesPendingMemory=launches.filter((item)=>item.memoryState==='PENDING').length;
  const launchesStillImmature=launches.filter((item)=>item.memoryState==='IMMATURE').length;

  return {
    presentationVersion:PONS_RAT_TRAP_PRESENTATION_VERSION,
    heading:'RAT TRAP',
    deck:'What happened the other times these paws showed up?',
    summary:{
      previousLaunches:projection.previousLaunchCount,
      launchesWithAnyMemory,
      launchesWithFullMemory,
      launchesPendingMemory,
      launchesStillImmature,
      coverageText:coverageText({
        previousLaunches:projection.previousLaunchCount,
        launchesWithAnyMemory,
        launchesWithFullMemory,
        launchesPendingMemory,
        launchesStillImmature
      })
    },
    launches,
    footer:'Observed history, not a prediction. Different quote assets are not compared.'
  };
}

function presentLaunch(launch:PonsRatTrapLaunchProjection):RatTrapPresentationLaunch {
  const memoryState=memoryStateFor(launch);
  return {
    launchId:launch.launchId,
    label:launchLabel(launch),
    memoryState,
    memoryText:memoryText(memoryState,launch),
    observations:launch.observations.map((observation)=>({
      horizonLabel:horizonLabel(observation.horizonMs),
      state:observation.state,
      valueText:observation.estimatedFdvQuoteRaw===null||observation.quoteAsset===null
        ? null
        : formatRawUnits(observation.estimatedFdvQuoteRaw,observation.quoteAsset.decimals),
      quoteLabel:observation.quoteAsset===null?null:quoteLabel(observation.quoteAsset),
      missing:[...observation.missing]
    })),
    highestObservedText:launch.highestObserved===null
      ? null
      : `${formatRawUnits(
          launch.highestObserved.estimatedFdvQuoteRaw,
          launch.highestObserved.quoteAsset.decimals
        )} ${quoteLabel(launch.highestObserved.quoteAsset)} @ ${tieLabel(launch.highestObserved.tiedHorizonsMs)}`,
    highestObservedQualifier:launch.highestObserved===null?null:'HIGHEST_SUPPORTED_SAMPLE'
  };
}

function memoryStateFor(launch:PonsRatTrapLaunchProjection):RatTrapLaunchMemoryState {
  if (launch.observations.every((item)=>item.state==='COMPLETE')) return 'FULL';
  if (launch.observations.some((item)=>item.state==='COMPLETE'||item.state==='PARTIAL')) return 'PARTIAL';
  if (launch.observations.some((item)=>item.state==='PENDING')) return 'PENDING';
  return 'IMMATURE';
}

function memoryText(
  state:RatTrapLaunchMemoryState,
  launch:PonsRatTrapLaunchProjection
):string {
  if(state==='FULL') return '5m · 1h · 24h receipts in memory.';
  if(state==='PARTIAL') {
    const present=launch.observations.filter((item)=>item.state==='COMPLETE'||item.state==='PARTIAL').length;
    return `${present}/3 receipt${present===1?'':'s'} in memory. Trail is still incomplete.`;
  }
  if(state==='PENDING') return 'This trail is old enough, but BINRAT has not stored its outcome receipts yet.';
  return 'This trail is still too fresh for all outcome windows.';
}

function hasAnyReceipt(launch:PonsRatTrapLaunchProjection):boolean {
  return launch.observations.some((item)=>item.observationId!==null);
}

function coverageText(summary:{
  previousLaunches:number;
  launchesWithAnyMemory:number;
  launchesWithFullMemory:number;
  launchesPendingMemory:number;
  launchesStillImmature:number;
}):string {
  if(summary.previousLaunches===0) return 'No previous launches from these reported paws.';
  const parts=[
    `${summary.launchesWithAnyMemory}/${summary.previousLaunches} prior launch${summary.previousLaunches===1?'':'es'} with outcome receipts`,
    `${summary.launchesWithFullMemory} complete through 24h`
  ];
  if(summary.launchesPendingMemory>0) parts.push(`${summary.launchesPendingMemory} still pending memory`);
  if(summary.launchesStillImmature>0) parts.push(`${summary.launchesStillImmature} still immature`);
  return parts.join(' · ')+'.';
}

function launchLabel(launch:PonsRatTrapLaunchProjection):string {
  const symbol=launch.symbol.trim();
  if(symbol) return symbol.startsWith('$')?symbol:`$${symbol}`;
  const name=launch.name.trim();
  if(name) return name;
  return shortAddress(launch.token);
}

function quoteLabel(asset:PonsRatTrapQuoteAsset):string {
  if(asset.kind==='NATIVE_ETH') return 'ETH est. FDV';
  return `quote-token est. FDV (${shortAddress(asset.address)})`;
}

function formatRawUnits(value:bigint,decimals:number):string {
  if(!Number.isSafeInteger(decimals)||decimals<0||decimals>255) {
    throw new Error('PONS_RAT_TRAP_PRESENTATION_DECIMALS_INVALID');
  }
  const negative=value<0n;
  const raw=negative?-value:value;
  if(decimals===0) return `${negative?'-':''}${raw.toString()}`;
  const base=10n**BigInt(decimals);
  const whole=raw/base;
  const remainder=(raw%base).toString().padStart(decimals,'0').replace(/0+$/,'');
  const fraction=remainder.slice(0,6).replace(/0+$/,'');
  return `${negative?'-':''}${whole.toString()}${fraction?`.${fraction}`:''}`;
}

function horizonLabel(ms:number):'5m'|'1h'|'24h' {
  if(ms===300_000) return '5m';
  if(ms===3_600_000) return '1h';
  if(ms===86_400_000) return '24h';
  throw new Error(`PONS_RAT_TRAP_PRESENTATION_HORIZON_INVALID:${ms}`);
}

function tieLabel(horizons:readonly number[]):string {
  return horizons.map(horizonLabel).join(' / ');
}

function shortAddress(value:string):string {
  return value.length>20?`${value.slice(0,8)}…${value.slice(-6)}`:value;
}
