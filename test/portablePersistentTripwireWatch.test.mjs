import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { PersistentTripwireWatch, PERSISTENT_TRIPWIRE_SCHEMA } from '../src/portable/persistentTripwireWatch.ts';
const GEN='aaaabbbb-cccc-dddd-eeee-ffffffffffff';
const ADDRESS='0x'+'ab'.repeat(20);
const TOPIC='0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607';
function createFixture() {
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE pons_tripwire_watches(generation TEXT PRIMARY KEY,owner_id TEXT,deployer TEXT,start_block INTEGER,created_at_ms INTEGER,state TEXT)");
 db.exec(PERSISTENT_TRIPWIRE_SCHEMA);
 db.prepare('INSERT INTO pons_tripwire_watches VALUES(?,?,?,?,?,?)').run(GEN,'telegram:1234',ADDRESS,100,1000,'ACTIVE');
 const service=new PersistentTripwireWatch(db,()=>2000);
 service.arm({generation:GEN,ownerId:'telegram:1234',deployer:ADDRESS,startBlock:100,stopsAtMs:86_402_000,subscriptionId:'0x55ff',eventTopic:TOPIC,approved:true});
 return {db,service};
}
test('fresh opt-in records UNKNOWN coverage and refuses reuse',()=>{
 const {db,service}=createFixture();
 assert.deepEqual(service.status(GEN),{state:'CONNECTED',coverage:'UNKNOWN_COVERAGE',hints:0});
 assert.throws(()=>service.arm({generation:GEN,ownerId:'telegram:1234',deployer:ADDRESS,startBlock:100,stopsAtMs:5000,subscriptionId:'x',eventTopic:TOPIC,approved:true}),/SESSION_ALREADY_EXISTS/);
 service.recoverAfterRestart(true);
 assert.equal(service.status(GEN).state,'UNKNOWN');
 db.close();
});
