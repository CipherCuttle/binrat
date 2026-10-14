/** One historical code read. No cohort capture, chain probe, retry or continuation. */
import {PONS_V2_FACTORY,PONS_V2_FACTORY_CODE_HASH,ROBINHOOD_CHAIN_ID} from '../pons/chain.js';
import {FUNDER_COHORT_V1,verifyFunderCohortFactoryCode} from './funderCohort.js';
import {createFunderCohortTransport} from './prospectiveTransport.js';
import {parseStrictJson} from './competence.js';
import type {RpcRequest} from './prospective.js';

export const ARCHIVE_PARITY_BRANCH='verify/binrat-github-archive-parity-20261014';
export const ARCHIVE_PARITY_MARKER='[binrat-github-archive-parity-20261014-one-code-read]';
export const ARCHIVE_PARITY_REFERENCE='2e7ec076e502ec746bbdb3ff2fd5609cda41a33b';
export const ARCHIVE_PARITY_REQUEST:RpcRequest=Object.freeze({jsonrpc:'2.0',id:1,method:'eth_getCode',
  params:Object.freeze(['0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e','0x4df8192']) as unknown as unknown[]});
export interface ArchiveParityAuthority {
  actions:boolean;repository:string;eventName:string;created:boolean;before:string;
  ref:string;runAttempt:string;message:string;sourceSha:string;eventSha:string;offlineVerifiedSha:string;
}
export interface ArchiveParityReceipt {
  schemaVersion:'binrat.github-archive-parity/1';
  verdict:'GITHUB_ARCHIVE_PARITY_PASS'|'GITHUB_ARCHIVE_PARITY_FAIL'|'GITHUB_ARCHIVE_PARITY_BLOCKED';
  status:'PASS'|'BLOCKED';reason:string;network:4663;contract:string;block:81756562;blockHex:string;
  expectedCodeHash:string;returnedCodeHash:string|null;requests:number;maxRequests:1;noRetries:true;
  referenceCommit:string;sourceSha:string|null;
}
const transportErrors=new Set(['PROSPECTIVE_RPC_RESPONSE_TOO_LARGE','PROSPECTIVE_RPC_HTTP_FAILED',
  'PROSPECTIVE_RPC_TIMEOUT','PROSPECTIVE_RPC_TRANSPORT_FAILED','ARCHIVE_RPC_SECRET_REFLECTION']);
export function archiveParityReceipt(sourceSha:string|null=null):ArchiveParityReceipt {
  return {schemaVersion:'binrat.github-archive-parity/1',verdict:'GITHUB_ARCHIVE_PARITY_BLOCKED',status:'BLOCKED',
    reason:'NOT_SENT',network:4663,contract:ARCHIVE_PARITY_REQUEST.params[0] as string,block:81756562,
    blockHex:'0x4df8192',expectedCodeHash:'0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84',
    returnedCodeHash:null,requests:0,maxRequests:1,noRetries:true,referenceCommit:ARCHIVE_PARITY_REFERENCE,
    sourceSha:sourceSha&&/^[a-f0-9]{40}$/.test(sourceSha)?sourceSha:null};
}
function authorized(a:ArchiveParityAuthority){
  return a.actions&&a.repository==='CipherCuttle/binrat'&&a.eventName==='push'&&a.created&&
    a.before==='0'.repeat(40)&&a.ref===`refs/heads/${ARCHIVE_PARITY_BRANCH}`&&a.runAttempt==='1'&&
    a.message===ARCHIVE_PARITY_MARKER&&/^[a-f0-9]{40}$/.test(a.sourceSha)&&
    a.eventSha===a.sourceSha&&a.offlineVerifiedSha===a.sourceSha;
}

/** The closure consumes its allowance even when a gate fails. Reserve durably before calling it. */
export function createGithubArchiveParityVerification(secret:unknown,authority:ArchiveParityAuthority,fetchOnce:typeof fetch=fetch){
  let consumed=false;
  const receipt=archiveParityReceipt(authority.sourceSha);
  return async(reserve:(pending:ArchiveParityReceipt)=>void):Promise<ArchiveParityReceipt>=>{
    if(consumed)return {...receipt,verdict:'GITHUB_ARCHIVE_PARITY_BLOCKED',status:'BLOCKED',reason:'SINGLE_USE_CONSUMED'};
    consumed=true;
    if(!authorized(authority))return {...receipt,reason:'AUTHORITY_UNAVAILABLE'};
    if(ROBINHOOD_CHAIN_ID!==4663||PONS_V2_FACTORY!==receipt.contract||FUNDER_COHORT_V1.outcomeThroughBlock!==receipt.block||
      `0x${receipt.block.toString(16)}`!==receipt.blockHex||PONS_V2_FACTORY_CODE_HASH!==receipt.expectedCodeHash)
      return {...receipt,reason:'FROZEN_SCOPE_DRIFT'};
    let read:ReturnType<typeof createFunderCohortTransport>;
    try{read=createFunderCohortTransport(secret,async(url,init)=>{
      if(receipt.requests!==0)throw new Error('SINGLE_USE_CONSUMED');
      reserve({...receipt,requests:1,reason:'RESERVED_NO_RETRY'});
      receipt.requests=1;
      return fetchOnce(url,init);
    });}catch{return {...receipt,reason:'ARCHIVE_SECRET_UNAVAILABLE_OR_INVALID'};}
    try{
      const result=await read(structuredClone(ARCHIVE_PARITY_REQUEST));
      if(result.error)return {...receipt,reason:transportErrors.has(result.error)?result.error:'ARCHIVE_TRANSPORT_BLOCKED'};
      const response=parseStrictJson(result.rawResponse) as Record<string,unknown>;
      if(!response||Array.isArray(response)||response.jsonrpc!=='2.0'||response.id!==1||
        Object.hasOwn(response,'error')||typeof response.result!=='string'||!/^0x(?:[a-fA-F0-9]{2})*$/.test(response.result))
        return {...receipt,reason:'ARCHIVE_RESPONSE_INVALID'};
      const checked=verifyFunderCohortFactoryCode(response.result);
      receipt.returnedCodeHash=checked.codeHash;
      return {...receipt,verdict:checked.matches?'GITHUB_ARCHIVE_PARITY_PASS':'GITHUB_ARCHIVE_PARITY_FAIL',
        status:checked.matches?'PASS':'BLOCKED',reason:checked.matches?'FACTORY_CODE_HASH_MATCH':'FACTORY_CODE_HASH_MISMATCH'};
    }catch{return {...receipt,reason:'ARCHIVE_VERIFICATION_BLOCKED'};}
  };
}
