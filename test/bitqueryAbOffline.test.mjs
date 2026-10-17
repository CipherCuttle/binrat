import test from 'node:test';
import assert from 'node:assert/strict';
import {frozenCase,query,compare,probe} from '../scripts/binrat-bitquery-ab-probe.mjs';

const c=frozenCase();
function event({tx=c.txHash,block=c.blockNumber,token=c.token,deployer=c.deployer}={}){
 return {Block:{Number:block},Transaction:{Hash:tx},Log:{Signature:{SignatureHash:'8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607'}},
 Arguments:[{Name:'token',Value:{address:token}},{Name:'deployer',Value:{address:deployer}}]};
}
const data=(events)=>({data:{EVM:{Events:events}}});
const response=(value,code=200)=>new Response(JSON.stringify(value),{status:code,headers:{'content-type':'application/json'}});
test('one frozen recorded 20-launch Case is identified without live claims',()=>{
 assert.equal(c.caseId,'742ed5c2d361c11d5a4da715e35e6c189a9b61ae4a433a937a96111360d7ab01');
 assert.equal(c.coverage.history,'PARTIAL');
 assert.match(c.sourceSha256,/^[a-f0-9]{64}$/);
 assert.match(query('target',c.txHash),/EVM\(network: robinhood\)/);
 assert.doesNotMatch(query('target',c.txHash),/archive|combined/);
 assert.doesNotMatch(query('recent',c.txHash),/archive|combined/);
});
test('shared event fields can match without claiming provider wins',()=>{
 const output=compare(c,data([event()]),data([event()]));
 assert.equal(output.status,'FIELDS_MATCH');
 assert.equal(output.checks,5);
 assert.equal(output.archiveQueried,false);
 assert.match(output.reason,/NOT_PAID_FORENSIC_VALUE/);
});
test('Bitquery missing old Case on free realtime is not a BINRAT win',()=>{
 assert.equal(compare(c,data([event()]),data([])).status,'NOT_COMPARABLE');
 assert.equal(compare(c,data([event()]),data([])).reason,'HISTORICAL_TARGET_NOT_IN_FREE_REALTIME_WINDOW');
 assert.equal(compare(c,data([]),data([event()])).status,'NOT_COMPARABLE');
});
test('contradicting source facts remain conflict rather than false consensus',()=>{
 const output=compare(c,data([event()]),data([event({deployer:'0x'+'0'.repeat(40)})]));
 assert.equal(output.status,'FIELDS_CONFLICT');
 assert.equal(output.matched.deployer,false);
 assert.equal(output.matched.block,true);
});
test('only two bounded POSTs, token in auth header not query URL/output, no retries',async()=>{
 const seen=[];
 const output=await probe({token:'unit-test-token-secret',request:async(url,init)=>{
  seen.push({url,init});
  return response(data([event()]));
 }});
 assert.equal(seen.length,2);
 assert.equal(output.count,2);
 assert.equal(output.status,'FIELDS_MATCH');
 assert.equal(output.keyPersisted,false);
 assert.ok(seen.every(x=>x.url==='https://streaming.bitquery.io/graphql'));
 assert.ok(seen.every(x=>x.init.headers.Authorization==='Bearer unit-test-token-secret'));
 assert.ok(seen.every(x=>x.init.redirect==='error'));
 assert.ok(!JSON.stringify(output).includes('unit-test-token-secret'));
});
test('401 authentication failure stops immediately; no second query',async()=>{
 let calls=0;
 const r=await probe({token:'unit-test-token-secret',request:async()=>{
  calls++;return response({errors:[{message:'Unauthorized'}]},401);
 }});
 assert.equal(calls,1);assert.equal(r.status,'NOT_RUN');assert.equal(r.count,1);
});
test('no retries on timeout/transport failure, no secret leakage',async()=>{
 let calls=0;
 const r=await probe({token:'unit-test-token-secret',request:async()=>{
  calls++;throw Error('provider error unit-test-token-secret');
 }});
 assert.equal(calls,1);assert.equal(r.status,'NOT_RUN');assert.equal(r.count,1);
 assert.ok(!JSON.stringify(r).includes('unit-test-token-secret'));
});
