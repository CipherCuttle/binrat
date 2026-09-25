/**
 * Bounded GitHack-only Pons factory snapshot. READ ONLY: eth_chainId/getCode/getLogs/
 * getBlock/getTransaction; no signing, D1 writes, trading, migration or deployment.
 * SOURCE: SENTRY M2A reviewed factory epoch / source on https://docs.ponsfamily.com/v2.
 * This is a single confirmed RECENT_WINDOW_ONLY snapshot, not an always-on indexer.
 */
import { mkdir,writeFile } from "node:fs/promises";
import { resolve,dirname } from "node:path";
import { createPublicClient,decodeFunctionData,defineChain,http,keccak256,parseAbiItem,
 type Address,type Hash,type Hex } from "viem";
import {PONS_PREVIEW_AUTHORITY as authority,buildPonsPreviewSnapshot,
 safeDirectMetadata,type PonsLog,type Metadata} from "../../src/ponsPreview/snapshot.js";

const rpc=process.env.PONS_PREVIEW_RPC_URL??"https://rpc.mainnet.chain.robinhood.com";
const parsedUrl=new URL(rpc);
if(parsedUrl.protocol!=="https:" || parsedUrl.username || parsedUrl.password) throw Error("PONS_READ_RPC_INVALID");
const output=resolve(process.env.PONS_PREVIEW_OUTPUT??"web-v2/public/pons-preview-snapshot.json");
if(!output.endsWith(".json"))throw Error("PONS_SNAPSHOT_PATH_INVALID");
const MAX_LAUNCHES=500,SCAN_LIMIT=8192n,CONFIRMATIONS=12n;
const CHUNK=64n,METADATA_LIMIT=72,MAX_RANGES=128;
const chain=defineChain({id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},
  rpcUrls:{default:{http:[rpc]}}});
const client=createPublicClient({chain,transport:http(rpc,{retryCount:1,timeout:20_000})});
const event=parseAbiItem("event TokenLaunched(address indexed token,address indexed curve,address indexed deployer,address pairToken,uint256 launchConfigId,uint256 graduationThreshold)");
const directAbi=[{type:"function",name:"launchToken",stateMutability:"payable",inputs:[
  {name:"params",type:"tuple",components:[
    {name:"name",type:"string"},{name:"symbol",type:"string"},{name:"logo",type:"string"},
    {name:"description",type:"string"},{name:"socials",type:"tuple",components:[
      {name:"twitter",type:"string"},{name:"telegram",type:"string"},
      {name:"discord",type:"string"},{name:"website",type:"string"},
      {name:"farcaster",type:"string"}]},
    {name:"creatorFeeRecipient",type:"address"},{name:"creatorTaxBps",type:"uint16"},
    {name:"buybackEnabled",type:"bool"},{name:"expectedEconomics",type:"bytes32"},
    {name:"salt",type:"bytes32"}]},
  {name:"launchConfigId",type:"uint256"},{name:"pairToken",type:"address"}],
  outputs:[{name:"token",type:"address"},{name:"curve",type:"address"}]}] as const;
