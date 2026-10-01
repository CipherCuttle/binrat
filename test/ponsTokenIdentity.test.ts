import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson } from '../src/evidence/canonical.js';
import { discoverRats } from '../src/autonomous/rats.js';
import { D1PonsTokenIdentityStore } from '../src/cloudflare/ponsTokenIdentityStore.js';
import { runCloudflarePonsTokenIdentityCycle } from '../src/cloudflare/syncQueue.js';
import {
  buildPonsTokenIdentityReceipt,
  syncPonsTokenIdentities,
  verifyPonsTokenIdentityReceipt,
  type PonsTokenIdentityLaunch,
  type PonsTokenIdentitySource
} from '../src/pons/tokenIdentity.js';
import { autonomousFixture, CREATOR, hash } from './support/autonomousFixture.js';

function sourceFor(
  identities:Map<string,{name:string;symbol:string;decimals:number}>,
  failTokens=new Set<string>()
):PonsTokenIdentitySource {
  return {
    async assertAuthority() {},
    async getBlockHash(blockNumber) { return hash(Number(blockNumber)); },
    async readIdentity(launch:PonsTokenIdentityLaunch) {
      if (failTokens.has(launch.token)) throw new Error('FIXTURE_TOKEN_READ_FAILED');
      const value=identities.get(launch.token);
      if (!value) throw new Error('FIXTURE_IDENTITY_MISSING');
      return value;
    }
  };
}

test('Pons token identity receipts are deterministic, canonical and tamper-evident', async () => {
  const launch={launchId:'a'.repeat(64),token:'0x'+'1'.repeat(40) as `0x${string}`};
  const input={
    launch,
    observedBlock:123n,
    observedBlockHash:hash(123),
    name:'Bin Rat',
    symbol:'BIN',
    decimals:18
  };
  const first=await buildPonsTokenIdentityReceipt(input);
  const second=await buildPonsTokenIdentityReceipt(input);
  assert.equal(canonicalJson(first),canonicalJson(second));
  await assert.doesNotReject(verifyPonsTokenIdentityReceipt(first));
  await assert.rejects(
    verifyPonsTokenIdentityReceipt({...first,symbol:'FAKE'}),
    /PONS_TOKEN_IDENTITY_RECEIPT_INVALID/
  );
});

test('identity enrichment upgrades Fresh Garbage labels without rewriting canonical launch authority', async () => {
  const f=await autonomousFixture();
  try {
    const older=await f.launch(99,CREATOR);
    await f.checkpoint(100);
    const before=await f.db.prepare('SELECT authority_json FROM launches WHERE launch_id=?')
      .bind(f.initial.launchId).first<{authority_json:string}>();
    assert.ok(before);

    const identities=new Map([
      [f.initial.token,{name:'Bin Rat',symbol:'BIN',decimals:18}],
      [older.token,{name:'Old Scrap',symbol:'SCRAP',decimals:18}]
    ]);
    const report=await syncPonsTokenIdentities(
      sourceFor(identities),
      new D1PonsTokenIdentityStore(f.db),
      12
    );
    assert.deepEqual(
      {attempted:report.attempted,inserted:report.inserted,duplicates:report.duplicates,failed:report.failed},
      {attempted:2,inserted:2,duplicates:0,failed:0}
    );

    const after=await f.db.prepare('SELECT authority_json FROM launches WHERE launch_id=?')
      .bind(f.initial.launchId).first<{authority_json:string}>();
    assert.equal(after?.authority_json,before.authority_json);

    const snapshot=await discoverRats(f.db,f.now());
    assert.equal(snapshot.candidates[0]?.latestLaunch.symbol,'BIN');
    assert.equal(snapshot.candidates[0]?.previousLaunches?.[0]?.symbol,'SCRAP');
  } finally { f.db.close(); }
});

