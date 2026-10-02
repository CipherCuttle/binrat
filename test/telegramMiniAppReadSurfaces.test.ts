import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { handleWorkerRequest } from '../src/cloudflare/worker.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1PonsOutcomeObservationStore } from '../src/cloudflare/ponsOutcomeStore.js';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import type { D1DatabaseLike, D1PreparedStatementLike, D1ResultLike } from '../src/cloudflare/d1Types.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { buildPonsCurveOutcomeCapabilityReceipt, NATIVE_QUOTE } from '../src/pons/outcomeCapability.js';
import { buildPonsOutcomeObservationReceipt } from '../src/pons/outcomeReceipts.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const USER_ID=77;
const DEPLOYER='0x0000000000000000000000000000000000000042' as Hex;

function addr(n:number):Hex { return `0x${n.toString(16).padStart(40,'0')}` as Hex; }
function hash(n:number):Hex { return `0x${n.toString(16).padStart(64,'0')}` as Hex; }

function launch(input:{id:string;block:number;token:number;curve:number;symbol:string}):LaunchObserved {
  return {
    launchId:input.id,eventId:input.id,chainId:4663,blockNumber:BigInt(input.block),
    blockHash:hash(input.block),observedAtMs:999_000_000,source:'PONS_V2',
    launcher:addr(999),txHash:hash(input.block+10_000),logIndex:0,token:addr(input.token),
    creator:DEPLOYER,pool:addr(input.curve),name:input.symbol,symbol:input.symbol,
    imageUri:'',website:'',twitter:'',telegram:''
  };
}

async function memoryReceipt(value:LaunchObserved) {
  const horizonMs=300_000;
  const launchTimestampMs=1_000_000;
  const capability=await buildPonsCurveOutcomeCapabilityReceipt({
    launch:{launchId:value.launchId,token:value.token,curve:value.pool},
    observedBlock:110n,
    observedBlockHash:hash(110),
    observedTimestampMs:launchTimestampMs+horizonMs,
    pairToken:NATIVE_QUOTE,
    quoteDecimals:18,
    totalSupply:10n**18n,
    graduated:false,
    quoteReserve:2n*10n**18n,
    tokenReserve:10n**18n
  });
  return buildPonsOutcomeObservationReceipt({
    launch:{launchId:value.launchId,token:value.token,curve:value.pool},
    horizonMs,
    targetTimestampMs:launchTimestampMs+horizonMs,
    capability
  });
}

function miniAppInitData(now:number,token:string):string {
  const fields={
    auth_date:String(Math.floor(now/1000)),
    query_id:'miniapp-read-surfaces',
    user:JSON.stringify({id:USER_ID,first_name:'Rat Tester'})
  };
  const check=Object.entries(fields)
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([key,value])=>`${key}=${value}`)
    .join('\n');
  const secret=createHmac('sha256','WebAppData').update(token).digest();
  const digest=createHmac('sha256',secret).update(check).digest('hex');
  return new URLSearchParams({...fields,hash:digest}).toString();
}

class ReadOnlyStatement implements D1PreparedStatementLike {
  constructor(
    private readonly inner:D1PreparedStatementLike,
    private readonly onWrite:()=>never
  ) {}
  bind(...values:unknown[]):D1PreparedStatementLike {
    return new ReadOnlyStatement(this.inner.bind(...values),this.onWrite);
  }
  run<T=Record<string,unknown>>():Promise<D1ResultLike<T>> { return this.onWrite(); }
  first<T=Record<string,unknown>>():Promise<T|null> { return this.inner.first<T>(); }
  all<T=Record<string,unknown>>():Promise<D1ResultLike<T>> { return this.inner.all<T>(); }
}

class StrictReadOnlyDb implements D1DatabaseLike {
  writeAttempts=0;
  constructor(private readonly inner:D1DatabaseLike) {}
  private readonly denyWrite=():never=>{
    this.writeAttempts+=1;
    throw new Error('PASSIVE_MINIAPP_WRITE_ATTEMPT');
  };
  prepare(sql:string):D1PreparedStatementLike {
    return new ReadOnlyStatement(this.inner.prepare(sql),this.denyWrite);
  }
  batch(_statements:D1PreparedStatementLike[]):Promise<D1ResultLike[]> { return this.denyWrite(); }
  exec(_sql:string):Promise<unknown> { return this.denyWrite(); }
}

function privateEnv(db:D1DatabaseLike,token:string) {
  return {
    DB:db,
    TELEGRAM_BOT_TOKEN:token,
    BINRAT_AUTONOMOUS_RAT_ENABLED:'true',
    BINRAT_TELEGRAM_UI_V2_ENABLED:'true',
    BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED:'false',
    BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID:String(USER_ID),
    RAT_CANDIDATE_ALLOWED_USER_ID:String(USER_ID)
  };
}

async function post(path:string,db:D1DatabaseLike,token:string,now:number,body:Record<string,unknown>={}) {
  return handleWorkerRequest(
    new Request(`https://binrat.example${path}`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({initData:miniAppInitData(now,token),...body})
    }),
    privateEnv(db,token),
    {externalFetch:fetch,now:()=>now}
  );
}

