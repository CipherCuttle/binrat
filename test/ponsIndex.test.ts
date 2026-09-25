import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {PONS_PREVIEW_AUTHORITY as A,type PonsLog} from '../src/ponsPreview/snapshot.js';
import {PONS_D1_SCHEMA_SQL} from '../src/ponsIndex/schema.js';
import {indexedPonsFacts,PONS_MAX_FACTS_PER_CYCLE} from '../src/ponsIndex/model.js';
import {PonsD1Store} from '../src/ponsIndex/store.js';
import {bootstrapPonsWindow,collectOneConfirmedRange,type PonsReadSource} from '../src/ponsIndex/collector.js';
import {handlePonsPublicGet} from '../src/ponsIndex/api.js';
import {handleWorkerRequest} from '../src/cloudflare/worker.js';
import {D1_SCHEMA_SQL} from '../src/cloudflare/d1Schema.js';
import {D1CompatDatabase} from './support/d1Compat.js';

const h=(n:number)=>('0x'+n.toString(16).padStart(64,'0'));
const a=(n:number)=>('0x'+n.toString(16).padStart(40,'0'));
const log=(block:number,seed=block,deployer=a(4)):PonsLog=>({
 blockNumber:BigInt(block),blockHash:h(block),transactionHash:h(seed+500),
 logIndex:0,token:a(seed+100),curve:a(seed+200),deployer,
 pairToken:a(0),launchConfigId:1n
});
function source(options:{head?:number;logs?:PonsLog[];chain?:number;codeHash?:string}={}):PonsReadSource{
 return {
  chainId:async()=>options.chain??4663,
  headBlock:async()=>BigInt(options.head??113),
  factoryCodeHash:async()=>options.codeHash??A.runtimeCodeHash,
  blockHash:async n=>h(Number(n)),
  factoryLogs:async(from,to)=>(options.logs??[]).filter(l=>l.blockNumber>=from&&l.blockNumber<=to)
 };
}
function request(path:string){return new Request('https://binrat.test'+path);}
test('separate Pons D1 authority is tracked but never alters Arc D1 schema',()=>{
 const sql=readFileSync(new URL('../cloudflare/pons-schema.sql',import.meta.url),'utf8');
 assert.equal(sql.trim(),PONS_D1_SCHEMA_SQL.trim());
 assert.doesNotMatch(D1_SCHEMA_SQL,/pons_launch_facts/);
 assert.match(PONS_D1_SCHEMA_SQL,/CHECK\(chain_id=4663\)/);
});
test('Pons confirmed HTTP source commits contiguous ranges and preserves empty-range progress',async()=>{
 const db=new D1CompatDatabase();await db.exec(PONS_D1_SCHEMA_SQL);
 const store=new PonsD1Store(db);
 try{
  const rpc=source({head:113,logs:[log(100),log(101,102)]});
  await bootstrapPonsWindow(store,rpc,10000,2n);
  const cp=await store.checkpoint();
  assert.equal(cp?.fromBlock,100);assert.equal(cp?.nextBlock,100);
  const cycle=await collectOneConfirmedRange(store,rpc,10001);
  assert.deepEqual([cycle.status,cycle.factCount,cycle.throughBlock],['COMMITTED',2,'101']);
  assert.equal((await store.checkpoint())?.nextBlock,102);
  const rows=await store.list(10);
  assert.equal(rows.length,2);
  assert.equal(rows[0]?.blockNumber,'101');
  assert.equal(rows[0]?.deployer,a(4));
  assert.equal(rows[0]?.metadata.status,'NOT_AVAILABLE');
  assert.equal(rows[0]?.previousFromSameDeployerWithinWindow,1);
  assert.equal((await collectOneConfirmedRange(store,rpc,10002)).status,'CAUGHT_UP');
  const api=await handlePonsPublicGet(request('/api/pons/feed?limit=2'),db,10003);
  assert.equal(api.status,200);
  const body=await api.json() as {chainId:number;fundingCoverage:string;historyComplete:boolean;launches:unknown[]};
  assert.equal(body.chainId,4663);
  assert.equal(body.historyComplete,false);
  assert.equal(body.fundingCoverage,'NOT_COLLECTED');
  assert.equal(body.launches.length,2);
  const old=await handlePonsPublicGet(request('/api/pons/launch/'+rows[0]!.id),db,10003);
  assert.equal(old.status,200);
  const caseBody=await old.json() as {previousSameDeployerWithinCapturedWindow:unknown[]};
  assert.equal(caseBody.previousSameDeployerWithinCapturedWindow.length,1);
 }finally{db.close();}
});
test('reorg against prior 12-confirmed checkpoint persists HALT and hides feed without deleting facts',async()=>{
 const db=new D1CompatDatabase();await db.exec(PONS_D1_SCHEMA_SQL);
 try{
  const store=new PonsD1Store(db);
  const rpc=source({head:113,logs:[log(100)]});
  await bootstrapPonsWindow(store,rpc,1000,2n);
  await collectOneConfirmedRange(store,rpc,1001);
  const bad:PonsReadSource={...rpc,blockHash:async block=>block===101n?h(900):h(Number(block))};
  await assert.rejects(collectOneConfirmedRange(store,bad,1002),/PONS_REORG_HALT/);
  assert.equal((await store.checkpoint())?.status,'REORG_HALT');
  assert.equal(await store.factCount(),1);
  assert.equal((await handlePonsPublicGet(request('/api/pons/feed'),db,1003)).status,503);
  assert.equal((await handlePonsPublicGet(request('/api/pons/health'),db,1003)).status,503);
  await assert.rejects(db.prepare('DELETE FROM pons_launch_facts').run(),/PONS_FACT_IMMUTABLE/);
 }finally{db.close();}
});
test('invalid chain, code hash and dense single block never write or skip facts',async()=>{
 const db=new D1CompatDatabase();await db.exec(PONS_D1_SCHEMA_SQL);
 const store=new PonsD1Store(db);
 try{
  await assert.rejects(bootstrapPonsWindow(store,source({chain:5042}),1),/PONS_CHAIN_DRIFT/);
  await assert.rejects(bootstrapPonsWindow(store,source({codeHash:h(1)}),1),/PONS_FACTORY_HASH_DRIFT/);
  assert.equal(await store.checkpoint(),null);
  await bootstrapPonsWindow(store,source(),2,2n);
  const tooMany=Array.from({length:PONS_MAX_FACTS_PER_CYCLE+1},(_,i)=>log(100,800+i));
  await assert.rejects(collectOneConfirmedRange(store,source({logs:tooMany}),3),/PONS_SINGLE_BLOCK_WRITE_BUDGET/);
  assert.equal((await store.checkpoint())?.nextBlock,100);
  assert.equal(await store.factCount(),0);
 }finally{db.close();}
});
test('SENTRY identities match, duplicate and modified facts do not overwrite append-only records',async()=>{
 const db=new D1CompatDatabase();await db.exec(PONS_D1_SCHEMA_SQL);
 try{
  const store=new PonsD1Store(db);
  const prev=await store.initialize(100n,h(99),500);
  const facts=indexedPonsFacts({from:100n,through:100n,throughHash:h(100),capturedAtMs:501,logs:[log(100)]});
  const f=facts[0]!;
  assert.match(f.eventId,/^[0-9a-f]{64}$/);assert.notEqual(f.eventId,f.id);
  await store.appendRange({expected:prev,from:100n,through:100n,throughHash:h(100),facts,nowMs:501});
  await assert.rejects(store.appendRange({expected:prev,from:100n,through:100n,throughHash:h(100),
   facts:[{...f,metadata:{...f.metadata,status:'DIRECT_FACTORY_INPUT',name:'evil',symbol:'EVIL'}}],
   nowMs:502}),/PONS_FACT_COLLISION/);
  await assert.rejects(store.appendRange({expected:prev,from:100n,through:100n,throughHash:h(100),facts,nowMs:503}));
  assert.equal(await store.factCount(),1);
  assert.equal((await store.checkpoint())?.nextBlock,101);
  await assert.rejects(db.prepare("UPDATE pons_launch_facts SET deployer='broken'").run(),/PONS_FACT_IMMUTABLE/);
 }finally{db.close();}
});
test('default-off Pons GET routes never fall through to Arc and support separate PONS_DB only',async()=>{
 const db=new D1CompatDatabase(),arc=new D1CompatDatabase();
 await db.exec(PONS_D1_SCHEMA_SQL);await arc.exec(D1_SCHEMA_SQL);
 const store=new PonsD1Store(db);
 try{
  const cp=await store.initialize(100n,h(99),Date.now());
  await store.appendRange({expected:cp,from:100n,through:100n,throughHash:h(100),
   facts:indexedPonsFacts({from:100n,through:100n,throughHash:h(100),
    capturedAtMs:Date.now(),logs:[log(100)]}),nowMs:Date.now()});
  const no=await handleWorkerRequest(request('/api/pons/feed'),{DB:arc,PONS_DB:db});
  assert.equal(no.status,503);
  assert.equal((await no.json() as {error:string}).error,'PONS_PUBLIC_API_NOT_ENABLED');
  const enabled={DB:arc,PONS_DB:db,BINRAT_PONS_PUBLIC_API_ENABLED:'true'};
  assert.equal((await handleWorkerRequest(request('/api/pons/feed?limit=1'),enabled)).status,200);
  assert.equal((await handleWorkerRequest(request('/api/feed'),enabled)).status,503);
  assert.equal((await handleWorkerRequest(request('/api/pons/feed?limit=1000'),enabled)).status,400);
  assert.equal((await handleWorkerRequest(new Request('https://binrat.test/api/pons/feed',{method:'POST'}),enabled)).status,405);
  assert.equal((await handleWorkerRequest(request('/api/pons/creator/no'),enabled)).status,400);
 }finally{db.close();arc.close();}
});
