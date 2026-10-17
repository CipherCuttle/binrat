import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore Repo pins @types/node 20, which omits Node 22's built-in node:sqlite.
import {DatabaseSync} from 'node:sqlite';
import {PersistentPositiveEventWatch, POSITIVE_EVENT_SOURCE_PINS, type PositiveGrant, type ChainHint} from '../src/portable/persistentTripwireWatch.js';
import {POSITIVE_EVENT_BUDGET,quotePositiveEventBudget,PROOF_METHOD_RESERVATIONS} from '../src/portable/persistentTripwireBudget.js';
const DEPLOYER='0x'+'a'.repeat(40);
const CONTRACT='0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e';
const TOPIC=POSITIVE_EVENT_SOURCE_PINS.tokenLaunchedTopic0;
const HASH='0x'+'f'.repeat(64);
const TX='0x'+'e'.repeat(64);
const JOB='00000000-0000-0000-0000-000000000001';
const grant:PositiveGrant={id:'candidate1',mode:'POSITIVE_EVENT_ONLY_V1',ownerId:'telegram:15',
  deployer:DEPLOYER,tokenLaunchedTopic0:TOPIC,chainId:4663,startsAtMs:1000,expiresAtMs:86_401_000,
  consentBlock:300,maxCandidates:12,setupBoundOutsideThisModule:true};
const hint:ChainHint={address:CONTRACT,topics:[TOPIC,'0x'+'2'.repeat(64),'0x'+'3'.repeat(64),
  '0x'+DEPLOYER.slice(2).padStart(64,'0')],blockNumber:301,blockHash:HASH,transactionHash:TX,logIndex:1,removed:false};
