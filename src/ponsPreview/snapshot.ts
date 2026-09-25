/** Isolated, read-only Pons V2 preview projection. No Arc D1 or trade authority.
 * Factory epoch/code hash follow SENTRY M2A's reviewed 2026-08-03 R1 authority.
 * This bounded recent window is NOT full creator history or a funding trace. */
import { createHash } from "node:crypto";
import {canonicalJson} from "../evidence/canonical.js";

export const PONS_PREVIEW_AUTHORITY = Object.freeze({
  chainId:4663,
  factory:"0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  runtimeCodeHash:"0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84",
  fromBlock:26841846n,
  authorityId:"ROBINHOOD_PONS_V2_FACTORY_2026_08_03_R1",
});
const hex40=/^0x[0-9a-f]{40}$/i,hex64=/^0x[0-9a-f]{64}$/i;
export type Metadata = {status:"DIRECT_FACTORY_INPUT"|"NOT_AVAILABLE"; name:string|null;
  symbol:string|null;logo:string|null;description:string|null;
  website:string|null;telegram:string|null;twitter:string|null;};
export type PonsLog = {blockNumber:bigint;blockHash:string;transactionHash:string;logIndex:number;
  token:string;curve:string;deployer:string;pairToken:string;launchConfigId:bigint;};
export type PonsLaunchPreview = {
  id:string; token:string;curve:string;deployer:string;pairToken:string;
  blockNumber:string;blockHash:string;txHash:string;logIndex:number;launchConfigId:string;
  metadata:Metadata;
  previousFromSameDeployerWithinWindow:number;
};
export type PonsPreviewSnapshot = {
  schemaVersion:"binrat.pons-preview/0.1";chainId:4663;factory:string;authorityId:string;
  factoryRuntimeCodeHash:string;generatedAt:string;asOfBlock:string;asOfBlockHash:string;
  scannedFromBlock:string;confirmationDepth:12;historyCoverage:"RECENT_WINDOW_ONLY";
  metadataCoverage:"DIRECT_FACTORY_INPUT_ONLY";fundingCoverage:"NOT_COLLECTED";
  launches:PonsLaunchPreview[];
};
/** Only direct-factory calldata can supply a logo here. Router call metadata remains unknown.
 * Strict address/field bounds apply to untrusted user-supplied launch descriptions. */
export function safeDirectMetadata(value:unknown):Metadata {
  const empty:Metadata={status:"NOT_AVAILABLE",name:null,symbol:null,logo:null,
    description:null,website:null,telegram:null,twitter:null};
  if(!value||typeof value!=="object")return empty;
  const o=value as Record<string,unknown>;
  const read=(key:string,max:number)=>typeof o[key]==="string" && (o[key] as string).length<=max
    ? (o[key] as string).trim()||null : null;
  const name=read("name",120),symbol=read("symbol",32);
  if(!name||!symbol)return empty;
  const social=o.socials && typeof o.socials==="object"?o.socials as Record<string,unknown>:{};
  const url=(key:string)=>{
    const raw=social[key];
    if(typeof raw!=="string"||raw.length>350)return null;
    try {const u=new URL(raw);return u.protocol==="https:" && !u.username && !u.password?u.href:null;}
    catch{return null;}
  };
  return {status:"DIRECT_FACTORY_INPUT",name,symbol,logo:read("logo",600),
    description:read("description",500),website:url("website"),telegram:url("telegram"),twitter:url("twitter")};
}
export function buildPonsPreviewSnapshot(input:{
  generatedAt:string;asOfBlock:bigint;asOfBlockHash:string;scannedFromBlock:bigint;
  factoryCodeHash:string; logs:readonly PonsLog[];
  metadataByTx:ReadonlyMap<string,Metadata>;
}):PonsPreviewSnapshot{
  const a=PONS_PREVIEW_AUTHORITY;
  if(input.factoryCodeHash.toLowerCase()!==a.runtimeCodeHash)throw Error("PONS_FACTORY_RUNTIME_MISMATCH");
  if(!hex64.test(input.asOfBlockHash)||input.asOfBlock<a.fromBlock ||
     input.scannedFromBlock<a.fromBlock || input.scannedFromBlock>input.asOfBlock)
    throw Error("PONS_SNAPSHOT_ANCHOR_INVALID");
  if(!Number.isFinite(Date.parse(input.generatedAt)))throw Error("PONS_SNAPSHOT_CLOCK_INVALID");
  const ordered=[...input.logs].sort((a,b)=>a.blockNumber===b.blockNumber?b.logIndex-a.logIndex:
    a.blockNumber>b.blockNumber?-1:1);
  if(ordered.length>500)throw Error("PONS_SNAPSHOT_OVER_LIMIT");
  const identities=new Set<string>();const launches:PonsLaunchPreview[]=[];
  for(const log of ordered){
    if(log.blockNumber<input.scannedFromBlock||log.blockNumber>input.asOfBlock||
       !hex64.test(log.blockHash)||!hex64.test(log.transactionHash)||
       ![log.token,log.curve,log.deployer,log.pairToken].every(x=>hex40.test(x))||
       !Number.isSafeInteger(log.logIndex)||log.logIndex<0 ||log.launchConfigId<0n)
      throw Error("PONS_LAUNCH_LOG_INVALID");
    const key=log.transactionHash.toLowerCase()+":"+log.logIndex;
    if(identities.has(key))throw Error("PONS_DUPLICATE_EVENT_IDENTITY");
    identities.add(key);
    const metadata=input.metadataByTx.get(log.transactionHash.toLowerCase())??safeDirectMetadata(null);
    launches.push({
      id:createHash("sha256").update(canonicalJson({
        kind:"PONS_V2_LAUNCH_V1",chainId:a.chainId,factory:a.factory.toLowerCase(),
        txHash:log.transactionHash.toLowerCase(),token:log.token.toLowerCase()
      })).digest("hex"),
      token:log.token.toLowerCase(),curve:log.curve.toLowerCase(),
      deployer:log.deployer.toLowerCase(),pairToken:log.pairToken.toLowerCase(),
      blockNumber:log.blockNumber.toString(),blockHash:log.blockHash.toLowerCase(),
      txHash:log.transactionHash.toLowerCase(),logIndex:log.logIndex,
      launchConfigId:log.launchConfigId.toString(),metadata,
      previousFromSameDeployerWithinWindow:0
    });
  }
  // Counts are deliberately restricted to *older* launches inside the retrieved window.
  const priorByDeployer=new Map<string,number>();
  for(let i=launches.length-1;i>=0;i--){
    const item=launches[i]!;
    item.previousFromSameDeployerWithinWindow=priorByDeployer.get(item.deployer)??0;
    priorByDeployer.set(item.deployer,item.previousFromSameDeployerWithinWindow+1);
  }
  return {schemaVersion:"binrat.pons-preview/0.1",chainId:4663,factory:a.factory,
    authorityId:a.authorityId,factoryRuntimeCodeHash:a.runtimeCodeHash,
    generatedAt:input.generatedAt,asOfBlock:input.asOfBlock.toString(),
    asOfBlockHash:input.asOfBlockHash.toLowerCase(),
    scannedFromBlock:input.scannedFromBlock.toString(),confirmationDepth:12,
    historyCoverage:"RECENT_WINDOW_ONLY",metadataCoverage:"DIRECT_FACTORY_INPUT_ONLY",
    fundingCoverage:"NOT_COLLECTED",launches};
}
