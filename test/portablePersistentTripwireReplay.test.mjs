import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { PersistentTripwireWatch as Watch, PERSISTENT_TRIPWIRE_SCHEMA as SCHEMA } from '../src/portable/persistentTripwireWatch.ts';
const g='aaaabbbb-cccc-dddd-eeee-ffffffffffff',d='0x'+'ab'.repeat(20),t='0x'+'11'.repeat(32),o='0x'+'22'.repeat(32);
function setup() {
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE pons_tripwire_watches(generation TEXT PRIMARY KEY,owner_id TEXT,deployer TEXT,start_block INTEGER,created_at_ms INTEGER,state TEXT)");
 db.exec(SCHEMA);
 db.prepare('INSERT INTO pons_tripwire_watches VALUES(?,?,?,?,?,?)').run(g,'telegram:1234',d,100,1000,'ACTIVE');
 const w=new Watch(db,()=>2000);
 w.arm({generation:g,ownerId:'telegram:1234',deployer:d,startBlock:100,stopsAtMs:86_402_000,subscriptionId:'0x55ff',eventTopic:t,approved:true});
 const log={address:'0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e',topics:[t,o,o,'0x'+d.slice(2).padStart(64,'0')],
 blockNumber:'0x65',blockHash:'0x'+'33'.repeat(32),transactionHash:'0x'+'44'.repeat(32),logIndex:'0x0',data:'0x',removed:false};
 const frame=(patch={})=>({jsonrpc:'2.0',method:'eth_subscription',params:{subscription:'0x55ff',result:{...log,...patch}}});
 return {db,w,frame};
}
test('only exact selected deployer hints are queued; duplicates are idempotent',()=>{
 const {db,w,frame}=setup();
 assert.equal(w.ingest(g,frame()),'QUEUED');
 assert.equal(w.ingest(g,frame()),'DUPLICATE');
 assert.equal(w.pending(g).length,1);
 assert.throws(()=>w.ingest(g,frame({topics:[t,o,o,o]})),/SCOPE_INVALID/);
 assert.equal(w.status(g).coverage,'UNKNOWN_COVERAGE');
 db.close();
});
test('historic and removed event hints cannot produce positive eligibility',()=>{
 const {db,w,frame}=setup();
 assert.equal(w.ingest(g,frame({blockNumber:'0x64'})),'HISTORICAL_IGNORED');
 assert.equal(w.ingest(g,frame({removed:true})),'REORG_UNKNOWN');
 assert.equal(w.pending(g).length,0);
 assert.equal(w.status(g).state,'UNKNOWN');
 db.close();
});
test('conflicting block hashes quarantine pending evidence',()=>{
 const {db,w,frame}=setup();
 w.ingest(g,frame());
 assert.equal(w.ingest(g,frame({blockHash:'0x'+'55'.repeat(32)})),'CONFLICT_UNKNOWN');
 assert.equal(w.pending(g).length,0);
 db.close();
});
test('owner cancellation blocks even a matching subscribed event',()=>{
 const {db,w,frame}=setup();
 db.prepare("UPDATE pons_tripwire_watches SET state='CANCELLED'").run();
 assert.throws(()=>w.ingest(g,frame()),/SESSION_INACTIVE/);
 db.close();
});
test('unbounded frame is rejected without storage side effects',()=>{
 const {db,w,frame}=setup();
 assert.throws(()=>w.ingest(g,{...frame(),padding:'x'.repeat(9000)}),/HINT_INVALID/);
 assert.equal(w.status(g).hints,0);
 db.close();
});
