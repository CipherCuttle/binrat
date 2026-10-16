import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BUDGET_SCHEMA,TRIPWIRE_PROOF_BUDGET_SCHEMA,BudgetLedger,
  HISTORICAL_SOURCE_PRINCIPAL,HISTORICAL_SOURCE_GRANT_ID} from '../src/portable/budget.js';
import {selectHistoricalLaunch,historicalQualificationPrincipal,readHistoricalBudget,
  HISTORICAL_BLOCK,HISTORICAL_DEPLOYER} from '../scripts/qualifyPonsHistoricalLocal.js';
import {PONS_V2_FACTORY} from '../src/pons/chain.js';

function cases(){
 const db=new Database(':memory:');
 db.exec(`CREATE TABLE launches (
  launch_id TEXT,chain_id INTEGER,source TEXT,launcher TEXT,creator TEXT,
  block_number TEXT,block_hash TEXT,tx_hash TEXT,log_index INTEGER,event_id TEXT);
  CREATE TABLE provenance_facts (
  chain_id INTEGER,launch_id TEXT,source_event_id TEXT,
  observed_block TEXT,observed_block_hash TEXT,log_index INTEGER,creator TEXT);
  CREATE TABLE pons_forward_watches_v1 (owner_id TEXT,deployer TEXT);`);
 const hash='0x'+'11'.repeat(32),tx='0x'+'22'.repeat(32),event='abc';
 db.prepare('INSERT INTO launches VALUES(?,?,?,?,?,?,?,?,?,?)').run('launch',4663,
  'PONS_V2',PONS_V2_FACTORY,HISTORICAL_DEPLOYER,String(HISTORICAL_BLOCK),hash,tx,0,event);
 db.prepare('INSERT INTO provenance_facts VALUES(?,?,?,?,?,?,?)').run(4663,'launch',event,
  String(HISTORICAL_BLOCK),hash,0,HISTORICAL_DEPLOYER);
 return db;
}
test('historical source identity comes from stored launch and matching provenance',()=>{
 const db=cases();try{
  const known=selectHistoricalLaunch(db);
  assert.equal(known.blockNumber,HISTORICAL_BLOCK);
  assert.equal(known.transactionHash,'0x'+'22'.repeat(32));
  assert.equal(known.deployer,HISTORICAL_DEPLOYER);
  assert.equal(historicalQualificationPrincipal(),HISTORICAL_SOURCE_PRINCIPAL);
 }finally{db.close()}
});
test('tampered provenance, duplicate or absent canary fail before network',()=>{
 const db=cases();try{
  db.prepare("UPDATE provenance_facts SET observed_block_hash=?").run('0x'+'ff'.repeat(32));
  assert.throws(()=>selectHistoricalLaunch(db),/PROVENANCE_MISMATCH/);
  db.prepare("DELETE FROM provenance_facts").run();
  assert.throws(()=>selectHistoricalLaunch(db),/ABSENT/);
 }finally{db.close()}
});
test('historical evidence needs no existing Watch and cannot impersonate Telegram owner',()=>{
 const db=cases();try{
  assert.equal(selectHistoricalLaunch(db).deployer,HISTORICAL_DEPLOYER);
  assert.equal(historicalQualificationPrincipal(),HISTORICAL_SOURCE_PRINCIPAL);
  assert.throws(()=>historicalQualificationPrincipal('telegram:123'),/OWNER_OVERRIDE_DENIED/);
  db.prepare('INSERT INTO pons_forward_watches_v1 VALUES(?,?)').run('telegram:222',HISTORICAL_DEPLOYER);
  assert.equal(historicalQualificationPrincipal(),HISTORICAL_SOURCE_PRINCIPAL);
 }finally{db.close()}
});
test('read-only daily ledger reconciliation includes prior diagnostics without resets',()=>{
 const db=new Database(':memory:');try{
  db.exec(BUDGET_SCHEMA);
  db.prepare("INSERT INTO collector_jobs(job_id,start_block,state,started_at_ms) VALUES(?,?,?,?)")
    .run('previous','0','FAILED',0);
  const add=db.prepare('INSERT INTO rpc_attempts(job_id,day,method,reserved_at_ms) VALUES(?,?,?,?)');
  for(let i=0;i<13;i++)add.run('previous','1970-01-01','prior',0);
  const status=readHistoricalBudget(db,2_000);
  assert.deepEqual(status,{day:'1970-01-01',used:13,after:21});
  for(let i=0;i<80;i++)add.run('previous','1970-01-01','prior',0);
  assert.throws(()=>readHistoricalBudget(db,2_000),/100_REQUEST_GATE/);
  assert.equal(db.prepare('SELECT count(*) n FROM rpc_attempts').get().n,93);
 }finally{db.close()}
});
test('an existing grant fences replay without changing the original ledger',()=>{
 const db=new Database(':memory:');try{
  db.exec(BUDGET_SCHEMA);
  db.exec(TRIPWIRE_PROOF_BUDGET_SCHEMA);
  db.prepare('INSERT INTO tripwire_proof_grants_v1 (grant_id,owner_id,generation,deployer,created_at_ms,stops_at_ms,max_milli_cu) VALUES(?,?,?,?,?,?,?)')
    .run('historical-pons-orbbook-20261015-v1','telegram:321','aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      HISTORICAL_DEPLOYER,0,60000,800000);
  assert.throws(()=>readHistoricalBudget(db,2_000),/GRANT_ALREADY_CREATED/);
 }finally{db.close()}
});

test('historical-only grant reserves eight shared slots but cannot authorize Watch or proof',()=>{
 const dir=mkdtempSync(join(tmpdir(),'historical-source-budget-'));
 const path=join(dir,'budget.sqlite');
 const init=new Database(path);
 init.exec(BUDGET_SCHEMA);
 init.close();
 const ledger=new BudgetLedger(path,{attemptsPerDay:100,attemptsPerRun:50,
   blocksPerRun:1000,runtimeMs:60000,attemptsPerRequest:1},()=>2000);
 const generation='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 const scope={ownerId:HISTORICAL_SOURCE_PRINCIPAL,generation,deployer:HISTORICAL_DEPLOYER};
 try{
   const job=ledger.start(BigInt(HISTORICAL_BLOCK));
   ledger.createHistoricalQualificationGrant({grantId:HISTORICAL_SOURCE_GRANT_ID,
     generation,deployer:HISTORICAL_DEPLOYER,stopsAtMs:60_000,
     maxMilliCu:800_000,approved:true});
   assert.throws(()=>ledger.createHistoricalQualificationGrant({
     grantId:HISTORICAL_SOURCE_GRANT_ID,generation,deployer:HISTORICAL_DEPLOYER,
     stopsAtMs:60_000,maxMilliCu:800_000,approved:true
   }),/UNIQUE/);
   assert.throws(()=>ledger.reserveTripwireStream(job,HISTORICAL_SOURCE_GRANT_ID,50_000,scope),
     /WATCH_OWNER_REQUIRED/);
   assert.throws(()=>ledger.reserveTripwireProof(job,HISTORICAL_SOURCE_GRANT_ID,50_000,scope),
     /WATCH_OWNER_REQUIRED/);
   ledger.reserveTripwireQualification(job,HISTORICAL_SOURCE_GRANT_ID,50_000,scope,
     {blockNumber:HISTORICAL_BLOCK,transactionHash:'0x'+'22'.repeat(32),logIndex:0});
   assert.equal(ledger['db'].prepare('SELECT count(*) n FROM rpc_attempts').get().n,8);
   assert.equal(ledger['db'].prepare('SELECT reserved_milli_cu n FROM tripwire_proof_grants_v1').get().n,800_000);
   assert.equal(ledger['db'].prepare('SELECT status FROM tripwire_source_qualifications_v1').get().status,'RESERVED');
 }finally{ledger.close();rmSync(dir,{recursive:true,force:true})}
});
