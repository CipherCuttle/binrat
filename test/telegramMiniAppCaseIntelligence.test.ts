import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { handleWorkerRequest } from '../src/cloudflare/worker.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import type { D1DatabaseLike, D1PreparedStatementLike, D1ResultLike } from '../src/cloudflare/d1Types.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const TOKEN='123456:case-endpoint-fixture';
const USER_ID=77;
const addr=(n:number)=>('0x'+n.toString(16).padStart(40,'0')) as Hex;
const hash=(n:number)=>('0x'+n.toString(16).padStart(64,'0')) as Hex;

function launch():LaunchObserved {
  return {
    launchId:'a'.repeat(64),
    eventId:'b'.repeat(64),
    chainId:4663,
    blockNumber:200n,
    blockHash:hash(200),
    observedAtMs:10_000_000,
    source:'PONS_V2',
    launcher:addr(1),
    txHash:hash(1200),
    logIndex:0,
    token:addr(2),
    creator:addr(3),
    pool:addr(4),
    name:'Canonical Case',
    symbol:'CASE',
    imageUri:'',
    website:'',
    twitter:'',
    telegram:''
  };
}

function signedInitData(nowMs:number,userId=USER_ID):string {
  const fields={
    auth_date:String(Math.floor(nowMs/1000)),
    query_id:'case-intelligence-test',
    user:JSON.stringify({id:userId,first_name:'Case Tester'})
  };
  const check=Object.entries(fields)
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([key,value])=>`${key}=${value}`)
    .join('\n');
  const secret=createHmac('sha256','WebAppData').update(TOKEN).digest();
  const signature=createHmac('sha256',secret).update(check).digest('hex');
  return new URLSearchParams({...fields,hash:signature}).toString();
}

class ReadOnlyStatement implements D1PreparedStatementLike {
  constructor(
    private readonly inner:D1PreparedStatementLike,
    private readonly deny:()=>never
  ) {}

  bind(...values:unknown[]):D1PreparedStatementLike {
    return new ReadOnlyStatement(this.inner.bind(...values),this.deny);
  }

  run<T=Record<string,unknown>>():Promise<D1ResultLike<T>> {
    return this.deny();
  }

  first<T=Record<string,unknown>>():Promise<T|null> {
    return this.inner.first<T>();
  }

  all<T=Record<string,unknown>>():Promise<D1ResultLike<T>> {
    return this.inner.all<T>();
  }
}

class StrictReadOnlyDb implements D1DatabaseLike {
  writeAttempts=0;

  constructor(private readonly inner:D1DatabaseLike) {}

  private readonly deny=():never=>{
    this.writeAttempts+=1;
    throw new Error('CASE_ENDPOINT_WRITE_ATTEMPT');
  };

  prepare(sql:string):D1PreparedStatementLike {
    return new ReadOnlyStatement(this.inner.prepare(sql),this.deny);
  }

  batch(_statements:D1PreparedStatementLike[]):Promise<D1ResultLike[]> {
    return this.deny();
  }

  exec(_sql:string):Promise<unknown> {
    return this.deny();
  }
}

function privateEnv(db:D1DatabaseLike){
  return {
    DB:db,
    TELEGRAM_BOT_TOKEN:TOKEN,
    BINRAT_AUTONOMOUS_RAT_ENABLED:'true',
    BINRAT_TELEGRAM_UI_V2_ENABLED:'true',
    BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED:'false',
    BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID:String(USER_ID),
    RAT_CANDIDATE_ALLOWED_USER_ID:String(USER_ID)
  };
}

