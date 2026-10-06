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
import {INDEXED_OBSERVATION_V1,observeIndexedFunding} from '../src/workforce/prospectiveObservation.js';

// Synthetic transport controls only. Event construction below is not a real outcome or model holdout.
const origin=1800000000000,recipient='0x'+'a'.repeat(40),token='0x'+'b'.repeat(40),curve='0x'+'c'.repeat(40);
const hash=(n:number)=>'0x'+n.toString(16).padStart(64,'0'),q=(n:number)=>'0x'+n.toString(16);
const code=JSON.parse(readFileSync('test/fixtures/workforce/recorded/pons-funding-a-rpc-v1.json','utf8')).responses[1].response.result;
function temp(t:{after:(f:()=>void)=>void}){const d=mkdtempSync(join(tmpdir(),'binrat-observation-'));t.after(()=>rmSync(d,{recursive:true,force:true}));return d;}
async function manifest(){return sealCapture({schemaVersion:'binrat.prospective-capture/3' as const,provenance:'PUBLIC_RPC_SHADOW' as const,captureId:'synthetic-observation-control',
 discovery:{strategy:'INDEXED_FUNDER_OUTGOING' as const,source:'ALCHEMY_ROBINHOOD_ARCHIVE' as const,maxRangeBlocks:4096 as const,maxPages:3 as const,pageSize:5 as const},
 funder:PROSPECTIVE_FUNDER,endpoint:PROSPECTIVE_RPC,createdAtMs:origin,expiresAtMs:origin+86400000,maxRpcCalls:48 as const,historyBlocks:8 as const,maxWindowBlocks:200000 as const,
 authority:{publicRpcRead:true as const,model:false as const,delivery:false as const,capital:false as const}});}
async function setup(t:Parameters<typeof temp>[0]){const store=new ProspectiveJournal(join(temp(t),'capture.sqlite'),true);t.after(()=>store.close());await store.register(await manifest());return store;}
function fake(options:{candidateRange?:number;thirdPage?:boolean;failIndex?:boolean;noLaunch?:boolean;earlierLaunch?:boolean;lateWait?:boolean}={}){
 let now=origin,ranges=0,funding:any=null,launch:any=null,handoff:ProspectiveState|null=null;
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
   const p=r.params[0] as any;result=launch&&BigInt(launch.blockNumber)>=BigInt(p.fromBlock)&&BigInt(launch.blockNumber)<=BigInt(p.toBlock)?[structuredClone(launch)]:[];
  }else assert.fail('unexpected method');
  return {rawResponse:JSON.stringify({jsonrpc:'2.0',id:r.id,result}),error:null};
 };
 const onBoundary=async(s:ProspectiveState)=>{
  boundaries.push(structuredClone(s));
  if(s.phase==='HANDOFF_PREPARED'&&!handoff){
   handoff=structuredClone(s);if(options.noLaunch)return;
   const n=Number(s.handoff!.afterBlock)+(options.earlierLaunch?0:10);
   launch={address:PONS_V2_FACTORY,blockHash:hash(n),blockNumber:q(n),transactionHash:hash(999999),transactionIndex:'0x0',logIndex:'0x0',removed:false,
    topics:[toEventSelector(ponsTokenLaunchedEvent),'0x'+token.slice(2).padStart(64,'0'),'0x'+curve.slice(2).padStart(64,'0'),'0x'+recipient.slice(2).padStart(64,'0')],
    data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],['0x'+'0'.repeat(40) as `0x${string}`,0n,1n])};
  }
 };
 return {transport,onBoundary,now:()=>now,pause:async(ms:number)=>{waits.push(ms);now+=options.lateWait?720001:ms;},requests,waits,boundaries,getHandoff:()=>handoff};
}

test('bounded observation continues beyond empty ranges and the saved handoff to a supported strictly later launch',async t=>{
 const store=await setup(t),f=fake({candidateRange:2});
 const result=await observeIndexedFunding(store,f.transport,f.pause,f.now,f.onBoundary);
 assert.equal(result.stopReason,'JOURNAL_TERMINAL');assert.equal(result.state.phase,'FOUND');assert.equal(result.state.rpcCalls,34);
 assert.equal(result.state.indexedDiscovery!.ranges.length,1);assert.equal(result.state.notification!.deliveryAuthorized,false);
 const handoff=f.getHandoff()!;assert.equal(handoff.rpcCalls,27);assert.equal(handoff.finding,null);assert.ok(result.state.finding);
 assert.ok(BigInt(result.state.finding!.launchBlock)>BigInt(handoff.handoff!.afterBlock));
 const raw=store.export(),calls=(raw.calls as {json:string}[]).map(c=>JSON.parse(c.json));
 assert.deepEqual(await auditProspective(JSON.parse((raw.manifest as {json:string}).json),calls),result.state);
});

