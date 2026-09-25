/** Read-only Robinhood 4663 factory acquisition. HTTP alone commits confirmed evidence.
 * Optional WS subscriptions may wake a cycle but cannot advance the checkpoint. */
import {createPublicClient,defineChain,http,keccak256,parseAbiItem,type Address} from 'viem';
import {PONS_PREVIEW_AUTHORITY as A,type PonsLog} from '../ponsPreview/snapshot.js';
import {PonsD1Store} from './store.js';
import {indexedPonsFacts,PONS_MAX_FACTS_PER_CYCLE} from './model.js';

export interface PonsReadSource {
 chainId():Promise<number>;
 headBlock():Promise<bigint>;
 factoryCodeHash(block:bigint):Promise<string>;
 blockHash(block:bigint):Promise<string>;
 factoryLogs(from:bigint,to:bigint):Promise<PonsLog[]>;
}
const event=parseAbiItem('event TokenLaunched(address indexed token,address indexed curve,address indexed deployer,address pairToken,uint256 launchConfigId,uint256 graduationThreshold)');
export class ViemPonsHttpSource implements PonsReadSource{
 private readonly client;
 constructor(rpc='https://rpc.mainnet.chain.robinhood.com'){
  const u=new URL(rpc);
  if(u.protocol!=='https:'||u.username||u.password)throw Error('PONS_RPC_URL_INVALID');
  const chain=defineChain({id:4663,name:'Robinhood Chain',
   nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},
   rpcUrls:{default:{http:[rpc]}}});
  this.client=createPublicClient({chain,transport:http(rpc,{retryCount:1,timeout:20000})});
 }
 chainId(){return this.client.getChainId();}
 headBlock(){return this.client.getBlockNumber();}
 async factoryCodeHash(block:bigint):Promise<string>{
  const code=await this.client.getBytecode({address:A.factory as Address,blockNumber:block});
  if(!code||code==='0x')throw Error('PONS_FACTORY_CODE_MISSING');
  return keccak256(code).toLowerCase();
 }
 async blockHash(block:bigint):Promise<string>{
  const value=await this.client.getBlock({blockNumber:block});
  if(!value.hash)throw Error('PONS_BLOCK_HASH_MISSING');
  return value.hash.toLowerCase();
 }
 async factoryLogs(from:bigint,to:bigint):Promise<PonsLog[]>{
  const logs=await this.client.getLogs({address:A.factory as Address,
   event,fromBlock:from,toBlock:to,strict:true});
  if(logs.length>1000)throw Error('PONS_LOG_RANGE_POSSIBLY_TRUNCATED');
  return logs.map(log=>{
   if(!log.args.token||!log.args.curve||!log.args.deployer||
    !log.args.pairToken||log.args.launchConfigId===undefined||
    log.blockNumber===null||log.blockHash===null||log.transactionHash===null||log.logIndex===null)
    throw Error('PONS_FACTORY_LOG_MALFORMED');
   return {blockNumber:log.blockNumber,blockHash:log.blockHash,
    transactionHash:log.transactionHash,logIndex:log.logIndex,
    token:log.args.token,curve:log.args.curve,deployer:log.args.deployer,
    pairToken:log.args.pairToken,launchConfigId:log.args.launchConfigId};
  });
 }
}
const same=(x:string,y:string)=>x.toLowerCase()===y.toLowerCase();
async function assertSource(source:PonsReadSource,block:bigint):Promise<void>{
 if(await source.chainId()!==4663)throw Error('PONS_CHAIN_DRIFT');
 if(!same(await source.factoryCodeHash(block),A.runtimeCodeHash))
  throw Error('PONS_FACTORY_HASH_DRIFT');
}
export async function bootstrapPonsWindow(store:PonsD1Store,source:PonsReadSource,
 nowMs:number,lookback=8192n):Promise<void>{
 if(lookback<1n||lookback>8192n)throw Error('PONS_BOOTSTRAP_LOOKBACK');
 const head=await source.headBlock(),final=head-12n;
 if(final<A.fromBlock)throw Error('PONS_HEAD_BEFORE_FACTORY_EPOCH');
 await assertSource(source,final);
 const from=final-lookback+1n>A.fromBlock?final-lookback+1n:A.fromBlock;
 const preceding=await source.blockHash(from-1n);
 await store.initialize(from,preceding,nowMs);
}
export type PonsCycleResult={status:'COMMITTED'|'CAUGHT_UP';fromBlock:string|null;
 throughBlock:string;factCount:number;confirmationDepth:12};
/** One <=64-block catch-up range, <=16 immutable rows, <=19 D1 writes.
 * Reorg at a previously committed 12-confirmed checkpoint causes a durable HALT.
 * A transient reorg at the uncommitted target retries without publishing mixed facts. */
export async function collectOneConfirmedRange(store:PonsD1Store,source:PonsReadSource,
 nowMs:number):Promise<PonsCycleResult>{
 const cp=await store.checkpoint();
 if(!cp)throw Error('PONS_BOOTSTRAP_REQUIRED');
 if(cp.status!=='READY')throw Error('PONS_REORG_HALT');
 const head=await source.headBlock(),final=head-12n;
 if(final<BigInt(cp.lastBlock))throw Error('PONS_SOURCE_BEHIND_CHECKPOINT');
 await assertSource(source,final);
 const prior=await source.blockHash(BigInt(cp.lastBlock));
 if(!same(prior,cp.lastHash)){
  await store.haltForReorg(cp,prior,nowMs);
  throw Error('PONS_REORG_HALT');
 }
 if(BigInt(cp.nextBlock)>final)
  return {status:'CAUGHT_UP',fromBlock:null,throughBlock:cp.lastBlock.toString(),
   factCount:0,confirmationDepth:12};
 const from=BigInt(cp.nextBlock);
 let through=from+63n<final?from+63n:final;
 // Reduce the queried range rather than silently dropping dense launch events.
 let logs:PonsLog[]=[];
 for(;;){
  logs=await source.factoryLogs(from,through);
  if(logs.length<=PONS_MAX_FACTS_PER_CYCLE)break;
  if(through===from)throw Error('PONS_SINGLE_BLOCK_WRITE_BUDGET');
  through=from+(through-from)/2n;
 }
 const anchor=await source.blockHash(through);
 const blocks=[...new Set(logs.map(l=>l.blockNumber.toString()))];
 if(logs.some(l=>l.blockNumber<from||l.blockNumber>through))
  throw Error('PONS_LOG_OUTSIDE_RANGE');
 const canonical=new Map<string,string>();
 for(const n of blocks)canonical.set(n,await source.blockHash(BigInt(n)));
 for(const log of logs){
  if(!same(log.blockHash,canonical.get(log.blockNumber.toString())??''))
   throw Error('PONS_LOG_BLOCK_FORK');
 }
 // Recheck both ends after all RPC work and before D1 atomic advancement.
 if(!same(await source.blockHash(through),anchor))throw Error('PONS_REORG_DURING_SCAN');
 const priorAgain=await source.blockHash(BigInt(cp.lastBlock));
 if(!same(priorAgain,cp.lastHash)){
  await store.haltForReorg(cp,priorAgain,nowMs);
  throw Error('PONS_REORG_HALT');
 }
 const facts=indexedPonsFacts({from,through,throughHash:anchor,capturedAtMs:nowMs,logs});
 await store.appendRange({expected:cp,from,through,throughHash:anchor,facts,nowMs});
 return {status:'COMMITTED',fromBlock:from.toString(),throughBlock:through.toString(),
  factCount:facts.length,confirmationDepth:12};
}

