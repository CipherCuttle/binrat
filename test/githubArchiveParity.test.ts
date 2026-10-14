import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {keccak256,type Hex} from 'viem';
import {createGithubArchiveParityVerification,ARCHIVE_PARITY_REQUEST,ARCHIVE_PARITY_MARKER,
  ARCHIVE_PARITY_BRANCH,type ArchiveParityAuthority,type ArchiveParityReceipt} from '../src/workforce/githubArchiveParity.js';
import {verifyFunderCohortFactoryCode} from '../src/workforce/funderCohort.js';

const key='offline_synthetic_credential_123456';
const archive=`https://robinhood-mainnet.g.alchemy.com/v2/${key}`;
const expected='0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84';
const historicalCode=JSON.parse(readFileSync('test/fixtures/workforce/recorded/pons-funding-a-rpc-v1.json','utf8')).responses[1].response.result;
const sha='a'.repeat(40);
const authority:ArchiveParityAuthority={actions:true,repository:'CipherCuttle/binrat',eventName:'push',created:true,
  before:'0'.repeat(40),ref:`refs/heads/${ARCHIVE_PARITY_BRANCH}`,runAttempt:'1',message:ARCHIVE_PARITY_MARKER,
  sourceSha:sha,eventSha:sha,offlineVerifiedSha:sha};
const response=(result:unknown)=>JSON.stringify({jsonrpc:'2.0',id:1,result});
function sanitized(receipt:ArchiveParityReceipt){
  const text=JSON.stringify(receipt);
  for(const forbidden of [key,archive,'https://','rawResponse','apiKey','provider body'])assert.equal(text.includes(forbidden),false);
  assert.ok(receipt.requests===0||receipt.requests===1);
  assert.equal(receipt.maxRequests,1);assert.equal(receipt.noRetries,true);
}

test('exact frozen request, restricted POST and durable reservation precede the only mocked fetch',async()=>{
  for(const credential of [key,archive]){
    const events:string[]=[],saved:ArchiveParityReceipt[]=[];
    const run=createGithubArchiveParityVerification(credential,authority,async(url,init)=>{
      events.push('fetch');assert.deepEqual(events,['reserve','fetch']);
      assert.equal(String(url),archive);assert.equal(init?.method,'POST');assert.equal(init?.redirect,'error');
      assert.deepEqual(init?.headers,{'content-type':'application/json'});assert.ok(init?.signal);
      assert.equal(String(init?.body),JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getCode',
        params:['0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e','0x4df8192']}));
      return new Response(response(historicalCode));
    });
    const receipt=await run(pending=>{events.push('reserve');saved.push(pending);});
    assert.equal(receipt.verdict,'GITHUB_ARCHIVE_PARITY_PASS');assert.equal(receipt.status,'PASS');
    assert.equal(receipt.requests,1);assert.equal(receipt.returnedCodeHash,expected);
    assert.equal(receipt.expectedCodeHash,expected);assert.equal(receipt.network,4663);
    assert.equal(receipt.block,81756562);assert.equal(BigInt(receipt.blockHex),81756562n);
    assert.equal(saved.length,1);assert.equal(saved[0].reason,'RESERVED_NO_RETRY');assert.equal(saved[0].requests,1);
    sanitized(receipt);sanitized(saved[0]);
    const second=await run(()=>assert.fail('second reservation forbidden'));
    assert.equal(second.status,'BLOCKED');assert.equal(second.reason,'SINGLE_USE_CONSUMED');
    assert.deepEqual(events,['reserve','fetch']);sanitized(second);
  }
});

test('hash mismatch records only returned Keccak hash and never makes a second call',async()=>{
  for(const code of ['0x','0x6000']){
    let n=0;
    const run=createGithubArchiveParityVerification(key,authority,async()=>{n++;return new Response(response(code));});
    const result=await run(()=>{});
    assert.equal(result.verdict,'GITHUB_ARCHIVE_PARITY_FAIL');assert.equal(result.status,'BLOCKED');
    assert.equal(result.returnedCodeHash,keccak256(code as Hex));assert.equal(result.requests,1);
    assert.equal(verifyFunderCohortFactoryCode(code).matches,false);sanitized(result);
    await run(()=>assert.fail());assert.equal(n,1);
  }
  assert.deepEqual(verifyFunderCohortFactoryCode(historicalCode),{codeHash:expected,matches:true});
});

