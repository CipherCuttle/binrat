/** Offline-testable, one-attempt transports for the private indexed probe only. */
import {PROSPECTIVE_RPC,captureTerminal,type ProspectiveState} from './prospective.js';
import {indexedCaptureTransport,ProspectiveJournal,type PublicReadTransport} from './prospectiveJournal.js';

const MAX_BYTES=1_000_000,TIMEOUT_MS=15_000;
const PUBLIC_METHODS=['eth_chainId','eth_getCode','eth_getBlockByNumber','eth_getTransactionReceipt','eth_getLogs'];
type FetchOnce=typeof fetch;

function archiveConfig(value:unknown){
  if(typeof value!=='string'||!value.trim())throw new Error('ARCHIVE_RPC_SECRET_REQUIRED');
  const input=value.trim(),key=/^[A-Za-z0-9_-]{8,128}$/.test(input)?input:null;
  // Same exact host/path policy as the existing archive resolver. No arbitrary URL, redirects or query credentials.
  const match=/^https:\/\/robinhood-mainnet\.g\.alchemy\.com\/v2\/([A-Za-z0-9_-]{8,128})$/.exec(input);
  if(!key&&!match)throw new Error('ARCHIVE_RPC_SECRET_INVALID');
  const token=key??match![1];return {token,url:`https://robinhood-mainnet.g.alchemy.com/v2/${token}`};
}
function reflectsSecret(body:string,token:string){
  if(body.includes(token))return true;
  // Also inspect truncated JSON: a stream failure must not preserve an escaped credential.
  try{if(JSON.stringify(JSON.parse(body)).includes(token))return true;}catch{}
  return body.replace(/\\u([a-fA-F0-9]{4})/g,(_,code)=>String.fromCharCode(parseInt(code,16)))
    .replace(/\\/g,'').replace(/%([a-fA-F0-9]{2})/g,(_,pair)=>String.fromCharCode(parseInt(pair,16))).includes(token);
}
function readOnce(url:string,methods:string[],fetchOnce:FetchOnce,secret?:string):PublicReadTransport {
  return async request=>{
    if(!methods.includes(request.method))return {rawResponse:'',error:'PROSPECTIVE_METHOD_NOT_ALLOWED'};
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    let body='',error:string|null=null,reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
    const chunks:Uint8Array[]=[];let bytes=0;
    try{
      const response=await fetchOnce(url,{method:'POST',redirect:'error',signal:controller.signal,
        headers:{'content-type':'application/json'},body:JSON.stringify(request)});
      reader=response.body?.getReader();
      if(reader)while(true){
        const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;
        if(bytes>MAX_BYTES){controller.abort();error='PROSPECTIVE_RPC_RESPONSE_TOO_LARGE';break;}
        chunks.push(chunk.value);
      }
      if(!error&&!response.ok)error='PROSPECTIVE_RPC_HTTP_FAILED';
    }catch{error=controller.signal.aborted?'PROSPECTIVE_RPC_TIMEOUT':'PROSPECTIVE_RPC_TRANSPORT_FAILED';}
    finally{clearTimeout(timer);body=Buffer.concat(chunks).toString('utf8');try{await reader?.cancel();}catch{}}
    // Never retain credentials even when the provider reflects them in an error response.
    if(secret&&reflectsSecret(body,secret))return {rawResponse:'',error:'ARCHIVE_RPC_SECRET_REFLECTION'};
    return {rawResponse:body,error};
  };
}
export function createIndexedProbeTransport(secret:unknown,fetchOnce:FetchOnce=fetch):PublicReadTransport {
  const config=archiveConfig(secret);
  return indexedCaptureTransport(readOnce(PROSPECTIVE_RPC,PUBLIC_METHODS,fetchOnce,config.token),
    readOnce(config.url,['alchemy_getAssetTransfers'],fetchOnce,config.token));
}

/** One fresh range, not an ongoing subscription. The original journal remains the only allowance. */
export async function captureOneIndexedRange(store:ProspectiveJournal,transport:PublicReadTransport,
  pause:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now:()=>number=()=>Date.now()):Promise<ProspectiveState>{
  const manifest=JSON.parse((store.export().manifest as {json:string}).json);
  if(manifest.schemaVersion!=='binrat.prospective-capture/3')throw new Error('INDEXED_PROBE_V3_REQUIRED');
  // A one-shot entrypoint cannot silently continue an earlier attempt or mint a new allowance for it.
  if((store.export().calls as unknown[]).length!==0)throw new Error('INDEXED_PROBE_FRESH_JOURNAL_REQUIRED');
  const deadline=now()+8*60_000;
  const bounded:PublicReadTransport=async request=>{
    // Let future blocks accumulate after the initial head. Reservation precedes this observation wait.
    if(request.id===4)await pause(60_000);
    if(now()>=deadline)return {rawResponse:'',error:'INDEXED_PROBE_TIME_LIMIT'};
    return transport(request);
  };
  for(let steps=0;steps<48;steps++){
    const state=await store.step(bounded,now);
    if(captureTerminal(state)||state.handoff||state.indexedDiscovery!.ranges.length>0)return state;
    if(state.stage==='INDEX_HEAD')await pause(30_000);
  }
  throw new Error('INDEXED_PROBE_STEP_LIMIT');
}
