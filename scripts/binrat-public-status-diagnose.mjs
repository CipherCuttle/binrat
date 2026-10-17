#!/usr/bin/env node
/**
 * 3-GET bounded readonly diagnosis of BINRAT public freshness and release.
 * No Bitquery calls, secrets, runtime mutation or deploys.
 */
import {createHash} from 'node:crypto';
const HOST='https://binrat.tech';
const PATHS=['/api/status','/api/health','/health'];
const MAX_BYTES=32768;
const TIMEOUT_MS=10000;
const sha=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const plain=(v)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const dec=(v)=>typeof v==='string'&&/^(0|[1-9][0-9]*)$/.test(v);
const hash=(v)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const blockHash=(v)=>typeof v==='string'&&/^0x[a-f0-9]{64}$/.test(v);
const safeNumber=(v)=>Number.isSafeInteger(v)&&v>=0;
const safeValue=(v)=>v===null||typeof v==='string'&&v.length<150||typeof v==='boolean'||safeNumber(v);
export function assessStatus(status,atMs){
  const tests={
    object:plain(status),
    schema:status?.schemaVersion==='binrat.public-status/0.1',
    chain:status?.chainId===4663,
    state:status?.state==='FRESH_VERIFIED',
    digest:hash(status?.feedDigest),
    checkpointHash:blockHash(status?.checkpointBlockHash),
    checkpointBlock:dec(status?.checkpointBlock),
    verifiedAt:safeNumber(status?.verifiedAtMs),
    freshnessUntil:safeNumber(status?.freshnessValidUntilMs),
    notFuture:safeNumber(status?.verifiedAtMs)&&status.verifiedAtMs<=atMs,
    beforeExpiry:safeNumber(status?.freshnessValidUntilMs)&&atMs<=status.freshnessValidUntilMs,
    ageWithin180s:safeNumber(status?.verifiedAtMs)&&
      atMs>=status.verifiedAtMs&&atMs-status.verifiedAtMs<=180000,
    lastSyncErrorNull:status?.lastSyncError===null
  };
  const dates=['verifiedAtMs','freshnessValidUntilMs','runtimeUpdatedAtMs'];
  return {admitted:Object.values(tests).every(Boolean),
    failed:Object.entries(tests).filter(([,ok])=>!ok).map(([k])=>k),
    checks:tests,
    state:typeof status?.state==='string'?status.state.slice(0,70):null,
    schemaVersion:typeof status?.schemaVersion==='string'?status.schemaVersion.slice(0,70):null,
    chainId:safeNumber(status?.chainId)?status.chainId:null,
    checkpointBlock:dec(status?.checkpointBlock)?status.checkpointBlock:null,
    checkpointBlockHash:blockHash(status?.checkpointBlockHash)?status.checkpointBlockHash:null,
    feedDigest:hash(status?.feedDigest)?status.feedDigest:null,
    publicationVersion:safeNumber(status?.publicationVersion)?status.publicationVersion:null,
    ageSeconds:safeNumber(status?.verifiedAtMs)?Math.round((atMs-status.verifiedAtMs)/1000):null,
    expiryDeltaSeconds:safeNumber(status?.freshnessValidUntilMs)?Math.round((status.freshnessValidUntilMs-atMs)/1000):null,
    runtimeAgeSeconds:safeNumber(status?.runtimeUpdatedAtMs)?Math.round((atMs-status.runtimeUpdatedAtMs)/1000):null,
    lastSyncErrorPresent:status?.lastSyncError!==null,
    timestamps:Object.fromEntries(dates.map(k=>[k,safeNumber(status?.[k])?status[k]:null]))
  };
}
export function assessChainHealth(health){
  if(!plain(health))return {recognized:false,reason:'NOT_OBJECT'};
  const fields=['ok','indexReady','liveCaughtUp','runtimeFresh','observationReady','historyBackfillComplete','launchCount','checkpointBlock','headBlock','targetBlock','runtimeUpdatedAtMs','lastHistoryError','lastObservationError','lastSyncError'];
  return {recognized:health.chainId===4663,chainId:safeNumber(health.chainId)?health.chainId:null,
    fields:Object.fromEntries(fields.map(k=>[k,safeValue(health[k])?health[k]:null])),
    syncErrorPresent:health.lastSyncError!==null,
    observationErrorPresent:health.lastObservationError!==null,
    historyErrorPresent:health.lastHistoryError!==null
  };
}
export function assessIdentity(info){
  if(!plain(info))return {recognized:false,reason:'NOT_OBJECT'};
  const r=plain(info.release)?info.release:{};
  return {recognized:info.service==='binrat-cloudflare-edge',
    service:typeof info.service==='string'?info.service.slice(0,80):null,
    releaseSha:typeof info.releaseSha==='string'&&/^[a-f0-9]{7,64}$/.test(info.releaseSha)?info.releaseSha:null,
    revisionId:typeof r.workerRevisionId==='string'&&r.workerRevisionId.length<128?r.workerRevisionId:null,
    effectiveMaxStatusAgeMs:safeNumber(r.effectiveMaxStatusAgeMs)?r.effectiveMaxStatusAgeMs:null,
    releaseIdentity:{keys:Object.keys(r).filter(k=>k!=='workerRevisionId'&&k!=='effectiveMaxStatusAgeMs').sort().slice(0,16)}
  };
}
export async function diagnose({request=globalThis.fetch,atMs=Date.now(),host=HOST}={}){
  if(host!==HOST&&host!=='https://binrat.test')throw Error('HOST_NOT_ALLOWLISTED');
  const receipts=[];const responses={};
  for(const path of PATHS){
    const start=Date.now();
    try{
      const result=await request(host+path,{method:'GET',redirect:'error',
        signal:AbortSignal.timeout(TIMEOUT_MS)});
      if(Number(result.headers?.get?.('content-length')||0)>MAX_BYTES)throw Error('RESPONSE_SIZE_LIMIT');
      const reader=result.body?.getReader();if(!reader)throw Error('RESPONSE_BODY_ABSENT');
      const chunks=[];let count=0;
      try{while(true){
        const b=await reader.read();if(b.done)break;
        count+=b.value.length;
        if(count>MAX_BYTES){await reader.cancel();throw Error('RESPONSE_SIZE_LIMIT');}
        chunks.push(Buffer.from(b.value));
      }}finally{reader.releaseLock();}
      const b=Buffer.concat(chunks);
      receipts.push({path,httpStatus:result.status,bytes:b.length,bodySha256:sha(b),
        durationMs:Date.now()-start});
      if(!result.ok){responses[path]={unavailable:'HTTP_'+result.status};continue;}
      try{responses[path]=JSON.parse(b.toString('utf8'));}
      catch{responses[path]={unavailable:'RESPONSE_NOT_JSON'};}
    }catch(e){
      const name=e instanceof Error?e.name:'UNKNOWN';
      receipts.push({path,requestError:name==='TimeoutError'?'TIMEOUT':name==='AbortError'?'ABORTED':'REQUEST_FAILED',
        durationMs:Date.now()-start});
      responses[path]={unavailable:name==='TimeoutError'?'TIMEOUT':'REQUEST_FAILED'};
    }
  }
  const admitted=assessStatus(responses['/api/status'],atMs);
  const chainHealth=assessChainHealth(responses['/api/health']);
  const identity=assessIdentity(responses['/health']);
  const releaseMatch=identity.releaseSha?
    (identity.releaseSha==='160ab9c4fbb2f9cebd4a45cc20f5e75d85f57302'?'MATCHES_MCP_SOURCE_BASE':'OTHER_RELEASE'):
    'UNKNOWN';
  return {status:'DIAGNOSTIC_ONLY',readOnly:true,apiRequests:receipts.length,
    bitqueryRequests:0,ownerAuthorizedScope:'BINRAT_PUBLIC_READ_ONLY',
    capturedAtMs:atMs,checks:{status:admitted,health:chainHealth,identity,releaseMatch},
    receipts,verdict:admitted.admitted?'STATUS_ADMISSION_OK':'STATUS_ADMISSION_FAILED',
    note:'Public releaseSha is informative; it is not an independent attestation of the actual deployed backend binary.'};
}
if(process.argv[1]&&new URL(import.meta.url).pathname.endsWith(process.argv[1])){
  if(process.argv.includes('--dry-run')){
    console.log(JSON.stringify({mode:'OFFLINE_READY',paths:PATHS,callLimit:3,bitqueryCalls:0}));
  }else if(process.argv.includes('--live-readonly')&&process.env.BINRAT_PUBLIC_DIAG_GRANT==='ONE_SHOT_20261017'){
    console.log(JSON.stringify(await diagnose()));
  }else{console.error('STOP: exact grant required');process.exitCode=1;}
}
