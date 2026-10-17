import test from 'node:test';
import assert from 'node:assert/strict';
import {inspect} from '../scripts/binrat-cloudflare-control-inspect.mjs';
const ACC='8927d39146b901d0f463b971a1d039e6',SECRET='private-test-token-example';
function make({paused=false,crons=['* * * * *'],queuePresent=true,forbidQueue=false}={}){
 const calls=[];
 const request=async (url,opts)=>{
  calls.push({url,opts});
  let value;
  if(url.endsWith('/workers/scripts/binrat-edge-v0/settings'))value={
   bindings:[{type:'queue',name:'SYNC_QUEUE',queue_name:'binrat-sync-v0'},{type:'secret_text',name:'API_KEY',text:'SECRET_LEAK'}]};
  else if(url.endsWith('/workers/scripts/binrat-edge-v0/schedules'))
   value={schedules:crons.map(cron=>({cron}))};
  else if(url.endsWith('/queues?per_page=100'))
   value=queuePresent?[{queue_name:'binrat-sync-v0',queue_id:'uuid_123',settings:{delivery_paused:paused}}]:[];
  else if(url.endsWith('/queues/uuid_123'))value={queue_name:'binrat-sync-v0',settings:{delivery_paused:paused},
   producers:[{script:'binrat-edge-v0'}],consumers:[{type:'worker',script_name:'binrat-edge-v0'}]};
  else throw Error('Unexpected URL');
  if(forbidQueue&&url.includes('/queues/uuid_123'))return Response.json({success:false,errors:[]},{status:403});
  return Response.json({success:true,result:value});
 };
 return {request,calls};
}
test('wrong account or missing secret stops before network',async()=>{
 let f=make();
 let r=await inspect({account:'not-allowed',token:SECRET,request:f.request});
 assert.equal(r.status,'BLOCKED');assert.equal(f.calls.length,0);
 r=await inspect({account:ACC,token:'',request:f.request});
 assert.equal(r.status,'BLOCKED');assert.equal(f.calls.length,0);
});
test('returns paused queue and cron state after exactly four scoped GETs',async()=>{
 const m=make({paused:true,crons:[]});
 const r=await inspect({account:ACC,token:SECRET,request:m.request});
 assert.equal(r.apiCalls,4);
 assert.equal(r.queue.deliveryPaused,true);
 assert.equal(r.binding.hasPonsProducer,true);
 assert.equal(r.conclusion,'NO_CRON_TRIGGERS');
 assert.deepEqual(r.cronSchedules,[]);
 assert.ok(m.calls.every(c=>c.opts.method==='GET'&&c.opts.redirect==='error'));
 assert.ok(m.calls.every(c=>c.url.startsWith('https://api.cloudflare.com/client/v4/accounts/'+ACC+'/')));
 assert.ok(m.calls.every(c=>c.opts.headers.Authorization==='Bearer '+SECRET));
 assert.ok(!JSON.stringify(r).includes(SECRET));
 assert.ok(!JSON.stringify(r).includes('SECRET_LEAK'));
});
test('normal queue/cron still not proof that collector is updating',async()=>{
 const m=make({});
 const r=await inspect({account:ACC,token:SECRET,request:m.request});
 assert.equal(r.conclusion,'PRODUCER_AND_QUEUE_CONFIGURED_CHECK_LOGS');
 assert.equal(r.queue.knownWorkerConsumer,true);
 assert.equal(r.queue.knownWorkerProducer,true);
});
test('no producer queue does not query an untrusted guessed queue id',async()=>{
 const m=make({queuePresent:false});
 const r=await inspect({account:ACC,token:SECRET,request:m.request});
 assert.equal(r.apiCalls,3);
 assert.equal(r.queueMatches,0);
 assert.equal(r.conclusion,'CONTROL_PLANE_INCOMPLETE');
});
test('provider denial is exposed as code only, no token or raw body',async()=>{
 const m=make({forbidQueue:true});
 const r=await inspect({account:ACC,token:SECRET,request:m.request});
 assert.equal(r.apiCalls,4);
 assert.equal(r.providerErrors.queueDetails,'HTTP_403');
 assert.ok(!JSON.stringify(r).includes(SECRET));
});
