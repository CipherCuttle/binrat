import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1PonsTokenIdentityStore } from '../src/cloudflare/ponsTokenIdentityStore.js';
import {
  buildPonsTokenIdentityReceipt,
  syncPonsTokenIdentities,
  verifyPonsTokenIdentityReceipt,
  type PonsTokenIdentityLaunch,
  type PonsTokenIdentitySource
} from '../src/pons/tokenIdentity.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const DEPLOYER='0x0000000000000000000000000000000000000042' as Hex;

function addr(n:number):Hex {
  return `0x${n.toString(16).padStart(40,'0')}` as Hex;
}
function hash(n:number):Hex {
  return `0x${n.toString(16).padStart(64,'0')}` as Hex;
}
function launch(input:{id:string;block:number;token:number;pool:number;symbol:string}):LaunchObserved {
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
    symbol:input.symbol,
    imageUri:'',
    website:'',
    twitter:'',
    telegram:''
  };
}

function sourceFor(
  identities:Map<string,{name:string;symbol:string;decimals:number}>,
  failTokens=new Set<string>()
):PonsTokenIdentitySource {
  return {
    async assertAuthority() {},
    async getBlockHash(blockNumber) { return hash(Number(blockNumber)); },
    async readIdentity(value:PonsTokenIdentityLaunch) {
      if (failTokens.has(value.token)) throw new Error('FIXTURE_TOKEN_READ_FAILED');
      const identity=identities.get(value.token);
      if (!identity) throw new Error('FIXTURE_IDENTITY_MISSING');
      return identity;
    }
  };
}

test('Pons identity receipt is deterministic and tamper-evident', async () => {
  const input={
    launch:{launchId:'a'.repeat(64),token:addr(1)},
    observedBlock:123n,
    observedBlockHash:hash(123),
    name:'Bin Rat',
    symbol:'BIN',
    decimals:18
  };
  const first=await buildPonsTokenIdentityReceipt(input);
  const second=await buildPonsTokenIdentityReceipt(input);
  assert.deepEqual(first,second);
  await assert.doesNotReject(verifyPonsTokenIdentityReceipt(first));
  await assert.rejects(
    verifyPonsTokenIdentityReceipt({...first,symbol:'FORGED'}),
    /PONS_TOKEN_IDENTITY_RECEIPT_INVALID/
  );
});

test('identity sync enriches presentation evidence without rewriting launch authority', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const identityStore=new D1PonsTokenIdentityStore(db);
  const first=launch({id:'1'.repeat(64),block:100,token:1,pool:2,symbol:''});
  const second=launch({id:'2'.repeat(64),block:110,token:3,pool:4,symbol:''});
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
    const report=await syncPonsTokenIdentities(sourceFor(identities),identityStore,12);

    assert.deepEqual(
      {attempted:report.attempted,inserted:report.inserted,duplicates:report.duplicates,failed:report.failed},
      {attempted:2,inserted:2,duplicates:0,failed:0}
    );
    const after=await db.prepare('SELECT launch_id,authority_json FROM launches ORDER BY launch_id')
      .all<{launch_id:string;authority_json:string}>();
    assert.deepEqual(after.results,before.results);

    const rows=await db.prepare(
      'SELECT launch_id,name,symbol,decimals FROM pons_token_identity_receipts ORDER BY launch_id'
    ).all<{launch_id:string;name:string;symbol:string;decimals:number}>();
    assert.deepEqual(rows.results,[
      {launch_id:first.launchId,name:'Bin Rat',symbol:'BIN',decimals:18},
      {launch_id:second.launchId,name:'Old Scrap',symbol:'SCRAP',decimals:18}
    ]);
  } finally {
    store.close();
    db.close();
  }
});

test('one unreadable token does not block other identity receipts', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const identityStore=new D1PonsTokenIdentityStore(db);
  const first=launch({id:'3'.repeat(64),block:100,token:5,pool:6,symbol:''});
  const second=launch({id:'4'.repeat(64),block:110,token:7,pool:8,symbol:''});
  try {
    await store.putLaunch(first);
    await store.putLaunch(second);
    await store.commitCheckpoint({blockNumber:120n,blockHash:hash(120),guardBlockNumber:null,guardBlockHash:null});

    const identities=new Map([[second.token,{name:'Good Scrap',symbol:'GOOD',decimals:18}]]);
    const report=await syncPonsTokenIdentities(
      sourceFor(identities,new Set([first.token])),
      identityStore,
      12
    );

    assert.equal(report.attempted,2);
    assert.equal(report.inserted,1);
    assert.equal(report.failed,1);
    const saved=await db.prepare('SELECT symbol FROM pons_token_identity_receipts WHERE launch_id=?')
      .bind(second.launchId).first<{symbol:string}>();
    assert.equal(saved?.symbol,'GOOD');
  } finally {
    store.close();
    db.close();
  }
});

test('identity migration is additive and idempotent against a pre-identity schema', async () => {
  const db=new D1CompatDatabase();
  try {
    await db.exec('CREATE TABLE launches (launch_id TEXT PRIMARY KEY);');
    const migration=readFileSync(
      new URL('../cloudflare/migrations/20261001_pons_token_identity_v1.sql',import.meta.url),
      'utf8'
    );
    await db.exec(migration);
    await db.exec(migration);
    const table=await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='pons_token_identity_receipts'"
    ).first<{name:string}>();
    const index=await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_pons_token_identity_token'"
    ).first<{name:string}>();
    assert.equal(table?.name,'pons_token_identity_receipts');
    assert.equal(index?.name,'idx_pons_token_identity_token');
  } finally {
    db.close();
  }
});
