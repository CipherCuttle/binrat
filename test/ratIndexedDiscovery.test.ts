import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {encodeAbiParameters,toEventSelector} from 'viem';
import {canonicalJson} from '../src/evidence/canonical.js';
import {PONS_V2_FACTORY} from '../src/pons/chain.js';
import {ponsTokenLaunchedEvent} from '../src/pons/ponsAbi.js';
import {outgoingTransferParams,parseOutgoingTransferPage} from '../src/pons/fundingOutgoing.js';
import {ProspectiveJournal,indexedCaptureTransport,type PublicReadTransport} from '../src/workforce/prospectiveJournal.js';
import {auditProspective,sealCapture,PROSPECTIVE_FUNDER,PROSPECTIVE_RPC,type IndexedManifest,type CaptureCall,type RpcRequest} from '../src/workforce/prospective.js';
// SYNTHETIC_TRANSPORT_CONTROL: no live provider, real throughput or competence claim.
const origin=1800000000000,recipient='0x'+'a'.repeat(40),token='0x'+'b'.repeat(40),curve='0x'+'c'.repeat(40);
const hash=(n:number)=>'0x'+n.toString(16).padStart(64,'0'),q=(n:number)=>'0x'+n.toString(16);
const factoryCode=JSON.parse(readFileSync('test/fixtures/workforce/recorded/pons-funding-a-rpc-v1.json','utf8')).responses[1].response.result;
const tx={hash:hash(1000),from:PROSPECTIVE_FUNDER,to:recipient,value:'0x1',blockNumber:q(102),blockHash:hash(102),transactionIndex:'0x0',chainId:'0x1237'};
const candidate={hash:tx.hash,from:tx.from,to:tx.to,blockNum:tx.blockNumber,category:'external',rawContract:{value:tx.value,address:null}};
const log={address:PONS_V2_FACTORY,blockHash:hash(120),blockNumber:q(120),transactionHash:hash(2000),transactionIndex:'0x0',logIndex:'0x0',removed:false,
 topics:[toEventSelector(ponsTokenLaunchedEvent),'0x'+token.slice(2).padStart(64,'0'),'0x'+curve.slice(2).padStart(64,'0'),'0x'+recipient.slice(2).padStart(64,'0')],
 data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],['0x'+'0'.repeat(40) as `0x${string}`,0n,1n])};
const block=(n:number,full=false)=>({number:q(n),hash:hash(n),parentHash:hash(n-1),timestamp:q(origin/1000+n-100),transactions:n===102?(full?[structuredClone(tx)]:[tx.hash]):n===120?[log.transactionHash]:[]});
async function manifest(){return sealCapture({schemaVersion:'binrat.prospective-capture/3' as const,provenance:'PUBLIC_RPC_SHADOW' as const,captureId:'synthetic-indexed-control',
 discovery:{strategy:'INDEXED_FUNDER_OUTGOING' as const,source:'ALCHEMY_ROBINHOOD_ARCHIVE' as const,maxRangeBlocks:4096 as const,maxPages:3 as const,pageSize:5 as const},
 funder:PROSPECTIVE_FUNDER,endpoint:PROSPECTIVE_RPC,createdAtMs:origin,expiresAtMs:origin+86400000,maxRpcCalls:48 as const,historyBlocks:8 as const,maxWindowBlocks:200000 as const,
 authority:{publicRpcRead:true as const,model:false as const,delivery:false as const,capital:false as const}});}
