import { D1PonsOutcomeObservationStore } from '../src/cloudflare/ponsOutcomeStore.js';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import {
  ROBINHOOD_PUBLIC_RPC_FALLBACK_URL,
  resolveRobinhoodArchiveRpcUrl,
  runCloudflarePonsOutcomeCycle
} from '../src/cloudflare/syncQueue.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { RpcPonsOutcomeObservationSource } from '../src/pons/outcomeReceipts.js';
import { PonsLaunchSource } from '../src/pons/ponsSource.js';
import { ROBINHOOD_CHAIN_ID } from '../src/pons/chain.js';
import { D1CompatDatabase } from '../test/support/d1Compat.js';

const CANARY={
  launchId:'c5d9e15fe9926ac76fa8d6cbcbd8fb11dd3c260e2b251a5c17a7435a47baff40',
  token:'0xded2066a8cf7d1406a7d3cb1b1241e25f41bbba4',
  curve:'0xafb0d125689c7d0bd02833adac0e8efb0b64f403',
  launchBlock:76_720_075n,
  checkpointBlock:77_585_328n
} as const;

function gate(condition:unknown,code:string):asserts condition {
  if (!condition) throw new Error(code);
}

const archiveRpcUrl=resolveRobinhoodArchiveRpcUrl({
  BINRAT_ROBINHOOD_ARCHIVE_RPC_URL:process.env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL
});
const discoveryRpcUrl=ROBINHOOD_PUBLIC_RPC_FALLBACK_URL;
const launchSource=new PonsLaunchSource({rpcUrl:discoveryRpcUrl,now:()=>0});
await launchSource.assertAuthority(CANARY.checkpointBlock);
const launchCandidates=await launchSource.catchUp(CANARY.launchBlock,CANARY.launchBlock);
const launch=launchCandidates.find((item)=>
  item.launchId===CANARY.launchId &&
  item.token.toLowerCase()===CANARY.token &&
  item.pool.toLowerCase()===CANARY.curve
);
gate(launch,'PONS_OUTCOME_RUNTIME_CANARY_LAUNCH_MISSING');

const source=new RpcPonsOutcomeObservationSource({discoveryRpcUrl,archiveRpcUrl});
const checkpointPoint=await source.getBlockPoint(CANARY.checkpointBlock);
const launchPoint=await source.getBlockPoint(CANARY.launchBlock);
gate(
  checkpointPoint.timestampMs-launchPoint.timestampMs>=24*60*60*1000,
  'PONS_OUTCOME_RUNTIME_CANARY_NOT_MATURE'
);

const db=new D1CompatDatabase();
await db.exec(D1_SCHEMA_SQL);
const store=new D1Store(db,ROBINHOOD_CHAIN_ID);
try {
  await store.putLaunch(launch);
  await store.commitCheckpoint({
    blockNumber:CANARY.checkpointBlock,
    blockHash:checkpointPoint.blockHash,
    guardBlockNumber:null,
    guardBlockHash:null
  });
  await new D1RuntimeStateStore(db,ROBINHOOD_CHAIN_ID).put({
    sourceVerified:true,
    liveCaughtUp:true,
    headBlock:CANARY.checkpointBlock+2n,
    targetBlock:CANARY.checkpointBlock,
    observationReady:false,
    historyBackfillComplete:false,
    historyBackfillTargetBlock:null,
    lastSyncError:null,
    lastHistoryError:null,
    lastObservationError:null,
    updatedAtMs:checkpointPoint.timestampMs
  });

  const result=await runCloudflarePonsOutcomeCycle(
    {
      DB:db,
      BINRAT_PONS_OUTCOME_ENABLED:'true',
      BINRAT_PONS_OUTCOME_MAX_PER_CYCLE:'3'
    },
    {
      kind:'PONS_OUTCOME_CYCLE',
      cycleId:'o2-live-local-d1-canary',
      enqueuedAtMs:checkpointPoint.timestampMs
    },
    {
      now:()=>checkpointPoint.timestampMs,
      ponsOutcomeSource:source
    }
  );
  gate(result.status==='SUCCESS','PONS_OUTCOME_RUNTIME_CYCLE_NOT_SUCCESS');
  gate(result.inserted===3,'PONS_OUTCOME_RUNTIME_INSERT_COUNT_INVALID');

  const receipts=await new D1PonsOutcomeObservationStore(db).listForLaunch(CANARY.launchId);
  gate(receipts.length===3,'PONS_OUTCOME_RUNTIME_RECEIPT_COUNT_INVALID');
  gate(
    receipts.map((item)=>item.horizonMs).join(',')==='300000,3600000,86400000',
    'PONS_OUTCOME_RUNTIME_HORIZONS_INVALID'
  );

  console.log(JSON.stringify({
    kind:'PONS_OUTCOME_RUNTIME_LOCAL_D1_PROBE_PASS',
    productionD1Touched:false,
    chainId:ROBINHOOD_CHAIN_ID,
    launchId:CANARY.launchId,
    token:CANARY.token,
    curve:CANARY.curve,
    launchBlock:CANARY.launchBlock.toString(),
    checkpointBlock:CANARY.checkpointBlock.toString(),
    result,
    receipts:receipts.map((item)=>({
      horizonMs:item.horizonMs,
      targetTimestampMs:item.targetTimestampMs,
      observedBlock:item.observedBlock.toString(),
      observedBlockHash:item.observedBlockHash,
      observedTimestampMs:item.observedTimestampMs,
      phase:item.phase,
      status:item.status,
      estimatedFdvQuoteRaw:item.estimatedFdvQuoteRaw?.toString() ?? null,
      evidenceDigest:item.evidenceDigest
    }))
  },null,2));
} finally {
  store.close();
  db.close();
}
