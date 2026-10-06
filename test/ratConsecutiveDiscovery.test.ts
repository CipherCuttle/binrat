import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {encodeAbiParameters,toEventSelector} from 'viem';
import {canonicalJson,sha256Hex} from '../src/evidence/canonical.js';
import {PONS_V2_FACTORY} from '../src/pons/chain.js';
import {ponsTokenLaunchedEvent} from '../src/pons/ponsAbi.js';
import {ProspectiveJournal,type PublicReadTransport} from '../src/workforce/prospectiveJournal.js';
import {auditProspective,sealCapture,PROSPECTIVE_FUNDER,PROSPECTIVE_RPC,type CaptureCall,type ConsecutiveManifest,type RpcRequest} from '../src/workforce/prospective.js';
// Entire fake transport below is SYNTHETIC_TRANSPORT_CONTROL, never real observation evidence.
const origin=1800000000000,recipient='0x'+'a'.repeat(40),token='0x'+'b'.repeat(40),curve='0x'+'c'.repeat(40);
const hash=(n:number)=>'0x'+n.toString(16).padStart(64,'0');
const q=(n:number)=>'0x'+n.toString(16);
const factoryCode=JSON.parse(readFileSync('test/fixtures/workforce/recorded/pons-funding-a-rpc-v1.json','utf8')).responses[1].response.result;
const tx={hash:hash(1000),from:PROSPECTIVE_FUNDER,to:recipient,value:'0x1',blockNumber:q(102),blockHash:hash(102),transactionIndex:'0x0',chainId:'0x1237'};
const rawLog={address:PONS_V2_FACTORY,blockHash:hash(120),blockNumber:q(120),transactionHash:hash(2000),transactionIndex:'0x0',logIndex:'0x0',removed:false,
  topics:[toEventSelector(ponsTokenLaunchedEvent),'0x'+token.slice(2).padStart(64,'0'),'0x'+curve.slice(2).padStart(64,'0'),'0x'+recipient.slice(2).padStart(64,'0')],
  data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],['0x'+'0'.repeat(40) as `0x${string}`,0n,1n])};
function block(n:number,full=false){return {number:q(n),hash:hash(n),parentHash:hash(n-1),timestamp:q(origin/1000+n-100),transactions:n===102?(full?[{...tx}]:[tx.hash]):n===120?[rawLog.transactionHash]:[]};}
async function manifest(){return sealCapture({schemaVersion:'binrat.prospective-capture/2' as const,provenance:'PUBLIC_RPC_SHADOW' as const,captureId:'synthetic-consecutive-control',discovery:{strategy:'CONSECUTIVE_NUMBERED_BLOCKS' as const,maxBlocks:8 as const},
  funder:PROSPECTIVE_FUNDER,endpoint:PROSPECTIVE_RPC,createdAtMs:origin,expiresAtMs:origin+86400000,maxRpcCalls:48 as const,historyBlocks:8 as const,maxWindowBlocks:200000 as const,
  authority:{publicRpcRead:true as const,model:false as const,delivery:false as const,capital:false as const}});}