function rig(sharedDebits=13){
 const sql=new DatabaseSync(':memory:');let clock=2000;
 const debits:string[]=[];
 const ledger={reserve(_job:string,method:string,_deadline:number){if(debits.length+sharedDebits>=100)throw Error('SHARED_LEDGER_EXHAUSTED');debits.push(method);}};
 const newWatch=(g:PositiveGrant=grant)=>PersistentPositiveEventWatch.open(sql,g,ledger,()=>clock);
 const w=newWatch();return {sql,ledger,debits,w,newWatch,setClock:(ms:number)=>{clock=ms;}};
}
test('quote models setup, stream envelope and positive jobs without pretending actual billing',()=>{
 const q=quotePositiveEventBudget(13,12);
 assert.equal(q.ok,true);assert.equal(q.totalDailyRequests,96);
 assert.ok(Math.abs(q.grantModeledCu-8609.12)<0.00001);
 assert.equal(quotePositiveEventBudget(99,1).ok,false);
 assert.equal(quotePositiveEventBudget(0,13).ok,false);
 assert.equal(PROOF_METHOD_RESERVATIONS.length,6);
 assert.equal(POSITIVE_EVENT_BUDGET.utcDayRequests,100);
});
test('24h quiet has zero polling/reservations and honest UNKNOWN coverage',()=>{
 const a=rig();const v=a.w.coverage();assert.equal(v.absenceProven,false);
 assert.equal(v.quietIntervals,'UNKNOWN');assert.equal(v.disconnectedIntervals,'UNKNOWN');
 assert.equal(a.debits.length,0);assert.equal(v.casePublication,false);assert.equal(v.telegramDelivery,false);
});
test('exact matching post-consent Pons hint gets PENDING not VERIFIED',()=>{
 const a=rig();assert.deepEqual(a.w.journal(hint),{state:'PENDING',reason:'UNVERIFIED_POSITIVE_HINT'});
 assert.equal(a.debits.length,0);
 const row=a.sql.prepare('SELECT state,block_number FROM positive_event_hints_v1').get() as any;
 assert.equal(row.state,'PENDING');assert.equal(row.block_number,301);
});
test('duplicate cannot cause repeat admission, proof reserve debits six only once',()=>{
 const a=rig();a.w.journal(hint);assert.equal(a.w.journal(hint).state,'DUPLICATE');
 const claimed=a.w.reserveProof(TX,1,JOB);
 assert.equal(claimed.state,'PROOF_SLOTS_RESERVED');assert.equal(a.debits.length,6);
 assert.equal(a.w.reserveProof(TX,1,JOB).state,'UNKNOWN');assert.equal(a.debits.length,6);
 assert.equal(a.w.coverage().absenceProven,false);
});
test('unrelated factory, topic, deployer, or pre-consent log cannot create work',()=>{
 const a=rig();
 for(const h of [{...hint,address:'0x'+'b'.repeat(40)},
  {...hint,topics:['0x'+'9'.repeat(64),...hint.topics.slice(1)]},
  {...hint,topics:[...hint.topics.slice(0,3),'0x'+'0'.repeat(64)]},
  {...hint,blockNumber:300}]) assert.equal(a.w.journal(h as ChainHint).state,'IGNORED');
 assert.equal(a.sql.prepare('SELECT COUNT(*) n FROM positive_event_hints_v1').get()?.n,0);
});
test('malformed and removed logs never become findings; removed invalidates pending/reserved',()=>{
 const a=rig();assert.equal(a.w.journal({...hint,transactionHash:'0xfake'} as ChainHint).state,'UNKNOWN');
 a.w.journal(hint);a.w.reserveProof(TX,1,JOB);
 assert.equal(a.w.journal({...hint,removed:true}).reason,'REMOVED_OR_REORG_HINT');
 assert.equal(a.sql.prepare('SELECT state FROM positive_event_hints_v1').get()?.state,'UNKNOWN');
 assert.equal(a.w.reserveProof(TX,1,JOB).state,'UNKNOWN');
});
test('block-hash drift freezes the exact event and never retries proof',()=>{
 const a=rig();a.w.journal(hint);
 assert.equal(a.w.journal({...hint,blockHash:'0x'+'9'.repeat(64)}).reason,'HINT_BLOCK_HASH_DRIFT');
 assert.equal(a.w.reserveProof(TX,1,JOB).state,'UNKNOWN');
});
test('ledger failure partial reservations terminate UNKNOWN; existing debits never refunded',()=>{
 const a=rig(96);a.w.journal(hint);
 const x=a.w.reserveProof(TX,1,JOB);
 assert.equal(x.reason,'SHARED_LEDGER_OR_GRANT_BLOCKED');
 assert.equal(a.debits.length,4);assert.equal(a.w.reserveProof(TX,1,JOB).state,'UNKNOWN');
 assert.equal(a.debits.length,4);
});
test('crash between claim and reserve is terminal UNKNOWN on restart',()=>{
 const a=rig();a.w.journal(hint);
 a.sql.prepare("UPDATE positive_event_hints_v1 SET state='RESERVING'").run();
 const restarted=a.newWatch();assert.equal(restarted.recoverInterrupted(),1);
 assert.equal(restarted.reserveProof(TX,1,JOB).state,'UNKNOWN');
 assert.equal(a.debits.length,0);
});
test('scope drift fails closed across restarts without replacing data',()=>{
 const a=rig();a.w.journal(hint);
 assert.throws(()=>a.newWatch({...grant,deployer:'0x'+'b'.repeat(40)}),/POSITIVE_EVENT_SCOPE_DRIFT/);
 assert.equal(a.sql.prepare('SELECT COUNT(*) n FROM positive_event_hints_v1').get()?.n,1);
});
test('expired and premature grants cannot enqueue or reserve work',()=>{
 const a=rig();a.setClock(86_401_001);
 assert.equal(a.w.journal(hint).reason,'GRANT_NOT_CURRENT');
 assert.equal(a.w.reserveProof(TX,1,JOB).reason,'GRANT_NOT_CURRENT');
 a.setClock(999);assert.equal(a.w.journal(hint).state,'UNKNOWN');
 assert.equal(a.debits.length,0);
});
test('bounded scope rejects arbitrary lifetime, missing consent, wrong chain, unapproved setup',()=>{
 const a=rig();for(const g of [{...grant,expiresAtMs:grant.expiresAtMs+1},
  {...grant,chainId:1}, {...grant,consentBlock:-1},
  {...grant,setupBoundOutsideThisModule:false}, {...grant,maxCandidates:999}]) {
  assert.throws(()=>a.newWatch(g as PositiveGrant));
 }
});
test('candidate cap and hint cap fail closed; no provider I/O',()=>{
 const a=rig();
 for(let i=0;i<32;i++){
  const tx='0x'+(i+1).toString(16).padStart(64,'0');
  assert.equal(a.w.journal({...hint,transactionHash:tx}).state,'PENDING');
 }
 assert.equal(a.w.journal({...hint,transactionHash:'0x'+'b'.repeat(64)}).reason,'PENDING_HINT_CAP');
 assert.equal(a.debits.length,0);
});

test('canonical event ABI selector and Pons source are pinned; fake selector grant is rejected',()=>{
 const a=rig();
 assert.equal(POSITIVE_EVENT_SOURCE_PINS.factory, CONTRACT);
 assert.equal(POSITIVE_EVENT_SOURCE_PINS.factoryCodeHash, '0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84');
 assert.equal(POSITIVE_EVENT_SOURCE_PINS.tokenLaunchedTopic0, TOPIC);
 const forged={...grant,tokenLaunchedTopic0:'0x'+'1'.repeat(64)} as PositiveGrant;
 assert.notEqual(forged.tokenLaunchedTopic0,TOPIC);
 assert.throws(()=>a.newWatch(forged),/POSITIVE_EVENT_SCOPE_INVALID/);
 assert.equal(a.w.journal({...hint,topics:['0x'+'1'.repeat(64),...hint.topics.slice(1)]}).state,'IGNORED');
});
