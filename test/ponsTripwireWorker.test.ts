import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { handleWorkerRequest, type BinratWorkerEnv } from '../src/cloudflare/worker.js';
import { capturedProduction, fixtureNow, fixtureSource, createPonsTripwireFixtureDatabase } from './support/ponsTripwireFixture.js';

const token = '12345:OFFLINE-ONLY-MOCK-TOKEN';
const caseId = capturedProduction.openedCaseLaunchId;
function signed(userId=42, now=fixtureNow) {
  const params = new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:userId,first_name:'Offline owner'})});
  const check = [...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const key = createHmac('sha256','WebAppData').update(token).digest();
  params.set('hash',createHmac('sha256',key).update(check).digest('hex'));
  return params.toString();
}
function env(db: BinratWorkerEnv['DB']): BinratWorkerEnv {
  return {DB:db,BINRAT_PONS_READ_ONLY:'true',BINRAT_PONS_TRIPWIRE_ENABLED:'true',BINRAT_PONS_TRIPWIRE_ALLOWED_USER_ID:'42',TELEGRAM_BOT_TOKEN:token,TELEGRAM_WEBHOOK_SECRET:'offline-secret'};
}
const noNetwork: typeof fetch = async()=>{throw new Error('UNEXPECTED_NETWORK');};
async function call(e: BinratWorkerEnv, action: string, input: unknown={initData:signed(),caseId}, now=fixtureNow) {
  return handleWorkerRequest(new Request(`https://binrat.tech/api/pons-tripwire/${action}`,{method:'POST',body:JSON.stringify(input)}),e,{now:()=>now,externalFetch:noNetwork,ponsTripwireSource:fixtureSource});
}
test('real Case uses signed owner auth, derives exact deployer, persists status and cancels even with stale or removed source evidence',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try {
    const e=env(db);
    assert.equal((await (await call(e,'status')).json()).watch,null);
    const created=await call(e,'watch');assert.equal(created.status,200);
    const watch=(await created.json()).watch;
    assert.equal(watch.deployer,capturedProduction.deployer);
    assert.equal(watch.sourceCaseUrl,`https://binrat.tech/bag/${caseId}`);
    const status=(await (await call(e,'status')).json()).watch;
    assert.equal(status.generation,watch.generation);
    await db.prepare('DELETE FROM launches WHERE launch_id=?').bind(caseId).run();
    const staleNow=fixtureNow+600_000;
    const cancelled=await call(e,'cancel',{initData:signed(42,staleNow),caseId},staleNow);
    assert.equal(cancelled.status,200);assert.equal((await cancelled.json()).watch.state,'CANCELLED');
    assert.equal((await (await call(e,'status',{initData:signed(42,staleNow),caseId},staleNow)).json()).watch.state,'CANCELLED');
  } finally {db.close();}
});
test('forged, expired, different owner, client-supplied authority and oversized bodies fail before arming',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try {
    const e=env(db);
    assert.equal((await call(e,'watch',{initData:'forged',caseId})).status,401);
    assert.equal((await call(e,'watch',{initData:signed(42,fixtureNow-301_000),caseId})).status,401);
    assert.equal((await call(e,'watch',{initData:signed(43),caseId})).status,403);
    assert.equal((await call(e,'watch',{initData:signed(),caseId,chatId:43,deployer:capturedProduction.deployer})).status,400);
    assert.equal((await call(e,'watch',{initData:'x'.repeat(17_000),caseId})).status,413);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM pons_tripwire_watches').first<{n:number}>())!.n,0);
  } finally {db.close();}
});
test('disabled default and unrelated mutations remain suppressed by Pons read-only profile',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try {
    const e=env(db);delete e.BINRAT_PONS_TRIPWIRE_ENABLED;
    assert.equal((await call(e,'watch')).status,405);
    e.BINRAT_PONS_TRIPWIRE_ENABLED='true';
    for(const path of ['/api/miniapp/bootstrap','/__candidate/rat-smoke','/__candidate/pons-bootstrap','/api/holder/session']){
      const response=await handleWorkerRequest(new Request(`https://binrat.tech${path}`,{method:'POST',body:'{}'}),e,{now:()=>fixtureNow,externalFetch:noNetwork});
      assert.equal(response.status,405);
    }
    assert.equal((await handleWorkerRequest(new Request('https://binrat.tech/api/pons-tripwire/watch'),e)).status,405);
  } finally {db.close();}
});
test('Case handoff uses Telegram bounded start payload and exact web_app URL, never auto opts in, deduplicates',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try {
    const e=env(db);e.BINRAT_PONS_TRIPWIRE_DELIVERY_ENABLED='true';const sent:any[]=[];
    const mock:typeof fetch=async(url,init)=>{assert.equal(String(url),`https://api.telegram.org/bot${token}/sendMessage`);sent.push(JSON.parse(String(init?.body)));return new Response(JSON.stringify({ok:true,result:{message_id:73}}));};
    const payload='pons_'+Buffer.from(caseId,'hex').toString('base64url');assert.equal(payload.length,48);
    const update={update_id:1,message:{message_id:1,chat:{id:42,type:'private'},from:{id:42,is_bot:false},text:`/start ${payload}`}};
    const request=(secret='offline-secret',value=update)=>new Request('https://binrat.tech/telegram/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body:JSON.stringify(value)});
    const deps={now:()=>fixtureNow,externalFetch:mock};
    assert.equal((await handleWorkerRequest(request('invalid'),e,deps)).status,401);
    assert.equal((await handleWorkerRequest(request(),e,deps)).status,200);
    assert.equal((await handleWorkerRequest(request(),e,deps)).status,200);
    assert.equal(sent.length,1);assert.equal(sent[0].chat_id,42);
    assert.equal(sent[0].reply_markup.inline_keyboard[0][0].web_app.url,`https://binrat.tech/bag/${caseId}`);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM pons_tripwire_watches').first<{n:number}>())!.n,0);
    const unrelated={...update,update_id:2,message:{...update.message,text:'/watch 0x0000000000000000000000000000000000000001'}};
    assert.equal((await handleWorkerRequest(request('offline-secret',unrelated),e,deps)).status,200);
    assert.equal(sent.length,1);
  } finally {db.close();}
});
test('ambiguous handoff has durable terminal claim before mock transport and cannot resend',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try {
    let attempts=0;const e=env(db);e.BINRAT_PONS_TRIPWIRE_DELIVERY_ENABLED='true';const deps={now:()=>fixtureNow,externalFetch:(async()=>{attempts++;throw new Error('MOCK_RESPONSE_LOST');}) as typeof fetch};
    const payload=Buffer.from(caseId,'hex').toString('base64url');
    const request=()=>new Request('https://binrat.tech/telegram/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':'offline-secret'},body:JSON.stringify({update_id:55,message:{chat:{id:42,type:'private'},from:{id:42},text:`/start pons_${payload}`}})});
    assert.equal((await (await handleWorkerRequest(request(),e,deps)).json()).delivery,'UNKNOWN');
    assert.equal((await (await handleWorkerRequest(request(),e,deps)).json()).duplicate,true);
    assert.equal(attempts,1);
  } finally {db.close();}
});
test('cancellation cannot report success while an opt-in is still awaiting source verification',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try {
    const e=env(db);let release!:()=>void;let entered!:()=>void;
    const sourceEntered=new Promise<void>(resolve=>{entered=resolve;});
    const sourceWait=new Promise<void>(resolve=>{release=resolve;});
    const source={...fixtureSource,async head(){entered();await sourceWait;return fixtureSource.head();}};
    const pending=handleWorkerRequest(new Request('https://binrat.tech/api/pons-tripwire/watch',{method:'POST',body:JSON.stringify({initData:signed(),caseId})}),e,{now:()=>fixtureNow,externalFetch:noNetwork,ponsTripwireSource:source});
    await sourceEntered;
    assert.equal((await call(e,'cancel')).status,503);
    release();assert.equal((await pending).status,200);
    assert.equal((await (await call(e,'cancel')).json()).watch.state,'CANCELLED');
  }finally{db.close();}
});

