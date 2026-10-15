import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { encodeAbiParameters, keccak256, toEventSelector, toHex } from 'viem';
import { BUDGET_SCHEMA, BudgetLedger } from '../src/portable/budget.js';
import { qualifyHistoricalPonsLaunch } from '../src/portable/tripwireSourceQualification.js';
import { ponsTokenLaunchedEvent } from '../src/pons/ponsAbi.js';
import { forwardReceiptRoot } from '../src/portable/forwardReceiptRoot.js';

const GEN='aaaabbbb-cccc-dddd-eeee-ffffffffffff',OWNER='telegram:1234';
const DEPLOYER='0x'+'ab'.repeat(20);
const TOKEN='0x'+'01'.repeat(20),CURVE='0x'+'02'.repeat(20),PAIR='0x'+'03'.repeat(20);
const FACTORY='0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e';
const HASH='0x'+'44'.repeat(32),TX='0x'+'55'.repeat(32);
const TOPIC=toEventSelector(ponsTokenLaunchedEvent).toLowerCase();
const word=(v:string)=>'0x'+v.slice(2).padStart(64,'0');
function fixture(){
 let now=2000;
 const dir=mkdtempSync(join(tmpdir(),'pons-source-')),path=join(dir,'ledger.db');
 const initial=new Database(path);initial.exec(BUDGET_SCHEMA);initial.close();
 const ledger=new BudgetLedger(path,{attemptsPerDay:100,attemptsPerRun:50,blocksPerRun:1000,
   runtimeMs:60000,attemptsPerRequest:1},()=>now);
 ledger.createTripwireProofGrant({grantId:'historical-grant',ownerId:OWNER,generation:GEN,deployer:DEPLOYER,
    stopsAtMs:86_402_000,maxMilliCu:10_000_000,approved:true});
 const job=ledger.start(101n);
 const code='0x6001600055';
 const log={address:FACTORY,topics:[TOPIC,word(TOKEN),word(CURVE),word(DEPLOYER)],
   blockNumber:'0x65',blockHash:HASH,transactionHash:TX,transactionIndex:'0x0',
   logIndex:'0x0',removed:false,
   data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[PAIR,1n,100n])};
 const receipt={blockHash:HASH,blockNumber:'0x65',transactionHash:TX,transactionIndex:'0x0',
    status:'0x1',type:'0x0',cumulativeGasUsed:'0x5208',gasUsed:'0x5208',
    logsBloom:'0x'+'00'.repeat(256),logs:[log]};
 const root=forwardReceiptRoot([receipt] as any);
 const block=(n:number,hash=HASH)=>({number:toHex(n),hash,receiptsRoot:root,transactions:[TX]});
 const responses=['0x1237',code,block(104,'0x'+'66'.repeat(32)),
   block(103,'0x'+'77'.repeat(32)),block(101),[log],[receipt],block(101)];
 const methods=['eth_chainId','eth_getCode','eth_getBlockByNumber','eth_getBlockByNumber',
   'eth_getBlockByNumber','eth_getLogs','eth_getBlockReceipts','eth_getBlockByNumber'];
 const calls:string[]=[];
 const wire={mode:'OFFLINE_FIXTURE_ONLY' as const,
    async request(method:string,params:unknown[],signal:AbortSignal){
      assert.equal(signal.aborted,false);
      assert.ok(Array.isArray(params));
      assert.equal(method,methods[calls.length]);
      calls.push(method);return responses[calls.length-1];
    }};
 const known={blockNumber:101,blockHash:HASH,transactionHash:TX,logIndex:0,deployer:DEPLOYER};
 const args={ledger,job,grantId:'historical-grant',deadlineMs:50000,
   scope:{ownerId:OWNER,generation:GEN,deployer:DEPLOYER},
   known,wire,offlineExpectedCodeHash:keccak256(code),now:()=>now};
 const db=ledger['db'];
 const debits=()=>db.prepare('SELECT count(*) n FROM rpc_attempts').get().n as number;
 const reservation=()=>db.prepare('SELECT status,result_digest FROM tripwire_source_qualifications_v1').get() as any;
 const cleanup=()=>{ledger.close();rmSync(dir,{recursive:true,force:true});};
 return {args,ledger,db,calls,responses,log,receipt,root,known,debits,reservation,cleanup,
   time:(v:number)=>{now=v}};
}
test('synthetic Pons launch matches pinned fixture code, full receipt trie and eight reserved calls',async()=>{
 const f=fixture();try{
   const result=await qualifyHistoricalPonsLaunch(f.args);
   assert.equal(result.chainId,4663);
   assert.equal(result.blockHash,HASH);
   assert.equal(result.deployer,DEPLOYER);
   assert.equal(result.coverage,'HISTORICAL_POSITIVE_ONLY');
   assert.equal(result.sourceAuthority,'OFFLINE_SIMULATED');
   assert.equal(result.receiptsRoot,f.root);
   assert.equal(f.calls.length,8);
   assert.equal(f.debits(),8);
   assert.equal(f.reservation().status,'QUALIFIED');
   assert.match(f.reservation().result_digest,/^[0-9a-f]{64}$/);
 }finally{f.cleanup();}
});
test('historical qualification reservation cannot be replayed with new attempt IDs',async()=>{
 const f=fixture();try{
   await qualifyHistoricalPonsLaunch(f.args);
   await assert.rejects(qualifyHistoricalPonsLaunch(f.args));
   assert.equal(f.calls.length,8);
   assert.equal(f.debits(),8);
 }finally{f.cleanup();}
});
test('wrong Robinhood chain ID stops after one request but burns all eight reserved slots',async()=>{
 const f=fixture();try{
   f.responses[0]='0x1';
   await assert.rejects(qualifyHistoricalPonsLaunch(f.args),/QUALIFICATION_UNVERIFIED/);
   assert.equal(f.calls.length,1);
   assert.equal(f.debits(),8);
   assert.equal(f.reservation().status,'UNKNOWN');
 }finally{f.cleanup();}
});
test('provider bytecode hash drift fails before checking block or receipts',async()=>{
 const f=fixture();try{
   f.responses[1]='0xdeadbeef';
   await assert.rejects(qualifyHistoricalPonsLaunch(f.args),/QUALIFICATION_UNVERIFIED/);
   assert.equal(f.calls.length,2);
 }finally{f.cleanup();}
});
test('simulated bytecode override cannot claim a real provider source',async()=>{
 const f=fixture();try{
   const realWire={...f.args.wire,mode:'EXPLICIT_READONLY_PROVIDER' as const};
   await assert.rejects(qualifyHistoricalPonsLaunch({...f.args,wire:realWire}),/TEST_OVERRIDE_DENIED/);
   assert.equal(f.calls.length,0);
   assert.equal(f.debits(),0);
 }finally{f.cleanup();}
});
test('unsupported finalized tag fails before a known event is decoded',async()=>{
 const f=fixture();try{
   f.responses[3]=null;
   await assert.rejects(qualifyHistoricalPonsLaunch(f.args),/QUALIFICATION_UNVERIFIED/);
   assert.equal(f.calls.length,4);
 }finally{f.cleanup();}
});
test('event missing from eth_getLogs cannot be interpreted as absence or verified positive',async()=>{
 const f=fixture();try{
   f.responses[5]=[];
   await assert.rejects(qualifyHistoricalPonsLaunch(f.args),/QUALIFICATION_UNVERIFIED/);
   assert.equal(f.reservation().status,'UNKNOWN');
 }finally{f.cleanup();}
});
test('receipt root mismatch rejects provider result',async()=>{
 const f=fixture();try{
   f.responses[4]={...(f.responses[4] as object),receiptsRoot:'0x'+'99'.repeat(32)};
   await assert.rejects(qualifyHistoricalPonsLaunch(f.args),/QUALIFICATION_UNVERIFIED/);
   assert.equal(f.calls.length,7);
 }finally{f.cleanup();}
});
test('reorg across final header recheck cannot earn qualification',async()=>{
 const f=fixture();try{
   f.responses[7]={...(f.responses[7] as object),hash:'0x'+'99'.repeat(32)};
   await assert.rejects(qualifyHistoricalPonsLaunch(f.args),/QUALIFICATION_UNVERIFIED/);
   assert.equal(f.calls.length,8);
 }finally{f.cleanup();}
});
test('99 previously reserved RPC requests block qualification before any IO',async()=>{
 const f=fixture();try{
   f.db.transaction(()=>{
     for(let i=0;i<99;i++)f.db.prepare('INSERT INTO rpc_attempts(job_id,day,method,reserved_at_ms) VALUES(?,?,?,?)')
       .run(f.args.job,'1970-01-01','previous-diagnostics',2000);
   })();
   await assert.rejects(qualifyHistoricalPonsLaunch(f.args));
   assert.equal(f.debits(),99);
   assert.equal(f.calls.length,0);
 }finally{f.cleanup();}
});
test('grant less than 800 modeled CU blocks before IO',async()=>{
 const f=fixture();try{
   f.db.prepare('UPDATE tripwire_proof_grants_v1 SET max_milli_cu=799999').run();
   await assert.rejects(qualifyHistoricalPonsLaunch(f.args));
   assert.equal(f.debits(),0);
   assert.equal(f.calls.length,0);
 }finally{f.cleanup();}
});
test('overlong runtime deadline cannot bypass existing 60-second job',async()=>{
 const f=fixture();try{
   await assert.rejects(qualifyHistoricalPonsLaunch({...f.args,deadlineMs:999999}));
   assert.equal(f.debits(),0);assert.equal(f.calls.length,0);
 }finally{f.cleanup();}
});
