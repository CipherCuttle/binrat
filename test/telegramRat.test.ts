import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildPublicSnapshot } from '../src/cloudflare/publicSnapshot.js';
import {
  renderRatReply,
  renderRatReplyDetailed,
  validateCapabilityManifest,
  type CapabilityManifest
} from '../src/telegram/rat.js';

const manifest: CapabilityManifest=JSON.parse(readFileSync('docs/CAPABILITY_MANIFEST_V0.json','utf8'));

const config = {
  apiBaseUrl: 'https://api.example.test',
  siteUrl: 'https://binrat.example.test',
  manifest
};

test('token answer is sourced from fail-closed launch authorization', async () => {
  const reply = await renderRatReply('/token', config);
  assert.match(reply ?? '', /token state: NOT_LAUNCHED/);
  assert.match(reply ?? '', /launch authorization: BLOCKED/);
  assert.match(reply ?? '', /marketing authorized: NO/);
  assert.match(reply ?? '', /launch authorized: NO/);
  assert.match(reply ?? '', /No public entitlement or staking action/i);
});

test('remote manifest failure revokes launch and marketing authority in replies', async () => {
  const authorizedLocal: CapabilityManifest = {
    ...manifest,
    launchAuthorization: {
      ...manifest.launchAuthorization,
      status: 'AUTHORIZED',
      marketingAuthorized: true,
      launchAuthorized: true,
      tokenState: 'LAUNCHED'
    }
  };
  const remoteConfig = { ...config, manifest: authorizedLocal, manifestMode: 'REMOTE_FAIL_CLOSED' as const };
  const fakeFetch: typeof fetch = async () => new Response('{}', { status: 503 });

  const reply = await renderRatReply('/token', remoteConfig, fakeFetch);
  assert.match(reply ?? '', /launch authorization: UNVERIFIED_REMOTE_STATUS/);
  assert.match(reply ?? '', /marketing authorized: NO/);
  assert.match(reply ?? '', /launch authorized: NO/);
  assert.match(reply ?? '', /token state: UNVERIFIED/);
});

test('roadmap uses one projected crew and explicit future employment',async()=>{
 const reply=await renderRatReply('/roadmap',config);
 assert.match(reply??'',/TRIPWIRE · WATCHER · BUILDING/);assert.match(reply??'',/SNIFFER · TRAIL HUNTER · PROVING/);
 assert.match(reply??'',/THE DEN · ORGANIZE · PLANNED · POST-LAUNCH/);
 assert.match(reply??'',/Future workforce direction: FIND → EMPLOY → LEAVE → RETURN/);
 assert.doesNotMatch(reply??'',/Intelligence V1|Dumpster Ledger|Rat Den V0|Rat Watch V0|Sniffer NEXT|Den BUILDING/);
});
test('status is grounded in the complete verified snapshot contract',async()=>{
 const snapshot=await latest();const now=Date.now();
 const status={schemaVersion:'binrat.public-status/0.1',chainId:4663,state:'FRESH_VERIFIED',checkpointBlock:snapshot.sourceCheckpoint,
  checkpointBlockHash:snapshot.checkpointBlockHash,feedDigest:snapshot.feedDigest,verifiedAtMs:now,publicationVersion:1,runtimeUpdatedAtMs:now,freshnessValidUntilMs:now+180000,lastSyncError:null};
 const requests:string[]=[];
 const fakeFetch:typeof fetch=async input=>{const url=String(input);requests.push(url);return jsonResponse(url.endsWith('/api/status')?status:snapshot);};
 const reply=await renderRatReply('/status',config,fakeFetch);
 assert.match(reply??'',/index: FRESH_VERIFIED/);assert.match(reply??'',/launches in publication: 1/);
 assert.ok(requests.every(url=>!url.endsWith('/api/health')));
 status.feedDigest='b'.repeat(64);assert.match(await renderRatReply('/status',config,fakeFetch)??'',/UNVERIFIED \/ UNAVAILABLE/);
});

test('invalid creator address fails before network lookup', async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    throw new Error('should not fetch');
  };
  const reply = await renderRatReply('/creator nope', config, fakeFetch);
  assert.match(reply ?? '', /invalid creator address/i);
  assert.equal(calls, 0);
});