test('every Actions authority gate fails closed before reserve or fetch; reruns cannot consume a new allowance',async()=>{
  const changes:Partial<ArchiveParityAuthority>[]=[{actions:false},{repository:'other/binrat'},{eventName:'workflow_dispatch'},
    {created:false},{before:sha},{ref:'refs/heads/feat/binrat-funder-cohort-v1'},{runAttempt:'2'},
    {message:ARCHIVE_PARITY_MARKER+'\nretry'},{sourceSha:'invalid'},{eventSha:'b'.repeat(40)},{offlineVerifiedSha:''}];
  for(const change of changes){
    let n=0;
    const run=createGithubArchiveParityVerification(key,{...authority,...change},async()=>{n++;throw new Error(key);});
    const result=await run(()=>assert.fail('unauthorized reservation'));
    assert.equal(result.reason,'AUTHORITY_UNAVAILABLE');assert.equal(result.status,'BLOCKED');
    assert.equal(result.requests,0);assert.equal(n,0);sanitized(result);
    assert.equal((await run(()=>assert.fail())).reason,'SINGLE_USE_CONSUMED');assert.equal(n,0);
  }
});

test('missing or invalid credential makes zero calls and never exports input in the receipt',async()=>{
  for(const secret of [undefined,'',archive+'?token='+key,'http://robinhood-mainnet.g.alchemy.com/v2/'+key,
    'https://attacker.example/v2/'+key,archive+'/extra']){
    let n=0;
    const run=createGithubArchiveParityVerification(secret,authority,async()=>{n++;throw new Error(key);});
    const result=await run(()=>assert.fail());
    assert.equal(result.reason,'ARCHIVE_SECRET_UNAVAILABLE_OR_INVALID');assert.equal(result.requests,0);
    assert.equal(result.status,'BLOCKED');assert.equal(n,0);sanitized(result);
  }
});

test('failure to persist the reservation prevents sending',async()=>{
  let n=0;
  const run=createGithubArchiveParityVerification(key,authority,async()=>{n++;throw new Error(key);});
  const result=await run(()=>{throw new Error(archive);});
  assert.equal(result.status,'BLOCKED');assert.equal(result.requests,0);assert.equal(n,0);sanitized(result);
  await run(()=>assert.fail());assert.equal(n,0);
});

test('HTTP denial, redirect rejection, thrown secret and malformed replies never trigger retry or fallback',async()=>{
  const bodies=['provider body',{jsonrpc:'2.0',id:2,result:historicalCode},
    {jsonrpc:'1.0',id:1,result:historicalCode},{jsonrpc:'2.0',id:1,error:{message:key}},
    {jsonrpc:'2.0',id:1,result:'0x123'},{jsonrpc:'2.0',id:1,result:null},
    {jsonrpc:'2.0',id:1,result:'not hex'},[],null,
    '{"jsonrpc":"2.0","id":1,"id":1,"result":"0x"}'];
  const fetches:(typeof fetch)[]=[
    async()=>new Response('provider body',{status:403}),
    async()=>new Response('',{status:302,headers:{location:archive}}),
    async()=>{throw new Error(archive);},
    ...bodies.map(body=>async()=>new Response(typeof body==='string'?body:JSON.stringify(body)))
  ];
  for(const fetcher of fetches){
    let n=0;
    const run=createGithubArchiveParityVerification(key,authority,async(...args)=>{n++;return fetcher(...args);});
    const result=await run(()=>{});
    assert.equal(result.verdict,'GITHUB_ARCHIVE_PARITY_BLOCKED');assert.equal(result.requests,1);
    assert.equal(result.returnedCodeHash,null);sanitized(result);
    await run(()=>assert.fail());assert.equal(n,1);
  }
});

test('credential reflection is discarded including escaped, percent-encoded and truncated responses',async()=>{
  const escaped=key.split('').map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('');
  const encoded=key.split('').map(c=>'%'+c.charCodeAt(0).toString(16)).join('');
  for(const body of [JSON.stringify({error:archive}),JSON.stringify({error:key}),JSON.stringify({error:encoded}),
    '{"error":"'+escaped+'"}','{"error":"'+escaped]){
    let n=0;
    const run=createGithubArchiveParityVerification(key,authority,async()=>{n++;return new Response(body,{status:401});});
    const receipt=await run(()=>{});
    assert.equal(receipt.reason,'ARCHIVE_RPC_SECRET_REFLECTION');assert.equal(receipt.status,'BLOCKED');
    assert.equal(n,1);assert.equal(receipt.returnedCodeHash,null);sanitized(receipt);
  }
});

