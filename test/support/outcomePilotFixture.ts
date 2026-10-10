// EXPLICIT SYNTHETIC OFFLINE FIXTURE. No network, paid RPC, queue or production D1.
import { readFileSync } from 'node:fs';
import { autonomousFixture,hash } from './autonomousFixture.js';
import { buildPonsCurveOutcomeCapabilityReceipt } from '../../src/pons/outcomeCapability.js';
import type { PonsOutcomeObservationSource } from '../../src/pons/outcomeReceipts.js';
import { enqueuePonsOutcomeCycle,handleSyncQueueBatch,type BinratSyncMessage,type CloudflareSyncEnv } from '../../src/cloudflare/syncQueue.js';
import { latestPonsLaunchSnapshot } from '../../src/autonomous/rats.js';
import { buildPublicSnapshot,publishPublicSnapshot } from '../../src/cloudflare/publicSnapshot.js';

export const PILOT_SCHEMA=readFileSync(new URL('../../cloudflare/migrations/20261010_pons_outcome_pilot.sql',import.meta.url),'utf8');
export async function outcomePilotFixture() {
  const f=await autonomousFixture();const origin=f.now();
  await f.db.exec(PILOT_SCHEMA);
  const current=await f.launch(101);
  f.advance(600000);await f.checkpoint(110);
  await publishFixture(f);
  await f.db.prepare(`INSERT INTO pons_outcome_pilots(pilot_id,enabled,start_block,valid_from_ms,expires_ms,rpc_remaining,cycles_remaining)
    VALUES ('fixture',1,99,?,?,120,3)`).bind(origin-60000,origin+172740000).run();
  for (const h of [300000,3600000,86400000]) await f.db.prepare(`INSERT INTO pons_outcome_jobs
    (pilot_id,launch_id,horizon_ms,launch_timestamp_ms,due_ms) VALUES ('fixture',?,?,?,?)`)
    .bind(f.initial.launchId,h,origin,origin+h).run();
  const messages:BinratSyncMessage[]=[];
  const env:CloudflareSyncEnv={DB:f.db,BINRAT_PONS_READ_ONLY:'true',BINRAT_PONS_OUTCOME_ENABLED:'true',
    BINRAT_PONS_OUTCOME_COLLECT_AUTHORIZED:'true',BINRAT_PONS_OUTCOME_PILOT_ID:'fixture',SYNC_QUEUE:{send:async m=>{messages.push(m);}}};
  let reads=0,graduated=false;
  const source:PonsOutcomeObservationSource={
    assertAuthority:async()=>{},
    getBlockPoint:async n=>{reads++;return {blockNumber:n,blockHash:hash(Number(n)),timestampMs:origin+Number(n-100n)*60000};},
    readOutcomeAt:async(l,n)=>{
      reads++;
      return buildPonsCurveOutcomeCapabilityReceipt({launch:l,observedBlock:n,observedBlockHash:hash(Number(n)),
        observedTimestampMs:origin+Number(n-100n)*60000,pairToken:'0x'+'0'.repeat(40) as `0x${string}`,
        quoteDecimals:18,totalSupply:1000000n,graduated,quoteReserve:graduated?null:10n,tokenReserve:graduated?null:500000n});
    }
  };
  const execute=async(m:BinratSyncMessage,override=source)=>{
    let ack=0,retry=0;
    await handleSyncQueueBatch({messages:[{body:m,ack(){ack++;},retry(){retry++;}}]},env,{now:f.now,ponsOutcomeSource:override});
    return {ack,retry};
  };
  const schedule=async()=>{await enqueuePonsOutcomeCycle(env,f.now());return messages.at(-1)!;};
  const receipts=()=>f.db.prepare('SELECT * FROM pons_outcome_receipts WHERE launch_id=?').bind(f.initial.launchId).all();
  return {...f,origin,current,env,source,messages,schedule,execute,receipts,reads:()=>reads,setGraduated:(v:boolean)=>{graduated=v;}};
}

export async function publishFixture(f:Pick<Awaited<ReturnType<typeof autonomousFixture>>,'db'|'now'>) {
  const latest=await latestPonsLaunchSnapshot(f.db,f.now(),20);
  await publishPublicSnapshot(f.db,await buildPublicSnapshot({schemaVersion:'binrat.latest-launches/0.1',chainId:4663,
    sourceCheckpoint:latest.sourceCheckpoint,checkpointBlockHash:latest.checkpointBlockHash,historyCoverage:'PARTIAL',launches:latest.launches}),f.now());
}
