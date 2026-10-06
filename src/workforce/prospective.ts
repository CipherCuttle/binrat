/** Manual, bounded public-RPC observation. Never imported by production routes. */
import {readFileSync} from 'node:fs';
import {Ajv2020} from 'ajv/dist/2020.js';
import { decodeEventLog, keccak256, toEventSelector, type Hex } from 'viem';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { PONS_V2_FACTORY, PONS_V2_FACTORY_CODE_HASH } from '../pons/chain.js';
import { ponsTokenLaunchedEvent } from '../pons/ponsAbi.js';

export const PROSPECTIVE_RPC = 'https://rpc.mainnet.chain.robinhood.com';
export const PROSPECTIVE_FUNDER = '0x9bc462bce2acd6fbe2ef5470d55b439453451083';
export interface ProspectiveManifest {
  schemaVersion:'binrat.prospective-capture/1'; provenance:'PUBLIC_RPC_SHADOW';
  captureId:string; funder:typeof PROSPECTIVE_FUNDER; endpoint:typeof PROSPECTIVE_RPC;
  createdAtMs:number; expiresAtMs:number; maxRpcCalls:48; historyBlocks:8; maxWindowBlocks:200000;
  authority:{ publicRpcRead:true; model:false; delivery:false; capital:false };
  digest:string;
}
export interface RpcRequest {jsonrpc:'2.0';id:number;method:string;params:unknown[]}
export interface CaptureCall {
  sequence:number; previousDigest:string; digest:string; startedAtMs:number; completedAtMs:number|null;
  request:RpcRequest; status:'PENDING'|'COMPLETE'|'FAILED'; rawResponse:string|null; error:string|null;
}
export interface ProspectiveHandoff {
  schemaVersion:'binrat.prospective-handoff/1'; fromRat:'SNIFFER';toRat:'RAT_ZERO';
  objective:'CHECK_PONS_LAUNCH_AFTER_OBSERVATION'; captureId:string; recipient:string;
  createdAtMs:number; afterBlock:string; fundingTx:string;
  history:{fromBlock:string;toBlock:string;scope:'TOP_LEVEL_TRANSACTION_PARTICIPATION_ONLY';complete:true;seen:false;blockHashes:string[]};
  evidenceSequences:number[]; authority:{research:true;network:false;provider:false;delivery:false;capital:false};
  remainingRpcCalls:number; digest:string;
}
type Phase='CREATED'|'SEARCHING'|'COLLECTING_HISTORY'|'HANDOFF_PREPARED'|'WATCHING'|'FOUND'|'INELIGIBLE'|'EXPIRED'|'EXHAUSTED'|'HALTED';
type Stage='CHAIN'|'CODE'|'INITIAL_HEAD'|'SAMPLE'|'FUNDING_RECEIPT'|'HISTORY'|'FUNDING_RECHECK'|'PRE_HEAD'|'PRE_LOGS'|'HANDOFF_HEAD'|'WATCH_HEAD'|'WATCH_ANCHOR'|'RANGE_START'|'WATCH_LOGS'|'RANGE_ANCHOR'|'LAUNCH_RECEIPT'|'LAUNCH_BLOCK';
type Obj=Record<string,any>;
export interface ProspectiveState {
  mode:'LOCAL_READ_ONLY_SHADOW'; captureId:string; phase:Phase; stage:Stage; reason:string|null; rpcCalls:number;
  initialBlock:string|null; cursor:string|null; throughBlock:string|null;
  funding:Obj|null; fundingBlock:Obj|null; history:Obj[]; handoff:ProspectiveHandoff|null;
  finding:{provenance:'PUBLIC_RPC_SHADOW';fundingTx:string;launchTx:string;recipient:string;token:string;
    fundingBlock:string;launchBlock:string;handoffDigest:string;historyScope:string;evidenceSequences:number[];digest:string}|null;
  caseDiff:{provenance:'PUBLIC_RPC_SHADOW';beforeDigest:string;afterDigest:string;addedFacts:string[]}|null;
  notification:{state:'PREPARED_ONLY';deliveryAuthorized:false;id:string;text:string}|null;
  discoveryCoverage:'SAMPLED_BLOCKS_ONLY'; authentication:'PROVIDER_REPORTED_LOCAL_CLOCK_NOT_EXTERNALLY_ATTESTED';
  nextRequest:RpcRequest|null; snapshotDigest:string;
}
const ajv=new Ajv2020({strict:true});
const manifestShape=ajv.compile(JSON.parse(readFileSync('contracts/rat-workforce/prospective/PROSPECTIVE_CAPTURE_V1.schema.json','utf8')));
const handoffShape=ajv.compile(JSON.parse(readFileSync('contracts/rat-workforce/prospective/PROSPECTIVE_HANDOFF_V1.schema.json','utf8')));
const fail=(code='PROSPECTIVE_RESPONSE_INVALID'):never=>{throw new Error(code)};
const obj=(v:unknown):Obj=>v&&typeof v==='object'&&!Array.isArray(v)?v as Obj:fail();
const hex=(v:unknown,n:number):string=>typeof v==='string'&&new RegExp(`^0x[a-f0-9]{${n}}$`).test(v)?v:fail();
const quantity=(v:unknown):bigint=>typeof v==='string'&&/^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/.test(v)?BigInt(v):fail();
const q=(n:bigint):string=>`0x${n.toString(16)}`;
const terminal=(s:ProspectiveState)=>['FOUND','INELIGIBLE','EXPIRED','EXHAUSTED','HALTED'].includes(s.phase);
export const captureTerminal=(s:ProspectiveState)=>terminal(s);
export async function sealCapture<T extends object>(value:T):Promise<T & {digest:string}> {
  const copy={...value} as Record<string,unknown>;delete copy.digest;return {...value,digest:await sha256Hex(copy)} as T & {digest:string};
}
export async function validateProspectiveManifest(input:unknown):Promise<ProspectiveManifest> {
  if(!manifestShape(input))fail('PROSPECTIVE_MANIFEST_INVALID');
  const m=obj(input);
  if(Object.keys(m).sort().join(',')!=='authority,captureId,createdAtMs,digest,endpoint,expiresAtMs,funder,historyBlocks,maxRpcCalls,maxWindowBlocks,provenance,schemaVersion'||
    m.schemaVersion!=='binrat.prospective-capture/1'||m.provenance!=='PUBLIC_RPC_SHADOW'||m.endpoint!==PROSPECTIVE_RPC||m.funder!==PROSPECTIVE_FUNDER||
    typeof m.captureId!=='string'||!/^[a-zA-Z0-9_:-]{1,100}$/.test(m.captureId)||m.maxRpcCalls!==48||m.historyBlocks!==8||m.maxWindowBlocks!==200000||
    !Number.isSafeInteger(m.createdAtMs)||m.createdAtMs<0||m.expiresAtMs!==m.createdAtMs+86400000||
    canonicalJson(m.authority)!==canonicalJson({publicRpcRead:true,model:false,delivery:false,capital:false})||
    (await sealCapture(m)).digest!==m.digest)fail('PROSPECTIVE_MANIFEST_INVALID');
  return structuredClone(m) as ProspectiveManifest;
}
function block(value:unknown,full:boolean):Obj {
  const b=obj(value);hex(b.hash,64);hex(b.parentHash,64);quantity(b.number);
  if(quantity(b.number)>99999999999999999999n||quantity(b.timestamp)>BigInt(Math.floor(Number.MAX_SAFE_INTEGER/1000))||
    !Array.isArray(b.transactions)||b.transactions.length>5000)fail();
  const seen=new Set<string>();
  b.transactions.forEach((raw:unknown,index:number)=>{
    if(!full){const hash=hex(raw,64);if(seen.has(hash))fail();seen.add(hash);return;}
    const tx=obj(raw);hex(tx.hash,64);hex(tx.from,40);if(tx.to!==null)hex(tx.to,40);quantity(tx.value);
    if(tx.blockHash!==b.hash||tx.blockNumber!==b.number||quantity(tx.transactionIndex)!==BigInt(index)||quantity(tx.chainId)!==4663n||seen.has(tx.hash))fail();seen.add(tx.hash);
  });
  return b;
}
function pointTime(b:Obj,time:number){if(Math.abs(Number(quantity(b.timestamp))*1000-time)>30000)fail('PROSPECTIVE_CLOCK_OR_HEAD_STALE');}
function receipt(value:unknown,txHash:string,b:Obj):Obj {
  const r=obj(value);
  if(r.transactionHash!==txHash||r.blockHash!==b.hash||r.blockNumber!==b.number||quantity(r.status)!==1n||
      !Array.isArray(r.logs)||r.logs.length>128)fail('PROSPECTIVE_RECEIPT_BINDING_INVALID');
  for(const l of r.logs)if(l.removed!==false||l.blockHash!==r.blockHash||l.blockNumber!==r.blockNumber||l.transactionHash!==r.transactionHash)fail();
  return r;
}
function logs(value:unknown,from:bigint,to:bigint,recipient:string):Obj[]{
  if(!Array.isArray(value)||value.length>32)return fail();const seen=new Set<string>();
  return value.map((raw:unknown)=>{
    const l=obj(raw);hex(l.transactionHash,64);hex(l.blockHash,64);
    const n=quantity(l.blockNumber),index=quantity(l.logIndex);
    if(l.address!==PONS_V2_FACTORY||l.removed!==false||n<from||n>to||index>BigInt(Number.MAX_SAFE_INTEGER))fail();
    const a=decodeEventLog({abi:[ponsTokenLaunchedEvent],data:l.data as Hex,topics:l.topics,strict:true}).args;
    if(a.deployer.toLowerCase()!==recipient)fail();const id=`${l.transactionHash}:${index}`;
    if(seen.has(id))fail('PROSPECTIVE_DUPLICATE_LOG');seen.add(id);return {...l,args:{token:a.token.toLowerCase(),deployer:a.deployer.toLowerCase(),curve:a.curve.toLowerCase()}};
  }).sort((a:Obj,b:Obj)=>quantity(a.blockNumber)<quantity(b.blockNumber)?-1:quantity(a.blockNumber)>quantity(b.blockNumber)?1:Number(quantity(a.logIndex)-quantity(b.logIndex)));
}
function filter(from:bigint,to:bigint,recipient:string){return {address:PONS_V2_FACTORY,fromBlock:q(from),toBlock:q(to),
  topics:[toEventSelector(ponsTokenLaunchedEvent),null,null,`0x${recipient.slice(2).padStart(64,'0')}`]};}