test('stream interruption and oversize replies remain bounded and sanitized',async()=>{
  for(const oversize of [true,false]){
    let n=0,reads=0;
    const run=createGithubArchiveParityVerification(key,authority,async()=>{
      n++;
      return new Response(new ReadableStream({pull(controller){
        if(oversize){controller.enqueue(new Uint8Array(1_000_001));controller.close();}
        else if(reads++===0)controller.enqueue(new TextEncoder().encode('{"error":"'+key));
        else controller.error(new Error(archive));
      }}));
    });
    const receipt=await run(()=>{});assert.equal(receipt.status,'BLOCKED');assert.equal(n,1);
    assert.equal(receipt.reason,oversize?'PROSPECTIVE_RPC_RESPONSE_TOO_LARGE':'ARCHIVE_RPC_SECRET_REFLECTION');
    sanitized(receipt);
  }
});

test('the existing 15-second transport timeout stops the only mocked request without retry',async()=>{
  let n=0;
  const run=createGithubArchiveParityVerification(key,authority,async(_url,init)=>{
    n++;
    return new Promise<Response>((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(new Error(archive)),{once:true}));
  });
  const receipt=await run(()=>{});
  assert.equal(receipt.reason,'PROSPECTIVE_RPC_TIMEOUT');assert.equal(receipt.status,'BLOCKED');
  assert.equal(receipt.requests,1);sanitized(receipt);
  await run(()=>assert.fail());assert.equal(n,1);
});

test('CLI output and disk receipt remain sanitized on preflight halt, and existing journal prevents reuse',()=>{
  const directory=mkdtempSync(join(tmpdir(),'binrat-archive-parity-offline-'));
  try{
    const run=()=>spawnSync(process.execPath,['scripts/verify-github-archive-parity.mjs'],{encoding:'utf8',
      env:{PATH:process.env.PATH,RUNNER_TEMP:directory,BINRAT_ROBINHOOD_ARCHIVE_RPC_URL:archive}});
    const first=run();assert.equal(first.status,1);assert.equal(first.stderr,'');
    const receipt=JSON.parse(first.stdout);assert.equal(receipt.requests,0);assert.equal(receipt.status,'BLOCKED');
    sanitized(receipt);assert.equal(first.stdout.includes(key),false);
    const out=join(directory,'binrat-github-archive-parity-20261014');
    assert.deepEqual(readdirSync(out),['receipt.json']);
    const persisted=readFileSync(join(out,'receipt.json'),'utf8');sanitized(JSON.parse(persisted));
    const second=run();assert.equal(second.status,1);assert.equal(second.stderr,'');
    assert.equal(JSON.parse(second.stdout).reason,'SINGLE_USE_DIRECTORY_EXISTS');
    assert.equal(readFileSync(join(out,'receipt.json'),'utf8'),persisted);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('workflow gates a fresh push and attempt 1, tests before secret injection, and uploads only the receipt',()=>{
  const workflow=readFileSync('.github/workflows/github-archive-parity-once.yml','utf8');
  assert.ok(workflow.includes(`branches: [${ARCHIVE_PARITY_BRANCH}]`));
  for(const gate of ['github.event.created == true','github.run_attempt == 1',ARCHIVE_PARITY_MARKER,
    "github.event.before == '0000000000000000000000000000000000000000'"])assert.ok(workflow.includes(gate));
  assert.equal(workflow.includes('workflow_dispatch'),false);assert.equal(workflow.includes('schedule:'),false);
  assert.ok(workflow.indexOf('tsx --test')<workflow.indexOf('secrets.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL'));
  assert.equal((workflow.match(/secrets\./g)??[]).length,1);
  assert.ok(workflow.includes('/receipt.json'));assert.equal(workflow.includes('capture-funder-cohort'),false);
  assert.equal(workflow.includes('deploy'),false);assert.equal(workflow.includes('contents: write'),false);
  assert.equal(Object.isFrozen(ARCHIVE_PARITY_REQUEST),true);assert.equal(Object.isFrozen(ARCHIVE_PARITY_REQUEST.params),true);
});
