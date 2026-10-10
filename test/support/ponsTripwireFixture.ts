/** Actual production identities with explicitly simulated LOCAL source times.
 * No captured canonical timestamps exist; this fixture must never claim them.
 */
import { readFileSync } from 'node:fs';
import type { WatchSource } from '../../src/autonomous/source.js';
import type { Hex, LaunchObserved } from '../../src/core/types.js';
import type { ProvenanceFact } from '../../src/intelligence/provenance.js';
import { D1_SCHEMA_SQL } from '../../src/cloudflare/d1Schema.js';
import { D1Store } from '../../src/cloudflare/d1Store.js';
import { D1RuntimeStateStore } from '../../src/cloudflare/runtimeState.js';
import { buildPublicSnapshot, publishPublicSnapshot } from '../../src/cloudflare/publicSnapshot.js';
import { D1CompatDatabase } from './d1Compat.js';
export const capturedProduction=JSON.parse(readFileSync(new URL('../fixtures/pons-tripwire-production.json',import.meta.url),'utf8')) as {
  openedCaseLaunchId:string;laterMatchingLaunchId:string;deployer:string;launches:Array<Record<string,any>>;
};
// Deliberate local scenario time: never interpreted as actual production blocktime.
export const fixtureNow=1_800_000_000_000;
const rows=capturedProduction.launches;
export const fixtureSource:WatchSource={
  async head(){return {chainId:4663,block:BigInt(rows[0]!.block_number),hash:rows[0]!.block_hash,timestampMs:fixtureNow-1_000};},
  async point(block){const row=rows.find(value=>BigInt(value.block_number)===block);if(!row)throw new Error('FIXTURE_POINT_UNKNOWN');
    return {hash:row.block_hash,timestampMs:fixtureNow+(row===rows[0]?-1_000:1_000)};}
};
export function productionLaunch(row:Record<string,any>):LaunchObserved {
  return {launchId:row.launch_id,eventId:row.event_id,chainId:row.chain_id,blockNumber:BigInt(row.block_number),
    blockHash:row.block_hash as Hex,source:row.source,launcher:row.launcher,txHash:row.tx_hash,logIndex:row.log_index,
    token:row.token,creator:row.creator,pool:row.pool,name:row.name,symbol:row.symbol,imageUri:row.image_uri,
    website:row.website,twitter:row.twitter,telegram:row.telegram,observedAtMs:row.observed_at_ms};
}
export async function seedProductionRow(db:D1CompatDatabase,row:Record<string,any>) {
  const store=new D1Store(db,4663);await store.putLaunch(productionLaunch(row));
  const payload=JSON.parse(row.payload_json) as Omit<ProvenanceFact,'observedBlock'>&{observedBlock:string};
  await store.putProvenanceFact({...payload,observedBlock:BigInt(payload.observedBlock)});
}
export async function publishFixture(db:D1CompatDatabase,block:bigint,hash:Hex,now:number) {
  await new D1Store(db,4663).commitCheckpoint({blockNumber:block,blockHash:hash,guardBlockNumber:null,guardBlockHash:null});
  await new D1RuntimeStateStore(db,4663).put({sourceVerified:true,liveCaughtUp:true,headBlock:block,targetBlock:block,
    observationReady:false,historyBackfillComplete:false,historyBackfillTargetBlock:null,
    lastSyncError:null,lastHistoryError:null,lastObservationError:null,updatedAtMs:now});
  await publishPublicSnapshot(db,await buildPublicSnapshot({schemaVersion:'binrat.latest-launches/0.1',chainId:4663,
    sourceCheckpoint:block.toString(),checkpointBlockHash:hash,historyCoverage:'PARTIAL',launches:[]}),now);
}
export async function createPonsTripwireFixtureDatabase(path=':memory:') {
  const db=new D1CompatDatabase(path);await db.exec(D1_SCHEMA_SQL);
  await seedProductionRow(db,rows[0]!);
  const existing=await db.prepare('SELECT publication_version FROM binrat_public_snapshots WHERE chain_id=4663').first();
  if(!existing) await publishFixture(db,BigInt(rows[0]!.block_number),rows[0]!.block_hash,fixtureNow);
  return db;
}