/** Pure reconstruction validates every request in order; future responses cannot modify an earlier prefix. */
export async function auditProspective(input:unknown,calls:CaptureCall[],now?:number):Promise<ProspectiveState>{
  const m=await validateProspectiveManifest(input);
  if(!Array.isArray(calls)||calls.length>m.maxRpcCalls||canonicalJson(calls).length>12_000_000)fail('PROSPECTIVE_JOURNAL_INVALID');
  const s:ProspectiveState={mode:'LOCAL_READ_ONLY_SHADOW',captureId:m.captureId,phase:'CREATED',stage:'CHAIN',reason:null,rpcCalls:0,initialBlock:null,cursor:null,throughBlock:null,
    funding:null,fundingBlock:null,history:[],handoff:null,finding:null,caseDiff:null,notification:null,discoveryCoverage:'SAMPLED_BLOCKS_ONLY',
    authentication:'PROVIDER_REPORTED_LOCAL_CLOCK_NOT_EXTERNALLY_ATTESTED',nextRequest:null,snapshotDigest:''};
  let preHead:Obj|null=null,handoffHead:Obj|null=null,rangeBlock:Obj|null=null,rangeStart:Obj|null=null,rangeLog:Obj|null=null;
  let cursorHash:string|null=null;
  let previousDigest=m.digest,previousTime=m.createdAtMs;
  const request=():RpcRequest|null=>{
    if(terminal(s))return null;let method='',params:unknown[]=[];
    switch(s.stage){
      case 'CHAIN':method='eth_chainId';break;
      case 'CODE':method='eth_getCode';params=[PONS_V2_FACTORY,'latest'];break;
      case 'INITIAL_HEAD':case 'PRE_HEAD':case 'HANDOFF_HEAD':case 'WATCH_HEAD':method='eth_getBlockByNumber';params=['latest',false];break;
      case 'SAMPLE':method='eth_getBlockByNumber';params=['latest',true];break;
      case 'FUNDING_RECEIPT':method='eth_getTransactionReceipt';params=[s.funding!.hash];break;
      case 'HISTORY':method='eth_getBlockByNumber';params=[q(quantity(s.fundingBlock!.number)-8n+BigInt(s.history.length)),true];break;
      case 'FUNDING_RECHECK':method='eth_getBlockByNumber';params=[s.fundingBlock!.number,false];break;
      case 'PRE_LOGS':method='eth_getLogs';params=[filter(quantity(s.fundingBlock!.number),quantity(preHead!.number),s.funding!.to)];break;
      case 'WATCH_ANCHOR':method='eth_getBlockByNumber';params=[q(BigInt(s.cursor!)),false];break;
      case 'WATCH_LOGS':method='eth_getLogs';params=[filter(BigInt(s.cursor!)+1n,BigInt(s.throughBlock!),s.funding!.to)];break;
      case 'RANGE_START':case 'RANGE_ANCHOR':method='eth_getBlockByNumber';params=[q(BigInt(s.throughBlock!)),false];break;
      case 'LAUNCH_RECEIPT':method='eth_getTransactionReceipt';params=[rangeLog!.transactionHash];break;
      case 'LAUNCH_BLOCK':method='eth_getBlockByNumber';params=[rangeLog!.blockNumber,false];break;
    }
    return {jsonrpc:'2.0',id:s.rpcCalls+1,method,params};
  };
  for(const c of calls){
    if(Object.keys(c).sort().join(',')!=='completedAtMs,digest,error,previousDigest,rawResponse,request,sequence,startedAtMs,status'||
      c.sequence!==s.rpcCalls+1||c.previousDigest!==previousDigest||(await sealCapture(c)).digest!==c.digest||
      !Number.isSafeInteger(c.startedAtMs)||c.startedAtMs<previousTime||c.startedAtMs>m.expiresAtMs||
      canonicalJson(c.request)!==canonicalJson(request()))fail('PROSPECTIVE_JOURNAL_INVALID');
    s.rpcCalls++;previousDigest=c.digest;
    if(c.status==='PENDING'){
      if(c!==calls.at(-1)||c.completedAtMs!==null||c.rawResponse!==null||c.error!==null)fail('PROSPECTIVE_JOURNAL_INVALID');
      s.phase='HALTED';s.reason='UNCERTAIN_RESERVED_RPC_NO_RETRY';break;
    }
    if(!Number.isSafeInteger(c.completedAtMs)||c.completedAtMs!<c.startedAtMs||typeof c.rawResponse!=='string'||c.rawResponse.length>1_000_000)fail('PROSPECTIVE_JOURNAL_INVALID');
    previousTime=c.completedAtMs!;
    if(c.completedAtMs!>m.expiresAtMs){if(c!==calls.at(-1))fail('PROSPECTIVE_JOURNAL_INVALID');s.phase='EXPIRED';s.reason='DEADLINE_DURING_RESERVED_RPC';break;}
    if(c.status==='FAILED'){if(c!==calls.at(-1))fail('PROSPECTIVE_JOURNAL_INVALID');s.phase='HALTED';s.reason=c.error&&/^[A-Z][A-Z0-9_]{0,100}$/.test(c.error)?c.error:'RPC_FAILED';break;}
    if(c.status!=='COMPLETE'||c.error!==null)fail('PROSPECTIVE_JOURNAL_INVALID');
    try{
      const r=obj(JSON.parse(c.rawResponse!));
      if(r.jsonrpc!=='2.0'||r.id!==c.sequence||'error'in r||r.result==null)fail('PROSPECTIVE_RPC_ERROR');
      const result=r.result;
      switch(s.stage){
        case 'CHAIN':if(quantity(result)!==4663n)fail('PROSPECTIVE_CHAIN_DRIFT');s.stage='CODE';break;
        case 'CODE':if(typeof result!=='string'||keccak256(result as Hex)!==PONS_V2_FACTORY_CODE_HASH)fail('PROSPECTIVE_FACTORY_DRIFT');s.stage='INITIAL_HEAD';break;
        case 'INITIAL_HEAD':{const b=block(result,false);pointTime(b,c.completedAtMs!);s.initialBlock=quantity(b.number).toString();s.phase='SEARCHING';s.stage='SAMPLE';break;}
        case 'SAMPLE':{
          const b=block(result,true);pointTime(b,c.completedAtMs!);const number=quantity(b.number);
          if(number>BigInt(s.initialBlock!)+BigInt(m.maxWindowBlocks)){s.phase='EXPIRED';s.reason='PARTIAL_DISCOVERY_WINDOW_ENDED';break;}
          if(number<=BigInt(s.initialBlock!))break;
          const tx=b.transactions.find((t:Obj)=>t.from===m.funder&&t.to!==null&&t.to!==t.from&&quantity(t.value)>0n);
          if(!tx)break;s.funding=tx;s.fundingBlock=b;s.stage='FUNDING_RECEIPT';s.phase='COLLECTING_HISTORY';break;
        }
        case 'FUNDING_RECEIPT':{const r=receipt(result,s.funding!.hash,s.fundingBlock!);if(r.from!==s.funding!.from||r.to!==s.funding!.to)fail();s.stage='HISTORY';break;}
        case 'HISTORY':{
          const b=block(result,true),wanted=quantity(s.fundingBlock!.number)-8n+BigInt(s.history.length);
          if(quantity(b.number)!==wanted||quantity(b.timestamp)>quantity(s.fundingBlock!.timestamp)||(s.history.length&&(b.parentHash!==s.history.at(-1)!.hash||quantity(b.timestamp)<quantity(s.history.at(-1)!.timestamp))))fail('PROSPECTIVE_HISTORY_GAP_OR_FORK');
          s.history.push(b);
          if(s.history.length===8){
            if(s.fundingBlock!.parentHash!==b.hash)fail('PROSPECTIVE_HISTORY_GAP_OR_FORK');
            const seen=s.history.some(h=>h.transactions.some((t:Obj)=>t.from===s.funding!.to||t.to===s.funding!.to));
            if(seen){s.phase='INELIGIBLE';s.reason='RECIPIENT_SEEN_IN_DECLARED_EXTERNAL_WINDOW';}else s.stage='FUNDING_RECHECK';
          }break;
        }
        case 'FUNDING_RECHECK':{const b=block(result,false);if(b.hash!==s.fundingBlock!.hash||b.number!==s.fundingBlock!.number)fail('PROSPECTIVE_FUNDING_REORG');s.stage='PRE_HEAD';break;}
        case 'PRE_HEAD':{
          preHead=block(result,false);pointTime(preHead,c.completedAtMs!);
          if(quantity(preHead.number)<quantity(s.fundingBlock!.number)||quantity(preHead.number)-quantity(s.fundingBlock!.number)>4096n)fail('PROSPECTIVE_CANDIDATE_TOO_OLD');
          s.stage='PRE_LOGS';break;
        }
        case 'PRE_LOGS':{
          if(logs(result,quantity(s.fundingBlock!.number),quantity(preHead!.number),s.funding!.to).length){s.phase='INELIGIBLE';s.reason='LAUNCH_ALREADY_OBSERVED';}else s.stage='HANDOFF_HEAD';break;
        }
        case 'HANDOFF_HEAD':{
          handoffHead=block(result,false);pointTime(handoffHead,c.completedAtMs!);if(quantity(handoffHead.number)<quantity(preHead!.number))fail('PROSPECTIVE_HEAD_REGRESSED');
          const handoff:Omit<ProspectiveHandoff,'digest'>={schemaVersion:'binrat.prospective-handoff/1',fromRat:'SNIFFER',toRat:'RAT_ZERO',objective:'CHECK_PONS_LAUNCH_AFTER_OBSERVATION',captureId:m.captureId,
            recipient:s.funding!.to,createdAtMs:c.completedAtMs!,afterBlock:quantity(handoffHead.number).toString(),fundingTx:s.funding!.hash,
            history:{fromBlock:quantity(s.history[0]!.number).toString(),toBlock:quantity(s.history.at(-1)!.number).toString(),scope:'TOP_LEVEL_TRANSACTION_PARTICIPATION_ONLY',complete:true,seen:false,blockHashes:s.history.map(b=>b.hash)},
            evidenceSequences:Array.from({length:c.sequence},(_,i)=>i+1),authority:{research:true,network:false,provider:false,delivery:false,capital:false},remainingRpcCalls:m.maxRpcCalls-s.rpcCalls};
          if(quantity(handoffHead.number)>BigInt(s.initialBlock!)+BigInt(m.maxWindowBlocks)){s.phase='EXPIRED';s.reason='PARTIAL_DISCOVERY_WINDOW_ENDED';break;}
          s.handoff=await sealCapture(handoff);if(!handoffShape(s.handoff))fail('PROSPECTIVE_HANDOFF_INVALID');s.cursor=s.handoff.afterBlock;cursorHash=handoffHead.hash;s.stage='WATCH_HEAD';s.phase='HANDOFF_PREPARED';break;
        }
        case 'WATCH_HEAD':{
          const b=block(result,false);pointTime(b,c.completedAtMs!);const n=quantity(b.number),cursor=BigInt(s.cursor!);
          if(n<cursor)fail('PROSPECTIVE_HEAD_REGRESSED');
          const end=BigInt(s.initialBlock!)+BigInt(m.maxWindowBlocks);const target=n<end?n:end;
          if(target<=cursor){if(cursor>=end){s.phase='EXPIRED';s.reason='NO_MATCH_IN_DECLARED_LAUNCH_RANGE';}break;}
          s.throughBlock=(target<cursor+4096n?target:cursor+4096n).toString();s.stage='WATCH_ANCHOR';s.phase='WATCHING';break;
        }
        case 'WATCH_ANCHOR':{const b=block(result,false);if(b.hash!==cursorHash||quantity(b.number)!==BigInt(s.cursor!))fail('PROSPECTIVE_HANDOFF_REORG');s.stage='RANGE_START';break;}
        case 'RANGE_START':{rangeStart=block(result,false);if(quantity(rangeStart.number)!==BigInt(s.throughBlock!))fail();s.stage='WATCH_LOGS';break;}
        case 'WATCH_LOGS':{
          const observed=logs(result,BigInt(s.cursor!)+1n,BigInt(s.throughBlock!),s.funding!.to);rangeLog=observed[0]??null;s.stage='RANGE_ANCHOR';break;
        }
        case 'RANGE_ANCHOR':{
          rangeBlock=block(result,false);if(quantity(rangeBlock.number)!==BigInt(s.throughBlock!)||rangeBlock.hash!==rangeStart!.hash)fail('PROSPECTIVE_RANGE_REORG');
          if(rangeLog){s.stage='LAUNCH_RECEIPT';}else{s.cursor=s.throughBlock;cursorHash=rangeBlock.hash;s.stage='WATCH_HEAD';s.phase='WATCHING';}break;
        }
        case 'LAUNCH_RECEIPT':{
          const r=obj(result);if(r.transactionHash!==rangeLog!.transactionHash||r.blockHash!==rangeLog!.blockHash||r.blockNumber!==rangeLog!.blockNumber||quantity(r.status)!==1n||!Array.isArray(r.logs))fail();
          const matching=r.logs.filter((l:Obj)=>l.logIndex===rangeLog!.logIndex&&canonicalJson(l)===canonicalJson(Object.fromEntries(Object.entries(rangeLog!).filter(([k])=>k!=='args'))));
          if(matching.length!==1)fail('PROSPECTIVE_LAUNCH_RECEIPT_MISMATCH');s.stage='LAUNCH_BLOCK';break;
        }
        case 'LAUNCH_BLOCK':{
          const b=block(result,false);if(b.hash!==rangeLog!.blockHash||b.number!==rangeLog!.blockNumber||!b.transactions.includes(rangeLog!.transactionHash)||
            quantity(b.number)<=BigInt(s.handoff!.afterBlock)||Number(quantity(b.timestamp))*1000<=s.handoff!.createdAtMs)fail('PROSPECTIVE_LAUNCH_NOT_AFTER_HANDOFF');
          if(b.number===rangeBlock!.number&&b.hash!==rangeBlock!.hash)fail('PROSPECTIVE_RANGE_REORG');
          const content={provenance:'PUBLIC_RPC_SHADOW' as const,fundingTx:s.funding!.hash,launchTx:rangeLog!.transactionHash,recipient:s.funding!.to,token:rangeLog!.args.token,
            fundingBlock:quantity(s.fundingBlock!.number).toString(),launchBlock:quantity(b.number).toString(),handoffDigest:s.handoff!.digest,historyScope:s.handoff!.history.scope,
            evidenceSequences:Array.from({length:c.sequence},(_,i)=>i+1)};
          s.finding=await sealCapture(content);s.caseDiff={provenance:'PUBLIC_RPC_SHADOW',beforeDigest:s.handoff!.digest,afterDigest:s.finding.digest,addedFacts:['PONS_REPORTED_DEPLOYER_LAUNCH','FUNDING_PRECEDES_LAUNCH','LAUNCH_AFTER_LOCAL_HANDOFF']};s.notification={state:'PREPARED_ONLY',deliveryAuthorized:false,id:s.finding.digest,text:'Recorded direct funding, bounded recipient-window absence, then a Pons launch after the prepared handoff. Nothing sent.'};s.phase='FOUND';s.reason='SUPPORTED_LAUNCH_AFTER_LOCAL_HANDOFF';break;
        }
      }
    }catch(error){if(c!==calls.at(-1))fail('PROSPECTIVE_JOURNAL_INVALID');s.phase='HALTED';s.reason=error instanceof Error&&/^[A-Z][A-Z0-9_]{0,100}$/.test(error.message)?error.message:'PROSPECTIVE_RESPONSE_INVALID';break;}
  }
  if(!terminal(s)&&s.rpcCalls===m.maxRpcCalls){s.phase='EXHAUSTED';s.reason='ORIGIN_RPC_BUDGET_EXHAUSTED';}
  if(!terminal(s)&&now!==undefined&&now>m.expiresAtMs){s.phase='EXPIRED';s.reason='WALL_DEADLINE_PARTIAL_COVERAGE';}
  s.nextRequest=request();const {snapshotDigest:unused,...snapshot}=s;s.snapshotDigest=await sha256Hex(snapshot);return s;
}