test('authenticated Case endpoint returns one assembled read-only Case pinned to the canonical checkpoint',async()=>{
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const current=launch();
  const now=12_000_000;

  try {
    await store.putLaunch(current);
    await store.putProvenanceFact(await buildProvenanceFact(current));
    await store.commitCheckpoint({
      blockNumber:220n,
      blockHash:hash(220),
      guardBlockNumber:null,
      guardBlockHash:null
    });

    const points=new Map<bigint,{blockNumber:bigint;blockHash:Hex;timestampMs:number}>([
      [200n,{blockNumber:200n,blockHash:hash(200),timestampMs:10_000_000}],
      [220n,{blockNumber:220n,blockHash:hash(220),timestampMs:11_000_000}]
    ]);
    const calls=new Map<string,number>();
    const blockSource={
      async getBlockPoint(blockNumber:bigint){
        const key=blockNumber.toString();
        calls.set(key,(calls.get(key)??0)+1);
        const point=points.get(blockNumber);
        if(!point) throw new Error('POINT_MISSING:'+key);
        return point;
      }
    };

    const readOnly=new StrictReadOnlyDb(db);
    const response=await handleWorkerRequest(
      new Request('https://binrat.example/api/miniapp/case-intelligence',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          initData:signedInitData(now),
          launchId:current.launchId
        })
      }),
      privateEnv(readOnly),
      {
        externalFetch:fetch,
        now:()=>now,
        ponsCaseBlockSource:blockSource
      }
    );

    assert.equal(response.status,200);
    assert.equal(readOnly.writeAttempts,0);
    const body=await response.json() as {
      case:{
        caseVersion:string;
        chainId:number;
        asOfBlock:string;
        current:{launchId:string;token:string;deployer:string;label:string;labelSource:string};
        facts:Array<{kind:string}>;
        handoffs:Array<{kind:string}>;
        coverage:{trashTrail:string;replay:string;funding:string};
        caseDigest:string;
      };
      trashTrail:{
        presentationVersion:string;
        summary:{previousLaunches:number;coverageText:string};
        launches:Array<unknown>;
      };
      replay:{
        replayVersion:string;
        semantics:string;
        asOfBlock:string;
        targetLaunchKnown:boolean;
        targetLaunch:{launchId:string}|null;
        previousLaunches:Array<unknown>;
        outputDigest:string;
      };
    };

    assert.equal(body.case.caseVersion,'BINRAT_CASE_MODEL_V1');
    assert.equal(body.case.chainId,4663);
    assert.equal(body.case.asOfBlock,'220');
    assert.equal(body.case.current.launchId,current.launchId);
    assert.equal(body.case.current.token,current.token);
    assert.equal(body.case.current.deployer,current.creator);
    assert.equal(body.case.current.label,'$CASE');
    assert.equal(body.case.current.labelSource,'CANONICAL_LAUNCH');
    assert.deepEqual(body.case.facts,[]);
    assert.deepEqual(body.case.handoffs.map((item)=>item.kind),['REPLAY']);
    assert.equal(body.case.coverage.trashTrail,'AVAILABLE');
    assert.equal(body.case.coverage.replay,'AVAILABLE');
    assert.equal(body.case.coverage.funding,'NO_POSITIVE_FACT');
    assert.match(body.case.caseDigest,/^[0-9a-f]{64}$/);

    assert.equal(body.trashTrail.presentationVersion,'BINRAT_PONS_TRASH_TRAIL_PRESENTATION_V1');
    assert.equal(body.trashTrail.summary.previousLaunches,0);
    assert.deepEqual(body.trashTrail.launches,[]);
    assert.equal(body.replay.replayVersion,'BINRAT_PONS_REPLAY_LAB_V1');
    assert.equal(body.replay.semantics,'KNOWABLE_AS_OF_BLOCK');
    assert.equal(body.replay.asOfBlock,'220');
    assert.equal(body.replay.targetLaunchKnown,true);
    assert.equal(body.replay.targetLaunch?.launchId,current.launchId);
    assert.deepEqual(body.replay.previousLaunches,[]);
    assert.match(body.replay.outputDigest,/^[0-9a-f]{64}$/);

    assert.equal(calls.get('200'),1);
    assert.equal(calls.get('220'),3);
  } finally {
    store.close();
    db.close();
  }
});

test('Case endpoint rejects forged Telegram auth before reading case evidence',async()=>{
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const now=12_000_000;
  try {
    const forged=new URLSearchParams(signedInitData(now));
    forged.set('hash','0'.repeat(64));
    let blockReads=0;

    const response=await handleWorkerRequest(
      new Request('https://binrat.example/api/miniapp/case-intelligence',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          initData:forged.toString(),
          launchId:'a'.repeat(64)
        })
      }),
      privateEnv(db),
      {
        externalFetch:fetch,
        now:()=>now,
        ponsCaseBlockSource:{
          async getBlockPoint(_blockNumber:bigint){
            blockReads+=1;
            throw new Error('AUTH_SHOULD_PRECEDE_BLOCK_READ');
          }
        }
      }
    );

    assert.equal(response.status,401);
    assert.equal(blockReads,0);
  } finally {
    db.close();
  }
});

test('Case endpoint enforces private allowlist and validates launch id',async()=>{
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const now=12_000_000;
  try {
    const deniedEnv={
      ...privateEnv(db),
      BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID:'78'
    };
    const denied=await handleWorkerRequest(
      new Request('https://binrat.example/api/miniapp/case-intelligence',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          initData:signedInitData(now),
          launchId:'a'.repeat(64)
        })
      }),
      deniedEnv,
      {externalFetch:fetch,now:()=>now}
    );
    assert.equal(denied.status,403);

    const malformed=await handleWorkerRequest(
      new Request('https://binrat.example/api/miniapp/case-intelligence',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          initData:signedInitData(now),
          launchId:'0xdeadbeef'
        })
      }),
      privateEnv(db),
      {externalFetch:fetch,now:()=>now}
    );
    assert.equal(malformed.status,400);
  } finally {
    db.close();
  }
});


test('Case endpoint discards a Case when the canonical checkpoint reorgs during assembly',async()=>{
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store=new D1Store(db,4663);
  const current=launch();
  const now=12_000_000;

  try {
    await store.putLaunch(current);
    await store.putProvenanceFact(await buildProvenanceFact(current));
    await store.commitCheckpoint({
      blockNumber:220n,
      blockHash:hash(220),
      guardBlockNumber:null,
      guardBlockHash:null
    });

    let asOfReads=0;
    const blockSource={
      async getBlockPoint(blockNumber:bigint){
        if(blockNumber===200n) {
          return {blockNumber,blockHash:hash(200),timestampMs:10_000_000};
        }
        if(blockNumber===220n) {
          asOfReads+=1;
          return {
            blockNumber,
            blockHash:asOfReads<3?hash(220):hash(999),
            timestampMs:11_000_000
          };
        }
        throw new Error('POINT_MISSING:'+blockNumber.toString());
      }
    };

    const readOnly=new StrictReadOnlyDb(db);
    const response=await handleWorkerRequest(
      new Request('https://binrat.example/api/miniapp/case-intelligence',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          initData:signedInitData(now),
          launchId:current.launchId
        })
      }),
      privateEnv(readOnly),
      {
        externalFetch:fetch,
        now:()=>now,
        ponsCaseBlockSource:blockSource
      }
    );

    assert.equal(response.status,503);
    assert.equal(readOnly.writeAttempts,0);
    assert.equal(asOfReads,3);
    const body=await response.json() as {error:string};
    assert.equal(body.error,'MINI_APP_UNAVAILABLE');
  } finally {
    store.close();
    db.close();
  }
});
