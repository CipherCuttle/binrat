import assert from 'node:assert/strict';
import test from 'node:test';
import type { LaunchSource } from '../src/core/ports.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import type { D1DatabaseLike, D1PreparedStatementLike, D1ResultLike } from '../src/cloudflare/d1Types.js';
import { buildProvenanceFact, projectProvenanceEdges } from '../src/intelligence/provenance.js';
import { syncLaunches } from '../src/indexer/syncLaunches.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const CHAIN_ID=4663;
const FACTORY='0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e' as Hex;

const hash=(block:bigint)=>`0x${block.toString(16).padStart(64,'0')}` as Hex;
const addr=(seed:number)=>`0x${seed.toString(16).padStart(40,'0')}` as Hex;

function launch(index:number):LaunchObserved {
  const block=BigInt(index);
  return {
    launchId:`pons-repair-${index.toString().padStart(4,'0')}`,
    eventId:`pons-repair-event-${index.toString().padStart(4,'0')}`,
    chainId:CHAIN_ID,
    blockNumber:block,
    blockHash:hash(block),
    observedAtMs:1,
    source:'PONS_V2',
    launcher:FACTORY,
    txHash:hash(BigInt(100_000+index)),
    logIndex:0,
    token:addr(1_000+index),
    creator:addr(50_000+(index%5)),
    pool:addr(10_000+index),
    name:'',
    symbol:'',
    imageUri:'',
    website:'',
    twitter:'',
    telegram:''
  };
}

class StableSource implements LaunchSource {
  async getHeadBlockNumber(){ return 152n; }
  async getBlockHash(blockNumber:bigint){ return hash(blockNumber); }
  async assertAuthority(_blockNumber:bigint){}
  async catchUp(_fromBlock:bigint,_toBlock:bigint){ return []; }
}

class CountingD1Database implements D1DatabaseLike {
  readonly inner=new D1CompatDatabase();
  maxBatchStatements=0;
  batchCalls=0;

  prepare(sql:string):D1PreparedStatementLike { return this.inner.prepare(sql); }
  exec(sql:string):Promise<unknown> { return this.inner.exec(sql); }
  async batch(statements:D1PreparedStatementLike[]):Promise<D1ResultLike[]> {
    this.batchCalls+=1;
    this.maxBatchStatements=Math.max(this.maxBatchStatements,statements.length);
    return this.inner.batch(statements);
  }
  close(){ this.inner.close(); }
}

test('D1 Pons provenance repair drains 150 missing facts without a giant replacement batch',async()=>{
  const db=new CountingD1Database();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,CHAIN_ID);
  try {
    const facts=[];
    for(let index=1;index<=150;index+=1){
      const value=launch(index);
      assert.equal(await store.putLaunch(value),'INSERTED');
      const fact=await buildProvenanceFact(value);
      facts.push(fact);
      assert.equal(await store.putProvenanceFact(fact),'INSERTED');
    }
    await store.commitCheckpoint({
      blockNumber:151n,
      blockHash:hash(151n),
      guardBlockNumber:119n,
      guardBlockHash:hash(119n)
    });

    const expected=await projectProvenanceEdges(facts);
    const source=new StableSource();
    const options={
      startBlock:1n,
      confirmations:1n,
      maxBatchBlocks:4n,
      reorgLookbackBlocks:32n,
      pollIntervalMs:100,
      provenanceProjection:'END_OF_RUN' as const
    };

    await syncLaunches(source,store,options);
    const first=await store.listProvenanceEdges();
    assert.ok(first.length>0);
    assert.ok(first.length<expected.length);

    await syncLaunches(source,store,options);
    assert.deepEqual(await store.listProvenanceEdges(),expected);

    const derived=expected.find((edge)=>edge.kind==='PREVIOUS_LAUNCH');
    assert.ok(derived);
    await db.prepare('DELETE FROM provenance_edges WHERE edge_id=?').bind(derived.edgeId).run();
    const directId='reported-creator:'+derived.sourceFactIds[0];
    assert.ok(await db.prepare('SELECT edge_id FROM provenance_edges WHERE edge_id=?').bind(directId).first());

    await syncLaunches(source,store,options);
    assert.deepEqual(await store.listProvenanceEdges(),expected);

    assert.ok(db.batchCalls>1);
    assert.ok(db.maxBatchStatements<=32,`max batch statements=${db.maxBatchStatements}`);
  } finally {
    store.close();
    db.close();
  }
});
