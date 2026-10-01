import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { runCloudflarePonsOutcomeCycle } from '../src/cloudflare/syncQueue.js';
import { D1CompatDatabase } from '../test/support/d1Compat.js';

const migration=readFileSync(
  new URL('../cloudflare/migrations/20261001_pons_outcome_v1.sql',import.meta.url),
  'utf8'
).trim();
const wrangler=readFileSync(
  new URL('../cloudflare/wrangler.example.jsonc',import.meta.url),
  'utf8'
);

const migrationOccurrences=D1_SCHEMA_SQL.split(migration).length-1;
assert.equal(migrationOccurrences,1,'O2 migration must appear exactly once in tracked schema');
const preO2Schema=D1_SCHEMA_SQL.replace(migration,'');

assert.match(wrangler,/"BINRAT_PONS_OUTCOME_ENABLED"\s*:\s*"false"/);
assert.match(wrangler,/"BINRAT_PONS_OUTCOME_MAX_PER_CYCLE"\s*:\s*"3"/);
assert.equal(
  wrangler.includes('BINRAT_ROBINHOOD_ARCHIVE_RPC_URL'),
  false,
  'archive credential must not be a plaintext Wrangler var'
);

const upgraded=new D1CompatDatabase();
const full=new D1CompatDatabase();

async function schemaObjects(db:D1CompatDatabase) {
  const result=await db.prepare(`
    SELECT type,name,tbl_name,sql
    FROM sqlite_master
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY type,name
  `).all<{type:string;name:string;tbl_name:string;sql:string|null}>();
  assert.equal(result.success,true);
  return result.results ?? [];
}

try {
  await upgraded.exec(preO2Schema);

  await upgraded.exec(`
    INSERT INTO launches (
      launch_id,event_id,chain_id,block_number,block_hash,source,launcher,tx_hash,log_index,
      token,creator,pool,name,symbol,image_uri,website,twitter,telegram,observed_at_ms,authority_json
    ) VALUES (
      'launch-rehearsal','event-rehearsal',4663,'77500000',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'PONS_V2','0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',0,
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333',
      'Existing Launch','EXIST','','','','',1790870000000,'{"source":"rehearsal"}'
    );
    INSERT INTO pons_token_identity_receipts (
      identity_id,identity_version,chain_id,launch_id,token,observed_block,observed_block_hash,
      name,symbol,decimals,evidence_digest,payload_json
    ) VALUES (
      'identity-rehearsal','BINRAT_PONS_TOKEN_IDENTITY_V1',4663,'launch-rehearsal',
      '0x1111111111111111111111111111111111111111','77500000',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'Existing Launch','EXIST',18,'digest-existing','{"kind":"existing"}'
    );
    INSERT INTO chain_checkpoints (
      chain_id,block_number,block_hash,guard_block_number,guard_block_hash
    ) VALUES (
      4663,'77500020',
      '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      NULL,NULL
    );
    INSERT INTO binrat_runtime_state (
      chain_id,source_verified,live_caught_up,head_block,target_block,observation_ready,
      history_backfill_complete,history_backfill_target_block,last_sync_error,last_history_error,
      last_observation_error,updated_at_ms
    ) VALUES (
      4663,1,1,'77500022','77500020',0,0,NULL,NULL,NULL,NULL,1790870010000
    );
  `);

  const beforeLaunch=await upgraded.prepare(
    "SELECT launch_id,block_number,block_hash,token,pool,name,symbol,authority_json FROM launches WHERE launch_id='launch-rehearsal'"
  ).first<Record<string,unknown>>();
  const beforeIdentity=await upgraded.prepare(
    "SELECT identity_id,launch_id,token,name,symbol,decimals,evidence_digest,payload_json FROM pons_token_identity_receipts WHERE identity_id='identity-rehearsal'"
  ).first<Record<string,unknown>>();
  const beforeCheckpoint=await upgraded.prepare(
    'SELECT * FROM chain_checkpoints WHERE chain_id=4663'
  ).first<Record<string,unknown>>();
  const beforeRuntime=await upgraded.prepare(
    'SELECT * FROM binrat_runtime_state WHERE chain_id=4663'
  ).first<Record<string,unknown>>();

  const disabledBeforeMigration=await runCloudflarePonsOutcomeCycle(
    {DB:upgraded,BINRAT_PONS_OUTCOME_ENABLED:'false'},
    {kind:'PONS_OUTCOME_CYCLE',cycleId:'deployment-rehearsal-pre-migration',enqueuedAtMs:1}
  );
  assert.deepEqual(disabledBeforeMigration,{
    status:'SUCCESS',
    inserted:0,
    duplicates:0,
    pendingMaturity:0,
    alreadyPresent:0,
    launchesVisited:0
  });

  await upgraded.exec(migration);
  await upgraded.exec(migration);

  const outcomeTable=await upgraded.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='pons_outcome_receipts'"
  ).first<{name:string}>();
  assert.equal(outcomeTable?.name,'pons_outcome_receipts');

  const outcomeCount=await upgraded.prepare(
    'SELECT COUNT(*) AS count FROM pons_outcome_receipts'
  ).first<{count:number}>();
  assert.equal(outcomeCount?.count,0);

  assert.deepEqual(await upgraded.prepare(
    "SELECT launch_id,block_number,block_hash,token,pool,name,symbol,authority_json FROM launches WHERE launch_id='launch-rehearsal'"
  ).first<Record<string,unknown>>(),beforeLaunch);
  assert.deepEqual(await upgraded.prepare(
    "SELECT identity_id,launch_id,token,name,symbol,decimals,evidence_digest,payload_json FROM pons_token_identity_receipts WHERE identity_id='identity-rehearsal'"
  ).first<Record<string,unknown>>(),beforeIdentity);
  assert.deepEqual(await upgraded.prepare(
    'SELECT * FROM chain_checkpoints WHERE chain_id=4663'
  ).first<Record<string,unknown>>(),beforeCheckpoint);
  assert.deepEqual(await upgraded.prepare(
    'SELECT * FROM binrat_runtime_state WHERE chain_id=4663'
  ).first<Record<string,unknown>>(),beforeRuntime);

  const disabledAfterMigration=await runCloudflarePonsOutcomeCycle(
    {DB:upgraded,BINRAT_PONS_OUTCOME_ENABLED:'false'},
    {kind:'PONS_OUTCOME_CYCLE',cycleId:'deployment-rehearsal-post-migration',enqueuedAtMs:2}
  );
  assert.deepEqual(disabledAfterMigration,disabledBeforeMigration);
  assert.equal((await upgraded.prepare(
    'SELECT COUNT(*) AS count FROM pons_outcome_receipts'
  ).first<{count:number}>())?.count,0);

  await full.exec(D1_SCHEMA_SQL);
  assert.deepEqual(await schemaObjects(upgraded),await schemaObjects(full));

  console.log(JSON.stringify({
    kind:'PONS_OUTCOME_DEPLOYMENT_REHEARSAL_PASS',
    remoteD1Touched:false,
    deployExecuted:false,
    secretInstalled:false,
    outcomeEnabled:false,
    cycleBound:3,
    preMigrationDisabledCompatibility:'PASS',
    migrationFirstApply:'PASS',
    migrationSecondApplyIdempotent:'PASS',
    existingLaunchPreserved:'PASS',
    existingIdentityPreserved:'PASS',
    checkpointPreserved:'PASS',
    runtimeStatePreserved:'PASS',
    outcomeTableInitiallyEmpty:true,
    upgradedSchemaMatchesTrackedTarget:true
  },null,2));
} finally {
  upgraded.close();
  full.close();
}
