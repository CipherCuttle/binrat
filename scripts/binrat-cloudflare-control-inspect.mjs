#!/usr/bin/env node
/**
 * Exactly one, bounded Cloudflare control-plane INSPECTION.
 * GET only. Never persists or logs provider token or raw API response.
 */
import {createHash} from 'node:crypto';

const EXPECTED_ACCOUNT='8927d39146b901d0f463b971a1d039e6';
const WORKER='binrat-edge-v0';
const QUEUE='binrat-sync-v0';
const ROOT='https://api.cloudflare.com/client/v4/accounts/';
const CAP=5;
const MAX_BYTES=131072;
const OUTCOME='READ_ONLY_CLOUDFLARE_CONTROL_PLANE';
const sha=x=>createHash('sha256').update(x).digest('hex');
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const safe=s=>typeof s==='string'&&s.length<160?s:null;
const safeBool=x=>x===true?true:x===false?false:null;
function sanitizeWorkersSettings(payload){
  const bindings=Array.isArray(payload?.bindings)?payload.bindings:[];
  return {bindingCount:bindings.length,
    hasPonsProducer:bindings.some(x=>x?.name==='SYNC_QUEUE'&&x?.type==='queue'&&x?.queue_name===QUEUE),
    queueBindings:bindings.filter(x=>x?.type==='queue').map(x=>({name:safe(x.name),queueName:safe(x.queue_name)})).slice(0,12)};
}
function queueSummary(q){
  const settings=obj(q?.settings)?q.settings:{};
  const producers=Array.isArray(q?.producers)?q.producers:[];
  const consumers=Array.isArray(q?.consumers)?q.consumers:[];
  return {queuePresent:!!q,queueName:safe(q?.queue_name),
    deliveryPaused:safeBool(settings.delivery_paused),
    producerCount:producers.length,consumerCount:consumers.length,
    knownWorkerProducer:producers.some(p=>p?.script===WORKER),
    knownWorkerConsumer:consumers.some(c=>c?.script_name===WORKER),
    consumerTypes:consumers.map(c=>safe(c?.type)).slice(0,10)};
}
export async function inspect({account,token,request=globalThis.fetch}){
  if(account!==EXPECTED_ACCOUNT)return {status:'BLOCKED',reason:'WRONG_ACCOUNT',apiCalls:0};
  if(typeof token!=='string'||token.length<12||token.length>2048||/[\r\n]/.test(token))
    return {status:'BLOCKED',reason:'SECRET_UNAVAILABLE',apiCalls:0};
  const entries=[];let count=0;
  const get=async(path)=>{
    if(count>=CAP)throw Error('READ_BUDGET_EXCEEDED');
    count++;const start=Date.now();
    let r;
    try{r=await request(ROOT+account+path,{method:'GET',redirect:'error',
      headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
    }catch{return {unavailable:'REQUEST_FAILED'};}
    if(!r.ok){entries.push({kind:path.split('/')[1]||'root',httpStatus:r.status});return {unavailable:'HTTP_'+r.status};}
    if(Number(r.headers.get('content-length')||0)>MAX_BYTES)return {unavailable:'BODY_LIMIT'};
    const reader=r.body?.getReader();if(!reader)return {unavailable:'NO_BODY'};
    let bytes=0;const pieces=[];
    try{
      while(true){const chunk=await reader.read();if(chunk.done)break;
        bytes+=chunk.value.length;
        if(bytes>MAX_BYTES){await reader.cancel().catch(()=>{});return {unavailable:'BODY_LIMIT'};}
        pieces.push(Buffer.from(chunk.value));
      }
    }finally{reader.releaseLock();}
    const body=Buffer.concat(pieces);
    entries.push({kind:path.split('/')[1]||'root',httpStatus:r.status,bytes:body.length,
      digest:sha(body),latencyMs:Date.now()-start});
    let parsed;try{parsed=JSON.parse(body.toString('utf8'));}catch{return {unavailable:'BAD_JSON'};}
    if(parsed.success!==true)return {unavailable:'PROVIDER_REJECTED'};
    return parsed.result??{unavailable:'EMPTY_RESULT'};
  };
  const settings=await get('/workers/scripts/'+WORKER+'/settings');
  const schedules=await get('/workers/scripts/'+WORKER+'/schedules');
  const queues=await get('/queues?per_page=100');
  const matches=Array.isArray(queues)?queues.filter(x=>x?.queue_name===QUEUE):[];
  let queue=null;
  if(matches.length===1&&typeof matches[0].queue_id==='string'&&/^[a-zA-Z0-9_-]+$/.test(matches[0].queue_id)){
    queue=await get('/queues/'+matches[0].queue_id);
  }
  const cron=Array.isArray(schedules?.schedules)?schedules.schedules.map(x=>safe(x?.cron)).slice(0,6):null;
  const output={version:'CLOUDFLARE_INSPECTION_V1',mode:OUTCOME,apiCalls:count,
    status:'OBSERVED_PARTIAL',worker:WORKER,queue:QUEUE,
    settingsAvailable:!settings.unavailable,
    schedulesAvailable:cron!==null,
    queueListingAvailable:Array.isArray(queues),
    queueMatches:matches.length,
    binding:sanitizeWorkersSettings(settings),
    cronSchedules:cron,
    queue:queueSummary(queue||matches[0]||null),
    providerErrors:{
      settings:safe(settings?.unavailable)||null,
      schedules:safe(schedules?.unavailable)||null,
      queueList:safe(queues?.unavailable)||null,
      queueDetails:safe(queue?.unavailable)||null
    },
    requestReceipts:entries,
    conclusion:cron?.length===0?'NO_CRON_TRIGGERS':
      queue?.settings?.delivery_paused===true?'QUEUE_DELIVERY_PAUSED':
      !settings.unavailable&&cron?.length>0&&queue?.settings?.delivery_paused===false?'PRODUCER_AND_QUEUE_CONFIGURED_CHECK_LOGS':'CONTROL_PLANE_INCOMPLETE',
    caution:'No runtime calls or mutations, D1 data unchanged. Cron/queue control state alone cannot establish the cause or authorization to resume.'};
  return output;
}
if(process.argv[1]&&new URL(import.meta.url).pathname.endsWith(process.argv[1])){
  if(process.argv.includes('--dry-run'))
    console.log(JSON.stringify({status:'DRY_RUN_OK',operation:OUTCOME,maxCalls:CAP,worker:WORKER,queue:QUEUE,noWrites:true}));
  else if(process.argv.includes('--read-only')&&process.env.BINRAT_CF_INSPECT_GRANT==='ONE_SHOT_20261017')
    console.log(JSON.stringify(await inspect({account:process.env.BINRAT_CLOUDFLARE_ACCOUNT_ID,
      token:process.env.BINRAT_CLOUDFLARE_ADMIN_API_TOKEN})));
  else {console.error('STOP: owner one-shot grant required');process.exitCode=1;}
}