test('Mini App HOT, NEW and WATCH surfaces are independent passive reads with zero D1 writes', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const runtime=new D1RuntimeStateStore(db,4663);
  const outcomeStore=new D1PonsOutcomeObservationStore(db);
  const first=launch({id:'a'.repeat(64),block:100,token:1,curve:2,symbol:'OLD'});
  const current=launch({id:'b'.repeat(64),block:200,token:3,curve:4,symbol:'NOW'});
  const now=101_000_000;
  const token='123456:fixture-token';
  try {
    await store.putLaunch(first);
    await store.putProvenanceFact(await buildProvenanceFact(first));
    await store.putLaunch(current);
    await store.putProvenanceFact(await buildProvenanceFact(current));
    await store.commitCheckpoint({
      blockNumber:220n,blockHash:hash(220),guardBlockNumber:null,guardBlockHash:null
    });
    await runtime.put({
      sourceVerified:true,
      liveCaughtUp:true,
      headBlock:220n,
      targetBlock:220n,
      observationReady:true,
      historyBackfillComplete:false,
      historyBackfillTargetBlock:null,
      lastSyncError:null,
      lastHistoryError:null,
      lastObservationError:null,
      updatedAtMs:now
    });
    await outcomeStore.put(await memoryReceipt(first));

    const readOnly=new StrictReadOnlyDb(db);
    const [hotResponse,latestResponse,watchesResponse]=await Promise.all([
      post('/api/miniapp/hot',readOnly,token,now),
      post('/api/miniapp/latest',readOnly,token,now),
      post('/api/miniapp/watches',readOnly,token,now)
    ]);

    assert.equal(hotResponse.status,200);
    assert.equal(latestResponse.status,200);
    assert.equal(watchesResponse.status,200);
    assert.equal(readOnly.writeAttempts,0);

    const hot=await hotResponse.json() as {
      hotGarbage:{
        ruleVersion:string;
        candidates:Array<{
          deployer:string;
          recurrenceCount:number;
          latestLaunch:{launchId:string};
          previousLaunches:Array<{launchId:string}>;
          memory:{rememberedPriorLaunches:number;outcomeReceipts:number};
        }>;
      };
    };
    assert.equal(hot.hotGarbage.ruleVersion,'HOT_GARBAGE_PONS_RECURRENCE_V1');
    assert.equal(hot.hotGarbage.candidates.length,1);
    assert.equal(hot.hotGarbage.candidates[0]?.deployer,DEPLOYER);
    assert.equal(hot.hotGarbage.candidates[0]?.recurrenceCount,2);
    assert.equal(hot.hotGarbage.candidates[0]?.latestLaunch.launchId,current.launchId);
    assert.equal(hot.hotGarbage.candidates[0]?.previousLaunches[0]?.launchId,first.launchId);
    assert.deepEqual(hot.hotGarbage.candidates[0]?.memory,{
      rememberedPriorLaunches:1,
      outcomeReceipts:1
    });

    const latest=await latestResponse.json() as {launches:Array<{launchId:string;priorLaunchCount:number}>};
    assert.equal(latest.launches[0]?.launchId,current.launchId);
    assert.equal(latest.launches[0]?.priorLaunchCount,1);

    const watches=await watchesResponse.json() as {watches:unknown[]};
    assert.deepEqual(watches.watches,[]);

    const cases=await db.prepare('SELECT COUNT(*) AS n FROM rat_v1_cases').first<{n:number}>();
    const snapshots=await db.prepare('SELECT COUNT(*) AS n FROM rat_v11_pons_discovery_snapshots').first<{n:number}>();
    assert.equal(Number(cases?.n??-1),0);
    assert.equal(Number(snapshots?.n??-1),0);
  } finally {
    store.close();
    db.close();
  }
});

test('Mini App creates a case only after explicit DIG', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const runtime=new D1RuntimeStateStore(db,4663);
  const value=launch({id:'c'.repeat(64),block:100,token:5,curve:6,symbol:'DIG'});
  const now=101_000_000;
  const token='123456:fixture-token';
  try {
    await store.putLaunch(value);
    await store.putProvenanceFact(await buildProvenanceFact(value));
    await store.commitCheckpoint({
      blockNumber:120n,blockHash:hash(120),guardBlockNumber:null,guardBlockHash:null
    });
    await runtime.put({
      sourceVerified:true,
      liveCaughtUp:true,
      headBlock:120n,
      targetBlock:120n,
      observationReady:false,
      historyBackfillComplete:false,
      historyBackfillTargetBlock:null,
      lastSyncError:null,
      lastHistoryError:null,
      lastObservationError:null,
      updatedAtMs:now
    });

    const before=await db.prepare('SELECT COUNT(*) AS n FROM rat_v1_cases').first<{n:number}>();
    assert.equal(Number(before?.n??-1),0);

    const response=await post('/api/miniapp/dig',db,token,now,{deployer:DEPLOYER});
    assert.equal(response.status,200);
    const body=await response.json() as {receipt:{caseId:string;subject:{entityId:string}}};
    assert.match(body.receipt.caseId,/^[0-9a-f]{64}$/);
    assert.equal(body.receipt.subject.entityId,DEPLOYER);

    const after=await db.prepare('SELECT COUNT(*) AS n FROM rat_v1_cases').first<{n:number}>();
    assert.equal(Number(after?.n??-1),1);
  } finally {
    store.close();
    db.close();
  }
});
