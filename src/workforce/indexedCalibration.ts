/** Separate retrospective retrieval/activity diagnostic; never a prospective job or subscription. */
import {canonicalJson} from '../evidence/canonical.js';
import {parseStrictJson} from './competence.js';
import {PROSPECTIVE_FUNDER,type RpcRequest} from './prospective.js';
import {parseOutgoingTransferPage} from '../pons/fundingOutgoing.js';
import type {PonsExternalNativeInboundCandidate as Candidate} from '../pons/fundingProvenance.js';

export const INDEXED_CALIBRATION_V1=Object.freeze({schemaVersion:'binrat.indexed-calibration/1',maxRpcCalls:12,
  recentWindowBlocks:200000,pageSize:5,maxPages:1,maxRecentVerifications:1,noRetries:true,
  maxRunMs:300000,model:false,delivery:false,capital:false,funder:PROSPECTIVE_FUNDER,
  controlBlock:77795399,controlHash:'0xcb29fa5271340288f12d79fba9adcd783a6d789e4dc043bd299812620511e9e2',
  controlRecipient:'0xaf70c00d8d252fc9fe68f00525b8df4e4fdcfcb8',controlValue:'0x2d0e13d60270f3',
  controlBlockHash:'0xe4503eaee898f505ec7b85584ab0f20480518318cfd93cd9609fe714659cec9c',
  coverage:'PROVIDER_INDEXED_EXTERNAL_NATIVE_CANDIDATES_ONLY'});
export interface CalibrationCall {request:RpcRequest;status:'PENDING'|'COMPLETE'|'FAILED';reservedAtMs:number;
  completedAtMs?:number;rawResponse?:string;error?:string|null}
const fail=(code='CALIBRATION_RESPONSE_INVALID'):never=>{throw new Error(code);};
const obj=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:fail();
const qty=(v:unknown):bigint=>typeof v==='string'&&/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(v)?BigInt(v):fail();
const hex=(v:unknown,n:number):string=>typeof v==='string'&&new RegExp(`^0x[0-9a-f]{${n}}$`).test(v)?v:fail();
const q=(n:bigint)=>'0x'+n.toString(16);
function block(v:unknown,expected?:bigint){
  const b=obj(v);hex(b.hash,64);hex(b.parentHash,64);const n=qty(b.number),t=qty(b.timestamp);
  if(n>99999999999999999999n||t>BigInt(Math.floor(Number.MAX_SAFE_INTEGER/1000))||
    (expected!==undefined&&n!==expected)||!Array.isArray(b.transactions)||b.transactions.length>5000)fail();
  return b;
}
function canonicalCandidate(v:unknown,c:Candidate){
  const b=block(v,c.blockNumber),seen=new Set<string>();let found:any=null;
  for(const [i,raw] of b.transactions.entries()){
    const tx=obj(raw),hash=hex(tx.hash,64);if(seen.has(hash))fail();seen.add(hash);
    if(hash!==c.txHash)continue;
    if(tx.blockHash!==b.hash||tx.blockNumber!==b.number||qty(tx.transactionIndex)!==BigInt(i)||
      qty(tx.chainId)!==4663n||tx.from!==c.from||tx.to!==c.to||qty(tx.value)!==c.valueWei)fail('CALIBRATION_CANONICAL_MISMATCH');
    found=tx;
  }
  if(!found)fail('CALIBRATION_CANONICAL_MISMATCH');return b;
}
function successfulReceipt(v:unknown,c:Candidate,b:Record<string,any>){
  const r=obj(v);if(r.transactionHash!==c.txHash||r.blockHash!==b.hash||r.blockNumber!==b.number||qty(r.status)!==1n||
    !Array.isArray(r.logs)||r.logs.length>128)fail('CALIBRATION_RECEIPT_MISMATCH');
  for(const raw of r.logs){const l=obj(raw);if(l.removed!==false||l.blockHash!==b.hash||l.blockNumber!==b.number||l.transactionHash!==c.txHash)fail();}
}
function page(v:unknown,from:bigint,to:bigint){
  const p=parseOutgoingTransferPage(v,PROSPECTIVE_FUNDER,from,to),seen=new Set<string>();
  for(const t of p.transfers){if(seen.has(t.txHash))fail('CALIBRATION_DUPLICATE_TRANSFER');seen.add(t.txHash);}return p;
}
function params(from:bigint,to:bigint){return {fromBlock:q(from),toBlock:q(to),fromAddress:PROSPECTIVE_FUNDER,
  category:['external'],excludeZeroValue:true,withMetadata:false,order:'asc',maxCount:'0x5'};}