test('Fresh Garbage ignores a tampered identity receipt payload', async () => {
  const f=await autonomousFixture();
  try {
    const older=await f.launch(99,CREATOR);
    await f.checkpoint(100);
    const identities=new Map([
      [f.initial.token,{name:'Bin Rat',symbol:'BIN',decimals:18}],
      [older.token,{name:'Old Scrap',symbol:'SCRAP',decimals:18}]
    ]);
    await syncPonsTokenIdentities(sourceFor(identities),new D1PonsTokenIdentityStore(f.db),12);
    const stored=await f.db.prepare('SELECT payload_json FROM pons_token_identity_receipts WHERE launch_id=?')
      .bind(f.initial.launchId).first<{payload_json:string}>();
    assert.ok(stored);
    const forged=JSON.parse(stored.payload_json) as Record<string,unknown>;
    forged.symbol='FORGED';
    await f.db.prepare('UPDATE pons_token_identity_receipts SET payload_json=? WHERE launch_id=?')
      .bind(JSON.stringify(forged),f.initial.launchId).run();

    const snapshot=await discoverRats(f.db,f.now());
    assert.equal(snapshot.candidates[0]?.latestLaunch.symbol,'FIXTURE');
    assert.notEqual(snapshot.candidates[0]?.latestLaunch.symbol,'FORGED');
  } finally { f.db.close(); }
});

test('one unreadable token does not block other identity receipts', async () => {
  const f=await autonomousFixture();
  try {
    const older=await f.launch(99,CREATOR);
    await f.checkpoint(100);
    const identities=new Map([
      [older.token,{name:'Old Scrap',symbol:'SCRAP',decimals:18}]
    ]);
    const report=await syncPonsTokenIdentities(
      sourceFor(identities,new Set([f.initial.token])),
      new D1PonsTokenIdentityStore(f.db),
      12
    );
    assert.equal(report.attempted,2);
    assert.equal(report.inserted,1);
    assert.equal(report.failed,1);
    const saved=await f.db.prepare('SELECT symbol FROM pons_token_identity_receipts WHERE launch_id=?')
      .bind(older.launchId).first<{symbol:string}>();
    assert.equal(saved?.symbol,'SCRAP');
  } finally { f.db.close(); }
});

test('Fresh Garbage falls back safely when identity schema is absent', async () => {
  const f=await autonomousFixture();
  try {
    await f.launch(99,CREATOR);
    await f.checkpoint(100);
    await f.db.exec('DROP TABLE pons_token_identity_receipts;');
    const snapshot=await discoverRats(f.db,f.now());
    assert.equal(snapshot.candidates[0]?.latestLaunch.symbol,'FIXTURE');
    assert.equal(snapshot.candidates[0]?.previousLaunches?.[0]?.symbol,'FIXTURE');
  } finally { f.db.close(); }
});

test('Fresh Garbage falls back on an incompatible partial identity schema', async () => {
  const f=await autonomousFixture();
  try {
    await f.launch(99,CREATOR);
    await f.checkpoint(100);
    await f.db.exec('DROP TABLE pons_token_identity_receipts; CREATE TABLE pons_token_identity_receipts (launch_id TEXT PRIMARY KEY);');
    const snapshot=await discoverRats(f.db,f.now());
    assert.equal(snapshot.candidates[0]?.latestLaunch.symbol,'FIXTURE');
  } finally { f.db.close(); }
});

test('identity queue cycle never mutates Pons runtime readiness', async () => {
  const f=await autonomousFixture();
  try {
    const older=await f.launch(99,CREATOR);
    await f.checkpoint(100);
    const before=await f.db.prepare('SELECT * FROM binrat_runtime_state WHERE chain_id=4663').first<Record<string,unknown>>();
    assert.ok(before);
    const identities=new Map([
      [f.initial.token,{name:'Bin Rat',symbol:'BIN',decimals:18}],
      [older.token,{name:'Old Scrap',symbol:'SCRAP',decimals:18}]
    ]);
    const result=await runCloudflarePonsTokenIdentityCycle(
      {...f.env,BINRAT_PONS_TOKEN_IDENTITY_ENABLED:'true',BINRAT_PONS_TOKEN_IDENTITY_MAX_PER_CYCLE:'12'},
      {kind:'PONS_TOKEN_IDENTITY_CYCLE',cycleId:'identity-fixture',enqueuedAtMs:f.now()},
      {now:f.now,ponsTokenIdentitySource:sourceFor(identities)}
    );
    assert.equal(result.status,'SUCCESS');
    const after=await f.db.prepare('SELECT * FROM binrat_runtime_state WHERE chain_id=4663').first<Record<string,unknown>>();
    assert.deepEqual(after,before);
  } finally { f.db.close(); }
});
