/** Retrospective pilot only. Selection is frozen before any Pons outcome request. */
import {createHash} from 'node:crypto';
import {decodeEventLog,keccak256,toEventSelector,type Hex} from 'viem';
import {canonicalJson} from '../evidence/canonical.js';
import {PONS_V2_FACTORY,PONS_V2_FACTORY_CODE_HASH} from '../pons/chain.js';
import {ponsTokenLaunchedEvent} from '../pons/ponsAbi.js';
import {parseOutgoingTransferPage} from '../pons/fundingOutgoing.js';
import type {PonsExternalNativeInboundCandidate as Candidate} from '../pons/fundingProvenance.js';
import {parseStrictJson} from './competence.js';
import {PROSPECTIVE_FUNDER,type RpcRequest} from './prospective.js';
import type {CalibrationCall} from './indexedCalibration.js';

export const FUNDER_COHORT_V1=Object.freeze({schemaVersion:'binrat.funder-cohort-policy/1',
  funder:PROSPECTIVE_FUNDER,fromBlock:81504001,toBlock:81704000,outcomeThroughBlock:81756562,
  maxRecipients:20,maxPages:8,pageSize:5,scanChunkBlocks:4096,maxLogsPerChunk:128,
  horizonsSeconds:[600,3600],minDecisionRecipients:10,decisionYield:0.2,
  maxRpcCalls:384,maxRunMs:600000,noRetries:true,selection:'FIRST_DISTINCT_NON_SELF_RECIPIENTS_IN_ASCENDING_PROVIDER_ORDER',
  coverage:'PROVIDER_INDEXED_EXTERNAL_NATIVE_CANDIDATES_AND_PROVIDER_RETURNED_PONS_LOGS',
  model:false,delivery:false,capital:false} as const);
type Obj=Record<string,any>;
const fail=(code='COHORT_RESPONSE_INVALID'):never=>{throw new Error(code);};
const obj=(v:unknown):Obj=>v&&typeof v==='object'&&!Array.isArray(v)?v as Obj:fail();
const qty=(v:unknown):bigint=>typeof v==='string'&&/^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/.test(v)?BigInt(v):fail();
const hex=(v:unknown,n:number):string=>typeof v==='string'&&new RegExp(`^0x[0-9a-f]{${n}}$`).test(v)?v:fail();
const q=(n:bigint|number)=>'0x'+BigInt(n).toString(16);
const digest=(v:unknown)=>createHash('sha256').update(canonicalJson(v)).digest('hex');
function block(v:unknown,n:bigint,full=false){
  const b=obj(v);if(qty(b.number)!==n||qty(b.timestamp)>BigInt(Math.floor(Number.MAX_SAFE_INTEGER/1000))||
    !Array.isArray(b.transactions)||b.transactions.length>5000)fail('COHORT_BLOCK_INVALID');
  hex(b.hash,64);hex(b.parentHash,64);const seen=new Set<string>();
  for(const [i,raw] of b.transactions.entries()){
    const tx=full?obj(raw):null,hash=hex(full?tx!.hash:raw,64);if(seen.has(hash))fail('COHORT_DUPLICATE_TRANSACTION');seen.add(hash);
    if(tx){hex(tx.from,40);if(tx.to!==null)hex(tx.to,40);qty(tx.value);
      if(tx.blockHash!==b.hash||tx.blockNumber!==b.number||qty(tx.transactionIndex)!==BigInt(i)||qty(tx.chainId)!==4663n)fail('COHORT_TRANSACTION_BINDING');}
  }return b;
}
function receipt(v:unknown,hash:string,b:Obj){
  const r=obj(v);if(r.transactionHash!==hash||r.blockHash!==b.hash||r.blockNumber!==b.number||qty(r.status)!==1n||
    !Array.isArray(r.logs)||r.logs.length>128)fail('COHORT_RECEIPT_BINDING');
  for(const l of r.logs)if(l.removed!==false||l.blockHash!==b.hash||l.blockNumber!==b.number||l.transactionHash!==hash)fail('COHORT_RECEIPT_LOG_BINDING');
  return r;
}
function sameHeader(a:Obj,b:Obj){return ['number','hash','parentHash','timestamp'].every(k=>a[k]===b[k]);}
const candidateJson=(c:Candidate)=>({txHash:c.txHash,recipient:c.to,blockNumber:c.blockNumber.toString(),valueWei:c.valueWei.toString()});