function workspace(t:{after:(fn:()=>void)=>void}){const d=mkdtempSync(join(tmpdir(),'binrat-indexed-'));t.after(()=>rmSync(d,{recursive:true,force:true}));return join(d,'capture.sqlite');}
type Options={pages?:unknown[];empty?:boolean;waiting?:boolean;fork?:boolean;cursorFork?:boolean;wrongTx?:boolean;failIndex?:boolean;deadline?:boolean;headAhead?:boolean;anchorDrift?:boolean;repeatedAnchor?:boolean;earlyFunding?:boolean;immediateParentFork?:boolean;advance?:boolean};
function fake(o:Options={}){
 let now=origin,heads=0,funded=false,post=0,endReads=0,pages=0,logs=0;const requests:RpcRequest[]=[],routes:string[]=[];
 const publicReads:PublicReadTransport=async r=>{
  assert.notEqual(r.method,'alchemy_getAssetTransfers');routes.push('PUBLIC');requests.push(structuredClone(r));now+=100;let result:any;
  if(r.method==='eth_chainId')result='0x1237';else if(r.method==='eth_getCode')result=factoryCode;
  else if(r.method==='eth_getBlockByNumber'){
   const [wanted,full]=r.params;
   if(wanted==='latest'){heads++;result=block(heads===1||o.waiting||(o.advance&&heads===2)?100:funded?(++post===1?109:post===2?110:125):o.headAhead?5100:o.advance?108+(heads-3)*8:108);if(o.headAhead)result.timestamp=q(origin/1000+8);}
   else{const n=Number(BigInt(wanted as string));result=block(n,Boolean(full));if(n===108&&!full&&++endReads===2&&o.fork)result.hash=hash(999);if(n===100&&o.cursorFork)result.hash=hash(999);
    if(o.wrongTx&&n===102&&full)result.transactions[0].value='0x2';
    if(n===108&&endReads===1&&o.anchorDrift)result.hash=hash(999);
    if(n===108&&o.repeatedAnchor)result.hash=hash(100);
    if(n===102&&full&&o.earlyFunding)result.timestamp=q(origin/1000-1);
    if(n===101&&full&&o.immediateParentFork)result.parentHash=hash(999);}
  }else if(r.method==='eth_getTransactionReceipt'){
   if(r.params[0]===tx.hash){funded=true;result={transactionHash:tx.hash,blockHash:hash(102),blockNumber:q(102),status:'0x1',from:tx.from,to:tx.to,logs:[]};}
   else result={transactionHash:log.transactionHash,blockHash:hash(120),blockNumber:q(120),status:'0x1',logs:[structuredClone(log)]};
  }else if(r.method==='eth_getLogs')result=++logs===1?[]:[structuredClone(log)];else assert.fail('unexpected public method');
  if(o.advance&&result?.number)result.timestamp=q(origin/1000+Math.floor((Number(BigInt(result.number))-100)/8));
  return {rawResponse:JSON.stringify({jsonrpc:'2.0',id:r.id,result}),error:null};
 };
 const indexedReads:PublicReadTransport=async r=>{
  assert.equal(r.method,'alchemy_getAssetTransfers');routes.push('INDEXED');requests.push(structuredClone(r));now+=100;
  if(o.deadline)now=origin+86400001;
  if(o.failIndex)return {rawResponse:'preserved uncertain body',error:'PUBLIC_RPC_TRANSPORT_FAILED'};
  const result=o.pages?.[pages++]??{transfers:o.empty?[]:[structuredClone(candidate)],pageKey:''};
  return {rawResponse:JSON.stringify({jsonrpc:'2.0',id:r.id,result}),error:null};
 };
 return {transport:indexedCaptureTransport(publicReads,indexedReads),requests,routes,now:()=>now};
}
function raw(store:ProspectiveJournal){const d=store.export();return {manifest:JSON.parse((d.manifest as {json:string}).json) as IndexedManifest,calls:(d.calls as {json:string}[]).map(r=>JSON.parse(r.json) as CaptureCall)};}
async function register(t:Parameters<typeof workspace>[0],o:Options={}){const path=workspace(t),store=new ProspectiveJournal(path,true),f=fake(o);t.after(()=>store.close());await store.register(await manifest());return {path,store,f};}

