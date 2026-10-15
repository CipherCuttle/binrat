import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { encodeAbiParameters, toEventSelector, toHex } from 'viem';
import { BUDGET_SCHEMA, BudgetLedger, TRIPWIRE_STREAM_MILLI_CU } from '../src/portable/budget.js';
import { OfflinePersistentTripwireRunner } from '../src/portable/offlinePersistentTripwireRunner.js';
import { ponsTokenLaunchedEvent } from '../src/pons/ponsAbi.js';
import { forwardReceiptRoot } from '../src/portable/forwardReceiptRoot.js';

const GEN='aaaabbbb-cccc-dddd-eeee-ffffffffffff';
const OWNER='telegram:1234', DEPLOYER='0x'+'ab'.repeat(20);
const TOKEN='0x'+'01'.repeat(20), CURVE='0x'+'02'.repeat(20), PAIR='0x'+'03'.repeat(20);
const FACTORY='0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e';
const TOPIC=toEventSelector(ponsTokenLaunchedEvent).toLowerCase(),TX='0x'+'55'.repeat(32);
const HASH='0x'+'44'.repeat(32);
const word=(x:string)=>'0x'+x.slice(2).padStart(64,'0');
function setup(){
 let time=2000;
 const dir=mkdtempSync(join(tmpdir(),'tripwire-runner-')),path=join(dir,'ledger.db');
 const init=new Database(path);init.exec(BUDGET_SCHEMA);init.close();
 const ledger=new BudgetLedger(path,{attemptsPerRun:50,attemptsPerDay:100,
   blocksPerRun:1000,runtimeMs:60000,attemptsPerRequest:1},()=>time);
 ledger.createTripwireProofGrant({grantId:'grant-one',ownerId:OWNER,generation:GEN,
   deployer:DEPLOYER,stopsAtMs:86_402_000,maxMilliCu:10_000_000,approved:true});
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 db.exec('CREATE TABLE pons_tripwire_watches(generation TEXT PRIMARY KEY,owner_id TEXT,deployer TEXT,start_block INTEGER,created_at_ms INTEGER,state TEXT)');
 db.prepare('INSERT INTO pons_tripwire_watches VALUES(?,?,?,?,?,?)')
   .run(GEN,OWNER,DEPLOYER,100,1000,'ACTIVE');
 const runner=new OfflinePersistentTripwireRunner({db:db as any,ledger,now:()=>time,offlineFixtureOnly:true});
 const grant={generation:GEN,ownerId:OWNER,deployer:DEPLOYER,startBlock:100,
    grantId:'grant-one',stopsAtMs:86_402_000,subscriptionId:'subscription1'};
 const job=ledger.start(101n);
 const admit=()=>runner.start(grant,{job,deadline:50000,exclusiveWriter:true});
 const log={address:FACTORY,topics:[TOPIC,word(TOKEN),word(CURVE),word(DEPLOYER)],
   blockNumber:'0x65',blockHash:HASH,transactionHash:TX,transactionIndex:'0x0',
   logIndex:'0x0',removed:false,
   data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[PAIR,1n,100n])};
 const frame=(changes={})=>({jsonrpc:'2.0',method:'eth_subscription',params:{
   subscription:'subscription1',result:{...log,...changes}
 }});
 const receipt={blockHash:HASH,blockNumber:'0x65',transactionHash:TX,transactionIndex:'0x0',
   status:'0x1',type:'0x0',cumulativeGasUsed:'0x5208',gasUsed:'0x5208',
   logsBloom:'0x'+'00'.repeat(256),logs:[log]};
 const root=forwardReceiptRoot([receipt] as any);
 const block=(number:number,hash=HASH,transactions=[TX])=>({number:toHex(number),
   hash,receiptsRoot:root,transactions});
 const calls:string[]=[];
 const result=[block(104,'0x'+'88'.repeat(32)),block(103,'0x'+'77'.repeat(32)),
   block(101),[log],[receipt],block(101)];
 const methods=['eth_getBlockByNumber','eth_getBlockByNumber','eth_getBlockByNumber',
   'eth_getLogs','eth_getBlockReceipts','eth_getBlockByNumber'];
 const wire={mode:'OFFLINE_FIXTURE_ONLY' as const,live:false as const,
   async request(method:string,params:unknown[]){
     assert.ok(calls.length<6);
     assert.equal(method,methods[calls.length]);
     calls.push(method);return result[calls.length-1];
   }};
 const prove=()=>runner.proveNext({job:ledger.start(101n),deadline:50000,wire,exclusiveWriter:true});
 const debits=()=>ledger['db'].prepare('SELECT count(*) n FROM rpc_attempts').get() as {n:number};
 const spent=()=>ledger['db'].prepare('SELECT reserved_milli_cu v FROM tripwire_proof_grants_v1').get() as {v:number};
 const bytes=()=>ledger['db'].prepare('SELECT received_bytes n,state FROM tripwire_stream_reservations_v1').get() as {n:number;state:string};
 const finish=()=>{db.close();ledger.close();rmSync(dir,{recursive:true,force:true});};
 return {db,ledger,runner,grant,job,frame,wire,admit,prove,calls,debits,spent,bytes,finish,setTime:(t:number)=>time=t};
}
test('one offline Watch reserves an 11-slot/3809.12-CU 24-hour stream envelope',()=>{
 const f=setup();
 try{
   f.admit();
   assert.equal(f.debits().n,11);
   assert.equal(f.spent().v,TRIPWIRE_STREAM_MILLI_CU);
   assert.deepEqual(f.runner.status(GEN),{state:'CONNECTED',coverage:'UNKNOWN_COVERAGE',hints:0});
   assert.throws(f.admit,/RUNNER_UNAVAILABLE/);
 }finally{f.finish();}
});
test('two duplicate frames consume bytes but create one pending hint',()=>{
 const f=setup();
 try{
   f.admit();
   assert.equal(f.runner.receive(f.frame()),'QUEUED');
   assert.equal(f.runner.receive(f.frame()),'DUPLICATE');
   assert.equal(f.runner.status(GEN)?.hints,1);
   assert.ok(f.bytes().n>0);
   assert.equal(f.debits().n,11);
 }finally{f.finish();}
});
test('offline end to end: hint becomes six-read, durably PROVEN receipt with 17 shared slots',async()=>{
 const f=setup();
 try{
   f.admit();
   assert.equal(f.runner.receive(f.frame()),'QUEUED');
   const proof=await f.prove();
   assert.equal(proof?.blockHash,HASH);
   assert.equal(proof?.deployer,DEPLOYER);
   assert.equal(f.calls.length,6);
   assert.equal(f.debits().n,17);
   assert.equal(f.spent().v,TRIPWIRE_STREAM_MILLI_CU+400000);
   assert.equal(f.db.prepare('SELECT state FROM persistent_tripwire_hints_v1').get().state,'PROVEN');
   assert.equal(f.db.prepare('SELECT count(*) n FROM persistent_tripwire_proofs_v1').get().n,1);
   assert.equal(await f.prove(),null);
 }finally{f.finish();}
});
test('a deleted event quarantines the runner and no further hint is admitted',()=>{
 const f=setup();
 try{
   f.admit();
   assert.equal(f.runner.receive(f.frame({removed:true})),'REORG_UNKNOWN');
   assert.equal(f.runner.status(GEN)?.state,'UNKNOWN');
   assert.throws(()=>f.runner.receive(f.frame()),/RUNNER_INACTIVE/);
 }finally{f.finish();}
});
test('oversized inbound frame stops runner and marks UNKNOWN coverage',()=>{
 const f=setup();
 try{
   f.admit();
   assert.throws(()=>f.runner.receive({...f.frame(),padding:'x'.repeat(9000)}),/RUNNER_FRAME_REJECTED/);
   assert.equal(f.runner.status(GEN)?.state,'UNKNOWN');
   assert.equal(f.bytes().state,'STOPPED');
 }finally{f.finish();}
});
test('restart cannot renew grant; saved hints retain unknown coverage',()=>{
 const f=setup();
 try{
   f.admit();f.runner.receive(f.frame());
   f.runner.stop(false);
   const recovered=new OfflinePersistentTripwireRunner({db:f.db as any,ledger:f.ledger,
     offlineFixtureOnly:true,now:()=>2000});
   recovered.recover(true,'grant-one');
   assert.equal(recovered.status(GEN)?.state,'UNKNOWN');
   assert.equal(recovered.status(GEN)?.hints,1);
   assert.throws(()=>recovered.start(f.grant,{job:f.job,deadline:50000,exclusiveWriter:true}));
 }finally{f.finish();}
});
test('99 prior global debits deny stream admission before any hints or transport',()=>{
 const f=setup();
 try{
   const sql=f.ledger['db'];
   sql.transaction(()=>{
     for(let i=0;i<99;i++)
       sql.prepare('INSERT INTO rpc_attempts(job_id,day,method,reserved_at_ms) VALUES(?,?,?,?)')
         .run(f.job,'1970-01-01','prior',2000);
   })();
   assert.throws(f.admit,/RPC_BUDGET_EXHAUSTED/);
   assert.equal(f.debits().n,99);
   assert.equal(f.spent().v,0);
 }finally{f.finish();}
});
test('fake-only proof cannot accept a live wire, even after event intake',async()=>{
 const f=setup();
 try{
   f.admit();f.runner.receive(f.frame());
   await assert.rejects(f.runner.proveNext({job:f.ledger.start(101n),deadline:50000,
     wire:{...f.wire,live:true} as any,exclusiveWriter:true}),/NOT_OFFLINE/);
   assert.equal(f.debits().n,11);
 }finally{f.finish();}
});
test('expiry stops frame acceptance; no periodic HTTP audit is scheduled',()=>{
 const f=setup();
 try{
   f.admit();f.setTime(86_402_001);
   assert.throws(()=>f.runner.receive(f.frame()),/RUNNER_INACTIVE/);
   assert.equal(f.runner.status(GEN)?.state,'UNKNOWN');
   assert.equal(f.debits().n,11);
 }finally{f.finish();}
});
