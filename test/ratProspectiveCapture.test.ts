import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {encodeAbiParameters,toEventSelector} from 'viem';
import {canonicalJson,sha256Hex} from '../src/evidence/canonical.js';
import {PONS_V2_FACTORY} from '../src/pons/chain.js';
import {ponsTokenLaunchedEvent} from '../src/pons/ponsAbi.js';
import {ProspectiveJournal,type PublicReadTransport} from '../src/workforce/prospectiveJournal.js';
import {auditProspective,sealCapture,PROSPECTIVE_FUNDER,PROSPECTIVE_RPC,type CaptureCall,type ProspectiveManifest,type RpcRequest} from '../src/workforce/prospective.js';
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
async function manifest(){return sealCapture({schemaVersion:'binrat.prospective-capture/1' as const,provenance:'PUBLIC_RPC_SHADOW' as const,captureId:'synthetic-transport-control',
  funder:PROSPECTIVE_FUNDER,endpoint:PROSPECTIVE_RPC,createdAtMs:origin,expiresAtMs:origin+86400000,maxRpcCalls:48 as const,historyBlocks:8 as const,maxWindowBlocks:200000 as const,
  authority:{publicRpcRead:true as const,model:false as const,delivery:false as const,capital:false as const}});}
function workspace(t:{after:(fn:()=>void)=>void}){const dir=mkdtempSync(join(tmpdir(),'binrat-prospective-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return join(dir,'capture.sqlite');}
function fake(options:{seen?:boolean;alreadyLaunched?:boolean;fundingStatus?:string;failAt?:number;badHistory?:boolean;launchTimeBeforeHandoff?:boolean;noFunding?:boolean;reorg?:boolean;rangeReorg?:boolean;emptyLater?:boolean}={}){
  let latestFalse=0,logs=0,rangeReads=0,now=origin;
  const transport:PublicReadTransport=async req=>{
    now+=100;
    if(req.id===options.failAt)return {rawResponse:'partial response',error:'PUBLIC_RPC_TRANSPORT_FAILED'};
    let result:any;
    if(req.method==='eth_chainId')result='0x1237';
    else if(req.method==='eth_getCode')result=factoryCode;
    else if(req.method==='eth_getBlockByNumber'){
      const [wanted,full]=req.params;
      if(wanted==='latest'){
        if(full)result=block(options.noFunding?103:102,true);
        else{latestFalse++;result=block(latestFalse===1?100:latestFalse===2?109:latestFalse===3?110:125);}
      }else{
        const n=Number(BigInt(wanted as string));result=block(n,full as boolean);
        if(options.seen&&n===94)result.transactions=[{...tx,blockNumber:q(94),blockHash:hash(94),from:recipient,to:PROSPECTIVE_FUNDER}];
        if(options.badHistory&&n===96)result.parentHash=hash(999);
        if(options.reorg&&n===110)result.hash=hash(999);
        if(n===125&&++rangeReads===2&&options.rangeReorg)result.hash=hash(999);
        if(options.launchTimeBeforeHandoff&&n===120)result.timestamp=q(origin/1000);
      }
    }else if(req.method==='eth_getTransactionReceipt'){
      if(req.params[0]===tx.hash)result={transactionHash:tx.hash,blockHash:hash(102),blockNumber:q(102),status:options.fundingStatus??'0x1',from:tx.from,to:tx.to,logs:[]};
      else result={transactionHash:rawLog.transactionHash,blockHash:hash(120),blockNumber:q(120),status:'0x1',logs:[structuredClone(rawLog)]};
    }else if(req.method==='eth_getLogs'){logs++;result=logs===1?(options.alreadyLaunched?[{...rawLog,blockNumber:q(105),blockHash:hash(105)}]:[]):options.emptyLater?[]:[structuredClone(rawLog)];}
    else throw Error('unexpected synthetic request');
    return {rawResponse:JSON.stringify({jsonrpc:'2.0',id:req.id,result}),error:null};
  };
  return {transport,now:()=>now};
}
function raw(store:ProspectiveJournal){const data=store.export() as {manifest:{json:string};calls:{json:string}[]};return {manifest:JSON.parse(data.manifest.json) as ProspectiveManifest,calls:data.calls.map(c=>JSON.parse(c.json) as CaptureCall)};}

test('synthetic control funding -> eight full history blocks -> saved handoff -> strictly later launch; restart preserves original budget',async t=>{
  const path=workspace(t),f=fake();let store=new ProspectiveJournal(path,true);await store.register(await manifest());
  let s=await store.step(f.transport,f.now);assert.equal(s.stage,'HANDOFF_HEAD');assert.equal(s.handoff,null);assert.equal(s.rpcCalls,16);store.close();
  store=new ProspectiveJournal(path);s=await store.step(f.transport,f.now);assert.equal(s.phase,'HANDOFF_PREPARED');assert.equal(s.rpcCalls,17);
  assert.equal(s.handoff!.history.complete,true);assert.equal(s.handoff!.history.seen,false);assert.equal(s.handoff!.history.fromBlock,'94');assert.equal(s.handoff!.history.toBlock,'101');
  assert.equal(s.finding,null);assert.equal(s.notification,null);assert.equal(s.handoff!.authority.capital,false);
  const {snapshotDigest,...snapshot}=s;assert.equal(snapshotDigest,await sha256Hex(snapshot));
  const prefix=raw(store);assert.deepEqual((await auditProspective(prefix.manifest,prefix.calls)).handoff,s.handoff);
  store.close();store=new ProspectiveJournal(path);s=await store.step(f.transport,f.now);
  assert.equal(s.phase,'FOUND');assert.equal(s.rpcCalls,24);assert.equal(s.finding!.launchBlock,'120');assert.equal(s.notification!.deliveryAuthorized,false);assert.ok(s.caseDiff!.addedFacts.includes('LAUNCH_AFTER_LOCAL_HANDOFF'));
  assert.ok(s.finding!.evidenceSequences.includes(17));assert.ok(s.handoff!.createdAtMs<s.finding!.evidenceSequences.length*100+origin);
  const again=await store.step(async()=>{throw Error('network must not run after terminal')},f.now);assert.deepEqual(again,s);store.close();
});

test('failed RPC is reserved and retained once; reopening never retries ambiguous or failed requests',async t=>{
  const path=workspace(t),f=fake({failAt:4});let store=new ProspectiveJournal(path,true);await store.register(await manifest());
  const halted=await store.step(f.transport,f.now);assert.equal(halted.phase,'HALTED');assert.equal(halted.rpcCalls,4);assert.equal(halted.handoff,null);
  assert.match(canonicalJson(store.export()),/partial response/);store.close();store=new ProspectiveJournal(path);
  assert.deepEqual(await store.step(async()=>{assert.fail('retry forbidden')},f.now),halted);store.close();
});

test('a reserved request left by a crash blocks further network work and remains exportable',async t=>{
  const path=workspace(t),m=await manifest(),store=new ProspectiveJournal(path,true);await store.register(m);store.close();
  const pending=await sealCapture({sequence:1,previousDigest:m.digest,startedAtMs:origin,completedAtMs:null,request:{jsonrpc:'2.0' as const,id:1,method:'eth_chainId',params:[]},status:'PENDING' as const,rawResponse:null,error:null});
  const db=new Database(path);db.prepare('INSERT INTO prospective_calls VALUES (?,?)').run(1,canonicalJson(pending));db.close();
  const reopened=new ProspectiveJournal(path);t.after(()=>reopened.close());const s=await reopened.step(async()=>{assert.fail('uncertain retry forbidden')},()=>origin);
  assert.equal(s.phase,'HALTED');assert.equal(s.reason,'UNCERTAIN_RESERVED_RPC_NO_RETRY');assert.equal(s.rpcCalls,1);assert.ok(reopened.export());
  const restored=new ProspectiveJournal(workspace(t),true);t.after(()=>restored.close());assert.deepEqual(await restored.restore(reopened.export()),s);
  assert.deepEqual(await restored.step(async()=>{assert.fail('restored pending retry forbidden')},()=>origin),s);
});

test('seen recipient, failed funding, history fork, earlier launch, late wall-clock launch and anchor reorg cannot produce a Case',async t=>{
  for(const options of [{seen:true},{fundingStatus:'0x0'},{badHistory:true},{alreadyLaunched:true},{launchTimeBeforeHandoff:true},{reorg:true},{rangeReorg:true,emptyLater:true}]){
    const path=workspace(t),f=fake(options),store=new ProspectiveJournal(path,true);await store.register(await manifest());
    let s=await store.step(f.transport,f.now);if(!['HALTED','INELIGIBLE'].includes(s.phase))s=await store.step(f.transport,f.now);
    if(s.phase==='HANDOFF_PREPARED')s=await store.step(f.transport,f.now);
    assert.ok(['HALTED','INELIGIBLE'].includes(s.phase),JSON.stringify({options,phase:s.phase,stage:s.stage}));assert.equal(s.finding,null);assert.equal(s.notification,null);store.close();
  }
});

test('no funding stays pending with sampled coverage; every manual step makes one sample, and 48 attempts exhaust the original budget',async t=>{
  const path=workspace(t),f=fake({noFunding:true}),store=new ProspectiveJournal(path,true);t.after(()=>store.close());await store.register(await manifest());
  let s=await store.step(f.transport,f.now);assert.equal(s.phase,'SEARCHING');assert.equal(s.rpcCalls,4);assert.equal(s.discoveryCoverage,'SAMPLED_BLOCKS_ONLY');
  s=await store.step(f.transport,f.now);assert.equal(s.rpcCalls,5);assert.equal(s.finding,null);
  while(s.rpcCalls<48)s=await store.step(f.transport,f.now);
  assert.equal(s.phase,'EXHAUSTED');assert.equal(s.handoff,null);assert.equal(s.notification,null);
  assert.deepEqual(await store.step(async()=>{assert.fail('budget retry forbidden')},f.now),s);
});

test('manifest authority, hidden budgets, request mutations, clock drift and altered prefix are rejected',async t=>{
  const m=await manifest();for(const key of ['model','delivery','capital']){
    const bad=structuredClone(m);(bad.authority as any)[key]=true;await assert.rejects(auditProspective(await sealCapture(bad),[]));
  }
  const bad=structuredClone(m);bad.maxRpcCalls=49 as 48;await assert.rejects(auditProspective(await sealCapture(bad),[]));
  const path=workspace(t),f=fake(),store=new ProspectiveJournal(path,true);await store.register(m);await store.step(f.transport,f.now);const data=raw(store);store.close();
  const changed=structuredClone(data.calls);changed[0]!.request.method='eth_sendRawTransaction';changed[0]=await sealCapture(changed[0]!);await assert.rejects(auditProspective(m,changed));
  const clock=structuredClone(data.calls.slice(0,3));clock[2]!.rawResponse=JSON.stringify({jsonrpc:'2.0',id:3,result:block(100)});clock[2]!.completedAtMs=origin+60000;clock[2]=await sealCapture(clock[2]!);
  assert.equal((await auditProspective(m,clock)).reason,'PROSPECTIVE_CLOCK_OR_HEAD_STALE');
  const resealed=structuredClone(data.calls);resealed[1]!.previousDigest='0'.repeat(64);resealed[1]=await sealCapture(resealed[1]!);await assert.rejects(auditProspective(m,resealed));
});

test('expiry never calls RPC or claims an unsampled no-match; foreign databases stay untouched',async t=>{
  const path=workspace(t),store=new ProspectiveJournal(path,true);await store.register(await manifest());
  const expired=await store.step(async()=>{assert.fail('expired network forbidden')},()=>origin+86400001);
  assert.equal(expired.phase,'EXPIRED');assert.equal(expired.reason,'WALL_DEADLINE_PARTIAL_COVERAGE');assert.equal(expired.rpcCalls,0);store.close();
  const foreign=workspace(t),db=new Database(foreign);db.exec('CREATE TABLE production (id TEXT)');db.close();const before=readFileSync(foreign);
  assert.throws(()=>new ProspectiveJournal(foreign,true),/PROSPECTIVE_DB_OWNERSHIP_REQUIRED/);assert.deepEqual(readFileSync(foreign),before);
});


test('restoring an exported prefix preserves origin budget and rejects replacement; pending reservations remain blocked',async t=>{
  const path=workspace(t),f=fake({noFunding:true}),first=new ProspectiveJournal(path,true);await first.register(await manifest());
  await first.step(f.transport,f.now);const exported=first.export();first.close();
  const restored=new ProspectiveJournal(workspace(t),true);t.after(()=>restored.close());const prefix=await restored.restore(exported);
  assert.equal(prefix.rpcCalls,4);assert.equal(prefix.phase,'SEARCHING');assert.deepEqual(await restored.restore(exported),prefix);
  const next=await restored.step(f.transport,f.now);assert.equal(next.rpcCalls,5);await assert.rejects(restored.restore(exported),/PROSPECTIVE_RESTORE_CONFLICT/);
  const edited=structuredClone(exported) as any;const call=JSON.parse(edited.calls[0].json);call.request.method='eth_sendRawTransaction';edited.calls[0].json=canonicalJson(await sealCapture(call));
  const target=new ProspectiveJournal(workspace(t),true);t.after(()=>target.close());await assert.rejects(target.restore(edited));
});


test('a stable empty watched range advances once; the saved prefix audits offline without becoming a positive proof',async t=>{
  const path=workspace(t),f=fake({emptyLater:true}),store=new ProspectiveJournal(path,true);await store.register(await manifest());
  await store.step(f.transport,f.now);await store.step(f.transport,f.now);const watched=await store.step(f.transport,f.now);
  assert.equal(watched.phase,'WATCHING');assert.equal(watched.cursor,'125');assert.equal(watched.rpcCalls,22);assert.equal(watched.finding,null);assert.equal(watched.caseDiff,null);
  const data=raw(store);store.close();assert.deepEqual(await auditProspective(data.manifest,data.calls),watched);
  const reopened=new ProspectiveJournal(path);t.after(()=>reopened.close());const unchanged=await reopened.step(f.transport,f.now);assert.equal(unchanged.cursor,'125');assert.equal(unchanged.rpcCalls,23);
  const recorded=JSON.parse(readFileSync('test/fixtures/workforce/prospective/public-capture-prefix-v1.json','utf8'));
  const real=await auditProspective(JSON.parse(recorded.manifest.json),recorded.calls.map((row:{json:string})=>JSON.parse(row.json)));
  assert.equal(real.phase,'SEARCHING');assert.equal(real.rpcCalls,4);assert.equal(real.initialBlock,'81271131');assert.equal(real.handoff,null);assert.equal(real.finding,null);assert.equal(real.caseDiff,null);assert.equal(real.notification,null);
  assert.equal(real.authentication,'PROVIDER_REPORTED_LOCAL_CLOCK_NOT_EXTERNALLY_ATTESTED');
});
