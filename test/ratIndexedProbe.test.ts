import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createIndexedProbeTransport,captureOneIndexedRange} from '../src/workforce/prospectiveTransport.js';
import {ProspectiveJournal,type PublicReadTransport} from '../src/workforce/prospectiveJournal.js';
import {PROSPECTIVE_RPC,PROSPECTIVE_FUNDER,sealCapture,type RpcRequest} from '../src/workforce/prospective.js';

const key='synthetic_key_never_live',url=`https://robinhood-mainnet.g.alchemy.com/v2/${key}`;
const indexed:RpcRequest={jsonrpc:'2.0',id:1,method:'alchemy_getAssetTransfers',params:[]};
const origin=1800000000000,hash=(n:number)=>'0x'+n.toString(16).padStart(64,'0'),q=(n:number)=>'0x'+n.toString(16);
function temp(t:{after:(f:()=>void)=>void}){const dir=mkdtempSync(join(tmpdir(),'binrat-probe-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir;}
async function manifest(){return sealCapture({schemaVersion:'binrat.prospective-capture/3' as const,
 discovery:{strategy:'INDEXED_FUNDER_OUTGOING' as const,source:'ALCHEMY_ROBINHOOD_ARCHIVE' as const,maxRangeBlocks:4096 as const,maxPages:3 as const,pageSize:5 as const},
 provenance:'PUBLIC_RPC_SHADOW' as const,captureId:'synthetic-probe-control',funder:PROSPECTIVE_FUNDER,endpoint:PROSPECTIVE_RPC,
 createdAtMs:origin,expiresAtMs:origin+86400000,maxRpcCalls:48 as const,historyBlocks:8 as const,maxWindowBlocks:200000 as const,
 authority:{publicRpcRead:true as const,model:false as const,delivery:false as const,capital:false as const}});}

test('probe transport accepts the existing archive setting, routes two sources and sends one attempt without redirects',async()=>{
 for(const value of [key,url]){
  const seen:{url:string;options:RequestInit}[]=[];
  const read=createIndexedProbeTransport(value,async(u,options)=>{seen.push({url:String(u),options:options!});return new Response('{"result":[]}');});
  await read(indexed);await read({...indexed,method:'eth_chainId'});
  assert.deepEqual(seen.map(x=>x.url),[url,PROSPECTIVE_RPC]);assert.equal(seen[0].options.redirect,'error');
  assert.equal(seen[0].options.method,'POST');assert.equal(seen[0].options.body,JSON.stringify(indexed));
  assert.equal(seen[0].options.signal!.aborted,false);
  assert.throws(()=>read({...indexed,method:'eth_sendRawTransaction'}));assert.equal(seen.length,2);
 }
 for(const value of [undefined,'','http://robinhood-mainnet.g.alchemy.com/v2/'+key,url+'?key=x',url+'#x',url+'/',
  url.replace('robinhood-mainnet','other-mainnet'),url.replace('https://','https://user@'),url.replace('.com/','.com:443/'),'https://example.com/'+key])
  assert.throws(()=>createIndexedProbeTransport(value),/ARCHIVE_RPC_SECRET_(INVALID|REQUIRED)/);
});

test('probe HTTP errors, network errors, redirects and oversized responses never trigger a retry or leak a URL',async()=>{
 for(const mode of ['http','network','redirect','oversize']){
  let attempts=0;
  const read=createIndexedProbeTransport(key,async(_url,options)=>{
   attempts++;assert.equal(options!.redirect,'error');
   if(mode==='network'||mode==='redirect')throw new Error('sensitive transport detail '+url);
   return mode==='http'?new Response('preserved provider rejection',{status:403}):new Response('x'.repeat(1_000_001));
  });
  const result=await read(indexed);assert.equal(attempts,1);assert.ok(result.error);assert.ok(!JSON.stringify(result).includes(key));
  if(mode==='http')assert.equal(result.rawResponse,'preserved provider rejection');
  if(mode==='oversize')assert.equal(result.error,'PROSPECTIVE_RPC_RESPONSE_TOO_LARGE');
 }
});

test('probe discards raw, JSON-escaped and percent-encoded credential reflections before journaling',async()=>{
 for(const body of [JSON.stringify({error:url}),JSON.stringify({error:key}).replace('synthetic','\\u0073ynthetic'),
  JSON.stringify({error:key.split('').map(c=>'%'+c.charCodeAt(0).toString(16)).join('')}),
  '{"error":"'+key.split('').map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('')]){
  let calls=0;const read=createIndexedProbeTransport(key,async()=>{calls++;return new Response(body,{status:401});});
  assert.deepEqual(await read(indexed),{rawResponse:'',error:'ARCHIVE_RPC_SECRET_REFLECTION'});assert.equal(calls,1);
 }
});

test('interrupted streaming retains its received prefix, and a timeout aborts exactly one HTTP invocation',async t=>{
 const body=new ReadableStream<Uint8Array>({start(c){c.enqueue(new TextEncoder().encode('received partial receipt'));},pull(c){c.error(new Error('private '+url));}});
 let calls=0;const read=createIndexedProbeTransport(key,async()=>{calls++;return new Response(body);});
 assert.deepEqual(await read(indexed),{rawResponse:'received partial receipt',error:'PROSPECTIVE_RPC_TRANSPORT_FAILED'});assert.equal(calls,1);
 t.mock.timers.enable({apis:['setTimeout']});
 const timeout=createIndexedProbeTransport(key,async(_url,options)=>{calls++;return new Promise((_resolve,reject)=>options!.signal!.addEventListener('abort',()=>reject(new Error('secret '+url))));});
 const pending=timeout(indexed);t.mock.timers.tick(15000);
 assert.deepEqual(await pending,{rawResponse:'',error:'PROSPECTIVE_RPC_TIMEOUT'});assert.equal(calls,2);
});

test('one-shot probe waits for future blocks, stops at the first confirmed empty indexed range, and refuses continuation',async t=>{
 const store=new ProspectiveJournal(join(temp(t),'capture.sqlite'),true);t.after(()=>store.close());await store.register(await manifest());
 let now=origin,heads=0;const waits:number[]=[],requests:RpcRequest[]=[];
 const factoryCode=JSON.parse(readFileSync('test/fixtures/workforce/recorded/pons-funding-a-rpc-v1.json','utf8')).responses[1].response.result;
 const read:PublicReadTransport=async r=>{
  requests.push(r);let result:any;now+=100;
  if(r.method==='eth_chainId')result='0x1237';else if(r.method==='eth_getCode')result=factoryCode;
  else if(r.method==='alchemy_getAssetTransfers')result={transfers:[]};
  else{const n=r.params[0]==='latest'?(++heads===1?100:120):Number(BigInt(r.params[0] as string));
   result={number:q(n),hash:hash(n),parentHash:hash(n-1),timestamp:q(origin/1000+(n===100?0:60)),transactions:[]};}
  return {rawResponse:JSON.stringify({jsonrpc:'2.0',id:r.id,result}),error:null};
 };
 const state=await captureOneIndexedRange(store,read,async ms=>{waits.push(ms);now+=ms;},()=>now);
 assert.equal(state.phase,'SEARCHING');assert.equal(state.rpcCalls,8);assert.deepEqual(waits,[60000]);
 assert.equal(state.indexedDiscovery!.ranges.length,1);assert.equal(state.indexedDiscovery!.throughBlock,'120');assert.equal(state.handoff,null);
 assert.equal(requests.filter(r=>r.method==='alchemy_getAssetTransfers').length,1);
 const before=store.export();await assert.rejects(captureOneIndexedRange(store,async()=>assert.fail('no repeat'),async()=>{},()=>now),/FRESH_JOURNAL_REQUIRED/);
 assert.deepEqual(store.export(),before);
});

test('one-shot time bound preserves its counted failed reservation without making another network call',async t=>{
 const store=new ProspectiveJournal(join(temp(t),'capture.sqlite'),true);t.after(()=>store.close());await store.register(await manifest());
 let now=origin,network=0;
 const code=JSON.parse(readFileSync('test/fixtures/workforce/recorded/pons-funding-a-rpc-v1.json','utf8')).responses[1].response.result;
 const state=await captureOneIndexedRange(store,async r=>{
  network++;const result=r.method==='eth_chainId'?'0x1237':r.method==='eth_getCode'?code:
   {number:'0x64',hash:hash(100),parentHash:hash(99),timestamp:q(origin/1000),transactions:[]};
  return {rawResponse:JSON.stringify({jsonrpc:'2.0',id:r.id,result}),error:null};
 },async()=>{now+=480001;},()=>now);
 assert.equal(state.phase,'HALTED');assert.equal(state.rpcCalls,4);assert.equal(network,3);
 const calls=store.export().calls as {json:string}[];assert.equal(JSON.parse(calls.at(-1)!.json).error,'INDEXED_PROBE_TIME_LIMIT');
});

test('runner exports a zero-attempt audit for missing configuration and never replaces existing receipts',t=>{
 const out=join(temp(t),'output'),env={...process.env};delete env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL;
 const args=['scripts/probe-indexed-funder.mjs','--out',out,'--capture-id','synthetic-no-key','--source-sha','a'.repeat(40)];
 const first=spawnSync(process.execPath,args,{env,encoding:'utf8'});assert.equal(first.status,1);
 const audit=readFileSync(join(out,'audit.json'),'utf8');assert.equal(JSON.parse(audit).rpcCalls,0);
 assert.equal(JSON.parse(readFileSync(join(out,'summary.json'),'utf8')).error,'ARCHIVE_RPC_SECRET_REQUIRED');
 assert.equal(existsSync(join(out,'capture.sqlite')),true);assert.equal(existsSync(join(out,'SHA256SUMS')),true);
 assert.equal(spawnSync(process.execPath,args,{env,encoding:'utf8'}).status,1);assert.equal(readFileSync(join(out,'audit.json'),'utf8'),audit);
});