function workspace(t:{after:(fn:()=>void)=>void}){const dir=mkdtempSync(join(tmpdir(),'binrat-prospective-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return join(dir,'capture.sqlite');}
function fake(options:{noFunding?:boolean;fundAt?:number;gap?:boolean;parentFork?:boolean;confirmFork?:boolean;cursorFork?:boolean;omitTransactions?:boolean;failAt?:number;headWait?:boolean;deadline?:boolean;sameHeadFork?:boolean;repeatedInitial?:boolean;repeatedPrefix?:boolean}={}){
  let latest=0,logs=0,funded=false,preHeads=0,now=origin,confirmations=0;const requests:RpcRequest[]=[];
  const fundAt=options.fundAt??102;
  function at(n:number,full:boolean){const b=block(n,full);b.transactions=n===fundAt&&!options.noFunding?(full?[{...tx,blockNumber:q(n),blockHash:hash(n)}]:[tx.hash]):n===120?[rawLog.transactionHash]:[];return b;}
  const transport:PublicReadTransport=async req=>{
    requests.push(structuredClone(req));now+=100;let result:any;
    if(req.id===options.failAt)return {rawResponse:'retained incomplete transport body',error:'PUBLIC_RPC_TRANSPORT_FAILED'};
    if(req.method==='eth_chainId')result='0x1237';
    else if(req.method==='eth_getCode')result=factoryCode;
    else if(req.method==='eth_getBlockByNumber'){
      const [wanted,full]=req.params;
      if(wanted==='latest'){assert.equal(full,false,'discovery never samples latest full block');latest++;
        result=at(latest===1||options.headWait?100:options.sameHeadFork&&latest===3?101:!funded?108:++preHeads===1?109:preHeads===2?110:125,false);
        if(options.sameHeadFork&&latest===3)result.hash=hash(999);
      }else{const n=Number(BigInt(wanted as string));result=at(n,full as boolean);
        if(options.repeatedInitial&&n===101)result.hash=hash(100);
        if(options.repeatedPrefix&&n===103)result.hash=hash(101);
        if(options.gap&&full&&n===101)result=at(102,true);
        if(options.parentFork&&full&&n===101)result.parentHash=hash(999);
        if(n===101&&!full){confirmations++;if(options.confirmFork&&confirmations===1)result.hash=hash(999);if(options.cursorFork&&confirmations===2)result.hash=hash(999);}
        if(options.omitTransactions&&full&&n===fundAt)result.transactions=[];
        if(options.deadline&&full&&n===101)now=origin+86400001;
      }
    }else if(req.method==='eth_getTransactionReceipt'){
      if(req.params[0]===tx.hash){funded=true;result={transactionHash:tx.hash,blockHash:hash(fundAt),blockNumber:q(fundAt),status:'0x1',from:tx.from,to:tx.to,logs:[]};}
      else result={transactionHash:rawLog.transactionHash,blockHash:hash(120),blockNumber:q(120),status:'0x1',logs:[structuredClone(rawLog)]};
    }else if(req.method==='eth_getLogs'){logs++;result=logs===1?[]:[structuredClone(rawLog)];}
    else assert.fail('unexpected request');
    return {rawResponse:JSON.stringify({jsonrpc:'2.0',id:req.id,result}),error:null};
  };return {transport,now:()=>now,requests};
}
function raw(store:ProspectiveJournal){const data=store.export() as {manifest:{json:string};calls:{json:string}[]};return {manifest:JSON.parse(data.manifest.json) as ConsecutiveManifest,calls:data.calls.map(c=>JSON.parse(c.json) as CaptureCall)};}

test('eight consecutive numbered blocks complete a scoped negative at 35 calls despite a head ahead of the cursor',async t=>{
  const store=new ProspectiveJournal(workspace(t),true),f=fake({noFunding:true});t.after(()=>store.close());await store.register(await manifest());
  let s=await store.step(f.transport,f.now);
  assert.equal(s.rpcCalls,7);assert.equal(s.discovery!.throughBlock,'101');assert.equal(s.discovery!.complete,false);
  while(s.phase==='SEARCHING')s=await store.step(f.transport,f.now);
  assert.equal(s.phase,'DISCOVERY_COMPLETE');assert.equal(s.rpcCalls,35);assert.equal(s.discovery!.complete,true);assert.equal(s.discovery!.valid,true);
  assert.deepEqual(s.discovery!.blocks.map(b=>b.number),['101','102','103','104','105','106','107','108']);
  assert.equal(s.discovery!.scope,'TOP_LEVEL_TRANSACTIONS_ONLY');assert.equal(s.finding,null);assert.equal(s.notification,null);
  assert.equal(s.discoveryCoverage,'CONTIGUOUS_NUMBERED_BLOCK_PREFIX');
  const data=raw(store);assert.deepEqual(await auditProspective(data.manifest,data.calls),s);
  assert.deepEqual(await store.step(async()=>{assert.fail('terminal network forbidden')},f.now),s);
});

test('restart and restore retain the next numbered block; funding skipped by latest-block sampling leads to the existing typed handoff and later launch',async t=>{
  const path=workspace(t),f=fake();let store=new ProspectiveJournal(path,true);await store.register(await manifest());
  let s=await store.step(f.transport,f.now);assert.equal(s.discovery!.throughBlock,'101');const exported=store.export();store.close();
  const restored=new ProspectiveJournal(workspace(t),true);t.after(()=>restored.close());assert.deepEqual(await restored.restore(exported),s);
  store=new ProspectiveJournal(path);s=await store.step(f.transport,f.now);assert.equal(s.rpcCalls,23);assert.equal(s.handoff,null);store.close();
  store=new ProspectiveJournal(path);t.after(()=>store.close());s=await store.step(f.transport,f.now);
  assert.equal(s.phase,'HANDOFF_PREPARED');assert.equal(s.rpcCalls,24);assert.equal(s.funding!.blockNumber,'0x66');
  assert.equal(s.discovery!.throughBlock,'102');assert.equal(s.discovery!.complete,false);assert.deepEqual(s.discovery!.blocks.map(b=>b.number),['101','102']);
  assert.equal(s.handoff!.authority.delivery,false);assert.equal(s.finding,null);
  s=await store.step(f.transport,f.now);assert.equal(s.phase,'FOUND');assert.equal(s.rpcCalls,31);assert.equal(s.notification!.deliveryAuthorized,false);
  assert.equal(s.finding!.launchBlock,'120');assert.ok(s.finding!.evidenceSequences.includes(s.discovery!.blocks[1]!.confirmationSequence));
});

test('wrong block, parent fork, changing confirmation and omitted full transactions cannot advance a candidate cursor',async t=>{
  for(const options of [{gap:true},{parentFork:true},{confirmFork:true},{omitTransactions:true,fundAt:101}]){
    const store=new ProspectiveJournal(workspace(t),true),f=fake(options);await store.register(await manifest());const s=await store.step(f.transport,f.now);
    assert.equal(s.phase,'HALTED',JSON.stringify(options));assert.equal(s.discovery!.throughBlock,null);assert.equal(s.discovery!.valid,false);assert.equal(s.discovery!.complete,false);
    assert.equal(s.funding,null);assert.equal(s.handoff,null);assert.equal(s.finding,null);store.close();
  }
});

test('a reorg of the saved cursor on reopening invalidates coverage before the next full block is read',async t=>{
  const path=workspace(t),f=fake({noFunding:true,cursorFork:true});let store=new ProspectiveJournal(path,true);await store.register(await manifest());
  await store.step(f.transport,f.now);store.close();store=new ProspectiveJournal(path);t.after(()=>store.close());const s=await store.step(f.transport,f.now);
  assert.equal(s.reason,'PROSPECTIVE_DISCOVERY_CURSOR_REORG');assert.equal(s.discovery!.throughBlock,'101');assert.equal(s.discovery!.valid,false);
  assert.equal(s.discovery!.complete,false);assert.equal(s.handoff,null);assert.equal(f.requests.filter(r=>r.params[0]==='0x66'&&r.params[1]===true).length,0);
});

test('failed confirmation and unresolved reservation retain bodies and the unadvanced cursor, without retry on restore',async t=>{
  const path=workspace(t),f=fake({noFunding:true,failAt:7});let store=new ProspectiveJournal(path,true);await store.register(await manifest());
  const halted=await store.step(f.transport,f.now);assert.equal(halted.phase,'HALTED');assert.equal(halted.rpcCalls,7);assert.equal(halted.discovery!.throughBlock,null);
  assert.match(canonicalJson(store.export()),/retained incomplete transport body/);const exported=store.export();store.close();
  store=new ProspectiveJournal(workspace(t),true);t.after(()=>store.close());await store.restore(exported);assert.deepEqual(await store.step(async()=>{assert.fail('retry forbidden')},f.now),halted);
  const m=await manifest(),pendingStore=new ProspectiveJournal(workspace(t),true);t.after(()=>pendingStore.close());
  const pending=await sealCapture({sequence:1,previousDigest:m.digest,startedAtMs:origin,completedAtMs:null,request:{jsonrpc:'2.0' as const,id:1,method:'eth_chainId',params:[]},status:'PENDING' as const,rawResponse:null,error:null});
  await pendingStore.restore({mode:'UNVERIFIED_PROSPECTIVE_EXPORT',manifest:{json:canonicalJson(m)},calls:[{sequence:1,json:canonicalJson(pending)}]});
  assert.equal((await pendingStore.step(async()=>{assert.fail('pending retry forbidden')},()=>origin)).reason,'UNCERTAIN_RESERVED_RPC_NO_RETRY');
});

test('waiting heads and late funding exhaust the original budget without an absence claim or launch finding',async t=>{
  for(const options of [{headWait:true},{fundAt:108}]){
    const store=new ProspectiveJournal(workspace(t),true),f=fake(options);await store.register(await manifest());let s=await store.step(f.transport,f.now);
    while(!['EXHAUSTED','FOUND','HALTED','DISCOVERY_COMPLETE'].includes(s.phase))s=await store.step(f.transport,f.now);
    assert.equal(s.phase,'EXHAUSTED');assert.equal(s.rpcCalls,48);assert.equal(s.finding,null);assert.equal(s.notification,null);
    if(options.headWait){assert.equal(s.discovery!.throughBlock,null);assert.equal(s.discovery!.complete,false);}
    else{assert.equal(s.handoff!.remainingRpcCalls,0);assert.equal(s.reason,'ORIGIN_RPC_BUDGET_EXHAUSTED');}
    assert.deepEqual(await store.step(async()=>{assert.fail('origin budget exhausted')},f.now),s);store.close();
  }
});

test('deadline during an unconfirmed full block leaves no advanced coverage or handoff',async t=>{
  const store=new ProspectiveJournal(workspace(t),true),f=fake({deadline:true});t.after(()=>store.close());await store.register(await manifest());
  const s=await store.step(f.transport,f.now);assert.equal(s.phase,'EXPIRED');assert.equal(s.reason,'DEADLINE_DURING_RESERVED_RPC');
  assert.equal(s.discovery!.throughBlock,null);assert.equal(s.discovery!.complete,false);assert.equal(s.handoff,null);
});

test('protocol mutations and journal upgrade conflict fail closed; V1 frozen audit is byte-identical in meaning',async t=>{
  const m=await manifest();for(const mutation of [{maxRpcCalls:49},{discovery:{strategy:'CONSECUTIVE_NUMBERED_BLOCKS',maxBlocks:9}},{authority:{...m.authority,capital:true}}])await assert.rejects(auditProspective(await sealCapture({...m,...mutation}),[]));
  const store=new ProspectiveJournal(workspace(t),true),f=fake({noFunding:true});await store.register(m);await store.step(f.transport,f.now);const data=raw(store);store.close();
  const calls=structuredClone(data.calls.slice(0,6));calls[5]!.request.params=['latest',true];calls[5]=await sealCapture(calls[5]!);await assert.rejects(auditProspective(m,calls));
  const v1=JSON.parse(readFileSync('test/fixtures/workforce/prospective/public-capture-prefix-v1.json','utf8'));const old=await auditProspective(JSON.parse(v1.manifest.json),v1.calls.map((c:{json:string})=>JSON.parse(c.json)));
  const terminal=JSON.parse(readFileSync('test/fixtures/workforce/prospective/public-capture-terminal-v1.json','utf8'));
  const closed=await auditProspective(JSON.parse(terminal.manifest.json),terminal.calls.map((c:{json:string})=>JSON.parse(c.json)));
  assert.equal(closed.phase,'EXPIRED');assert.equal(closed.rpcCalls,7);assert.equal(closed.snapshotDigest,'0fd4f00a26c2e7bd8ffc05e5e0d6617f337d39c111d9323fa0ee09ec535b7778');
  assert.equal(old.snapshotDigest,'de1a8d0d49dc3c38a0cd17034a7d18a4f7dddda7319ad084f03c64c88019c236');assert.equal(old.discovery,undefined);assert.equal(old.discoveryCoverage,'SAMPLED_BLOCKS_ONLY');
  const target=new ProspectiveJournal(workspace(t),true);t.after(()=>target.close());await target.restore(v1);await assert.rejects(target.register(m),/PROSPECTIVE_MANIFEST_CONFLICT/);
});


test('CLI requires explicit V2 registration and never upgrades an existing V1 journal',t=>{
  const path=workspace(t);const run=(...args:string[])=>JSON.parse(execFileSync(process.execPath,['scripts/capture-prospective-rat.mjs',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
  const created=run('init-consecutive','--db',path,'--capture-id','synthetic-cli-control');assert.equal(created.rpcCalls,0);assert.equal(created.discovery.strategy,'CONSECUTIVE_NUMBERED_BLOCKS');
  const exported=run('export','--db',path);assert.equal(JSON.parse(exported.manifest.json).schemaVersion,'binrat.prospective-capture/2');assert.equal(exported.calls.length,0);
  const legacy=workspace(t);run('init','--db',legacy,'--capture-id','synthetic-legacy-control');const before=run('export','--db',legacy);
  assert.throws(()=>run('init-consecutive','--db',legacy,'--capture-id','synthetic-upgrade-control'));assert.deepEqual(run('export','--db',legacy),before);
});


test('targeted rereview: repeated initial/prefix hashes and a same-height head fork invalidate coverage without a handoff',async t=>{
  for(const option of [{repeatedInitial:true},{repeatedPrefix:true},{sameHeadFork:true}]){
    const f=fake({...option,noFunding:true}),store=new ProspectiveJournal(workspace(t),true);await store.register(await manifest());let s=await store.step(f.transport,f.now);
    while(s.phase==='SEARCHING')s=await store.step(f.transport,f.now);
    assert.equal(s.phase,'HALTED');assert.equal(s.discovery!.valid,false);assert.equal(s.discovery!.complete,false);assert.equal(s.handoff,null);assert.equal(s.notification,null);
    assert.equal(s.reason,option.sameHeadFork?'PROSPECTIVE_DISCOVERY_CURSOR_REORG':'PROSPECTIVE_DISCOVERY_REPEATED_HASH');
    assert.equal(s.discovery!.blocks.length,option.repeatedInitial?0:option.repeatedPrefix?2:1);store.close();
  }
});