test('indexed outgoing candidate uses a frozen ascending range, canonical verification and the existing future-only pipeline',async t=>{
 const {store,f}=await register(t);let s=await store.step(f.transport,f.now);while(!s.handoff&&s.phase!=='HALTED')s=await store.step(f.transport,f.now);
 assert.equal(s.phase,'HANDOFF_PREPARED');assert.equal(s.rpcCalls,22);assert.equal(s.handoff!.remainingRpcCalls,26);
 assert.equal(s.discoveryCoverage,'PROVIDER_INDEXED_CANDIDATES_ONLY');assert.equal(s.discovery,undefined);assert.equal(s.indexedDiscovery!.throughBlock,null);
 assert.deepEqual(f.requests.find(r=>r.method==='alchemy_getAssetTransfers')!.params,[{fromBlock:'0x65',toBlock:'0x6c',fromAddress:PROSPECTIVE_FUNDER,category:['external'],excludeZeroValue:true,withMetadata:false,order:'asc',maxCount:'0x5'}]);
 assert.equal(f.routes.filter(x=>x==='INDEXED').length,1);assert.equal(s.finding,null);
 s=await store.step(f.transport,f.now);assert.equal(s.phase,'FOUND');assert.equal(s.rpcCalls,29);assert.equal(s.notification!.deliveryAuthorized,false);
 const d=raw(store);assert.deepEqual(await auditProspective(d.manifest,d.calls),s);
});

test('empty provider enumeration advances only its indexed range and never creates a chain-wide negative',async t=>{
 const {store,f}=await register(t,{empty:true});const s=await store.step(f.transport,f.now);
 assert.equal(s.rpcCalls,8);assert.equal(s.phase,'SEARCHING');assert.equal(s.indexedDiscovery!.throughBlock,'108');assert.equal(s.indexedDiscovery!.activeRange,null);
 assert.deepEqual(s.indexedDiscovery!.ranges,[{fromBlock:'101',toBlock:'108',pageSequences:[7],anchorSequence:6,confirmationSequence:8}]);
 assert.equal(s.reason,null);assert.equal(s.funding,null);assert.equal(s.handoff,null);assert.equal(s.notification,null);
 assert.equal(s.indexedDiscovery!.scope,'PROVIDER_INDEXED_EXTERNAL_NATIVE_CANDIDATES_ONLY');
 const restored=new ProspectiveJournal(workspace(t),true);t.after(()=>restored.close());assert.deepEqual(await restored.restore(store.export()),s);
 assert.equal((await restored.inspect()).nextRequest!.method,'eth_getBlockByNumber');
});

test('self transfers are skipped; page key, budget and candidate order survive restart',async t=>{
 const self={...candidate,to:PROSPECTIVE_FUNDER,hash:hash(900),blockNum:q(101)};
 const {store,f}=await register(t,{pages:[{transfers:[self],pageKey:'next-page'},{transfers:[candidate]}]});
 // Capture a page prefix explicitly, then reopen at its exact next request.
 const d=raw(store),m=d.manifest;let calls:CaptureCall[]=[],s=await auditProspective(m,calls);
 for(let i=0;i<7;i++){
  const startedAtMs=f.now();const response=await f.transport(s.nextRequest!);
  calls.push(await sealCapture({sequence:i+1,previousDigest:calls.at(-1)?.digest??m.digest,startedAtMs,completedAtMs:f.now(),request:s.nextRequest!,status:'COMPLETE' as const,rawResponse:response.rawResponse,error:null}));s=await auditProspective(m,calls);
 }
 assert.equal(s.nextRequest!.method,'alchemy_getAssetTransfers');assert.equal((s.nextRequest!.params[0] as any).pageKey,'next-page');assert.equal(s.funding,null);
 const restored=new ProspectiveJournal(workspace(t),true);t.after(()=>restored.close());await restored.restore({mode:'UNVERIFIED_PROSPECTIVE_EXPORT',manifest:{json:canonicalJson(m)},calls:calls.map(c=>({sequence:c.sequence,json:canonicalJson(c)}))});
 s=await restored.step(f.transport,f.now);while(!s.handoff&&s.phase!=='HALTED')s=await restored.step(f.transport,f.now);
 assert.equal(s.phase,'HANDOFF_PREPARED');assert.equal(s.rpcCalls,23);assert.equal(s.indexedDiscovery!.activeRange!.pages,2);assert.equal(s.funding!.hash,tx.hash);
});

