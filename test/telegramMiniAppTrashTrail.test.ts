import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { handleWorkerRequest } from '../src/cloudflare/worker.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { D1PonsOutcomeObservationStore } from '../src/cloudflare/ponsOutcomeStore.js';
import { D1PonsTokenIdentityStore } from '../src/cloudflare/ponsTokenIdentityStore.js';
import { buildPonsTokenIdentityReceipt } from '../src/pons/tokenIdentity.js';
import type { D1DatabaseLike, D1PreparedStatementLike, D1ResultLike } from '../src/cloudflare/d1Types.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
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

async function completeReceipt(
  value:LaunchObserved,
  horizonMs:number,
  launchTimestampMs:number,
  observedBlock:number,
  raw:bigint
) {
  const capability=await buildPonsCurveOutcomeCapabilityReceipt({
    launch:{launchId:value.launchId,token:value.token,curve:value.pool},
    observedBlock:BigInt(observedBlock),
    observedBlockHash:hash(observedBlock),
    observedTimestampMs:launchTimestampMs+horizonMs,
    pairToken:NATIVE_QUOTE,
    quoteDecimals:18,
    totalSupply:10n**18n,
    graduated:false,
    quoteReserve:raw,
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
    query_id:'trash-trail-endpoint-test',
    user:JSON.stringify({id:USER_ID,first_name:'Rat Tester'})
  };
  const check=Object.entries(fields)
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([key,value])=>`${key}=${value}`)
    .join('\n');
  const secret=createHmac('sha256','WebAppData').update(token).digest();
  const hash=createHmac('sha256',secret).update(check).digest('hex');
  return new URLSearchParams({...fields,hash}).toString();
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
    throw new Error('MINI_APP_RAT_TRAP_WRITE_ATTEMPT');
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

test('Mini App Trash Trail endpoint returns coverage-first shared presentation with zero D1 writes', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const outcomeStore=new D1PonsOutcomeObservationStore(db);
  const identityStore=new D1PonsTokenIdentityStore(db);
  const prior=launch({id:'a'.repeat(64),block:100,token:1,curve:2,symbol:''});
  const current=launch({id:'b'.repeat(64),block:300,token:3,curve:4,symbol:'NOW'});
  const now=101_000_000;
  const token='123456:fixture-token';
  try {
    await store.putLaunch(prior);
    await store.putLaunch(current);
    await store.commitCheckpoint({
      blockNumber:400n,blockHash:hash(400),guardBlockNumber:null,guardBlockHash:null
    });
    await outcomeStore.put(await completeReceipt(prior,300_000,1_000_000,110,2n*10n**18n));
    await identityStore.put(await buildPonsTokenIdentityReceipt({
      launch:{launchId:prior.launchId,token:prior.token},
      observedBlock:400n,observedBlockHash:hash(400),
      name:'Old Scrap Identity',symbol:'OLDID',decimals:18
    }));

    const points=new Map<bigint,{blockNumber:bigint;blockHash:Hex;timestampMs:number}>([
      [100n,{blockNumber:100n,blockHash:hash(100),timestampMs:1_000_000}],
      [300n,{blockNumber:300n,blockHash:hash(300),timestampMs:100_000_000}],
      [400n,{blockNumber:400n,blockHash:hash(400),timestampMs:now}]
    ]);
    const readOnly=new StrictReadOnlyDb(db);
    const response=await handleWorkerRequest(
      new Request('https://binrat.example/api/miniapp/trash-trail',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          initData:miniAppInitData(now,token),
          launchId:current.launchId
        })
      }),
      privateEnv(readOnly,token),
      {
        externalFetch:fetch,
        now:()=>now,
        ponsTrashTrailBlockSource:{
          async getBlockPoint(blockNumber) {
            const point=points.get(blockNumber);
            if(!point) throw new Error('POINT_MISSING');
            return point;
          }
        }
      }
    );

    assert.equal(response.status,200);
    assert.equal(readOnly.writeAttempts,0);
    const body=await response.json() as {
      trashTrail:{
        heading:string;
        summary:{previousLaunches:number;launchesWithAnyMemory:number;canOfferRatWatch:boolean;coverageText:string};
        launches:Array<{label:string;labelSource:string;memoryState:string;highestObservedText:string|null;observations:Array<{horizonLabel:string;state:string;valueText:string|null;quoteLabel:string|null}>}>;
        footer:string;
      }
    };
    assert.equal(body.trashTrail.heading,'TRASH TRAIL');
    assert.equal(body.trashTrail.summary.previousLaunches,1);
    assert.equal(body.trashTrail.summary.launchesWithAnyMemory,1);
    assert.equal(body.trashTrail.summary.canOfferRatWatch,true);
    assert.match(body.trashTrail.summary.coverageText,/I know what happened next for 1 of 1 prior launch/);
    assert.equal(body.trashTrail.launches[0]?.label,'$OLDID');
    assert.equal(body.trashTrail.launches[0]?.labelSource,'PERSISTED_TOKEN_IDENTITY');
    assert.equal(body.trashTrail.launches[0]?.memoryState,'PARTIAL');
    assert.match(body.trashTrail.launches[0]?.highestObservedText??'',/2 ETH est\. FDV @ 5m/);
    const rendered=JSON.stringify(body.trashTrail);
    assert.doesNotMatch(rendered,/\bATH\b|market cap|USD|prediction claim/i);
    assert.match(body.trashTrail.footer,/Observed history, not a prediction/);
  } finally {
    store.close();
    db.close();
  }
});

test('Mini App Trash Trail endpoint rejects an invalid launch id before block reads or D1 writes', async () => {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const now=101_000_000;
  const token='123456:fixture-token';
  const readOnly=new StrictReadOnlyDb(db);
  let blockReads=0;
  try {
    const response=await handleWorkerRequest(
      new Request('https://binrat.example/api/miniapp/trash-trail',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({initData:miniAppInitData(now,token),launchId:'not-a-launch'})
      }),
      privateEnv(readOnly,token),
      {
        externalFetch:fetch,
        now:()=>now,
        ponsTrashTrailBlockSource:{
          async getBlockPoint(blockNumber) {
            blockReads+=1;
            return {blockNumber,blockHash:hash(Number(blockNumber)),timestampMs:now};
          }
        }
      }
    );
    assert.equal(response.status,400);
    assert.deepEqual(await response.json(),{error:'MINI_APP_BODY_INVALID'});
    assert.equal(blockReads,0);
    assert.equal(readOnly.writeAttempts,0);
  } finally {
    db.close();
  }
});
