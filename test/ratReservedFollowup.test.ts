import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {encodeAbiParameters,toEventSelector} from 'viem';
import {PONS_V2_FACTORY} from '../src/pons/chain.js';
import {ponsTokenLaunchedEvent} from '../src/pons/ponsAbi.js';
import {ProspectiveJournal,type PublicReadTransport} from '../src/workforce/prospectiveJournal.js';
import {PROSPECTIVE_FUNDER,PROSPECTIVE_RPC,sealCapture,auditProspective,type RpcRequest,type ProspectiveState} from '../src/workforce/prospective.js';
import {RESERVED_FOLLOWUP_V1,observeReservedFollowup} from '../src/workforce/prospectiveObservation.js';

// Synthetic transport controls only. Event construction below is not a real outcome or model holdout.
const origin=1800000000000,recipient='0x'+'a'.repeat(40),token='0x'+'b'.repeat(40),curve='0x'+'c'.repeat(40);
const hash=(n:number)=>'0x'+n.toString(16).padStart(64,'0'),q=(n:number)=>'0x'+n.toString(16);
const code=JSON.parse(readFileSync('test/fixtures/workforce/recorded/pons-funding-a-rpc-v1.json','utf8')).responses[1].response.result;
function temp(t:{after:(f:()=>void)=>void}){const d=mkdtempSync(join(tmpdir(),'binrat-observation-'));t.after(()=>rmSync(d,{recursive:true,force:true}));return d;}
async function manifest(){return sealCapture({schemaVersion:'binrat.prospective-capture/4' as const,provenance:'PUBLIC_RPC_SHADOW' as const,captureId:'synthetic-observation-control',
 discovery:{strategy:'INDEXED_FUNDER_OUTGOING' as const,source:'ALCHEMY_ROBINHOOD_ARCHIVE' as const,maxRangeBlocks:4096 as const,maxPages:3 as const,pageSize:5 as const},
 funder:PROSPECTIVE_FUNDER,endpoint:PROSPECTIVE_RPC,createdAtMs:origin,expiresAtMs:origin+86400000,maxRpcCalls:96 as const,historyBlocks:8 as const,maxWindowBlocks:200000 as const,
 authority:{publicRpcRead:true as const,model:false as const,delivery:false as const,capital:false as const}});}