test('expired mutation lease cannot commit after source awaits, including after cancellation wins',async()=>{
  for(const cancel of [false,true]) {
    const db=await createPonsTripwireFixtureDatabase();try {
      const e=env(db);let now=fixtureNow;let release!:()=>void;let entered!:()=>void;
      const sourceEntered=new Promise<void>(resolve=>{entered=resolve;});
      const sourceWait=new Promise<void>(resolve=>{release=resolve;});
      const source={...fixtureSource,async head(){entered();await sourceWait;return fixtureSource.head();}};
      const pending=handleWorkerRequest(new Request('https://binrat.tech/api/pons-tripwire/watch',{method:'POST',body:JSON.stringify({initData:signed(),caseId})}),e,{now:()=>now,externalFetch:noNetwork,ponsTripwireSource:source});
      await sourceEntered;now+=90_001;
      if(cancel) assert.equal((await call(e,'cancel',{initData:signed(42,now),caseId},now)).status,200);
      release();assert.equal((await pending).status,503);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM pons_tripwire_watches').first<{n:number}>())!.n,0);
    }finally{db.close();}
  }
});

test('Telegram handoff has its own default-off delivery authorization',async()=>{
  const db=await createPonsTripwireFixtureDatabase();try {
    const e=env(db);let sends=0;
    const request=new Request('https://binrat.tech/telegram/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':'offline-secret'},body:JSON.stringify({update_id:66,message:{chat:{id:42,type:'private'},from:{id:42},text:`/start pons_${Buffer.from(caseId,'hex').toString('base64url')}`}})});
    const response=await handleWorkerRequest(request,e,{now:()=>fixtureNow,externalFetch:async()=>{sends++;throw new Error('MUST_NOT_SEND');}});
    assert.equal(response.status,403);assert.equal((await response.json()).error,'PONS_TRIPWIRE_DELIVERY_DISABLED');assert.equal(sends,0);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM telegram_update_receipts').first<{n:number}>())!.n,0);
  }finally{db.close();}
});