/** Recompute every expected read and score from raw responses; never trust a summary or unverified locator. */
export function auditFunderCohort(calls:CalibrationCall[],createdAtMs=calls[0]?.reservedAtMs??0){
  const p=FUNDER_COHORT_V1,from=BigInt(p.fromBlock),end=BigInt(p.toBlock),ceiling=BigInt(p.outcomeThroughBlock);
  let stage='CHAIN',error:string|null=null,next:RpcRequest|null=null,start:Obj|null=null,finish:Obj|null=null,outcomeEnd:Obj|null=null;
  let pageKey:string|null=null,pages=0,pageEnded=false,lastBlock=from,returned=0,selfTransfers=0,repeatedRecipients=0;
  const txHashes=new Set<string>(),recipients=new Set<string>(),pageKeys=new Set<string>(),candidates:Candidate[]=[],fundings:Obj[]=[],verifiedLaunches:Obj[]=[];
  let selectionDigest:string|null=null,selectionSequence:number|null=null,fundingIndex=0,fundingBlock:Obj|null=null;
  let scanFrom=from,scanTo=from,scanHeader:Obj|null=null,previousScanTime=0n;
  const confirmedRanges:Obj[]=[],observedLogs:Obj[]=[],logIds=new Set<string>();
  let launchIndex=0,launchBlock:Obj|null=null,launchReceipt:Obj|null=null;
  const launchCandidates=():Obj[]=>candidates.flatMap((c,i)=>{
    const first=observedLogs.filter(l=>l.recipient===c.to&&qty(l.blockNumber)>c.blockNumber)
      .sort((a,b)=>qty(a.blockNumber)<qty(b.blockNumber)?-1:qty(a.blockNumber)>qty(b.blockNumber)?1:Number(qty(a.logIndex)-qty(b.logIndex)))[0];
    return first?[{...first,fundingIndex:i}]:[];
  });
  const advanceScan=()=>{scanTo=scanFrom+BigInt(p.scanChunkBlocks)-1n;if(scanTo>ceiling)scanTo=ceiling;stage='SCAN_HEADER';};
  const request=():RpcRequest|null=>{
    let method='eth_getBlockByNumber',params:unknown[]=[];
    switch(stage){
      case 'CHAIN':method='eth_chainId';break;
      case 'CODE':method='eth_getCode';params=[PONS_V2_FACTORY,q(ceiling)];break;
      case 'START':params=[q(from),false];break;
      case 'END':case 'INDEX_RECHECK':params=[q(end),false];break;
      case 'CEILING':case 'CEILING_RECHECK':params=[q(ceiling),false];break;
      case 'INDEX':method='alchemy_getAssetTransfers';params=[{fromBlock:q(from),toBlock:q(end),fromAddress:p.funder,
        category:['external'],excludeZeroValue:true,withMetadata:false,order:'asc',maxCount:'0x5',...(pageKey?{pageKey}:{})}];break;
      case 'FUNDING_BLOCK':case 'FUNDING_RECHECK':params=[q(candidates[fundingIndex]!.blockNumber),stage==='FUNDING_BLOCK'];break;
      case 'FUNDING_RECEIPT':method='eth_getTransactionReceipt';params=[candidates[fundingIndex]!.txHash];break;
      case 'SCAN_HEADER':case 'SCAN_RECHECK':params=[q(scanTo),false];break;
      case 'SCAN_LOGS':method='eth_getLogs';params=[{address:PONS_V2_FACTORY,fromBlock:q(scanFrom),toBlock:q(scanTo),
        topics:[toEventSelector(ponsTokenLaunchedEvent),null,null,candidates.map(c=>'0x'+c.to.slice(2).padStart(64,'0'))]}];break;
      case 'LAUNCH_BLOCK':case 'LAUNCH_RECHECK':params=[launchCandidates()[launchIndex]!.blockNumber,false];break;
      case 'LAUNCH_RECEIPT':method='eth_getTransactionReceipt';params=[launchCandidates()[launchIndex]!.transactionHash];break;
      default:return null;
    }return {jsonrpc:'2.0',id:calls.length+1,method,params};
  };
  try{
    if(!Number.isSafeInteger(createdAtMs)||createdAtMs<0)fail('COHORT_REGISTRATION_TIME');
    if(!Array.isArray(calls)||calls.length>p.maxRpcCalls||Buffer.byteLength(canonicalJson(calls))>48_000_000)fail('COHORT_CALL_LIMIT');
    for(let i=0;i<calls.length;i++){
      const row=calls[i]!,expected=request();if(!expected)fail('COHORT_AFTER_TERMINAL');expected!.id=i+1;
      if(canonicalJson(row.request)!==canonicalJson(expected)||!Number.isSafeInteger(row.reservedAtMs)||row.reservedAtMs<createdAtMs||
        (i&&row.reservedAtMs<calls[i-1]!.completedAtMs!))fail('COHORT_REQUEST_OR_TIME_MISMATCH');
      if(row.status==='PENDING'||row.status==='FAILED'){
        if(i!==calls.length-1)fail('COHORT_AFTER_HALT');fail(row.status==='PENDING'?'COHORT_PENDING_NO_RETRY':'COHORT_FAILED_NO_RETRY');}
      if(row.status!=='COMPLETE'||row.error||!Number.isSafeInteger(row.completedAtMs)||row.completedAtMs!<row.reservedAtMs||
        typeof row.rawResponse!=='string'||Buffer.byteLength(row.rawResponse)>1_000_000)fail();
      if(row.completedAtMs!-createdAtMs>=p.maxRunMs)fail('COHORT_RESPONSE_AFTER_DEADLINE');
      const response=obj(parseStrictJson(row.rawResponse!));
      if(response.jsonrpc!=='2.0'||response.id!==i+1||Object.hasOwn(response,'error')||!Object.hasOwn(response,'result'))fail('COHORT_RPC_BINDING');
      const v=response.result;
      switch(stage){
        case 'CHAIN':if(v!=='0x1237')fail('COHORT_CHAIN_DRIFT');stage='CODE';break;
        case 'CODE':if(typeof v!=='string'||keccak256(v as Hex)!==PONS_V2_FACTORY_CODE_HASH)fail('COHORT_FACTORY_DRIFT');stage='START';break;
        case 'START':start=block(v,from);stage='END';break;
        case 'END':finish=block(v,end);if(qty(finish.timestamp)<qty(start!.timestamp))fail('COHORT_RANGE_TIME');stage='CEILING';break;
        case 'CEILING':outcomeEnd=block(v,ceiling);if(Number(qty(outcomeEnd.timestamp))*1000>row.completedAtMs!)fail('COHORT_FUTURE_CEILING');if(qty(outcomeEnd.timestamp)-qty(finish!.timestamp)<3600n)fail('COHORT_IMMATURE_WINDOW');stage='INDEX';break;
        case 'INDEX':{
          const page=parseOutgoingTransferPage(v,p.funder,from,end);pages++;
          for(const c of page.transfers){
            if(txHashes.has(c.txHash)||c.blockNumber<lastBlock)fail('COHORT_INDEX_DUPLICATE_OR_ORDER');txHashes.add(c.txHash);lastBlock=c.blockNumber;returned++;
            if(c.to===p.funder){selfTransfers++;continue;}
            if(recipients.has(c.to)){repeatedRecipients++;continue;}
            recipients.add(c.to);if(candidates.length<p.maxRecipients)candidates.push(c);
          }
          if(page.pageKey){if(pageKeys.has(page.pageKey))fail('COHORT_CURSOR_REPEATED');pageKeys.add(page.pageKey);}
          pageKey=page.pageKey;pageEnded=!pageKey;
          if(pageEnded||pages===p.maxPages||candidates.length===p.maxRecipients){
            selectionDigest=digest({protocol:p,candidates:candidates.map(candidateJson)});selectionSequence=i+1;stage='INDEX_RECHECK';
          }break;
        }
        case 'INDEX_RECHECK':if(!sameHeader(block(v,end),finish!))fail('COHORT_INDEX_ANCHOR_REORG');stage=candidates.length?'FUNDING_BLOCK':'CEILING_RECHECK';break;
        case 'FUNDING_BLOCK':{
          const c=candidates[fundingIndex]!;fundingBlock=block(v,c.blockNumber,true);
          const tx=fundingBlock.transactions.find((t:Obj)=>t.hash===c.txHash);
          if(!tx||tx.from!==p.funder||tx.to!==c.to||qty(tx.value)!==c.valueWei||qty(fundingBlock.timestamp)<qty(start!.timestamp)||
            qty(fundingBlock.timestamp)>qty(finish!.timestamp)||(c.blockNumber===from&&!sameHeader(fundingBlock,start!))||
            (c.blockNumber===end&&!sameHeader(fundingBlock,finish!)))fail('COHORT_CANONICAL_FUNDING');stage='FUNDING_RECEIPT';break;
        }
        case 'FUNDING_RECEIPT':receipt(v,candidates[fundingIndex]!.txHash,fundingBlock!);stage='FUNDING_RECHECK';break;
        case 'FUNDING_RECHECK':{
          const c=candidates[fundingIndex]!;if(!sameHeader(block(v,c.blockNumber),fundingBlock!))fail('COHORT_FUNDING_REORG');
          fundings.push({...candidateJson(c),timestamp:Number(qty(fundingBlock!.timestamp)),blockHash:fundingBlock!.hash,verifiedAtSequence:i+1});
          fundingIndex++;if(fundingIndex<candidates.length)stage='FUNDING_BLOCK';else advanceScan();break;
        }
        case 'SCAN_HEADER':{
          scanHeader=block(v,scanTo);if(qty(scanHeader.timestamp)<previousScanTime||qty(scanHeader.timestamp)>qty(outcomeEnd!.timestamp)||
            (scanTo===ceiling&&!sameHeader(scanHeader,outcomeEnd!)))fail('COHORT_SCAN_ANCHOR');stage='SCAN_LOGS';break;
        }
        case 'SCAN_LOGS':{
          if(!Array.isArray(v)||v.length>p.maxLogsPerChunk)fail('COHORT_LOG_LIMIT');
          for(const raw of v){
            const l=obj(raw);hex(l.transactionHash,64);hex(l.blockHash,64);const n=qty(l.blockNumber),index=qty(l.logIndex);
            if(l.address!==PONS_V2_FACTORY||l.removed!==false||n<scanFrom||n>scanTo||index>BigInt(Number.MAX_SAFE_INTEGER))fail('COHORT_LOG_BINDING');
            const a=decodeEventLog({abi:[ponsTokenLaunchedEvent],data:l.data as Hex,topics:l.topics,strict:true}).args;
            const recipient=a.deployer.toLowerCase();if(!candidates.some(c=>c.to===recipient))fail('COHORT_LOG_SUBJECT');
            const id=l.transactionHash+':'+index;if(logIds.has(id))fail('COHORT_LOG_DUPLICATE');logIds.add(id);
            observedLogs.push({...l,recipient,token:a.token.toLowerCase(),raw:structuredClone(l)});
          }stage='SCAN_RECHECK';break;
        }
        case 'SCAN_RECHECK':{
          if(!sameHeader(block(v,scanTo),scanHeader!))fail('COHORT_SCAN_REORG');previousScanTime=qty(scanHeader!.timestamp);
          confirmedRanges.push({fromBlock:scanFrom.toString(),toBlock:scanTo.toString(),endHash:scanHeader!.hash,confirmationSequence:i+1});
          if(scanTo<ceiling){scanFrom=scanTo+1n;advanceScan();}else stage=launchCandidates().length?'LAUNCH_BLOCK':'CEILING_RECHECK';break;
        }
        case 'LAUNCH_BLOCK':{
          const l=launchCandidates()[launchIndex]!;launchBlock=block(v,qty(l.blockNumber));
          const f=fundings[l.fundingIndex]!;
          if(launchBlock.hash!==l.blockHash||!launchBlock.transactions.includes(l.transactionHash)||qty(launchBlock.timestamp)<=BigInt(f.timestamp)||
            qty(launchBlock.timestamp)>qty(outcomeEnd!.timestamp))fail('COHORT_LAUNCH_CANONICAL_OR_CHRONOLOGY');
          const anchor=confirmedRanges.find(r=>r.toBlock===qty(l.blockNumber).toString());
          if(anchor&&anchor.endHash!==launchBlock.hash)fail('COHORT_LAUNCH_RANGE_BINDING');stage='LAUNCH_RECEIPT';break;
        }
        case 'LAUNCH_RECEIPT':{
          const l=launchCandidates()[launchIndex]!;launchReceipt=receipt(v,l.transactionHash,launchBlock!);
          if(launchReceipt.logs.filter((r:Obj)=>canonicalJson(r)===canonicalJson(l.raw)).length!==1)fail('COHORT_LAUNCH_RECEIPT_MISMATCH');stage='LAUNCH_RECHECK';break;
        }
        case 'LAUNCH_RECHECK':{
          const l=launchCandidates()[launchIndex]!;if(!sameHeader(block(v,qty(l.blockNumber)),launchBlock!))fail('COHORT_LAUNCH_REORG');
          verifiedLaunches.push({recipient:l.recipient,token:l.token,txHash:l.transactionHash,blockNumber:qty(l.blockNumber).toString(),
            timestamp:Number(qty(launchBlock!.timestamp)),delaySeconds:Number(qty(launchBlock!.timestamp))-fundings[l.fundingIndex]!.timestamp,verifiedAtSequence:i+1});
          launchIndex++;stage=launchIndex<launchCandidates().length?'LAUNCH_BLOCK':'CEILING_RECHECK';break;
        }
        case 'CEILING_RECHECK':if(!sameHeader(block(v,ceiling),outcomeEnd!))fail('COHORT_CEILING_REORG');stage='COMPLETE';break;
      }
    }
    next=request();
    if(next&&calls.length===p.maxRpcCalls)fail('COHORT_ORIGINAL_BUDGET_EXHAUSTED');
  }catch(caught){error=caught instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(caught.message)?caught.message:'COHORT_INVALID_RECEIPTS';next=null;}
  const complete=stage==='COMPLETE'&&!error;
  const results=fundings.map(f=>{const launch=verifiedLaunches.find(l=>l.recipient===f.recipient)??null;
    return {...f,launch,within10Minutes:launch?launch.delaySeconds<=600:complete?false:null,
      within60Minutes:launch?launch.delaySeconds<=3600:complete?false:null,
      unverifiedPriorOrSameBlockLogs:observedLogs.filter(l=>l.recipient===f.recipient&&qty(l.blockNumber)<=BigInt(f.blockNumber)).length};});
  const n=complete?results.length:null,ten=complete?results.filter(r=>r.within10Minutes).length:null,sixty=complete?results.filter(r=>r.within60Minutes).length:null;
  const verdict=!complete?'INCOMPLETE_NO_YIELD_DECISION':n!<p.minDecisionRecipients?'INCONCLUSIVE_SMALL_COHORT':
    ten!/n!>=p.decisionYield?'SMALL_EXPERIMENT_10_MINUTE_RULE':sixty!/n!>=p.decisionYield?
      'DEFER_10_MINUTE_CONSIDER_LONGER_WINDOW':'DEFER_FUNDER_PRELAUNCH_STRATEGY';
  return {schemaVersion:'binrat.funder-cohort-audit/1',outcome:error?'HALTED':complete?'COMPLETE':calls.length?'INCOMPLETE':'NOT_STARTED',
    stage,error,createdAtMs,attempts:calls.length,complete:calls.filter(c=>c.status==='COMPLETE').length,failed:calls.filter(c=>c.status==='FAILED').length,
    pending:calls.filter(c=>c.status==='PENDING').length,nextRequest:next,selection:{digest:selectionDigest,sealedAtSequence:selectionSequence,
      candidates:candidates.map(candidateJson),pages,returned,selfTransfers,repeatedRecipients,pageEnded,
      limitation:pageEnded?'PROVIDER_ENUMERATION_ENDED_NOT_INDEPENDENT_COMPLETENESS':'CAPPED_ASCENDING_PREFIX'},
    confirmedLaunchRanges:confirmedRanges,results,score:{recipients:n,launchesWithin10Minutes:ten,launchesWithin60Minutes:sixty,verdict,
      caveat:'DESCRIPTIVE_SELECTED_FUNDER_PILOT_NO_BASELINE_NO_CAUSAL_OR_PREDICTIVE_LIFT'},
    provenance:'PUBLIC_RPC_RETROSPECTIVE',coverage:p.coverage,modelCalls:0,deliveryCalls:0,capitalCalls:0,providerReportedCost:null};
}
