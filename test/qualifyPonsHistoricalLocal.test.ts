import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {BUDGET_SCHEMA,TRIPWIRE_PROOF_BUDGET_SCHEMA} from '../src/portable/budget.js';
import {selectHistoricalLaunch,ownerForQualification,readHistoricalBudget,
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
 db.prepare('INSERT INTO pons_forward_watches_v1 VALUES(?,?)').run('telegram:321',HISTORICAL_DEPLOYER);
 return db;
}
test('historical source identity comes from stored launch and matching provenance',()=>{
 const db=cases();try{
  const known=selectHistoricalLaunch(db);
  assert.equal(known.blockNumber,HISTORICAL_BLOCK);
  assert.equal(known.transactionHash,'0x'+'22'.repeat(32));
  assert.equal(known.deployer,HISTORICAL_DEPLOYER);
  assert.equal(ownerForQualification(db),'telegram:321');
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
test('a missing or ambiguous owner never receives automatic grant authority',()=>{
 const db=cases();try{
  assert.equal(ownerForQualification(db,'telegram:123'),'telegram:123');
  assert.throws(()=>ownerForQualification(db,'local-owner'),/OWNER_SCOPE_INVALID/);
  db.prepare('INSERT INTO pons_forward_watches_v1 VALUES(?,?)').run('telegram:222',HISTORICAL_DEPLOYER);
  assert.throws(()=>ownerForQualification(db),/OWNER_NOT_PROVEN/);
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
