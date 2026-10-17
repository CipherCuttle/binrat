import test from 'node:test';
import assert from 'node:assert/strict';
import {assessStatus,assessChainHealth,assessIdentity,diagnose} from '../scripts/binrat-public-status-diagnose.mjs';

const now=1792244700000;
const HASH='0x'+'a'.repeat(64),DIGEST='b'.repeat(64);
const valid={
  schemaVersion:'binrat.public-status/0.1',chainId:4663,state:'FRESH_VERIFIED',
  feedDigest:DIGEST,checkpointBlock:'84243956',checkpointBlockHash:HASH,
  publicationVersion:9,verifiedAtMs:now-20000,freshnessValidUntilMs:now+140000,
  runtimeUpdatedAtMs:now-16000,lastSyncError:null
};
const health={ok:true,chainId:4663,indexReady:true,liveCaughtUp:true,runtimeFresh:true,
  checkpointBlock:'84243956',headBlock:'84243957',targetBlock:'84243956',
  launchCount:16001,runtimeUpdatedAtMs:now-16000,
  lastSyncError:null,lastHistoryError:null,lastObservationError:null};
const identity={ok:true,service:'binrat-cloudflare-edge',releaseSha:'a'.repeat(40),
  release:{workerRevisionId:'revision-104',effectiveMaxStatusAgeMs:180000,sourceCommit:'sha'}};
const respond=(d,status=200)=>Response.json(d,{status});
function mock(map={}){
  const calls=[];
  const request=async(url,opts)=>{
    calls.push({url,opts});
    const u=new URL(url);
    if(!['/api/status','/api/health','/health'].includes(u.pathname))throw Error('UNCHECKED_URL');
    return respond(map[u.pathname]??({'/api/status':valid,'/api/health':health,'/health':identity}[u.pathname]));
  };
  return {request,calls};
}
test('status admission correctly identifies exact expired publication field',()=>{
  const v=assessStatus({...valid,freshnessValidUntilMs:now-1},now);
  assert.equal(v.admitted,false);
  assert.deepEqual(v.failed,['beforeExpiry']);
  assert.equal(v.expiryDeltaSeconds,0);
});
test('status admission identifies stale state, timestamp age and sync error separately',()=>{
  const v=assessStatus({...valid,state:'STALE_VERIFIED',verifiedAtMs:now-280000,lastSyncError:'RPC_TIMEOUT'},now);
  assert.equal(v.admitted,false);
  assert.ok(v.failed.includes('state'));
  assert.ok(v.failed.includes('ageWithin180s'));
  assert.ok(v.failed.includes('lastSyncErrorNull'));
});
test('valid admitted status preserves checkpoint, age, release and schema distinctions',()=>{
  const v=assessStatus(valid,now);
  assert.equal(v.admitted,true);
  assert.deepEqual(v.failed,[]);
  assert.equal(v.checkpointBlock,'84243956');
  assert.equal(v.ageSeconds,20);
});
test('missing/invalid status never incorrectly admitted',()=>{
  assert.equal(assessStatus({status:'ok'},now).admitted,false);
  assert.equal(assessStatus(null,now).admitted,false);
  assert.equal(assessStatus({...valid,chainId:5042},now).checks.chain,false);
});
test('health and identity report allowlisted operational fields only',()=>{
  const h=assessChainHealth({...health,privateToken:'SECRET'});
  const i=assessIdentity({...identity,privateToken:'SECRET',release:{...identity.release,credential:'SECRET'}});
  assert.equal(h.fields.runtimeFresh,true);
  assert.equal(i.releaseSha,'a'.repeat(40));
  assert.equal(i.revisionId,'revision-104');
  assert.ok(!JSON.stringify(h).includes('SECRET'));
  assert.ok(!JSON.stringify(i).includes('SECRET'));
});
test('one bounded read-only GET for each of three endpoints; no external calls',async()=>{
  const m=mock();
  const d=await diagnose({request:m.request,atMs:now,host:'https://binrat.test'});
  assert.equal(d.verdict,'STATUS_ADMISSION_OK');
  assert.equal(d.apiRequests,3);
  assert.equal(d.bitqueryRequests,0);
  assert.deepEqual(m.calls.map(c=>new URL(c.url).pathname),['/api/status','/api/health','/health']);
  assert.ok(m.calls.every(c=>c.opts.method==='GET'&&c.opts.redirect==='error'));
  assert.ok(!JSON.stringify(d).includes('SECRET'));
  assert.equal(d.checks.releaseMatch,'OTHER_RELEASE');
});
test('diagnosis reports exact reason when status is stale and does not claim repair',async()=>{
  const m=mock({'/api/status':{...valid,state:'STALE_VERIFIED',verifiedAtMs:now-700000}});
  const d=await diagnose({request:m.request,atMs:now,host:'https://binrat.test'});
  assert.equal(d.verdict,'STATUS_ADMISSION_FAILED');
  assert.ok(d.checks.status.failed.includes('state'));
  assert.ok(d.checks.status.failed.includes('ageWithin180s'));
  assert.equal(d.checks.health.fields.indexReady,true);
});
test('request errors are recorded but do not leak response bodies or touch Bitquery',async()=>{
  const m=mock();
  const request=async(url,opts)=>{
    if(url.endsWith('/api/status'))throw Error('SECRET_UNSAFE_PROVIDER_ERROR');
    return m.request(url,opts);
  };
  const d=await diagnose({request,atMs:now,host:'https://binrat.test'});
  assert.equal(d.verdict,'STATUS_ADMISSION_FAILED');
  assert.equal(d.bitqueryRequests,0);
  assert.ok(!JSON.stringify(d).includes('SECRET_UNSAFE_PROVIDER_ERROR'));
  assert.equal(d.receipts[0].requestError,'REQUEST_FAILED');
});
test('unexpected origin blocked before any requests',async()=>{
  const m=mock();
  await assert.rejects(diagnose({request:m.request,atMs:now,host:'https://example.com'}),/HOST_NOT_ALLOWLISTED/);
  assert.equal(m.calls.length,0);
});
