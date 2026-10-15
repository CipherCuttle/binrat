import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { encodeAbiParameters, toEventSelector, toHex } from 'viem';
import Database from 'better-sqlite3';
import { BUDGET_SCHEMA, BudgetLedger } from '../src/portable/budget.js';
import { PERSISTENT_TRIPWIRE_SCHEMA, PersistentTripwireWatch } from '../src/portable/persistentTripwireWatch.js';
import { PERSISTENT_TRIPWIRE_PROOF_SCHEMA, proveQueuedTripwireHint } from '../src/portable/persistentTripwireProof.js';
import { ponsTokenLaunchedEvent } from '../src/pons/ponsAbi.js';
import { forwardReceiptRoot } from '../src/portable/forwardReceiptRoot.js';

const GEN='aaaabbbb-cccc-dddd-eeee-ffffffffffff', DEPLOYER='0x'+'ab'.repeat(20);
const TOKEN='0x'+'01'.repeat(20), CURVE='0x'+'02'.repeat(20), PAIR='0x'+'03'.repeat(20);
const FACTORY='0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e';
const HASH='0x'+'44'.repeat(32),TX='0x'+'55'.repeat(32),LAST='0x'+'66'.repeat(32);
const SELECTOR=toEventSelector(ponsTokenLaunchedEvent).toLowerCase();
const word=(address:string)=>'0x'+address.slice(2).padStart(64,'0');
const MS=2000;
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'tripwire-proof-')), ledgerPath=join(dir,'ledger.db');
 const initLedger=new Database(ledgerPath);initLedger.exec(BUDGET_SCHEMA);initLedger.close();
 const limits={attemptsPerDay:100,attemptsPerRun:50,blocksPerRun:1000,runtimeMs:60000,attemptsPerRequest:1};
 const ledger=new BudgetLedger(ledgerPath,limits,()=>MS);
 ledger.createTripwireProofGrant({grantId:'demo-grant',ownerId:'telegram:1234',generation:GEN,deployer:DEPLOYER,
   stopsAtMs:86_402_000,maxMilliCu:10_000_000,approved:true});
 const job=ledger.start(101n);
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 db.exec('CREATE TABLE pons_tripwire_watches(generation TEXT PRIMARY KEY,owner_id TEXT,deployer TEXT,start_block INTEGER,created_at_ms INTEGER,state TEXT)');
 db.exec(PERSISTENT_TRIPWIRE_SCHEMA);
 db.prepare('INSERT INTO pons_tripwire_watches VALUES(?,?,?,?,?,?)').run(GEN,'telegram:1234',DEPLOYER,100,1000,'ACTIVE');
 const intake=new PersistentTripwireWatch(db as any,()=>MS);
 intake.arm({generation:GEN,ownerId:'telegram:1234',deployer:DEPLOYER,startBlock:100,
  stopsAtMs:86_402_000,subscriptionId:'sub1',eventTopic:SELECTOR,approved:true});
 const topics=[SELECTOR,word(TOKEN),word(CURVE),word(DEPLOYER)];
 const data=encodeAbiParameters([
   {type:'address'},{type:'uint256'},{type:'uint256'}],[PAIR,1n,100n]);
 const log={address:FACTORY,topics,data,blockNumber:toHex(101),blockHash:HASH,
    transactionHash:TX,transactionIndex:'0x0',logIndex:'0x0',removed:false};
 const frame={jsonrpc:'2.0',method:'eth_subscription',params:{subscription:'sub1',result:log}};
 assert.equal(intake.ingest(GEN,frame),'QUEUED');
 const receipt={blockHash:HASH,blockNumber:toHex(101),transactionHash:TX,transactionIndex:'0x0',
   status:'0x1',type:'0x0',cumulativeGasUsed:'0x5208',gasUsed:'0x5208',
   logsBloom:'0x'+'00'.repeat(256),logs:[log]};
 const receipts=[receipt];
 const root=forwardReceiptRoot(receipts as any);
 const block=(number:number,hash=HASH,receiptsRoot=root,transactions=[TX])=>({
   number:toHex(number),hash,receiptsRoot,transactions});
 const methods=['eth_getBlockByNumber','eth_getBlockByNumber','eth_getBlockByNumber','eth_getLogs',
   'eth_getBlockReceipts','eth_getBlockByNumber'];
 const responses=[block(104,LAST),block(103,'0x'+'77'.repeat(32)),block(101),[log],receipts,block(101)];
 let calls=0;
 const wire={request:async(method:string,params:unknown[])=>{
   assert.equal(method,methods[calls]);
   assert.ok(calls<6);
   assert.ok(Array.isArray(params));
   return responses[calls++];
 }};
 const options={db:db as any,ledger,job,grantId:'demo-grant',deadline:50000,generation:GEN,wire,now:()=>MS};
 const cleanup=()=>{db.close();ledger.close();rmSync(dir,{recursive:true,force:true});};
 return {db,ledger,ledgerPath,job,intake,frame,log,receipt,root,responses,wire,options,calls:()=>calls,cleanup};
}
test('a genuine synthetic matching event earns a durable positive proof after exactly six reserved reads',async()=>{
 const f=fixture();
 try{
   const proof=await proveQueuedTripwireHint(f.options);
   assert.equal(proof?.chainId,4663);
   assert.equal(proof?.deployer,DEPLOYER);
   assert.equal(proof?.blockHash,HASH);
   assert.equal(proof?.receiptsRoot,f.root);
   assert.equal(f.calls(),6);
   assert.equal(f.db.prepare("SELECT state FROM persistent_tripwire_hints_v1").get().state,'PROVEN');
   const stored=f.db.prepare("SELECT proof_digest,proof_json FROM persistent_tripwire_proofs_v1").get() as any;
   assert.ok(/^[0-9a-f]{64}$/.test(stored.proof_digest));
   assert.equal(JSON.parse(stored.proof_json).launchId,proof?.launchId);
   const used=f.ledger['db'].prepare('SELECT count(*) n FROM rpc_attempts WHERE job_id=?').get(f.job) as any;
   assert.equal(used.n,6);
 }finally{f.cleanup();}
});
test('a wrong receipts root burns reserved allowance and never persists a proof',async()=>{
 const f=fixture();
 try{
   f.responses[2]={...(f.responses[2] as object),receiptsRoot:'0x'+'99'.repeat(32)};
   f.responses[5]=f.responses[2];
   await assert.rejects(proveQueuedTripwireHint(f.options),/TRIPWIRE_PROOF_UNVERIFIED/);
   assert.ok(f.calls()<=6);
   assert.equal(f.db.prepare("SELECT state FROM persistent_tripwire_hints_v1").get().state,'UNKNOWN');
   assert.equal(f.db.prepare('SELECT count(*) n FROM persistent_tripwire_proofs_v1').get().n,0);
   assert.equal(f.ledger['db'].prepare('SELECT count(*) n FROM rpc_attempts WHERE job_id=?').get(f.job).n,6);
 }finally{f.cleanup();}
});
test('finality below candidate blocks before event proof reads',async()=>{
 const f=fixture();
 try{
   f.responses[1]={...(f.responses[1] as object),number:toHex(100)};
   await assert.rejects(proveQueuedTripwireHint(f.options),/TRIPWIRE_PROOF_UNVERIFIED/);
   assert.equal(f.calls(),2);
 }finally{f.cleanup();}
});
test('wrong getLogs set is rejected against cryptographic receipts root',async()=>{
 const f=fixture();
 try{
   f.responses[3]=[];
   await assert.rejects(proveQueuedTripwireHint(f.options),/TRIPWIRE_PROOF_UNVERIFIED/);
   assert.equal(f.calls(),5);
 }finally{f.cleanup();}
});
test('reorg at terminal header check invalidates proof',async()=>{
 const f=fixture();
 try{
   f.responses[5]={...(f.responses[5] as object),hash:'0x'+'99'.repeat(32)};
   await assert.rejects(proveQueuedTripwireHint(f.options),/TRIPWIRE_PROOF_UNVERIFIED/);
   assert.equal(f.calls(),6);
 }finally{f.cleanup();}
});
test('at 99/100 global debit, no provider request can occur',async()=>{
 const f=fixture();
 try{
   f.ledger['db'].transaction(()=>{
     for(let i=0;i<99;i++)
       f.ledger['db'].prepare("INSERT INTO rpc_attempts(job_id,day,method,reserved_at_ms) VALUES(?,?,?,?)")
         .run(f.job,'1970-01-01','prior-diagnostic',MS);
   })();
   await assert.rejects(proveQueuedTripwireHint(f.options),/TRIPWIRE_PROOF_UNVERIFIED/);
   assert.equal(f.calls(),0);
   assert.equal(f.ledger['db'].prepare('SELECT count(*) n FROM rpc_attempts').get().n,99);
 }finally{f.cleanup();}
});
test('a grant of less than 400 CU refuses proof without IO',async()=>{
 const f=fixture();
 try{
   f.ledger['db'].prepare('UPDATE tripwire_proof_grants_v1 SET max_milli_cu=399999').run();
   await assert.rejects(proveQueuedTripwireHint(f.options),/TRIPWIRE_PROOF_UNVERIFIED/);
   assert.equal(f.calls(),0);
 }finally{f.cleanup();}
});
test('owner cancellation during proof never admits durable evidence',async()=>{
 const f=fixture();
 try{
   const original=f.wire.request;
   f.wire.request=async(m,p)=>{const result=await original(m,p); if(f.calls()===5) f.db.prepare("UPDATE pons_tripwire_watches SET state='CANCELLED'").run();return result;};
   await assert.rejects(proveQueuedTripwireHint(f.options),/TRIPWIRE_PROOF_UNVERIFIED/);
   assert.equal(f.db.prepare('SELECT count(*) n FROM persistent_tripwire_proofs_v1').get().n,0);
 }finally{f.cleanup();}
});