const eq=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
async function retry<T>(f:()=>Promise<T>,tag:string):Promise<T>{
  for(let n=0;n<3;n++){try{return await f();}catch(e){
    if(n===2)throw Error("PONS_RPC_"+tag+"_FAILED");
    await new Promise(r=>setTimeout(r,500*(n+1)));
  }}throw Error("PONS_RETRY_EXHAUSTED");
}
async function main(){
  const chainId=await retry(()=>client.getChainId(),"CHAIN");
  if(chainId!==4663)throw Error("PONS_CHAIN_MISMATCH");
  const head=await retry(()=>client.getBlockNumber(),"HEAD");
  if(head<=authority.fromBlock+CONFIRMATIONS)throw Error("PONS_HEAD_BEFORE_FACTORY_EPOCH");
  const asOf=head-CONFIRMATIONS,fromFloor=asOf-SCAN_LIMIT+1n>authority.fromBlock?
    asOf-SCAN_LIMIT+1n:authority.fromBlock;
  const [anchor,code]=await Promise.all([
    retry(()=>client.getBlock({blockNumber:asOf}),"ANCHOR"),
    retry(()=>client.getBytecode({address:authority.factory as Address,blockNumber:asOf}),"CODE")
  ]);
  if(!anchor.hash||!code||keccak256(code).toLowerCase()!==authority.runtimeCodeHash)
    throw Error("PONS_FACTORY_RUNTIME_MISMATCH");
  const all:PonsLog[]=[];let scannedFrom=asOf,ranges=0,end=asOf;
  while(end>=fromFloor && all.length<MAX_LAUNCHES){
    if(++ranges>MAX_RANGES)throw Error("PONS_SCAN_RANGE_BUDGET_EXHAUSTED");
    const from=end-CHUNK+1n>fromFloor?end-CHUNK+1n:fromFloor;
    const logs=await retry(()=>client.getLogs({address:authority.factory as Address,event,
      fromBlock:from,toBlock:end}),"LOGS");
    if(logs.length>1000)throw Error("PONS_LOG_RANGE_POSSIBLY_TRUNCATED");
    for(const log of logs){
      const a=log.args;
      if(!a.token||!a.curve||!a.deployer||!a.pairToken||a.launchConfigId===undefined||
        log.blockNumber===null||log.blockHash===null||log.transactionHash===null||log.logIndex===null)
        throw Error("PONS_FACTORY_LOG_MALFORMED");
      all.push({blockNumber:log.blockNumber,blockHash:log.blockHash,
        transactionHash:log.transactionHash,logIndex:log.logIndex,token:a.token,curve:a.curve,
        deployer:a.deployer,pairToken:a.pairToken,launchConfigId:a.launchConfigId});
    }
    scannedFrom=from;
    end=from-1n;
  }
  all.sort((a,b)=>a.blockNumber===b.blockNumber?b.logIndex-a.logIndex:a.blockNumber>b.blockNumber?-1:1);
  const newest=all.slice(0,MAX_LAUNCHES);
  const meta=new Map<string,Metadata>();
  const metadataTargets=newest.slice(0,METADATA_LIMIT);
  let direct=0;
  // A router launch's top-level calldata does not contain this factory's LaunchParams.
  // Leave such artwork UNKNOWN rather than scraping a mutable third-party logo.
  for(let i=0;i<metadataTargets.length;i+=4){
    await Promise.all(metadataTargets.slice(i,i+4).map(async log=>{
      try{
        const tx=await retry(()=>client.getTransaction({hash:log.transactionHash as Hash}),"TX");
        if(!eq(tx.to??"",authority.factory)||!eq(tx.from,log.deployer))return;
        const decoded=decodeFunctionData({abi:directAbi,data:tx.input as Hex});
        if(decoded.functionName!=="launchToken")return;
        const [params,id,pair]=decoded.args;
        if(id!==log.launchConfigId||!eq(pair,log.pairToken))return;
        meta.set(log.transactionHash.toLowerCase(),safeDirectMetadata(params));direct++;
      }catch{ /* per-transaction metadata unavailable, launch event remains authoritative */ }
    }));
  }
  const endCheck=await retry(()=>client.getBlock({blockNumber:asOf}),"CANONICAL_RECHECK");
  if(endCheck.hash!==anchor.hash)throw Error("PONS_SNAPSHOT_REORG_AT_ANCHOR");
  const snapshot=buildPonsPreviewSnapshot({generatedAt:new Date().toISOString(),
    asOfBlock:asOf,asOfBlockHash:anchor.hash,scannedFromBlock:scannedFrom,
    factoryCodeHash:keccak256(code),logs:newest,metadataByTx:meta});
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(snapshot)+"\n","utf8");
  console.log("PONS_READ_ONLY_PREVIEW_SNAPSHOT_PASS",JSON.stringify({
    chainId:4663,asOfBlock:snapshot.asOfBlock,from:snapshot.scannedFromBlock,
    launchCount:snapshot.launches.length,metadataInspected:metadataTargets.length,
    directMetadataMatches:direct,coverage:snapshot.historyCoverage,
    factoryHash:authority.runtimeCodeHash,output,
  }));
}
main().catch(e=>{console.error("PONS_PREVIEW_SNAPSHOT_FAILED",e instanceof Error?e.message:"UNKNOWN");process.exitCode=1;});