test('empty provider ranges stop with unused candidate-verification capacity, without a chain-wide negative',async t=>{
 const store=await setup(t),f=fake();const {state,stopReason}=await observeIndexedFunding(store,f.transport,f.pause,f.now,f.onBoundary);
 assert.equal(state.rpcCalls,23);assert.equal(state.phase,'SEARCHING');assert.equal(stopReason,'DISCOVERY_RANGE_LIMIT');
 assert.equal(state.indexedDiscovery!.ranges.length,4);assert.equal(state.handoff,null);assert.equal(state.reason,null);assert.equal(state.finding,null);
 assert.equal(f.requests.filter(r=>r.method==='alchemy_getAssetTransfers').length,4);assert.deepEqual(f.waits,[60000,60000,60000,60000]);
 const before=store.export();await assert.rejects(observeIndexedFunding(store,async()=>assert.fail('closed journal must not continue')),/FRESH_JOURNAL_REQUIRED/);assert.deepEqual(store.export(),before);
});

test('third-page candidate in the fourth range fits original allowance through strictly later-launch admission',async t=>{
 const store=await setup(t),f=fake({candidateRange:4,thirdPage:true});
 const {state}=await observeIndexedFunding(store,f.transport,f.pause,f.now,f.onBoundary);
 assert.equal(state.phase,'FOUND');assert.equal(state.rpcCalls,46);assert.equal(state.indexedDiscovery!.ranges.length,3);
 assert.equal(state.handoff!.remainingRpcCalls,9);assert.equal(f.requests.length,46);
});

test('no later launch exhausts the same allowance and keeps the handoff without admitting a finding',async t=>{
 const store=await setup(t),f=fake({candidateRange:1,noLaunch:true});const {state}=await observeIndexedFunding(store,f.transport,f.pause,f.now,f.onBoundary);
 assert.equal(state.phase,'EXHAUSTED');assert.equal(state.rpcCalls,48);assert.equal(f.requests.length,48);
 assert.ok(state.handoff);assert.equal(state.finding,null);assert.equal(state.caseDiff,null);assert.equal(state.notification,null);
 await store.step(async()=>assert.fail('exhausted allowance cannot retry'),f.now);
});

test('indexed failure and time-limit reservation halt once, retain receipts and make no replacement attempt',async t=>{
 for(const options of [{failIndex:true},{lateWait:true}]){
  const store=await setup(t),f=fake(options);const {state}=await observeIndexedFunding(store,f.transport,f.pause,f.now,f.onBoundary);
  assert.equal(state.phase,'HALTED');assert.equal(state.rpcCalls,options.failIndex?7:4);assert.equal(f.requests.length,options.failIndex?7:3);
  if(options.failIndex)assert.match(JSON.stringify(store.export()),/preserved indexed failure/);
  await store.step(async()=>assert.fail('failed reservation cannot retry'),f.now);
 }
});

test('failed handoff checkpoint export stops before later-launch observation while the journal remains inspectable',async t=>{
 const store=await setup(t),f=fake({candidateRange:1});
 await assert.rejects(observeIndexedFunding(store,f.transport,f.pause,f.now,async s=>{if(s.handoff)throw new Error('CHECKPOINT_WRITE_FAILED');}),/CHECKPOINT_WRITE_FAILED/);
 const state=await store.inspect();assert.equal(state.phase,'HANDOFF_PREPARED');assert.equal(state.rpcCalls,22);assert.equal(state.finding,null);
 assert.equal(f.requests.filter(r=>r.method==='eth_getLogs').length,1); // Only the pre-handoff query.
});

test('targeted rereview: checkpoint callbacks cannot forge the observation control state or its result',async t=>{
 const store=await setup(t),f=fake({candidateRange:1});
 const {state}=await observeIndexedFunding(store,f.transport,f.pause,f.now,async s=>{
  await f.onBoundary(s);s.phase='FOUND';s.rpcCalls=48;s.indexedDiscovery!.ranges=[];
 });
 assert.equal(state.phase,'FOUND');assert.equal(state.rpcCalls,29);assert.ok(state.finding);
 assert.deepEqual(await store.inspect(),state);
});

test('opt-in CLI seals the fixed observation policy before any RPC; missing settings retain its zero-attempt audit',t=>{
 const out=join(temp(t),'capture'),env={...process.env};delete env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL;
 const run=spawnSync(process.execPath,['scripts/probe-indexed-funder.mjs','--protocol','bounded-observation-v1','--out',out,'--capture-id','synthetic-missing-secret','--source-sha','a'.repeat(40)],{env,encoding:'utf8'});
 assert.equal(run.status,1);const registration=JSON.parse(readFileSync(join(out,'registration.json'),'utf8'));
 assert.deepEqual(registration.protocol,INDEXED_OBSERVATION_V1);assert.match(registration.digest,/^[a-f0-9]{64}$/);
 assert.equal(JSON.parse(readFileSync(join(out,'audit.json'),'utf8')).rpcCalls,0);
 assert.equal(JSON.parse(readFileSync(join(out,'summary.json'),'utf8')).error,'ARCHIVE_RPC_SECRET_REQUIRED');
 assert.equal(JSON.parse(readFileSync(join(out,'summary.json'),'utf8')).outcome,'NOT_STARTED');
});
