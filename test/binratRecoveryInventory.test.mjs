import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { inspectRecovery, LIMITS } from '../scripts/binrat-recovery-readonly-inventory.mjs';

const ACCOUNT = '8927d39146b901d0f463b971a1d039e6';
const TOKEN = 'not-a-real-credential-secret';
const root = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}`;
const queue = 'q_001';
const d1 = 'db_001';
const paths = [
  '/workers/scripts/binrat-edge-v0/settings',
  '/workers/scripts/binrat-edge-v0/schedules',
  '/queues?per_page=100',
  `/queues/${queue}`,
  `/queues/${queue}/metrics`,
  '/d1/database?per_page=100',
  `/d1/database/${d1}/time_travel/bookmark`,
  '/subscriptions'
];
const data = {
  [paths[0]]: {bindings:[
    {name:'SYNC_QUEUE',type:'queue',queue_name:'binrat-sync-v0'},
    {name:'DB',type:'d1',id:d1},
    {name:'SECRET',type:'secret_text',text:'PROVIDER_SECRET_MUST_NOT_LEAK'}
  ]},
  [paths[1]]: {schedules:[]},
  [paths[2]]: [{queue_name:'binrat-sync-v0',queue_id:queue}],
  [paths[3]]: {queue_id:queue,queue_name:'binrat-sync-v0',settings:{delivery_paused:true,message_retention_period:86400},consumers_total_count:1,consumers:[{type:'worker'}]},
  [paths[4]]: {backlog_count:53,backlog_bytes:1024,oldest_message_timestamp_ms:1234000},
  [paths[5]]: [{uuid:d1,name:'binrat-production'}],
  [paths[6]]: {bookmark:'RESTORE_BOOKMARK_DO_NOT_LEAK'},
  [paths[7]]: [{id:'subsecret',status:'active'}]
};
function mock({replace={}, codes={}, raw={}, info={}}={}) {
  const calls=[];
  const request=async (url, options)=>{
    const path=url.slice(root.length);
    calls.push({url,options});
    assert.ok(url.startsWith(root+'/'), 'only configured account allowed');
    assert.ok(Object.hasOwn(data,path),`unknown or mutating endpoint: ${path}`);
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'error');
    assert.equal(options.headers.Authorization,`Bearer ${TOKEN}`);
    const status=codes[path]??200;
    if(Object.hasOwn(raw,path))return new Response(raw[path],{status});
    const value=replace[path]??data[path];
    const pageInfo=[paths[2],paths[5]].includes(path) && Array.isArray(value)
      ? {page:1,count:value.length,total_count:value.length,per_page:100} : undefined;
    return Response.json({success:status===200,result:value,
      result_info:Object.hasOwn(info,path)?info[path]:pageInfo}, {status});
  };
  return {request,calls};
}
async function run(m, args={}) {return inspectRecovery({account:ACCOUNT,token:TOKEN,request:m.request,...args});}

test('offline dry-run reports no live runner; live CLI flag never fetches',()=>{
  const script=new URL('../scripts/binrat-recovery-readonly-inventory.mjs',import.meta.url).pathname;
  const dry=execFileSync(process.execPath,[script,'--dry-run'],{encoding:'utf8'});
  assert.equal(JSON.parse(dry).liveRunner,false);
  assert.throws(()=>execFileSync(process.execPath,[script,'--read-only'],{stdio:'pipe'}),error => error.status === 2);
});
test('wrong account/token or untrusted transport is blocked before GET',async()=>{
  const m=mock();
  for(const input of [{account:'wrong',token:TOKEN,request:m.request},{account:ACCOUNT,token:'',request:m.request},{account:ACCOUNT,token:TOKEN}]){
    const result=await inspectRecovery(input);assert.equal(result.status,'BLOCKED'); assert.equal(result.requests,0);
  }
  assert.equal(m.calls.length,0);
});
test('exact eight authorized metadata GETs, no raw IDs, secrets, bookmark or invented cost safety',async()=>{
  const m=mock(); const result=await run(m);
  assert.equal(result.status,'METADATA_ONLY');
  assert.equal(result.requests,8);
  assert.deepEqual(m.calls.map(c=>c.url), paths.map(p=>root+p));
  assert.equal(result.workerBinding,true);
  assert.equal(result.cronCount,0);
  assert.equal(result.queue.deliveryPaused,true);
  assert.equal(result.queue.backlogCount,53);
  assert.equal(result.queue.workerConsumerIdentified,null);
  assert.equal(result.d1.identityMatched,true);
  assert.equal(result.d1.bookmarkAccessible,true);
  assert.equal(result.d1.offPlatformBackupVerified,false);
  assert.equal(result.billing.currentCostCeilingVerified,false);
  assert.equal(result.liveRoutingVerified,false);
  assert.equal(result.sourceCheckpointVerified,false);
  const serialized=JSON.stringify(result);
  for(const forbidden of [TOKEN,ACCOUNT,queue,d1,'RESTORE_BOOKMARK_DO_NOT_LEAK','PROVIDER_SECRET_MUST_NOT_LEAK','subsecret'])
    assert.ok(!serialized.includes(forbidden),`secret leaked: ${forbidden}`);
});
test('bounded output only uses allowlisted fields',async()=>{
 const m=mock({replace:{[paths[4]]:{...data[paths[4]],secret:'LEAK_THIS_STRING'}}});
 const result=await run(m);
 assert.ok(!JSON.stringify(result).includes('LEAK_THIS_STRING'));
 assert.ok(result.apiOutcomes.every(x=>Object.keys(x).sort().join(',')==='bytes,httpStatus,kind'));
});
test('transport abort and HTTP denial stop immediately without retries or provider error strings',async()=>{
 const m=mock({codes:{[paths[1]]:403}});const result=await run(m);
 assert.equal(result.status,'BLOCKED'); assert.equal(result.reason,'AUTH_OR_ACCESS_DENIED');
 assert.equal(result.requests,2);assert.equal(m.calls.length,2);
 assert.ok(!JSON.stringify(result).includes(TOKEN));
});
test('reject injected queue ID and do not reach arbitrary URL',async()=>{
 const m=mock({replace:{[paths[2]]:[{queue_name:'binrat-sync-v0',queue_id:'../hijack'}]}});
 const result=await run(m);assert.equal(result.reason,'QUEUE_IDENTITY_UNKNOWN');
 assert.equal(m.calls.length,3);
});
test('wrong queue identity cannot silently select a different producer/consumer',async()=>{
 const m=mock({replace:{[paths[3]]:{...data[paths[3]],queue_name:'attacker'}}});
 const result=await run(m);assert.equal(result.reason,'QUEUE_IDENTITY_MISMATCH');
 assert.equal(m.calls.length,4);
});
test('reject paginated partial queue or D1 listing instead of assuming absence',async()=>{
 for(const path of [paths[2],paths[5]]){
  const m=mock({info:{[path]:{page:1,per_page:100,total_count:101}}});
  const result=await run(m);
  assert.equal(result.reason,path===paths[2]?'QUEUES_PAGE_INCOMPLETE':'D1_PAGE_INCOMPLETE');
  assert.ok(m.calls.length <= LIMITS.calls);
 }
});
test('missing D1 binding does not guess identity or read bookmark',async()=>{
 const settings={bindings:[{name:'SYNC_QUEUE',type:'queue',queue_name:'binrat-sync-v0'}]};
 const m=mock({replace:{[paths[0]]:settings}});
 const result=await run(m);
 assert.equal(result.status,'INCOMPLETE');assert.equal(result.d1.identityMatched,null);
 assert.equal(result.d1.bookmarkAccessible,null);assert.equal(result.requests,7);
 assert.ok(!m.calls.some(c=>c.url.includes('time_travel')));
});
test('64KiB response body limit is enforced while reading, never retry',async()=>{
 const m=mock({raw:{[paths[0]]:'X'.repeat(LIMITS.bytesPerGet+100)}});
 const result=await run(m);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.reason,'BODY_LIMIT');
 assert.equal(m.calls.length,1);
});
test('invalid JSON fails closed, not logged',async()=>{
 const m=mock({raw:{[paths[1]]:'NOT_JSON'} });const result=await run(m);
 assert.equal(result.status,'BLOCKED');assert.equal(result.reason,'INVALID_JSON');
 assert.equal(m.calls.length,2);
});
test('zero requests after total wall-time exhausted',async()=>{
 const m=mock();let ticks=0;
 const result=await run(m,{now:()=>{ticks++;return ticks===1?0:LIMITS.msTotal+100}});
 assert.equal(result.status,'BLOCKED');assert.equal(result.reason,'TOTAL_WALL_TIME');assert.equal(result.requests,0);
});

test('a truncated consumer listing remains UNKNOWN even if no named consumer appears',async()=>{
 const m=mock({replace:{[paths[3]]:{...data[paths[3]],consumers:[],consumers_total_count:1}}});
 const result=await run(m);
 assert.equal(result.status,'METADATA_ONLY');
 assert.equal(result.queue.workerConsumerIdentified,null);
});
test('hung transport is bounded even if it ignores AbortSignal',async()=>{
 let n=0; const now=()=>++n===1?1000:45995;
 const result=await inspectRecovery({account:ACCOUNT,token:TOKEN,request:()=>new Promise(()=>{}),now});
 assert.equal(result.status,'BLOCKED');assert.equal(result.reason,'TIME_LIMIT');
 assert.equal(result.requests,1);
});

test('missing or contradictory pagination metadata cannot establish unique Queue/D1 identity',async()=>{
  for (const path of [paths[2],paths[5]]) {
    for (const info of [null,{page:2,count:1,total_count:1},{page:1,count:2,total_count:1}]) {
      const m=mock({info:{[path]:info}});
      const result=await run(m);
      assert.equal(result.status,'BLOCKED');
      assert.equal(result.reason,path===paths[2]?'QUEUES_PAGE_INCOMPLETE':'D1_PAGE_INCOMPLETE');
      assert.ok(m.calls.length<=LIMITS.calls);
    }
  }
});
