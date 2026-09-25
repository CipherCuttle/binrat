/** Pons-only append-only evidence identities. No trading or Arc adapter imports. */
import {createHash} from 'node:crypto';
import {canonicalJson} from '../evidence/canonical.js';
import {PONS_PREVIEW_AUTHORITY as A,type PonsLaunchPreview,type PonsLog,
  type Metadata,buildPonsPreviewSnapshot} from './sourceSnapshot.js';
export type IndexedPonsLaunch=PonsLaunchPreview & {eventId:string;factId:string};
const hex64=/^0x[0-9a-f]{64}$/i,hex40=/^0x[0-9a-f]{40}$/i,sha=/^[0-9a-f]{64}$/;
export const PONS_CHAIN_ID=4663 as const;
export const PONS_MAX_FACTS_PER_CYCLE=16;
export function digest(value:unknown):string{
 return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
export function ponsEventId(txHash:string,logIndex:number):string{
 return digest({kind:'PONS_V2_EVENT_V1',chainId:4663,factory:A.factory.toLowerCase(),
  txHash:txHash.toLowerCase(),logIndex});
}
export function indexedPonsFacts(input:{from:bigint;through:bigint;throughHash:string;
 capturedAtMs:number;logs:readonly PonsLog[];metadataByTx?:ReadonlyMap<string,Metadata>}):IndexedPonsLaunch[]{
 if(!Number.isSafeInteger(input.capturedAtMs)||input.capturedAtMs<0)throw Error('PONS_CAPTURE_CLOCK_INVALID');
 const snapshot=buildPonsPreviewSnapshot({
  generatedAt:new Date(input.capturedAtMs).toISOString(),asOfBlock:input.through,
  asOfBlockHash:input.throughHash,scannedFromBlock:input.from,
  factoryCodeHash:A.runtimeCodeHash,logs:input.logs,
  metadataByTx:input.metadataByTx??new Map()
 });
 return snapshot.launches.map(launch=>{
  const eventId=ponsEventId(launch.txHash,launch.logIndex);
  const factId=digest({kind:'PONS_V2_BLOCK_FACT_V1',eventId,blockHash:launch.blockHash});
  return {...launch,eventId,factId};
 });
}
export function validateIndexedFact(f:IndexedPonsLaunch):void{
 if(!f||!hex40.test(f.token)||!hex40.test(f.curve)||!hex40.test(f.deployer)||
  !hex40.test(f.pairToken)||!hex64.test(f.txHash)||!hex64.test(f.blockHash)||
  !Number.isSafeInteger(f.logIndex)||f.logIndex<0||!Number.isSafeInteger(Number(f.blockNumber))||
  !/^(0|[1-9][0-9]*)$/.test(f.blockNumber)||BigInt(f.blockNumber)<A.fromBlock||
  !/^(0|[1-9][0-9]*)$/.test(f.launchConfigId)||
  !Number.isSafeInteger(f.previousFromSameDeployerWithinWindow)||
  f.previousFromSameDeployerWithinWindow<0||
  !sha.test(f.id)||!sha.test(f.eventId)||!sha.test(f.factId))
  throw Error('PONS_FACT_FIELDS_INVALID');
 const launchId=digest({kind:'PONS_V2_LAUNCH_V1',chainId:4663,factory:A.factory.toLowerCase(),
  txHash:f.txHash.toLowerCase(),token:f.token.toLowerCase()});
 const eventId=ponsEventId(f.txHash,f.logIndex);
 const factId=digest({kind:'PONS_V2_BLOCK_FACT_V1',eventId,blockHash:f.blockHash.toLowerCase()});
 if(f.id!==launchId||f.eventId!==eventId||f.factId!==factId)throw Error('PONS_FACT_IDENTITY_INVALID');
 const m=f.metadata;
 if(!m||!['DIRECT_FACTORY_INPUT','NOT_AVAILABLE'].includes(m.status)||
  (m.status==='NOT_AVAILABLE' && [m.name,m.symbol,m.logo,m.description,m.website,m.twitter,m.telegram].some(x=>x!==null))||
  (m.status==='DIRECT_FACTORY_INPUT' && (!m.name||!m.symbol)))
  throw Error('PONS_FACT_METADATA_INVALID');
 for(const [value,limit] of [[m.name,120],[m.symbol,32],[m.logo,600],[m.description,500],
   [m.website,350],[m.twitter,350],[m.telegram,350]] as const){
  if(value!==null&&(typeof value!=='string'||value.length>limit))throw Error('PONS_FACT_METADATA_BOUND');
 }
 for(const social of [m.website,m.twitter,m.telegram]){
  if(social!==null){try{const u=new URL(social);
   if(u.protocol!=='https:'||u.username||u.password)throw Error();
  }catch{throw Error('PONS_FACT_METADATA_URL');}}
 }
}

