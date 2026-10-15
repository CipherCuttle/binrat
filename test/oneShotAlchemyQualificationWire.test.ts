import assert from 'node:assert/strict';
import {test} from 'node:test';
import {oneShotAlchemyQualificationWire} from '../src/portable/oneShotAlchemyQualificationWire.js';

const URL='https://robinhood-mainnet.g.alchemy.com/v2/TEST_ONLY_FAKE_KEY';
test('approved exact Robinhood host and path are required, no network on construction',()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;throw Error('NO_PROVIDER_ALLOWED')};
 for(const httpsUrl of [
  'http://robinhood-mainnet.g.alchemy.com/v2/dummy',
  'https://robinhood-mainnet.g.alchemy.com.evil.test/v2/dummy',
  'https://robinhood-mainnet.g.alchemy.com/v2/dummy?query=yes',
  'https://user:pass@robinhood-mainnet.g.alchemy.com/v2/dummy',
 ])assert.throws(()=>oneShotAlchemyQualificationWire({httpsUrl,approved:true,
   stopsAtMs:5000,fetchImpl:fetchImpl as any}),/PROVIDER_CONFIG_INVALID/);
 assert.throws(()=>oneShotAlchemyQualificationWire({httpsUrl:URL,approved:false,stopsAtMs:5000,
   fetchImpl:fetchImpl as any}),/PROVIDER_CONFIG_INVALID/);
 assert.equal(calls,0);
});
test('one authorized read equals exactly one fetch without a hidden retry',async()=>{
 let fetches=0;
 const wire=oneShotAlchemyQualificationWire({httpsUrl:URL,approved:true,stopsAtMs:5000,now:()=>2000,
  fetchImpl:async (_url,init)=>{
    fetches++;
    assert.equal(init?.redirect,'error');
    assert.equal(init?.method,'POST');
    assert.equal((JSON.parse(String(init?.body))).method,'eth_chainId');
    return new Response(JSON.stringify({jsonrpc:'2.0',id:1,result:'0x1237'}),{status:200});
  }});
 assert.equal(wire.mode,'EXPLICIT_READONLY_PROVIDER');
 assert.equal(await wire.request('eth_chainId',[],new AbortController().signal),'0x1237');
 assert.equal(fetches,1);
});
test('malformed RPC response, explicit RPC error and HTTP 503 are terminal, never retried',async()=>{
 for(const [status,body] of [
  [200,JSON.stringify({jsonrpc:'2.0',id:12,result:'0x1237'})],
  [200,JSON.stringify({jsonrpc:'2.0',id:1,error:{code:-32000,message:'SECRET_NOT_REPEATED'}})],
  [503,'backend off'],
  [200,'not json']
 ] as const){
   let calls=0;
   const wire=oneShotAlchemyQualificationWire({httpsUrl:URL,approved:true,stopsAtMs:5000,now:()=>2000,
    fetchImpl:async()=>{calls++;return new Response(body,{status})}});
   await assert.rejects(wire.request('eth_chainId',[],new AbortController().signal));
   assert.equal(calls,1);
 }
});
test('no write/subscription methods or ninth request are permitted',async()=>{
 let calls=0;
 const wire=oneShotAlchemyQualificationWire({httpsUrl:URL,approved:true,stopsAtMs:5000,now:()=>2000,
  fetchImpl:async (_url,init)=>{
   calls++;
   const id=JSON.parse(String(init?.body)).id;
   return new Response(JSON.stringify({jsonrpc:'2.0',id,result:'0x1237'}),{status:200});
  }});
 for(const method of ['eth_sendTransaction','eth_subscribe','debug_traceTransaction'])
   await assert.rejects(wire.request(method,[],new AbortController().signal),/CALL_DENIED/);
 for(let i=0;i<8;i++)await wire.request('eth_chainId',[],new AbortController().signal);
 await assert.rejects(wire.request('eth_chainId',[],new AbortController().signal),/CALL_DENIED/);
 assert.equal(calls,8);
});
test('aborted request and response-size violation reject without retry',async()=>{
 let calls=0;
 const wire=oneShotAlchemyQualificationWire({httpsUrl:URL,approved:true,stopsAtMs:5000,now:()=>2000,
  fetchImpl:async()=>{calls++;return new Response('x'.repeat(4*1024*1024+1),{status:200})}});
 await assert.rejects(wire.request('eth_chainId',[],new AbortController().signal),/TOO_LARGE/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(wire.request('eth_chainId',[],controller.signal),/CALL_DENIED/);
 assert.equal(calls,1);
});
