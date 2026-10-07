import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectPublicProduct} from '../src/public/productProjection.js';
import {renderRatReply,type CapabilityManifest} from '../src/telegram/rat.js';
import {buildPublicSnapshot} from '../src/cloudflare/publicSnapshot.js';
const manifest=()=>JSON.parse(readFileSync('docs/CAPABILITY_MANIFEST_V0.json','utf8')) as CapabilityManifest;
const config=(raw:CapabilityManifest)=>({manifest:raw,manifestMode:'REMOTE_FAIL_CLOSED' as const,apiBaseUrl:'https://api.example.test',siteUrl:'https://binrat.example.test'});

test('hostile H1: remote failure revokes every cached product claim and authorization',async()=>{
 const raw=manifest();raw.publicProduct=await projectPublicProduct({manifest:raw,snapshot:null,status:null});
 raw.publicProduct.launchState={status:'AUTHORIZED',tokenState:'LAUNCHED',launchAuthorized:true,marketingAuthorized:true};
 const reply=await renderRatReply('/token',config(raw),async()=>new Response('{}',{status:503}));
 assert.match(reply??'',/launch authorization: UNVERIFIED_REMOTE_STATUS/);assert.doesNotMatch(reply??'',/authorized: YES|token state: LAUNCHED/);
});
test('hostile H2: a received projection cannot contradict its canonical launch state',async()=>{
 const raw=manifest();raw.publicProduct=await projectPublicProduct({manifest:raw,snapshot:null,status:null});
 raw.publicProduct.launchState.launchAuthorized=true;
 const reply=await renderRatReply('/token',config(manifest()),async()=>new Response(JSON.stringify(raw),{status:200,headers:{'content-type':'application/json'}}));
 assert.doesNotMatch(reply??'',/authorized: YES/);assert.match(reply??'',/UNVERIFIED_REMOTE_STATUS/);
});
test('hostile H3: evidence timestamp in the future cannot establish freshness',async()=>{
 const now=Date.now();const snapshot=await buildPublicSnapshot({schemaVersion:'binrat.latest-launches/0.1',chainId:4663,sourceCheckpoint:'100',checkpointBlockHash:`0x${'1'.repeat(64)}`,historyCoverage:'PARTIAL',launches:[]});
 const status={schemaVersion:'binrat.public-status/0.1',chainId:4663,state:'FRESH_VERIFIED',checkpointBlock:'100',checkpointBlockHash:snapshot.checkpointBlockHash,feedDigest:snapshot.feedDigest,
   publicationVersion:1,lastSyncError:null,verifiedAtMs:now+1_000_000,runtimeUpdatedAtMs:now,freshnessValidUntilMs:now+180000};
 const product=await projectPublicProduct({manifest:manifest(),snapshot,status,nowMs:now});assert.notEqual(product.runtimeFreshness,'FRESH_VERIFIED');
});
test('hostile H4: unsupported Sniffer evidence must not retain a captured-handoff claim',async()=>{
 const product=await projectPublicProduct({manifest:manifest(),snapshot:null,status:null,research:null});
 const rat=product.crew.find(r=>r.id==='sniffer')!;assert.equal(rat.status,'UNVERIFIED');assert.doesNotMatch(rat.description,/has been captured/);
});

test('hostile H5: deployment changing after first observation revokes acceptance',async()=>{
 // @ts-expect-error Node-only readback helper, excluded from Worker bundle.
 const {readActiveDeployment,assertStableDeployment}=await import('../scripts/lib/read-active-deployment.mjs');
 const expected={workerName:'binrat-edge-v0',workerRevisionId:'11111111-2222-3333-4444-555555555555'};
 const requests:Array<{method:string;redirect:string}>=[];
 const fakeFetch=async(_url:string,init:{method:string;redirect:string})=>{requests.push(init);return new Response(JSON.stringify({success:true,result:{deployments:[{versions:[{version_id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',percentage:100}]}]}}));};
 const observed=await readActiveDeployment({accountId:'a'.repeat(32),token:'READ_ONLY_TEST_TOKEN',workerName:'binrat-edge-v0'},fakeFetch);
 assert.throws(()=>assertStableDeployment(expected,observed),/CHANGED_DURING_ACCEPTANCE/);
 assert.equal(requests[0]!.method,'GET');assert.equal(requests[0]!.redirect,'error');
 await assert.rejects(readActiveDeployment({workerName:'binrat-edge-v0'},fakeFetch),/READBACK_REQUIRED/);assert.equal(requests.length,1);
});

test('hostile H2: crew and wallet projection drift is rejected against canonical inputs',async()=>{
 for(const mutate of [
  (p:NonNullable<CapabilityManifest['publicProduct']>)=>{p.crew[1]!.status='LIVE';},
  (p:NonNullable<CapabilityManifest['publicProduct']>)=>{p.currentAuthority.treasuryAddress='0x'+'a'.repeat(40);},
  (p:NonNullable<CapabilityManifest['publicProduct']>)=>{p.manifestDigest='f'.repeat(64);}
 ]) {
  const raw=manifest();raw.publicProduct=await projectPublicProduct({manifest:raw,snapshot:null,status:null});mutate(raw.publicProduct);
  const reply=await renderRatReply('/roadmap',config(manifest()),async()=>new Response(JSON.stringify(raw),{status:200,headers:{'content-type':'application/json'}}));
  assert.match(reply??'',/UNVERIFIED_REMOTE_STATUS/);assert.doesNotMatch(reply??'',/TRIPWIRE · WATCHER · LIVE/);
 }
});

test('hostile H2 control: the actual deterministic transport remains usable',async()=>{
 const raw=manifest(),now=Date.now();const snapshot=await buildPublicSnapshot({schemaVersion:'binrat.latest-launches/0.1',chainId:4663,sourceCheckpoint:'100',checkpointBlockHash:`0x${'1'.repeat(64)}`,historyCoverage:'PARTIAL',launches:[]});
 const status={schemaVersion:'binrat.public-status/0.1',chainId:4663,state:'FRESH_VERIFIED',checkpointBlock:'100',checkpointBlockHash:snapshot.checkpointBlockHash,feedDigest:snapshot.feedDigest,
  verifiedAtMs:now,runtimeUpdatedAtMs:now,publicationVersion:1,lastSyncError:null,freshnessValidUntilMs:now+180000};
 raw.publicProduct=await projectPublicProduct({manifest:raw,snapshot,status});
 const reply=await renderRatReply('/roadmap',config(manifest()),async()=>new Response(JSON.stringify(raw),{status:200,headers:{'content-type':'application/json'}}));
 assert.match(reply??'',/RAT ZERO · SCOUT · LIVE/);assert.match(reply??'',/TRIPWIRE · WATCHER · BUILDING/);
 assert.match(reply??'',/WORKING RAT · FUTURE LABOR · PLANNED/);assert.doesNotMatch(reply??'',/UNVERIFIED_REMOTE_STATUS/);
});
