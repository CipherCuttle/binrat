import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {compareRecent,RECENT_QUERY,HISTORY_QUERY,selectOverlap} from '../scripts/binrat-bitquery-recent-overlap.js';
const raw=JSON.parse(readFileSync('docs/receipts/sprint-a1-2-contract/old-case-envelope.json','utf8'));
const l=raw.material.records[0].launch,p=raw.material.publication;
const now=p.verifiedAtMs+1000;
const STATUS={schemaVersion:'binrat.public-status/0.1',chainId:4663,state:'FRESH_VERIFIED',
  feedDigest:p.feedDigest,checkpointBlock:p.checkpointBlock,
  checkpointBlockHash:p.checkpointBlockHash,publicationVersion:p.publicationVersion,
  verifiedAtMs:p.verifiedAtMs,freshnessValidUntilMs:p.verifiedAtMs+180000,lastSyncError:null};
const FEED={schemaVersion:'binrat.latest-launches/0.1',chainId:4663,feedDigest:p.feedDigest,
  sourceCheckpoint:p.checkpointBlock,checkpointBlockHash:p.checkpointBlockHash,
  historyCoverage:'PARTIAL',launches:[{launchId:l.launchId,deployer:l.creator,token:l.token,
    blockNumber:l.blockNumber,txHash:l.txHash}]};
const event=()=>({Block:{Number:l.blockNumber},Transaction:{Hash:l.txHash},
  Log:{Index:l.logIndex,Signature:{SignatureHash:'8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607'}},
  Arguments:[{Name:'deployer',Value:{address:l.creator}},{Name:'token',Value:{address:l.token}}]});
const parsed=(events:any[])=>({data:{EVM:{Events:events}}});
function mock(opts:{stale?:boolean,noOverlap?:boolean,caseUnavailable?:boolean,authFailure?:boolean,mismatch?:boolean}={}){
  const calls:any[]=[];
  const request=async(url:string,init:RequestInit)=>{
    calls.push({url,method:init.method,auth:(init.headers as any)?.Authorization||null,body:init.body||''});
    let result:any,status=200;
    if(url.endsWith('/api/status'))result=opts.stale?{...STATUS,verifiedAtMs:now-5000000}:STATUS;
    else if(url.endsWith('/api/launches/latest'))result=FEED;
    else if(url.includes('/api/bag/')){
      result=opts.mismatch?{...raw,material:{...raw.material,publication:{...raw.material.publication,feedDigest:'f'.repeat(64)}}}:raw;
      if(opts.caseUnavailable)status=404;
    }else if(url==='https://streaming.bitquery.io/graphql'){
      if(opts.authFailure){status=401;result={errors:[{message:'AUTH'}]};}
      else if(String(init.body).includes('count: 10'))
        result=parsed(opts.noOverlap?[]:[event()]);
      else result=parsed([event()]);
    }else throw Error('Unexpected URL '+url);
    return Response.json(result,{status});
  };
  return {request:request as typeof fetch,calls};
}
test('query shapes are narrow, Robinhood Pons, realtime only and capped',()=>{
 assert.match(RECENT_QUERY,/EVM\(network: robinhood\)/);
 assert.match(RECENT_QUERY,/count: 10/);
 assert.match(HISTORY_QUERY(l.creator),/count: 20/);
 assert.match(HISTORY_QUERY(l.creator),/Name: \{is: "deployer"\}/);
 assert.doesNotMatch(RECENT_QUERY+HISTORY_QUERY(l.creator),/dataset: archive/);
 assert.throws(()=>HISTORY_QUERY('not an address'),/CREATOR_INVALID/);
});
test('same historical source simulated at its observation time: both providers share event and case digests',async()=>{
 const m=mock();
 const out=await compareRecent({token:'unit-test-BQ-token',request:m.request,now});
 assert.equal(out.status,'COMPARABLE_OBSERVATIONS',JSON.stringify(out));
 assert.equal(out.winner,'UNDETERMINED');
 assert.equal(out.caseId,l.launchId);
 assert.equal(out.caseDigest,raw.digest);
 assert.equal(out.commonEventFields.transaction,true);
 assert.equal(out.commonEventFields.token,true);
 assert.equal(out.exactTxOverlaps,1);
 assert.equal(out.binratVerifiedCaseRecords,20);
 assert.deepEqual(out.counts,{binrat:4,bitquery:2});
 assert.equal(m.calls.length,6);
 assert.equal(m.calls.filter(x=>x.auth!==null).length,2);
 assert.ok(!JSON.stringify(out).includes('unit-test-BQ-token'));
});
test('stale current BINRAT source fails before any Bitquery API usage',async()=>{
 const m=mock({stale:true});
 const out=await compareRecent({token:'unit-test-BQ-token',request:m.request,now});
 assert.equal(out.status,'NOT_RUN');
 assert.equal(out.reason,'BINRAT_STATUS_NOT_CURRENT_VERIFIED');
 assert.equal(out.counts.bitquery,0);
 assert.equal(m.calls.length,1);
});
test('no intersecting realtime event remains incomparable; do not invent winner',async()=>{
 const m=mock({noOverlap:true});
 const out=await compareRecent({token:'unit-test-BQ-token',request:m.request,now});
 assert.equal(out.status,'NOT_COMPARABLE');
 assert.equal(out.reason,'NO_IDENTICAL_RECENT_PONS_EVENT');
 assert.equal(out.counts.bitquery,1);
 assert.equal(out.counts.binrat,2);
});
test('Case evidence not served leaves no fake comparison or second Bitquery query',async()=>{
 const m=mock({caseUnavailable:true});
 const out=await compareRecent({token:'unit-test-BQ-token',request:m.request,now});
 assert.equal(out.status,'NOT_RUN');
 assert.equal(out.reason,'BINRAT_HTTP_404');
 assert.deepEqual(out.counts,{binrat:3,bitquery:1});
});
test('schema/receipt drift between Case and feed is rejected',async()=>{
 const m=mock({mismatch:true});
 const out=await compareRecent({token:'unit-test-BQ-token',request:m.request,now});
 assert.equal(out.status,'NOT_RUN');
 assert.equal(out.reason,'CASE_PUBLICATION_MISMATCH');
 assert.deepEqual(out.counts,{binrat:3,bitquery:1});
});
test('Bitquery authentication error stops, no retries, secret not leaked',async()=>{
 const m=mock({authFailure:true});
 const out=await compareRecent({token:'unit-test-BQ-token',request:m.request,now});
 assert.equal(out.status,'NOT_RUN');
 assert.equal(out.reason,'BITQUERY_HTTP_401');
 assert.deepEqual(out.counts,{binrat:2,bitquery:1});
 assert.ok(!JSON.stringify(out).includes('unit-test-BQ-token'));
});
test('missing matching event does not make Bitquery appear weaker',()=>{
 assert.equal(selectOverlap(FEED,[]),null);
 assert.equal(selectOverlap(FEED,[{txHash:l.txHash,blockNumber:l.blockNumber,token:l.token,
   deployer:'0x'+'0'.repeat(40),signature:'8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607'}]),null);
});