test('paging cycle, duplicate transfer, order regression and three-page truncation cannot advance a range',async t=>{
 const self=(n:number,b=101)=>({...candidate,to:PROSPECTIVE_FUNDER,hash:hash(n),blockNum:q(b)});
 for(const [pages,reason] of [
  [[{transfers:[self(1)],pageKey:'p'},{transfers:[self(2)],pageKey:'p'}],'PROSPECTIVE_INDEX_PAGE_CYCLE'],
  [[{transfers:[self(1)],pageKey:'p'},{transfers:[self(1)]}],'PROSPECTIVE_INDEX_ORDER_OR_DUPLICATE'],
  [[{transfers:[self(1,103)],pageKey:'p'},{transfers:[self(2,102)]}],'PROSPECTIVE_INDEX_ORDER_OR_DUPLICATE'],
  [[{transfers:[],pageKey:'p1'},{transfers:[],pageKey:'p2'},{transfers:[],pageKey:'p3'}],'INDEXED_PAGE_LIMIT_PARTIAL_RANGE']
 ] as [unknown[],string][]){
  const {store,f}=await register(t,{pages});const s=await store.step(f.transport,f.now);assert.equal(s.reason,reason);assert.equal(s.indexedDiscovery!.throughBlock,null);
  assert.equal(s.funding,null);assert.equal(s.handoff,null);assert.equal(s.finding,null);assert.equal(s.notification,null);
  const count=f.requests.length;await store.step(async()=>{assert.fail('terminal retry forbidden')},f.now);assert.equal(f.requests.length,count);
 }
});

test('provider source, category, native value, range, page size and metadata malformations fail closed',async t=>{
 for(const page of [null,{},{transfers:[{...candidate,from:recipient}]},{transfers:[{...candidate,blockNum:q(100)}]},
  {transfers:[{...candidate,blockNum:q(109)}]},{transfers:[{...candidate,category:'internal'}]},
  {transfers:[{...candidate,rawContract:{value:'0x1',address:recipient}}]},{transfers:[{...candidate,rawContract:{value:'0x0',address:null}}]},
  {transfers:[candidate],pageKey:null},{transfers:[candidate],pageKey:'bad key'},{transfers:Array(6).fill(candidate)}]){
  // A literal null page is supplied via a dedicated transport to avoid fake defaulting.
  const {store,f}=await register(t,{pages:[page]});const transport=page===null?indexedCaptureTransport(f.transport,async r=>({rawResponse:JSON.stringify({jsonrpc:'2.0',id:r.id,result:null}),error:null})):f.transport;
  const s=await store.step(transport,f.now);assert.equal(s.phase,'HALTED');assert.equal(s.indexedDiscovery!.throughBlock,null);assert.equal(s.funding,null);
 }
});

test('changed range/cursor anchors and canonical candidate mismatch cannot produce a handoff',async t=>{
 for(const o of [{fork:true},{cursorFork:true},{wrongTx:true}]){
  const {store,f}=await register(t,o);let s=await store.step(f.transport,f.now);while(s.phase==='COLLECTING_HISTORY')s=await store.step(f.transport,f.now);
  assert.equal(s.phase,'HALTED');assert.equal(s.indexedDiscovery!.valid,false);assert.equal(s.handoff,null);assert.equal(s.finding,null);
 }
 const {store,f}=await register(t,{empty:true,fork:true});const s=await store.step(f.transport,f.now);assert.equal(s.phase,'HALTED');assert.equal(s.indexedDiscovery!.throughBlock,null);
});

test('failed indexed request, pending reservation and deadline retain original allowance and never retry',async t=>{
 for(const o of [{failIndex:true},{deadline:true}]){
  const {store,f}=await register(t,o);const s=await store.step(f.transport,f.now);assert.equal(s.rpcCalls,7);assert.equal(s.phase,o.deadline?'EXPIRED':'HALTED');
  const restored=new ProspectiveJournal(workspace(t),true);t.after(()=>restored.close());await restored.restore(store.export());await restored.step(async()=>{assert.fail('uncertain request cannot retry')},f.now);
  if(o.failIndex)assert.match(canonicalJson(store.export()),/preserved uncertain body/);
 }
 const m=await manifest(),store=new ProspectiveJournal(workspace(t),true);t.after(()=>store.close());
 const pending=await sealCapture({sequence:1,previousDigest:m.digest,startedAtMs:origin,completedAtMs:null,request:{jsonrpc:'2.0' as const,id:1,method:'eth_chainId',params:[]},status:'PENDING' as const,rawResponse:null,error:null});
 await store.restore({mode:'UNVERIFIED_PROSPECTIVE_EXPORT',manifest:{json:canonicalJson(m)},calls:[{sequence:1,json:canonicalJson(pending)}]});
 assert.equal((await store.step(async()=>{assert.fail('reserved request cannot retry')},()=>origin)).reason,'UNCERTAIN_RESERVED_RPC_NO_RETRY');
});

