import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFunderCohortTransport,createIndexedProbeTransport} from '../src/workforce/prospectiveTransport.js';
import {PROSPECTIVE_RPC,type RpcRequest} from '../src/workforce/prospective.js';
import {FUNDER_COHORT_V1,auditFunderCohort} from '../src/workforce/funderCohort.js';
import {PONS_V2_FACTORY} from '../src/pons/chain.js';
import type {CalibrationCall} from '../src/workforce/indexedCalibration.js';

const key='synthetic_key_never_live',archive=`https://robinhood-mainnet.g.alchemy.com/v2/${key}`;
const request=(method:string,id=1,params:unknown[]=[]):RpcRequest=>({jsonrpc:'2.0',id,method,params});
const allowedPublic=['eth_chainId','eth_getBlockByNumber','eth_getTransactionReceipt','eth_getLogs'];
const historicalCode=JSON.parse(readFileSync('test/fixtures/workforce/recorded/pons-funding-a-rpc-v1.json','utf8')).responses[1].response.result;
const historicalCodeRequest=request('eth_getCode',1,[PONS_V2_FACTORY,'0x'+FUNDER_COHORT_V1.outcomeThroughBlock.toString(16)]);

test('cohort routes only historical code and indexed locator to archive, with one request per method',async()=>{
  for(const credential of [key,archive]){
    const seen:{url:string;method:string;init:RequestInit}[]=[];
    const read=createFunderCohortTransport(credential,async(url,init)=>{
      const rpc=JSON.parse(String(init!.body));seen.push({url:String(url),method:rpc.method,init:init!});
      return new Response(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:'0x1237'}));
    });
    for(const method of [...allowedPublic,'eth_getCode','alchemy_getAssetTransfers']){
      const result=await read(method==='eth_getCode'?historicalCodeRequest:request(method));
      assert.equal(result.error,null,method);
    }
    assert.equal(seen.length,6);
    assert.deepEqual(seen.map(x=>x.url),[
      ...allowedPublic.map(()=>PROSPECTIVE_RPC),archive,archive,
    ]);
    for(const row of seen){assert.equal(row.init.method,'POST');assert.equal(row.init.redirect,'error');}
    assert.throws(()=>read(request('eth_getCode',1,[PONS_V2_FACTORY,'latest'])),/COHORT_HISTORICAL_CODE_SCOPE_INVALID/);
    assert.throws(()=>read(request('eth_getCode',1,['0x'+'1'.repeat(40),historicalCodeRequest.params[1]])),/COHORT_HISTORICAL_CODE_SCOPE_INVALID/);
    assert.throws(()=>read(request('eth_sendRawTransaction')),/PROSPECTIVE_METHOD_NOT_ALLOWED/);
    assert.equal(seen.length,6);
  }
});

test('historical factory-code response advances the real cohort auditor past its original blocker',async()=>{
  const seen:string[]=[],origin=1800000000000,calls:CalibrationCall[]=[];
  const read=createFunderCohortTransport(key,async(url,init)=>{
    const rpc=JSON.parse(String(init!.body));
    seen.push(String(url));
    assert.ok(['eth_chainId','eth_getCode'].includes(rpc.method));
    return new Response(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:rpc.method==='eth_chainId'?'0x1237':historicalCode}));
  });
  for(let i=0;i<2;i++){
    const audit=auditFunderCohort(calls,origin);
    assert.equal(audit.error,null);
    assert.ok(audit.nextRequest);
    const r=audit.nextRequest!;
    const result=await read(r);
    assert.equal(result.error,null);
    calls.push({request:r,status:'COMPLETE',reservedAtMs:origin+i*100,completedAtMs:origin+i*100+50,
      rawResponse:result.rawResponse,error:null});
  }
  const after=auditFunderCohort(calls,origin);
  assert.equal(after.error,null);
  assert.equal(after.nextRequest?.method,'eth_getBlockByNumber');
  assert.equal(after.nextRequest?.params[0],'0x'+FUNDER_COHORT_V1.fromBlock.toString(16));
  assert.deepEqual(seen,[PROSPECTIVE_RPC,archive]);
});

test('original prospective transport retains public code routing with no widening',async()=>{
  const urls:string[]=[];
  const original=createIndexedProbeTransport(key,async(url)=>{urls.push(String(url));return new Response('{}');});
  await original(request('eth_getCode'));
  await original(request('alchemy_getAssetTransfers'));
  assert.deepEqual(urls,[PROSPECTIVE_RPC,archive]);
});

test('provider denial, bad credentials and prohibited methods fail closed without a fallback or retry',async()=>{
  for(const bad of [undefined,'',archive+'?bad=1','https://example.com/v2/'+key]){
    assert.throws(()=>createFunderCohortTransport(bad),/ARCHIVE_RPC_SECRET_(INVALID|REQUIRED)/);
  }
  const calls:string[]=[];
  const read=createFunderCohortTransport(key,async(url)=>{calls.push(String(url));return new Response('archive does not support history',{status:403});});
  const result=await read({...historicalCodeRequest,id:2});
  assert.equal(result.error,'PROSPECTIVE_RPC_HTTP_FAILED');
  assert.equal(calls.length,1);
  assert.deepEqual(calls,[archive]);
  assert.throws(()=>read(request('eth_sendRawTransaction')),/PROSPECTIVE_METHOD_NOT_ALLOWED/);
  assert.equal(calls.length,1);
});

test('historical-state archive credential reflections are removed before any journaling',async()=>{
  for(const body of [JSON.stringify({error:archive}),JSON.stringify({error:key}),
    JSON.stringify({error:key.split('').map(c=>'%'+c.charCodeAt(0).toString(16)).join('')})]){
    let n=0;
    const read=createFunderCohortTransport(key,async()=>{n++;return new Response(body,{status:401});});
    const result=await read(historicalCodeRequest);
    assert.deepEqual(result,{rawResponse:'',error:'ARCHIVE_RPC_SECRET_REFLECTION'});
    assert.equal(n,1);
    assert.equal(JSON.stringify(result).includes(key),false);
  }
});
