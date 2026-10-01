import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import worker from '../src/cloudflare/worker.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const CHAIN_ID = 5042;

test('Cloudflare cron queues an independent bounded Pons job', async () => {
  const db = new D1CompatDatabase();
  const sent: Array<{ kind: string }> = [];
  try {
    await worker.scheduled({}, {
      DB: db,
      SYNC_QUEUE: { async send(message) { sent.push(message); } }
    });
    assert.deepEqual(sent.map((message) => message.kind).sort(), [
      'PONS_SYNC_CYCLE', 'SYNC_CYCLE'
    ]);
  } finally { db.close(); }
});

test('Cloudflare health is instant and fail-closed before durable runtime state exists', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  try {
    const response = await worker.fetch(
      new Request('https://binrat.example/api/health'),
      { DB: db }
    );
    assert.equal(response.status, 200);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.ok, false);
    assert.equal(body.indexReady, false);
    assert.equal(body.runtimeFresh, false);
  } finally {
    db.close();
  }
});

test('D1 launch count through checkpoint is exact without loading the full launch set', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  try {
    for (const blockNumber of [99n,100n,101n]) {
      const launcher=address(Number(blockNumber)+1),txHash=hex64(Number(blockNumber)+2),token=address(Number(blockNumber)+3);
      const launch: LaunchObserved={
        launchId:await deriveLaunchId({chainId:4663,launcher,txHash,token,source:'PONS_V2'}),
        eventId:await deriveEventId({chainId:4663,launcher,txHash,logIndex:0,source:'PONS_V2'}),
        chainId:4663,blockNumber,blockHash:hex64(Number(blockNumber)),observedAtMs:1,source:'PONS_V2',
        launcher,txHash,logIndex:0,token,creator:address(55),pool:address(Number(blockNumber)+4),
        name:'Count Rat',symbol:'COUNT',imageUri:'',website:'',twitter:'',telegram:''
      };
      await store.putLaunch(launch);
    }
    assert.equal(await store.countLaunchesThroughBlock(100n),2);
    assert.equal(await store.countLaunchesThroughBlock(101n),3);
  } finally { store.close(); db.close(); }
});

test('Cloudflare health requires checkpoint at or beyond the verified runtime target', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const runtime=new D1RuntimeStateStore(db,4663);
  try {
    await store.commitCheckpoint({blockNumber:100n,blockHash:hex64(100),guardBlockNumber:null,guardBlockHash:null});
    await runtime.put({sourceVerified:true,liveCaughtUp:true,headBlock:102n,targetBlock:99n,
      observationReady:false,historyBackfillComplete:false,historyBackfillTargetBlock:null,lastSyncError:null,lastHistoryError:null,lastObservationError:null,updatedAtMs:Date.now()});
    let response=await worker.fetch(new Request('https://binrat.example/api/health'),{DB:db});
    let body=await response.json() as Record<string,unknown>;
    assert.equal(body.indexReady,true);

    await runtime.put({sourceVerified:true,liveCaughtUp:true,headBlock:102n,targetBlock:101n,
      observationReady:false,historyBackfillComplete:false,historyBackfillTargetBlock:null,lastSyncError:null,lastHistoryError:null,lastObservationError:null,updatedAtMs:Date.now()});
    response=await worker.fetch(new Request('https://binrat.example/api/health'),{DB:db});
    body=await response.json() as Record<string,unknown>;
    assert.equal(body.indexReady,false);
  } finally { db.close(); }
});

test('Cloudflare health exposes an optional non-secret release SHA without changing health status', async () => {
  const db = new D1CompatDatabase();
  try {
    const missing = await worker.fetch(new Request('https://binrat.example/health'), { DB: db });
    const missingBody = await missing.json() as Record<string, unknown>;
    assert.equal(missing.status, 200);
    assert.equal(missingBody.ok, true);
    assert.equal(missingBody.releaseSha, null);

    const stamped = await worker.fetch(
      new Request('https://binrat.example/health'),
      { DB: db, BINRAT_RELEASE_SHA: '9609456' }
    );
    const stampedBody = await stamped.json() as Record<string, unknown>;
    assert.equal(stamped.status, 200);
    assert.equal(stampedBody.ok, true);
    assert.equal(stampedBody.releaseSha, '9609456');
  } finally {
    db.close();
  }
});