function candidateJson(c:Candidate){return {txHash:c.txHash,from:c.from,to:c.to,blockNumber:c.blockNumber.toString(),valueWei:c.valueWei.toString()};}

/** Pure replay recomputes requests and admission. A failed/pending reservation is a terminal halt. */
export function auditIndexedCalibration(calls:CalibrationCall[]){
  let stage='CHAIN',next:RpcRequest|null=null,error:string|null=null,control:Candidate|null=null,
    historical:any=null,head:any=null,start:any=null,end:any=null,recent:Candidate|null=null;
  let controlVerified=false,recentVerified=false,returned=0,selfReturned=0,pageEnded:boolean|null=null;
  let from=0n,to=0n;
  const request=():RpcRequest|null=>{
    let method='eth_getBlockByNumber',p:unknown[]=[];
    switch(stage){
      case 'CHAIN':method='eth_chainId';break;
      case 'CONTROL_INDEX':method='alchemy_getAssetTransfers';p=[params(77795399n,77795399n)];break;
      case 'CONTROL_BLOCK':p=[q(77795399n),true];break;
      case 'CONTROL_RECEIPT':method='eth_getTransactionReceipt';p=[control!.txHash];break;
      case 'CONTROL_RECHECK':p=[q(77795399n),false];break;
      case 'HEAD':p=['latest',false];break;
      case 'START':p=[q(from),false];break;
      case 'END':case 'END_RECHECK':p=[q(to),false];break;
      case 'RECENT_INDEX':method='alchemy_getAssetTransfers';p=[params(from,to)];break;
      case 'RECENT_BLOCK':p=[q(recent!.blockNumber),true];break;
      case 'RECENT_RECEIPT':method='eth_getTransactionReceipt';p=[recent!.txHash];break;
      default:return null;
    }
    return {jsonrpc:'2.0',id:0,method,params:p};
  };
  try{
    if(!Array.isArray(calls)||calls.length>12)fail('CALIBRATION_CALL_LIMIT');
    for(let i=0;i<calls.length;i++){
      const row=calls[i]!,expected=request();if(!expected)throw new Error('CALIBRATION_AFTER_TERMINAL');expected.id=i+1;
      if(canonicalJson(row.request)!==canonicalJson(expected)||!Number.isSafeInteger(row.reservedAtMs)||row.reservedAtMs<0||
        (i&&row.reservedAtMs<calls[i-1]!.completedAtMs!))fail('CALIBRATION_REQUEST_OR_TIME_MISMATCH');
      if(row.status==='PENDING'||row.status==='FAILED'){
        if(i!==calls.length-1)fail('CALIBRATION_AFTER_HALT');fail(row.status==='PENDING'?'CALIBRATION_PENDING_RESERVATION':'CALIBRATION_FAILED_ATTEMPT');
      }
      if(row.status!=='COMPLETE'||row.error||!Number.isSafeInteger(row.completedAtMs)||row.completedAtMs!<row.reservedAtMs||
        typeof row.rawResponse!=='string'||Buffer.byteLength(row.rawResponse)>1000000)fail();
      const response=obj(parseStrictJson(row.rawResponse!));
      if(response.jsonrpc!=='2.0'||response.id!==expected.id||Object.hasOwn(response,'error')||!Object.hasOwn(response,'result'))fail('CALIBRATION_RPC_RESPONSE_INVALID');
      const v=response.result;
      switch(stage){
        case 'CHAIN':if(v!=='0x1237')fail('CALIBRATION_CHAIN_MISMATCH');stage='CONTROL_INDEX';break;
        case 'CONTROL_INDEX':{
          const p=page(v,77795399n,77795399n);
          control=p.transfers.find(t=>t.txHash===INDEXED_CALIBRATION_V1.controlHash)??null;
          if(!control){stage='CONTROL_NOT_RETURNED';break;}
          if(control.to!==INDEXED_CALIBRATION_V1.controlRecipient||control.valueWei!==BigInt(INDEXED_CALIBRATION_V1.controlValue))fail('CALIBRATION_CONTROL_MISMATCH');
          stage='CONTROL_BLOCK';break;
        }
        case 'CONTROL_BLOCK':historical=canonicalCandidate(v,control!);
          if(historical.hash!==INDEXED_CALIBRATION_V1.controlBlockHash)fail('CALIBRATION_CONTROL_REORG');stage='CONTROL_RECEIPT';break;
        case 'CONTROL_RECEIPT':successfulReceipt(v,control!,historical);stage='CONTROL_RECHECK';break;
        case 'CONTROL_RECHECK':if(block(v,77795399n).hash!==historical.hash)fail('CALIBRATION_CONTROL_REORG');controlVerified=true;stage='HEAD';break;
        case 'HEAD':head=block(v);to=qty(head.number);from=to>=199999n?to-199999n:0n;
          if(Math.abs(Number(qty(head.timestamp))*1000-row.completedAtMs!)>30000)fail('CALIBRATION_STALE_HEAD');stage='START';break;
        case 'START':start=block(v,from);stage='END';break;
        case 'END':end=block(v,to);if(end.hash!==head.hash||qty(start.timestamp)>qty(end.timestamp))fail('CALIBRATION_RANGE_MISMATCH');stage='RECENT_INDEX';break;
        case 'RECENT_INDEX':{
          const p=page(v,from,to);returned=p.transfers.length;selfReturned=p.transfers.filter(t=>t.to===PROSPECTIVE_FUNDER).length;
          recent=p.transfers.find(t=>t.to!==PROSPECTIVE_FUNDER)??null;pageEnded=!p.pageKey;stage='END_RECHECK';break;
        }
        case 'END_RECHECK':if(block(v,to).hash!==end.hash)fail('CALIBRATION_RANGE_REORG');stage=recent?'RECENT_BLOCK':'NO_RECENT_NON_SELF_RETURNED';break;
        case 'RECENT_BLOCK':historical=canonicalCandidate(v,recent!);
          if(qty(historical.timestamp)<qty(start.timestamp)||qty(historical.timestamp)>qty(end.timestamp)||
            (recent!.blockNumber===to&&historical.hash!==end.hash)||(recent!.blockNumber===from&&historical.hash!==start.hash))fail('CALIBRATION_CANDIDATE_RANGE_MISMATCH');
          stage='RECENT_RECEIPT';break;
        case 'RECENT_RECEIPT':successfulReceipt(v,recent!,historical);recentVerified=true;stage='RECENT_ACTIVITY_VERIFIED';break;
      }
    }
    next=request();if(next)next.id=calls.length+1;
  }catch(caught){error=caught instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(caught.message)?caught.message:'CALIBRATION_INVALID_RECEIPTS';next=null;}
  const outcome=error?'HALTED':stage==='CONTROL_NOT_RETURNED'?'CONTROL_NOT_RETURNED':recentVerified?'RECENT_ACTIVITY_VERIFIED':
    stage==='NO_RECENT_NON_SELF_RETURNED'?'NO_RECENT_NON_SELF_RETURNED':calls.length?'INCOMPLETE':'NOT_STARTED';
  return {schemaVersion:'binrat.indexed-calibration-audit/1',outcome,stage,error,attempts:calls.length,
    complete:calls.filter(c=>c.status==='COMPLETE').length,failed:calls.filter(c=>c.status==='FAILED').length,pending:calls.filter(c=>c.status==='PENDING').length,
    controlVerified,recentVerified,returnedCandidates:returned,selfReturned,pageEnded,
    recentWindow:head?{fromBlock:from.toString(),toBlock:to.toString(),startTimestamp:start?qty(start.timestamp).toString():null,endTimestamp:end?qty(end.timestamp).toString():null}:null,
    verifiedRecent:recentVerified?candidateJson(recent!):null,coverage:INDEXED_CALIBRATION_V1.coverage,
    nextRequest:next,modelCalls:0,deliveryCalls:0,capitalCalls:0,providerReportedCost:null};
}
