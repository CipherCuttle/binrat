/** Pinned Robinhood/Alchemy single-physical-attempt HTTP transport.
 * Never auto-connects; no retry, redirect, fallback, batch or websocket.
 * Call ONLY inside a separately ledger-reserved qualification invocation.
 * RPC URL may contain a secret: it is never copied into an error or log.
 */
import type { ReadOnlyQualificationWire } from './tripwireSourceQualification.js';

const HOST='robinhood-mainnet.g.alchemy.com';
const METHODS=new Set([
 'eth_chainId','eth_getCode','eth_getBlockByNumber','eth_getLogs','eth_getBlockReceipts'
]);
const MAX_BYTES=4*1024*1024;
export interface AlchemyQualificationWireOptions {
  httpsUrl:string;
  approved:boolean;
  /** Hard total lifetime of this physical-request adapter. */
  stopsAtMs:number;
  now?:()=>number;
  fetchImpl?:typeof fetch;
}
export function oneShotAlchemyQualificationWire(options:AlchemyQualificationWireOptions):ReadOnlyQualificationWire{
  let endpoint:URL;
  try{endpoint=new URL(options.httpsUrl)}catch{throw Error('TRIPWIRE_PROVIDER_CONFIG_INVALID')}
  if(options.approved!==true || endpoint.protocol!=='https:' || endpoint.hostname!==HOST ||
    endpoint.username || endpoint.password || endpoint.port || endpoint.search || endpoint.hash ||
    !/^\/v2\/[A-Za-z0-9_-]+$/.test(endpoint.pathname) ||
    !Number.isSafeInteger(options.stopsAtMs))
    throw Error('TRIPWIRE_PROVIDER_CONFIG_INVALID');
  const now=options.now??Date.now,callFetch=options.fetchImpl??fetch;
  let id=0;
  return {
    mode:'EXPLICIT_READONLY_PROVIDER',
    async request(method,params,signal){
      if(!METHODS.has(method) || !Array.isArray(params) || signal.aborted ||
        now()>=options.stopsAtMs || id>=8)
        throw Error('TRIPWIRE_PROVIDER_CALL_DENIED');
      const requestId=++id;
      let response:Response;
      try{
        // Exactly one fetch invocation. Never surface provider body, endpoint
        // or fetch error messages, which may contain secrets.
        response=await callFetch(options.httpsUrl,{
          method:'POST',redirect:'error',signal,
          headers:{'content-type':'application/json'},
          body:JSON.stringify({jsonrpc:'2.0',id:requestId,method,params})
        });
      }catch{throw Error('TRIPWIRE_PROVIDER_NETWORK_UNAVAILABLE')}
      if(signal.aborted || now()>=options.stopsAtMs || response.status!==200 || !response.body)
        throw Error('TRIPWIRE_PROVIDER_RESPONSE_UNAVAILABLE');
      let bytes=0;
      const chunks:Uint8Array[]=[];
      const reader=response.body.getReader();
      try{
        while(true){
          const result=await reader.read();
          if(result.done)break;
          bytes+=result.value.length;
          if(bytes>MAX_BYTES)throw Error('TRIPWIRE_PROVIDER_RESPONSE_TOO_LARGE');
          chunks.push(result.value);
          if(signal.aborted || now()>=options.stopsAtMs)
            throw Error('TRIPWIRE_PROVIDER_CALL_EXPIRED');
        }
      }finally{await reader.cancel().catch(()=>{});}
      let envelope:unknown;
      try{envelope=JSON.parse(Buffer.concat(chunks).toString('utf8'))}
      catch{throw Error('TRIPWIRE_PROVIDER_MALFORMED_JSON')}
      if(!envelope || typeof envelope!=='object' || Array.isArray(envelope) ||
        (envelope as Record<string,unknown>).jsonrpc!=='2.0' ||
        (envelope as Record<string,unknown>).id!==requestId ||
        Object.hasOwn(envelope,'error') ||
        !Object.hasOwn(envelope,'result'))
        throw Error('TRIPWIRE_PROVIDER_ENVELOPE_INVALID');
      return (envelope as Record<string,unknown>).result;
    }
  };
}