test('waiting consumes all 48 requests; manifest changes and keyless CLI activation are rejected',async t=>{
 const {store,f}=await register(t,{waiting:true});let s=await store.step(f.transport,f.now);while(s.phase==='SEARCHING')s=await store.step(f.transport,f.now);
 assert.equal(s.phase,'EXHAUSTED');assert.equal(s.rpcCalls,48);assert.equal(s.handoff,null);await store.step(async()=>{assert.fail('no fresh allowance')},f.now);
 const m=await manifest();for(const change of [{maxRpcCalls:49},{discovery:{...m.discovery,maxPages:4}},{authority:{...m.authority,model:true}},{endpoint:'https://example.com'}])await assert.rejects(auditProspective(await sealCapture({...m,...change}),[]));
 const path=workspace(t);const cli=new ProspectiveJournal(path,true);await cli.register(m);const before=cli.export();cli.close();
 assert.throws(()=>execFileSync(process.execPath,['scripts/capture-prospective-rat.mjs','step','--db',path],{encoding:'utf8',stdio:['ignore','pipe','pipe']}),e=>String((e as any).stderr).includes('INDEXED_CAPTURE_REQUIRES_EXPLICIT_ARCHIVE_TRANSPORT'));
 const reopened=new ProspectiveJournal(path,false,true);assert.deepEqual(reopened.export(),before);reopened.close();
});

test('pure outgoing query and routing constrain range and prevent arbitrary RPC methods',async()=>{
 assert.throws(()=>outgoingTransferParams(PROSPECTIVE_FUNDER,0n,4096n,null));
 assert.throws(()=>parseOutgoingTransferPage({transfers:[candidate,{...candidate,hash:hash(1001),blockNum:q(101)}]},PROSPECTIVE_FUNDER,101n,108n));
 let calls=0;const transport=indexedCaptureTransport(async()=>{calls++;return {rawResponse:'',error:null}},async()=>{calls++;return {rawResponse:'',error:null}});
 assert.throws(()=>transport({jsonrpc:'2.0',id:1,method:'eth_sendRawTransaction',params:[]}));assert.equal(calls,0);
});


test('targeted rereview: changed head/range identity, repeated anchor and funding before cursor time halt before admission',async t=>{
 for(const o of [{anchorDrift:true},{repeatedAnchor:true},{earlyFunding:true}]){
  const {store,f}=await register(t,o);const s=await store.step(f.transport,f.now);
  assert.equal(s.phase,'HALTED');assert.equal(s.indexedDiscovery!.valid,false);assert.equal(s.funding,null);assert.equal(s.handoff,null);assert.equal(s.indexedDiscovery!.throughBlock,null);
 }
});

test('targeted rereview: multiple indexed ranges share one 48-call budget; partial last range does not advance',async t=>{
 const {store,f}=await register(t,{empty:true,advance:true});let s=await store.step(f.transport,f.now);
 while(s.phase==='SEARCHING')s=await store.step(f.transport,f.now);
 assert.equal(s.phase,'EXHAUSTED');assert.equal(s.rpcCalls,48);assert.equal(f.requests.length,48);
 assert.equal(s.indexedDiscovery!.throughBlock,'164');assert.equal(s.indexedDiscovery!.ranges.length,8);assert.equal(s.indexedDiscovery!.activeRange!.fromBlock,'165');assert.equal(s.handoff,null);
 const queries=f.requests.filter(r=>r.method==='alchemy_getAssetTransfers');assert.equal(queries.length,9);
 assert.deepEqual(queries.map(r=>(r.params[0] as any).fromBlock),Array.from({length:9},(_,i)=>q(101+i*8)));
 await store.step(async()=>{assert.fail('cannot exceed original budget')},f.now);
});