test('deployer answer preserves bounded scope, fact receipts and identity boundary',async()=>{
 const address='0x1111111111111111111111111111111111111111';let path='';
 const fakeFetch:typeof fetch=async input=>{path=String(input);return jsonResponse({schemaVersion:'binrat.creator-summary/0.1',chainId:4663,
  reportedCreatorAddress:address,checkpointBlockHash:`0x${'1'.repeat(64)}`,feedDigest:'b'.repeat(64),coverage:{mode:'LATEST_4_VERIFIED_PONS_LAUNCHES',olderLaunchesOmitted:true},
  launches:[{blockNumber:'100',evidence:{factId:'binrat-fact:4663:'+ 'a'.repeat(64)}}]});};
 const reply=await renderRatReply('/creator '+address,config,fakeFetch);
 assert.match(path,/\/summary$/);assert.match(reply??'',/launches in bounded response: 1/);assert.match(reply??'',/binrat-fact:4663:/);
 assert.match(reply??'',/OLDER LAUNCHES OMITTED/);assert.match(reply??'',/not proof of common human identity/i);
});

test('bare token address resolves to its bag instead of pretending to be a creator', async () => {
  const launchId='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const fakeFetch: typeof fetch = async (input) => {
    const url=String(input);
    if(url.endsWith('/api/launches/latest')) return jsonResponse(await latest());
    if (url.endsWith('/api/bag/'+launchId)) return new Response(JSON.stringify({
      schemaVersion: 'binrat.public-feed/0.1',
      asOfBlock: '500',
      historyCoverage: 'UNVERIFIED',
      bag: {
        id: launchId,
        symbol: 'RAT',
        name: 'Rat Bag',
        reportedCreatorAddress: '0x3333333333333333333333333333333333333333',
        trashTrail: { priorLaunchCount: 2, coverage: 'UNVERIFIED' }
      },
      receipt: { receiptId: 'binrat-public:'+'a'.repeat(64) }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('{}', { status: 404 });
  };

  const reply = await renderRatReply('rat 0x1111111111111111111111111111111111111111', config, fakeFetch);
  assert.match(reply ?? '', /RAT — Rat Bag/);
  assert.match(reply ?? '', /prior launches from same reported address: 2/);
  assert.doesNotMatch(reply ?? '', /Creator File/);
});

test('address with multiple indexed roles asks for disambiguation',async()=>{
 const fakeFetch:typeof fetch=async()=>jsonResponse(await latest('0x1111111111111111111111111111111111111111'));
 const reply=await renderRatReply('rat 0x1111111111111111111111111111111111111111',config,fakeFetch);
 assert.match(reply??'',/multiple meanings/i);assert.match(reply??'',/REPORTED_CREATOR, TOKEN/);
});

test('Replay consumer rejects schema drift instead of synthesizing a timeline', async () => {
  const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
    schemaVersion: 'binrat.replay-bundle/99.0',
    stages: [{ label: '5m', status: 'COMPLETE' }]
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  const reply = await renderRatReply('/replay aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', config, fakeFetch);
  assert.match(reply ?? '', /no replayable indexed launch/i);
  assert.match(reply ?? '', /violated the public API contract/i);
  assert.doesNotMatch(reply ?? '', /5m COMPLETE/);
});

test('reply metadata binds exact non-user-text answer plan to the rendered text', async () => {
  const detailed = await renderRatReplyDetailed('/token', config);
  assert.ok(detailed);
  assert.match(detailed!.planDigest, /^[0-9a-f]{64}$/);
  assert.equal(detailed!.answerPlan.intent, 'TOKEN');
  assert.equal(detailed!.answerPlan.schemaVersion, 'binrat.rat-answer-plan/0.2');
  assert.equal(JSON.stringify(detailed!.answerPlan).includes('/token'), false);
});

test('irrelevant ordinary chat is ignored', async () => {
  assert.equal(await renderRatReply('wen moon?', config), null);
});

test('manifest validator fails closed on malformed launch authorization', () => {
  assert.throws(
    () => validateCapabilityManifest({
      ...manifest,
      launchAuthorization: { status: 'BLOCKED', marketingAuthorized: 'no', launchAuthorized: false }
    }),
    /CAPABILITY_MANIFEST_INVALID/
  );
});

function jsonResponse(value:unknown) {return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});}
async function latest(deployer='0x3333333333333333333333333333333333333333') {
 const id='a'.repeat(64);return buildPublicSnapshot({schemaVersion:'binrat.latest-launches/0.1',chainId:4663,sourceCheckpoint:'500',checkpointBlockHash:`0x${'1'.repeat(64)}`,historyCoverage:'PARTIAL',
 launches:[{launchId:id,factId:`binrat-fact:4663:${id}`,token:'0x1111111111111111111111111111111111111111',deployer,txHash:`0x${'2'.repeat(64)}`,blockNumber:'100',priorLaunchCount:2,symbol:'RAT',name:'Rat Bag',metadata:{imageUri:'',website:'',twitter:'',telegram:''}}]});
}