async function setup(t:Parameters<typeof temp>[0]){const store=new ProspectiveJournal(join(temp(t),'capture.sqlite'),true);t.after(()=>store.close());await store.register(await manifest());return store;}
function fake(options:{candidateRange?:number;thirdPage?:boolean;failIndex?:boolean;noLaunch?:boolean;earlierLaunch?:boolean;lateWait?:boolean;delayCycles?:number}={}){
 let now=origin,ranges=0,watchQueries=0,funding:any=null,launch:any=null,handoff:ProspectiveState|null=null;
 const requests:RpcRequest[]=[],waits:number[]=[],boundaries:ProspectiveState[]=[];
 const block=(n:number,full=false)=>({number:q(n),hash:hash(n),parentHash:hash(n-1),timestamp:q(origin/1000+n-1000),
  transactions:n===Number(BigInt(funding?.blockNumber??'0x0'))?(full?[structuredClone(funding)]:[funding.hash]):n===Number(BigInt(launch?.blockNumber??'0x0'))?[launch.transactionHash]:[]});
 const transfer=(n:number,self=false)=>({hash:hash(100000+n),from:PROSPECTIVE_FUNDER,to:self?PROSPECTIVE_FUNDER:recipient,blockNum:q(n),category:'external',rawContract:{value:'0x1',address:null}});
 const transport:PublicReadTransport=async r=>{
  now+=10;requests.push(structuredClone(r));let result:any;
  if(r.method==='eth_chainId')result='0x1237';else if(r.method==='eth_getCode')result=code;
  else if(r.method==='eth_getBlockByNumber'){const n=r.params[0]==='latest'?1000+Math.floor((now-origin)/1000):Number(BigInt(r.params[0] as string));result=block(n,Boolean(r.params[1]));}
  else if(r.method==='alchemy_getAssetTransfers'){
   if(options.failIndex)return {rawResponse:'preserved indexed failure',error:'ARCHIVE_RPC_FAILED'};
   const p=r.params[0] as any;if(!p.pageKey)ranges++;
   if(ranges!==options.candidateRange)result={transfers:[]};
   else{
    const start=Number(BigInt(p.fromBlock)),page=p.pageKey==='p2'?2:p.pageKey==='p3'?3:1;
    if(options.thirdPage&&page<3)result={transfers:[transfer(start+page-1,true)],pageKey:page===1?'p2':'p3'};
    else{
     const n=start+2,t=transfer(n);funding={hash:t.hash,from:t.from,to:t.to,value:'0x1',blockNumber:q(n),blockHash:hash(n),transactionIndex:'0x0',chainId:'0x1237'};
     result={transfers:[t]};
    }
   }
  }else if(r.method==='eth_getTransactionReceipt'){
   result=r.params[0]===funding.hash?{transactionHash:funding.hash,blockHash:funding.blockHash,blockNumber:funding.blockNumber,status:'0x1',from:funding.from,to:recipient,logs:[]}:
    {transactionHash:launch.transactionHash,blockHash:launch.blockHash,blockNumber:launch.blockNumber,status:'0x1',logs:[structuredClone(launch)]};
  }else if(r.method==='eth_getLogs'){
   // A launch is created only after the saved handoff callback; pre-handoff evidence stays empty.
   const p=r.params[0] as any;if(handoff&&options.delayCycles&&++watchQueries===options.delayCycles){const n=Number(BigInt(p.fromBlock))+1;launch={address:PONS_V2_FACTORY,blockHash:hash(n),blockNumber:q(n),transactionHash:hash(999999),transactionIndex:'0x0',logIndex:'0x0',removed:false,
    topics:[toEventSelector(ponsTokenLaunchedEvent),'0x'+token.slice(2).padStart(64,'0'),'0x'+curve.slice(2).padStart(64,'0'),'0x'+recipient.slice(2).padStart(64,'0')],
    data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],['0x'+'0'.repeat(40) as `0x${string}`,0n,1n])};}result=launch&&BigInt(launch.blockNumber)>=BigInt(p.fromBlock)&&BigInt(launch.blockNumber)<=BigInt(p.toBlock)?[structuredClone(launch)]:[];
  }else assert.fail('unexpected method');
  return {rawResponse:JSON.stringify({jsonrpc:'2.0',id:r.id,result}),error:null};
 };
 const onBoundary=async(s:ProspectiveState)=>{
  boundaries.push(structuredClone(s));
  if(s.phase==='HANDOFF_PREPARED'&&!handoff){
   handoff=structuredClone(s);if(options.noLaunch||options.delayCycles)return;
   const n=Number(s.handoff!.afterBlock)+(options.earlierLaunch?0:10);
   launch={address:PONS_V2_FACTORY,blockHash:hash(n),blockNumber:q(n),transactionHash:hash(999999),transactionIndex:'0x0',logIndex:'0x0',removed:false,
    topics:[toEventSelector(ponsTokenLaunchedEvent),'0x'+token.slice(2).padStart(64,'0'),'0x'+curve.slice(2).padStart(64,'0'),'0x'+recipient.slice(2).padStart(64,'0')],
    data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],['0x'+'0'.repeat(40) as `0x${string}`,0n,1n])};
  }
 };
 return {transport,onBoundary,now:()=>now,pause:async(ms:number)=>{waits.push(ms);now+=options.lateWait?1200001:ms;},requests,waits,boundaries,getHandoff:()=>handoff};
}

