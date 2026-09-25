/** Static, confirmed Pons snapshot transport. Independent of Arc LIVE and DEMO. */
export type PonsPreviewLaunch={
  id:string;token:string;curve:string;deployer:string;pairToken:string;
  blockNumber:string;blockHash:string;txHash:string;logIndex:number;launchConfigId:string;
  metadata:{status:"DIRECT_FACTORY_INPUT"|"NOT_AVAILABLE";name:string|null;symbol:string|null;
    logo:string|null;description:string|null;website:string|null;telegram:string|null;twitter:string|null};
  previousFromSameDeployerWithinWindow:number;
};
export type PonsPreviewSnapshot={
  schemaVersion:"binrat.pons-preview/0.1";chainId:4663;factory:string;authorityId:string;
  factoryRuntimeCodeHash:string;generatedAt:string;asOfBlock:string;asOfBlockHash:string;
  scannedFromBlock:string;confirmationDepth:12;historyCoverage:"RECENT_WINDOW_ONLY";
  metadataCoverage:"DIRECT_FACTORY_INPUT_ONLY";fundingCoverage:"NOT_COLLECTED";
  launches:PonsPreviewLaunch[];
};
const expectedFactory="0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
const expectedHash="0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84";
const obj=(v:unknown):v is Record<string,unknown>=>typeof v==="object"&&v!==null&&!Array.isArray(v);
// Canonical Pons launch IDs are sha256 *without* a 0x prefix; EVM hashes retain 0x.
const sha256=/^[0-9a-f]{64}$/i;
const hex40=/^0x[0-9a-f]{40}$/i, hex64=/^0x[0-9a-f]{64}$/i,numeric=/^(0|[1-9]\d{0,18})$/;
const bounded=(v:unknown,max=600)=>v===null||(typeof v==="string"&&v.length<=max);
export function parsePonsSnapshot(value:unknown):PonsPreviewSnapshot {
 if(!obj(value)||value.schemaVersion!=="binrat.pons-preview/0.1"||value.chainId!==4663||
  (value.factory as string)?.toLowerCase()!==expectedFactory||
  (value.factoryRuntimeCodeHash as string)?.toLowerCase()!==expectedHash||
  value.authorityId!=="ROBINHOOD_PONS_V2_FACTORY_2026_08_03_R1"||
  value.confirmationDepth!==12||value.historyCoverage!=="RECENT_WINDOW_ONLY"||
  value.metadataCoverage!=="DIRECT_FACTORY_INPUT_ONLY"||value.fundingCoverage!=="NOT_COLLECTED"||
  !hex64.test(String(value.asOfBlockHash))||!numeric.test(String(value.asOfBlock))||
  !numeric.test(String(value.scannedFromBlock))|| !Array.isArray(value.launches)||
  value.launches.length>500||BigInt(String(value.scannedFromBlock))>BigInt(String(value.asOfBlock))||
  typeof value.generatedAt!=="string"||!Number.isFinite(Date.parse(value.generatedAt)))throw Error("PONS_PREVIEW_SCHEMA_INVALID");
 const ids=new Set<string>(), events=new Set<string>();
 let prevBlock=BigInt(String(value.asOfBlock)),prevIndex=Number.MAX_SAFE_INTEGER;
 for(const row of value.launches){
  if(!obj(row)||!sha256.test(String(row.id))||!hex40.test(String(row.token))||
    !hex40.test(String(row.curve))||!hex40.test(String(row.deployer))||
    !hex40.test(String(row.pairToken))||!hex64.test(String(row.txHash))||
    !hex64.test(String(row.blockHash))||!numeric.test(String(row.blockNumber))||
    !numeric.test(String(row.launchConfigId))||!Number.isSafeInteger(row.logIndex)||
    (row.logIndex as number)<0||!Number.isSafeInteger(row.previousFromSameDeployerWithinWindow)||
    (row.previousFromSameDeployerWithinWindow as number)<0||!obj(row.metadata))
    throw Error("PONS_PREVIEW_RECORD_INVALID");
  const block=BigInt(String(row.blockNumber));
  if(block<BigInt(String(value.scannedFromBlock))||block>prevBlock||
    (block===prevBlock&&(row.logIndex as number)>=prevIndex))
    throw Error("PONS_PREVIEW_ORDER_INVALID");
  prevBlock=block;prevIndex=row.logIndex as number;
  const key=String(row.txHash).toLowerCase()+":"+row.logIndex;
  if(ids.has(String(row.id))||events.has(key))throw Error("PONS_PREVIEW_DUPLICATE");
  ids.add(String(row.id));events.add(key);
  const m=row.metadata;
  if(!["DIRECT_FACTORY_INPUT","NOT_AVAILABLE"].includes(String(m.status))||
    !bounded(m.name,120)||!bounded(m.symbol,32)||!bounded(m.logo)||
    !bounded(m.description,500)||!bounded(m.website,350)||
    !bounded(m.twitter,350)||!bounded(m.telegram,350)||
    (m.status==="NOT_AVAILABLE"&&[m.name,m.symbol,m.logo,m.description,m.website,m.twitter,m.telegram].some(v=>v!==null)))
    throw Error("PONS_PREVIEW_METADATA_INVALID");
 }
 return value as PonsPreviewSnapshot;
}
export async function loadPonsPreview(signal?:AbortSignal):Promise<PonsPreviewSnapshot>{
 const url=import.meta.env.BASE_URL+"pons-preview-snapshot.json";
 const response=await fetch(url,{cache:"no-store",headers:{accept:"application/json"},
  signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
 if(!response.ok)throw Error("PONS_SNAPSHOT_NOT_PUBLISHED");
 const data=await response.text();
 if(data.length>1_500_000)throw Error("PONS_SNAPSHOT_OVERSIZE");
 return parsePonsSnapshot(JSON.parse(data) as unknown);
}
export const ponsTokenUrl=(token:string)=>"https://robinhoodchain.blockscout.com/token/"+encodeURIComponent(token);
export const ponsTxUrl=(tx:string)=>"https://robinhoodchain.blockscout.com/tx/"+encodeURIComponent(tx);
export const compactAddress=(address:string)=>address.slice(0,8)+"…"+address.slice(-6);