test('Cloudflare read API projects the same durable BINRAT evidence from D1', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db, CHAIN_ID);
  const runtime = new D1RuntimeStateStore(db, CHAIN_ID);
  try {
    const launch = await makeLaunch();
    const fact = await buildProvenanceFact(launch);
    assert.equal(await store.putLaunch(launch), 'INSERTED');
    assert.equal(await store.putProvenanceFact(fact), 'INSERTED');
    await store.commitCheckpoint({
      blockNumber: launch.blockNumber,
      blockHash: launch.blockHash,
      guardBlockNumber: launch.blockNumber - 1n,
      guardBlockHash: hex64(99)
    });
    await store.setHistoricalBackfillNextBlock(launch.blockNumber + 1n);
    await runtime.put({
      sourceVerified: true,
      liveCaughtUp: true,
      headBlock: launch.blockNumber + 2n,
      targetBlock: launch.blockNumber,
      observationReady: true,
      historyBackfillComplete: false,
      historyBackfillTargetBlock: launch.blockNumber - 1n,
      lastSyncError: null,
      lastHistoryError: null,
      lastObservationError: null,
      updatedAtMs: Date.now()
    });

    const env = {
      DB: db,
      CAPABILITY_MANIFEST_JSON: JSON.stringify({
        schemaVersion: 'binrat.capability-manifest/0.1',
        capabilities: {},
        launchAuthorization: {
          status: 'BLOCKED',
          marketingAuthorized: false,
          launchAuthorized: false,
          tokenState: 'NOT_LAUNCHED'
        },
        invariant: 'Degen decides attention. Receipts decide truth.'
      })
    };

    const health = await worker.fetch(new Request('https://binrat.example/api/health'), env);
    const healthBody = await health.json() as Record<string, unknown>;
    assert.equal(health.status, 200);
    assert.equal(healthBody.indexReady, true);
    assert.equal(healthBody.launchCount, 1);

    const feedResponse = await worker.fetch(new Request('https://binrat.example/api/feed'), env);
    assert.equal(feedResponse.status, 200);
    const feed = await feedResponse.json() as { schemaVersion: string; bags: Array<{ id: string }> };
    assert.equal(feed.schemaVersion, 'binrat.public-feed/0.1');
    assert.equal(feed.bags[0]?.id, launch.launchId);

    const bag = await worker.fetch(new Request(`https://binrat.example/api/bag/${launch.launchId}`), env);
    assert.equal(bag.status, 200);

    const creator = await worker.fetch(
      new Request(`https://binrat.example/api/creator/${launch.creator}`),
      env
    );
    assert.equal(creator.status, 200);

    const replay = await worker.fetch(
      new Request(`https://binrat.example/api/bag/${launch.launchId}/replay`),
      env
    );
    assert.equal(replay.status, 200);
    const replayBody = await replay.json() as { schemaVersion: string; stages: Array<{ label: string }> };
    assert.equal(replayBody.schemaVersion, 'binrat.replay-bundle/0.1');
    assert.deepEqual(replayBody.stages.map((stage) => stage.label), ['LAUNCH']);

    const capabilities = await worker.fetch(new Request('https://binrat.example/api/capabilities'), env);
    assert.equal(capabilities.status, 200);
  } finally {
    store.close();
    db.close();
  }
});