test('fifth-range third-page candidate still has capacity for a positive tenth post-handoff cycle at exactly 96 reads',async t=>{
 const store=await setup(t),f=fake({candidateRange:5,thirdPage:true,delayCycles:10});
 const r=await observeReservedFollowup(store,f.transport,f.pause,f.now,f.onBoundary);
 assert.equal(r.state.phase,'FOUND');assert.equal(r.state.rpcCalls,96);assert.equal(r.completedEmptyLaunchRanges,9);
 assert.equal(f.getHandoff()!.rpcCalls,44);assert.equal(f.getHandoff()!.handoff!.remainingRpcCalls,52);
 assert.equal(r.state.handoff!.schemaVersion,'binrat.prospective-handoff/2');assert.equal(r.state.notification!.deliveryAuthorized,false);
 const raw=store.export();assert.deepEqual(await auditProspective(JSON.parse((raw.manifest as {json:string}).json),(raw.calls as {json:string}[]).map(x=>JSON.parse(x.json))),r.state);
 const copy=new ProspectiveJournal(join(temp(t),'restore.sqlite'),true);try{assert.deepEqual(await copy.restore(raw),r.state);}finally{copy.close();}
 await store.step(async()=>assert.fail('terminal cannot retry'),f.now);
});
test('ten confirmed empty follow-up ranges stop with retained handoff and no admitted Case or alert',async t=>{
 const store=await setup(t),f=fake({candidateRange:5,thirdPage:true,noLaunch:true});
 const r=await observeReservedFollowup(store,f.transport,f.pause,f.now,f.onBoundary);
 assert.equal(r.stopReason,'LAUNCH_RANGE_LIMIT');assert.equal(r.completedEmptyLaunchRanges,10);assert.equal(r.state.rpcCalls,94);
 assert.ok(r.state.handoff);assert.equal(r.state.finding,null);assert.equal(r.state.caseDiff,null);assert.equal(r.state.notification,null);
 const before=store.export();await assert.rejects(observeReservedFollowup(store,async()=>assert.fail('no continuation')),/FRESH_JOURNAL_REQUIRED/);assert.deepEqual(store.export(),before);
});
test('five empty discovery ranges close the finite opportunity while retaining follow-up allowance',async t=>{
 const store=await setup(t),f=fake();const r=await observeReservedFollowup(store,f.transport,f.pause,f.now,f.onBoundary);
 assert.equal(r.state.rpcCalls,28);assert.equal(r.stopReason,'DISCOVERY_RANGE_LIMIT');assert.equal(r.state.indexedDiscovery!.ranges.length,5);
 assert.equal(r.state.handoff,null);assert.equal(r.completedEmptyLaunchRanges,0);
});
test('early handoff can retain more than 48 calls without expanding its research authority',async t=>{
 const store=await setup(t),f=fake({candidateRange:1,noLaunch:true});const r=await observeReservedFollowup(store,f.transport,f.pause,f.now,f.onBoundary);
 assert.equal(r.state.handoff!.remainingRpcCalls,74);assert.equal(r.state.rpcCalls,72);
 assert.deepEqual(r.state.handoff!.authority,{research:true,network:false,provider:false,delivery:false,capital:false});
});
test('used journals cannot be upgraded, legacy manifest budgets remain fixed and malformed V4 budgets reject',async t=>{
 const m=await manifest();for(const changes of [{maxRpcCalls:95},{maxRpcCalls:97},{authority:{...m.authority,model:true}}])await assert.rejects(auditProspective(await sealCapture({...m,...changes}),[]));
 await assert.rejects(auditProspective(await sealCapture({...m,schemaVersion:'binrat.prospective-capture/3'}),[]));
 const old=await sealCapture({...m,schemaVersion:'binrat.prospective-capture/3',maxRpcCalls:48});const store=await setup(t);
 await assert.rejects(store.register(old),/MANIFEST_CONFLICT/);
 const legacy=new ProspectiveJournal(join(temp(t),'legacy.sqlite'),true);try{await legacy.register(old);await assert.rejects(observeReservedFollowup(legacy,async()=>assert.fail('wrong protocol')),/V4_REQUIRED/);}finally{legacy.close();}
});
test('request failure and both time limits halt without replacing the counted reservation',async t=>{
 for(const options of [{failIndex:true},{lateWait:true},{candidateRange:1,noLaunch:true}]){
  const store=await setup(t),f=fake(options);const pause=async(ms:number)=>f.pause(f.getHandoff()?16*60000:ms);
  const r=await observeReservedFollowup(store,f.transport,pause,f.now,f.onBoundary);
  assert.equal(r.state.phase,'HALTED');assert.equal(r.state.rpcCalls,options.failIndex?7:options.lateWait?4:23);
  assert.equal(f.requests.length,options.failIndex?7:options.lateWait?3:22);
  await store.step(async()=>assert.fail('halt cannot retry'),f.now);
 }
});
test('V4 rejects ambiguous duplicate JSON responses without admitting evidence',async t=>{
 const store=await setup(t),f=fake();let n=0;
 const r=await observeReservedFollowup(store,async request=>{n++;return {rawResponse:'{"jsonrpc":"2.0","id":1,"result":"0x1","result":"0x1237"}',error:null};},f.pause,f.now);
 assert.equal(n,1);assert.equal(r.state.phase,'HALTED');assert.equal(r.state.reason,'DUPLICATE_JSON_KEY');assert.equal(r.state.handoff,null);
});
test('a late successful launch reply is retained as a failed reservation, with no finding or notification',async t=>{
 const store=await setup(t),f=fake({candidateRange:1,delayCycles:1});
 const transport:PublicReadTransport=async r=>{
  const reply=await f.transport(r),body=JSON.parse(reply.rawResponse);
  if(r.method==='eth_getBlockByNumber'&&body.result.transactions?.includes(hash(999999)))await f.pause(16*60000);
  return reply;
 };
 const r=await observeReservedFollowup(store,transport,f.pause,f.now,f.onBoundary);
 assert.equal(r.state.phase,'HALTED');assert.equal(r.state.reason,'RESERVED_FOLLOWUP_TIME_LIMIT');assert.equal(r.state.rpcCalls,29);
 assert.ok(r.state.handoff);assert.equal(r.state.finding,null);assert.equal(r.state.notification,null);
 const last=JSON.parse((store.export().calls as {json:string}[]).at(-1)!.json);assert.equal(last.status,'FAILED');assert.match(last.rawResponse,new RegExp(hash(999999)));
});
test('a restored uncertain V4 reservation remains counted and cannot dispatch again',async t=>{
 const m=await manifest(),pending=await sealCapture({sequence:1,previousDigest:m.digest,request:{jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]},
  status:'PENDING',startedAtMs:origin,completedAtMs:null,rawResponse:null,error:null});
 const state=await auditProspective(m,[pending] as any);assert.equal(state.phase,'HALTED');assert.equal(state.rpcCalls,1);
 const store=new ProspectiveJournal(join(temp(t),'pending.sqlite'),true);try{
  await store.restore({mode:'UNVERIFIED_PROSPECTIVE_EXPORT',manifest:{json:JSON.stringify(m)},calls:[{sequence:1,json:JSON.stringify(pending)}]});
  assert.deepEqual(await store.step(async()=>assert.fail('uncertain cannot repeat'),()=>origin),state);
 }finally{store.close();}
});
test('opt-in V4 registration precedes RPC, missing secret preserves zero audit and keyless CLI refuses V4 dispatch',async t=>{
 const out=join(temp(t),'capture'),env={...process.env};delete env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL;
 const r=spawnSync(process.execPath,['scripts/probe-indexed-funder.mjs','--protocol','reserved-followup-v1','--out',out,'--capture-id','synthetic-missing-v4','--source-sha','a'.repeat(40)],{env,encoding:'utf8'});
 assert.equal(r.status,1);const reg=JSON.parse(readFileSync(join(out,'registration.json'),'utf8'));
 assert.deepEqual(reg.protocol,RESERVED_FOLLOWUP_V1);assert.equal(reg.manifest.maxRpcCalls,96);assert.equal(reg.manifest.schemaVersion,'binrat.prospective-capture/4');
 const before=readFileSync(join(out,'raw-receipts.json'),'utf8');
 const step=spawnSync(process.execPath,['scripts/capture-prospective-rat.mjs','step','--db',join(out,'capture.sqlite')],{env,encoding:'utf8'});
 assert.equal(step.status,1);assert.match(step.stderr,/REQUIRES_EXPLICIT_ARCHIVE_TRANSPORT/);
 const db=new ProspectiveJournal(join(out,'capture.sqlite'),false,true);try{assert.equal((db.export().calls as unknown[]).length,0);}finally{db.close();}
 assert.equal(readFileSync(join(out,'raw-receipts.json'),'utf8'),before);
});
