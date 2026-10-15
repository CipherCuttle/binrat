/** Explicit paid-canary transport only. Construction is disabled without its separate live grant. */
import { forwardRequire } from '../public/forwardCase.js';
import type { LiveWireV2 } from './liveSourceV2.js';

export function alchemyLiveWireV2(options:{httpUrl:string;websocketUrl:string;approvedCanaryId:string;
  expectedCanaryId:string;approved:boolean;stopsAtMs:number;fetchImpl?:typeof fetch;WebSocketImpl?:typeof WebSocket}):LiveWireV2 {
  forwardRequire(options.approved&&options.approvedCanaryId===options.expectedCanaryId&&options.expectedCanaryId.length>0,
    'LIVE_ALCHEMY_NOT_AUTHORIZED');
  const http=new URL(options.httpUrl),ws=new URL(options.websocketUrl);
  forwardRequire(http.protocol==='https:'&&ws.protocol==='wss:'&&http.hostname==='robinhood-mainnet.g.alchemy.com'&&ws.hostname===http.hostname&&
    !http.port&&!ws.port&&!http.username&&!http.password&&!ws.username&&!ws.password&&!http.search&&!http.hash&&!ws.search&&!ws.hash&&
    /^\/v2\/[A-Za-z0-9_-]+$/.test(http.pathname)&&http.pathname===ws.pathname,'LIVE_ALCHEMY_CONFIG_INVALID');
  const externalFetch=options.fetchImpl??fetch,Socket=options.WebSocketImpl??globalThis.WebSocket;
  let id=0;
  return {live:true,
    async request(method,params){
      forwardRequire(['eth_chainId','eth_getCode','eth_getBlockByNumber','eth_getLogs','eth_getBlockReceipts'].includes(method)&&Date.now()<options.stopsAtMs,'LIVE_ALCHEMY_METHOD_OR_TIME_INVALID');
      const requestId=++id,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(1,Math.min(8000,options.stopsAtMs-Date.now())));
      try{
        const response=await externalFetch(options.httpUrl,{method:'POST',redirect:'error',signal:controller.signal,
          headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:requestId,method,params})});
        forwardRequire(response.status===200&&response.body,'LIVE_ALCHEMY_RESPONSE_UNAVAILABLE');
        const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
        try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;
          forwardRequire(bytes<=1048576,'LIVE_ALCHEMY_RESPONSE_LIMIT');chunks.push(part.value);}}
        finally{await reader.cancel();}
        const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        forwardRequire(value&&value.jsonrpc==='2.0'&&value.id===requestId&&!Object.hasOwn(value,'error')&&Object.hasOwn(value,'result'),'LIVE_ALCHEMY_RPC_UNAVAILABLE');
        return {result:value.result,bytes};
      }finally{clearTimeout(timer);controller.abort();}
    },
    open(handlers){
      forwardRequire(Date.now()<options.stopsAtMs&&Socket,'LIVE_ALCHEMY_TIME_INVALID');
      const socket=new Socket(options.websocketUrl);socket.binaryType='arraybuffer';
      socket.onopen=()=>handlers.open();
      socket.onmessage=event=>handlers.message(typeof event.data==='string'?event.data:new Uint8Array(event.data as ArrayBuffer));
      socket.onclose=()=>handlers.close();socket.onerror=()=>handlers.error();
      return {send:data=>socket.send(data),close:()=>socket.close()};
    }
  };
}
