/** Bounded outgoing candidate locator; no transport, credential lookup or retry loop. */
import {parsePonsExternalNativeCandidate,type PonsExternalNativeInboundCandidate} from './fundingProvenance.js';

export function outgoingTransferParams(funder:string,from:bigint,to:bigint,pageKey:string|null){
  if(!/^0x[0-9a-f]{40}$/.test(funder)||from<0n||to<from||to-from>=4096n)throw new Error('PONS_OUTGOING_RANGE_INVALID');
  return {fromBlock:`0x${from.toString(16)}`,toBlock:`0x${to.toString(16)}`,fromAddress:funder,
    category:['external'],excludeZeroValue:true,withMetadata:false,order:'asc',maxCount:'0x5',...(pageKey?{pageKey}:{})};
}

export function parseOutgoingTransferPage(input:unknown,funder:string,from:bigint,to:bigint){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('PONS_OUTGOING_PAGE_INVALID');
  const r=input as {transfers?:unknown;pageKey?:unknown};
  if(!Array.isArray(r.transfers)||r.transfers.length>5)throw new Error('PONS_OUTGOING_PAGE_INVALID');
  // Alchemy documents an empty pageKey as an end marker; absence is also accepted.
  if(r.pageKey!==undefined&&(typeof r.pageKey!=='string'||r.pageKey.length>256||/[\x00-\x20\x7f]/.test(r.pageKey)))throw new Error('PONS_OUTGOING_PAGE_KEY_INVALID');
  const transfers:PonsExternalNativeInboundCandidate[]=r.transfers.map(parsePonsExternalNativeCandidate);
  for(let i=0;i<transfers.length;i++){
    const t=transfers[i]!;
    if(t.from!==funder||t.blockNumber<from||t.blockNumber>to)throw new Error('PONS_OUTGOING_TRANSFER_BINDING_INVALID');
    if(i&&t.blockNumber<transfers[i-1]!.blockNumber)throw new Error('PONS_OUTGOING_ORDER_INVALID');
  }
  return {transfers,pageKey:r.pageKey?String(r.pageKey):null};
}