test('Mini App bootstrap exposes the same verified 4663 latest launches and recurrence summary', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db,4663);
  const runtime = new D1RuntimeStateStore(db,4663);
  const now = Date.now();
  const creator = address(77);
  try {
    const launches: LaunchObserved[] = [];
    for (const blockNumber of [100n,101n]) {
      const launcher=address(1),txHash=hex64(Number(blockNumber)+1000),token=address(Number(blockNumber)+2000);
      const launch: LaunchObserved = {
        launchId:await deriveLaunchId({chainId:4663,launcher,txHash,token,source:'PONS_V2'}),
        eventId:await deriveEventId({chainId:4663,launcher,txHash,logIndex:0,source:'PONS_V2'}),
        chainId:4663,blockNumber,blockHash:hex64(Number(blockNumber)),observedAtMs:now,
        source:'PONS_V2',launcher,txHash,logIndex:0,token,creator,pool:address(Number(blockNumber)+3000),
        name:blockNumber===101n?'Latest Rat':'Older Rat',symbol:blockNumber===101n?'NEW':'OLD',
        imageUri:'',website:'',twitter:'',telegram:''
      };
      launches.push(launch);
      await store.putLaunch(launch);
      await store.putProvenanceFact(await buildProvenanceFact(launch));
    }
    await store.commitCheckpoint({blockNumber:101n,blockHash:hex64(101),guardBlockNumber:100n,guardBlockHash:hex64(100)});
    await runtime.put({sourceVerified:true,liveCaughtUp:true,headBlock:103n,targetBlock:101n,
      observationReady:false,historyBackfillComplete:false,historyBackfillTargetBlock:null,lastSyncError:null,
      lastHistoryError:null,lastObservationError:null,updatedAtMs:now});

    const token='123456:fixture-token';
    const fields={
      auth_date:String(Math.floor(now/1000)),
      query_id:'surface-authority-test',
      user:JSON.stringify({id:77,first_name:'Rat Tester'})
    };
    const check=Object.entries(fields).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}=${value}`).join('\n');
    const secret=createHmac('sha256','WebAppData').update(token).digest();
    const hash=createHmac('sha256',secret).update(check).digest('hex');
    const initData=new URLSearchParams({...fields,hash}).toString();

    const response=await worker.fetch(new Request('https://binrat.example/api/miniapp/bootstrap',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({initData})
    }),{
      DB:db,TELEGRAM_BOT_TOKEN:token,BINRAT_AUTONOMOUS_RAT_ENABLED:'true',BINRAT_TELEGRAM_UI_V2_ENABLED:'true',
      BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED:'false',BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID:'77',
      RAT_CANDIDATE_ALLOWED_USER_ID:'77'
    });
    assert.equal(response.status,200);
    const body=await response.json() as {
      latestLaunches:Array<{symbol:string;blockNumber:string;deployer:string;priorLaunchCount:number}>;
      rats:{chainId:number;candidates:Array<{recurrenceCount:number;latestLaunch:{symbol:string;blockNumber:string}}>}
    };
    assert.equal(body.latestLaunches[0]?.symbol,'NEW');
    assert.equal(body.latestLaunches[0]?.blockNumber,'101');
    assert.equal(body.latestLaunches[0]?.deployer,creator);
    assert.equal(body.latestLaunches[0]?.priorLaunchCount,1);
    assert.equal(body.rats.chainId,4663);
    assert.equal(body.rats.candidates[0]?.recurrenceCount,2);
    assert.equal(body.rats.candidates[0]?.latestLaunch.symbol,'NEW');
    assert.equal(body.rats.candidates[0]?.latestLaunch.blockNumber,'101');
  } finally {
    store.close();
    db.close();
  }
});

test('bounded latest-launch API exposes the newest canonical 4663 launches without the full feed projection', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const runtime=new D1RuntimeStateStore(db,4663);
  const now=Date.now();
  try {
    for (let i=0;i<21;i++) {
      const blockNumber=100n+BigInt(i);
      const launcher=address(100+i),txHash=hex64(200+i),token=address(300+i);
      const launch: LaunchObserved={
        launchId:await deriveLaunchId({chainId:4663,launcher,txHash,token,source:'PONS_V2'}),
        eventId:await deriveEventId({chainId:4663,launcher,txHash,logIndex:0,source:'PONS_V2'}),
        chainId:4663,blockNumber,blockHash:hex64(400+i),observedAtMs:now,source:'PONS_V2',
        launcher,txHash,logIndex:0,token,creator:address(500+(i%3)),pool:address(600+i),
        name:`Launch ${i}`,symbol:`L${i}`,imageUri:'',website:'',twitter:'',telegram:''
      };
      await store.putLaunch(launch);
      await store.putProvenanceFact(await buildProvenanceFact(launch));
    }
    await store.commitCheckpoint({blockNumber:120n,blockHash:hex64(420),guardBlockNumber:null,guardBlockHash:null});
    await runtime.put({sourceVerified:true,liveCaughtUp:true,headBlock:122n,targetBlock:120n,
      observationReady:false,historyBackfillComplete:false,historyBackfillTargetBlock:null,lastSyncError:null,
      lastHistoryError:null,lastObservationError:null,updatedAtMs:now});

    const response=await worker.fetch(new Request('https://binrat.example/api/launches/latest'),{DB:db});
    assert.equal(response.status,200);
    const body=await response.json() as {
      schemaVersion:string;chainId:number;sourceCheckpoint:string;historyCoverage:string;
      launches:Array<{symbol:string;blockNumber:string;factId:string;priorLaunchCount:number}>
    };
    assert.equal(body.schemaVersion,'binrat.latest-launches/0.1');
    assert.equal(body.chainId,4663);
    assert.equal(body.sourceCheckpoint,'120');
    assert.equal(body.historyCoverage,'PARTIAL');
    assert.equal(body.launches.length,20);
    assert.equal(body.launches[0]?.symbol,'L20');
    assert.equal(body.launches[0]?.blockNumber,'120');
    assert.ok(body.launches.every(item=>item.factId.length>0 && Number.isSafeInteger(item.priorLaunchCount)));
  } finally { store.close(); db.close(); }
});

test('active Robinhood authority retires every legacy Arc Rat Radar route instead of mixing chains', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const runtime=new D1RuntimeStateStore(db,4663);
  const now=Date.now();
  try {
    const launcher=address(11),txHash=hex64(12),token=address(13),creator=address(14);
    const launch: LaunchObserved={
      launchId:await deriveLaunchId({chainId:4663,launcher,txHash,token,source:'PONS_V2'}),
      eventId:await deriveEventId({chainId:4663,launcher,txHash,logIndex:0,source:'PONS_V2'}),
      chainId:4663,blockNumber:100n,blockHash:hex64(100),observedAtMs:now,source:'PONS_V2',
      launcher,txHash,logIndex:0,token,creator,pool:address(15),name:'Pons Rat',symbol:'PRAT',
      imageUri:'',website:'',twitter:'',telegram:''
    };
    await store.putLaunch(launch);
    await store.putProvenanceFact(await buildProvenanceFact(launch));
    await store.commitCheckpoint({blockNumber:100n,blockHash:hex64(100),guardBlockNumber:null,guardBlockHash:null});
    await runtime.put({sourceVerified:true,liveCaughtUp:true,headBlock:102n,targetBlock:100n,
      observationReady:false,historyBackfillComplete:false,historyBackfillTargetBlock:null,lastSyncError:null,
      lastHistoryError:null,lastObservationError:null,updatedAtMs:now});

    for (const path of [
      '/api/rat-radar/watchlist',
      '/api/rat-radar/activity/'+'a'.repeat(64),
      '/api/rat-radar/address/'+address(99)+'/activity'
    ]) {
      const response=await worker.fetch(new Request('https://binrat.example'+path),{DB:db});
      assert.equal(response.status,410,path);
      const body=await response.json() as Record<string,unknown>;
      assert.equal(body.error,'LEGACY_ARC_RADAR_RETIRED');
      assert.equal(body.chainId,4663);
      assert.equal(body.replacement,'PONS_DEPLOYER_RECURRENCE');
    }
  } finally { store.close(); db.close(); }
});

test('Cloudflare read API refuses stale runtime authority even when old evidence remains durable', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db, CHAIN_ID);
  const runtime = new D1RuntimeStateStore(db, CHAIN_ID);
  try {
    const launch = await makeLaunch();
    const fact = await buildProvenanceFact(launch);
    await store.putLaunch(launch);
    await store.putProvenanceFact(fact);
    await store.commitCheckpoint({
      blockNumber: launch.blockNumber,
      blockHash: launch.blockHash,
      guardBlockNumber: null,
      guardBlockHash: null
    });
    await runtime.put({
      sourceVerified: true,
      liveCaughtUp: true,
      headBlock: launch.blockNumber + 2n,
      targetBlock: launch.blockNumber,
      observationReady: true,
      historyBackfillComplete: false,
      historyBackfillTargetBlock: null,
      lastSyncError: null,
      lastHistoryError: null,
      lastObservationError: null,
      updatedAtMs: Date.now() - 120_000
    });

    const response = await worker.fetch(
      new Request('https://binrat.example/api/feed'),
      { DB: db, BINRAT_MAX_STATUS_AGE_MS: '60000' }
    );
    assert.equal(response.status, 503);
  } finally {
    store.close();
    db.close();
  }
});

async function makeLaunch(): Promise<LaunchObserved> {
  const launcher = address(1);
  const txHash = hex64(2);
  const token = address(3);
  const launchId = await deriveLaunchId({ chainId: CHAIN_ID, launcher, txHash, token });
  const eventId = await deriveEventId({ chainId: CHAIN_ID, launcher, txHash, logIndex: 4 });
  return {
    launchId,
    eventId,
    chainId: CHAIN_ID,
    blockNumber: 100n,
    blockHash: hex64(100),
    observedAtMs: 100_000,
    source: 'ARCPAD',
    launcher,
    txHash,
    logIndex: 4,
    token,
    creator: address(5),
    pool: address(6),
    name: 'Cloud Rat',
    symbol: 'RAT',
    imageUri: '',
    website: '',
    twitter: '',
    telegram: ''
  };
}

function address(seed: number): Hex {
  return `0x${seed.toString(16).padStart(40, '0').slice(-40)}` as Hex;
}

function hex64(seed: number): Hex {
  return `0x${seed.toString(16).padStart(64, '0').slice(-64)}` as Hex;
}
