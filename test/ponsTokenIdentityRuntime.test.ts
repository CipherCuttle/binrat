import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { runCloudflarePonsTokenIdentityCycle } from '../src/cloudflare/syncQueue.js';
import type { PonsTokenIdentityLaunch, PonsTokenIdentitySource } from '../src/pons/tokenIdentity.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const DEPLOYER='0x0000000000000000000000000000000000000042' as Hex;

function addr(n:number):Hex {
  return `0x${n.toString(16).padStart(40,'0')}` as Hex;
}
function hash(n:number):Hex {
  return `0x${n.toString(16).padStart(64,'0')}` as Hex;
}
function launch(input:{id:string;block:number;token:number;pool:number}):LaunchObserved {
  return {
    launchId:input.id,
    eventId:input.id,
    chainId:4663,
    blockNumber:BigInt(input.block),
    blockHash:hash(input.block),
    observedAtMs:999_000_000,
    source:'PONS_V2',
    launcher:addr(999),
    txHash:hash(input.block+10_000),
    logIndex:0,
    token:addr(input.token),
    creator:DEPLOYER,
    pool:addr(input.pool),
    name:'',
    symbol:'',
    imageUri:'',
    website:'',
    twitter:'',
    telegram:''
  };
}

function sourceFor(identities:Map<string,{name:string;symbol:string;decimals:number}>):PonsTokenIdentitySource {
  return {
    async assertAuthority() {},
    async getBlockHash(blockNumber) { return hash(Number(blockNumber)); },
    async readIdentity(value:PonsTokenIdentityLaunch) {
      const identity=identities.get(value.token);
      if (!identity) throw new Error('FIXTURE_IDENTITY_MISSING');
      return identity;
    }
  };
}

test('disabled identity runtime coexists even when identity schema is absent', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  await db.exec('DROP TABLE pons_token_identity_receipts;');
  try {
    const result=await runCloudflarePonsTokenIdentityCycle(
      {DB:db,BINRAT_PONS_TOKEN_IDENTITY_ENABLED:'false'},
      {kind:'PONS_TOKEN_IDENTITY_CYCLE',cycleId:'disabled',enqueuedAtMs:1},
      {now:()=>1}
    );
    assert.deepEqual(result,{
      status:'SUCCESS',attempted:0,inserted:0,duplicates:0,failed:0,remaining:0
    });
  } finally {
    db.close();
  }
});

test('enabled identity runtime obeys a one-receipt cycle bound and does not rewrite launch authority', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const first=launch({id:'1'.repeat(64),block:100,token:1,pool:2});
  const second=launch({id:'2'.repeat(64),block:110,token:3,pool:4});
  try {
    await store.putLaunch(first);
    await store.putLaunch(second);
    await store.commitCheckpoint({blockNumber:120n,blockHash:hash(120),guardBlockNumber:null,guardBlockHash:null});
    const before=await db.prepare('SELECT launch_id,authority_json FROM launches ORDER BY launch_id')
      .all<{launch_id:string;authority_json:string}>();
    const identities=new Map([
      [first.token,{name:'Bin Rat',symbol:'BIN',decimals:18}],
      [second.token,{name:'Old Scrap',symbol:'SCRAP',decimals:18}]
    ]);
    const env={
      DB:db,
      BINRAT_PONS_TOKEN_IDENTITY_ENABLED:'true',
      BINRAT_PONS_TOKEN_IDENTITY_MAX_PER_CYCLE:'1'
    };

    const firstCycle=await runCloudflarePonsTokenIdentityCycle(
      env,
      {kind:'PONS_TOKEN_IDENTITY_CYCLE',cycleId:'one',enqueuedAtMs:1},
      {now:()=>1,ponsTokenIdentitySource:sourceFor(identities)}
    );
    assert.equal(firstCycle.status,'SUCCESS');
    if(firstCycle.status!=='SUCCESS') assert.fail('expected success');
    assert.equal(firstCycle.inserted,1);

    const afterOne=await db.prepare('SELECT COUNT(*) AS n FROM pons_token_identity_receipts')
      .first<{n:number}>();
    assert.equal(Number(afterOne?.n),1);

    const secondCycle=await runCloudflarePonsTokenIdentityCycle(
      env,
      {kind:'PONS_TOKEN_IDENTITY_CYCLE',cycleId:'two',enqueuedAtMs:2},
      {now:()=>2,ponsTokenIdentitySource:sourceFor(identities)}
    );
    assert.equal(secondCycle.status,'SUCCESS');
    if(secondCycle.status!=='SUCCESS') assert.fail('expected success');
    assert.equal(secondCycle.inserted,1);

    const afterTwo=await db.prepare('SELECT COUNT(*) AS n FROM pons_token_identity_receipts')
      .first<{n:number}>();
    assert.equal(Number(afterTwo?.n),2);

    const afterAuthority=await db.prepare('SELECT launch_id,authority_json FROM launches ORDER BY launch_id')
      .all<{launch_id:string;authority_json:string}>();
    assert.deepEqual(afterAuthority.results,before.results);
  } finally {
    store.close();
    db.close();
  }
});

test('enabled identity runtime requires the archive rail when no injected source is supplied', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  try {
    const result=await runCloudflarePonsTokenIdentityCycle(
      {DB:db,BINRAT_PONS_TOKEN_IDENTITY_ENABLED:'true'},
      {kind:'PONS_TOKEN_IDENTITY_CYCLE',cycleId:'archive-required',enqueuedAtMs:1},
      {now:()=>1}
    );
    assert.equal(result.status,'RETRY');
    if(result.status!=='RETRY') assert.fail('expected retry');
    assert.match(result.code,/MISSING_CONFIG|PONS_/);
  } finally {
    db.close();
  }
});
