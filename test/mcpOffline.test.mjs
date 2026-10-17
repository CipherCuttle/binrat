import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {loadCapturedPons,evaluateTool,handleMcp} from '../scripts/binrat-mcp-offline.mjs';

const FILES=['docs/receipts/sprint-a1/public-feed.json','docs/receipts/sprint-a1/public-status.json'];
const cid=(s)=>s.feed.launches[0].launchId;
const addr=(s)=>s.feed.launches[0].deployer;

test('pinned real Pons historical source matches checksum, chain, schemas and checkpoint',()=>{
  const s=loadCapturedPons();
  assert.equal(s.feed.chainId,4663);
  assert.equal(s.feed.schemaVersion,'binrat.latest-launches/0.1');
  assert.equal(s.feed.launches.length,20);
  assert.equal(s.source.live,false);
  assert.match(s.source.feedSha256,/^[a-f0-9]{64}$/);
  assert.notEqual(s.status.verifiedAtMs,undefined);
});

test('source_status is truthful about recorded versus current freshness',()=>{
  const s=loadCapturedPons();
  const r=evaluateTool(s,'source_status',{});
  assert.equal(r.status,'UNKNOWN');
  assert.equal(r.reason,'LIVE_SOURCE_NOT_CHECKED');
  assert.equal(r.freshness.liveNow,'UNKNOWN');
  assert.equal(r.freshness.kind,'RECORDED_ONLY');
  assert.equal(r.provenance.sourceCommit,'160ab9c4fbb2f9cebd4a45cc20f5e75d85f57302');
  assert.equal(r.data.capturedLaunches,20);
});

test('get_case identifies exactly one recorded launch but refuses to manufacture a Case envelope',()=>{
  const s=loadCapturedPons();
  const r=evaluateTool(s,'get_case',{case_id:cid(s)});
  assert.equal(r.status,'UNKNOWN');
  assert.equal(r.reason,'FULL_CASE_EVIDENCE_NOT_CAPTURED');
  assert.equal(r.data.recordedLaunchCard.launchId,cid(s));
  assert.equal(r.data.recordedLaunchCard.deployer,addr(s));
  assert.equal(r.data.fullCaseEvidence,null);
  assert.equal(evaluateTool(s,'get_case',{case_id:'f'.repeat(64)}).reason,'CASE_NOT_IN_RECORDED_WINDOW');
});

test('deployer lookup stays exact-address, snapshot-scoped, limited and explicit on missing',()=>{
  const s=loadCapturedPons();
  const r=evaluateTool(s,'investigate_deployer',{address:addr(s),limit:1});
  assert.equal(r.status,'OK');
  assert.equal(r.data.launches[0].deployer,addr(s));
  assert.equal(r.data.returned,1);
  assert.equal(r.coverage.wholeChain,false);
  assert.equal(r.coverage.history,'PARTIAL');
  assert.equal(evaluateTool(s,'investigate_deployer',{address:'0x'+'0'.repeat(40)}).status,'UNKNOWN');
  assert.equal(evaluateTool(s,'investigate_deployer',{address:'0x'+'0'.repeat(40)}).reason,'NO_MATCH_IN_RECORDED_WINDOW');
});

test('malformed input, injected fields and unbounded output rejected',()=>{
  const s=loadCapturedPons();
  for(const params of [
    {address:'http://169.254.169.254'},
    {address:'0x'+'f'.repeat(40),limit:1000},
    {address:addr(s),limit:4,arbitraryRpc:'eth_call'},
    {address:addr(s),limit:-1}
  ]){
    const out=evaluateTool(s,'investigate_deployer',params);
    assert.equal(out.status,'ERROR');
    assert.equal(out.data,null);
  }
  assert.equal(evaluateTool(s,'get_case',{case_id:'ab'}).status,'ERROR');
  assert.equal(evaluateTool(s,'source_status',{url:'https://example.com'}).status,'ERROR');
  assert.equal(evaluateTool(s,'compare_cases',{}).status,'ERROR');
});

test('pinning prevents swapped, mixed or modified snapshots',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'binrat-mcp-'));
  try{
    for(const file of FILES){
      mkdirSync(dirname(join(tmp,file)),{recursive:true});
      copyFileSync(resolve(file),join(tmp,file));
    }
    assert.equal(loadCapturedPons(tmp).feed.launches.length,20);
    const p=join(tmp,FILES[1]);
    writeFileSync(p,readFileSync(p,'utf8').replace('"FRESH_VERIFIED"','"STALE_VERIFIED"'));
    assert.throws(()=>loadCapturedPons(tmp),/SOURCE_GIT_BLOB_DRIFT/);
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('MCP handshake, tools listing, responses, notifications and invalid calls',()=>{
  const s=loadCapturedPons();
  const init=handleMcp(s,{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'offline-test',version:'1'}}});
  assert.equal(init.result.protocolVersion,'2025-06-18');
  assert.equal(init.result.serverInfo.name,'binrat-pinned-pons-offline');
  assert.deepEqual(handleMcp(s,{jsonrpc:'2.0',id:2,method:'tools/list'}).result.tools.map(x=>x.name),
    ['source_status','get_case','investigate_deployer']);
  const ok=handleMcp(s,{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'get_case',arguments:{case_id:cid(s)}}});
  assert.equal(ok.result.structuredContent.reason,'FULL_CASE_EVIDENCE_NOT_CAPTURED');
  assert.equal(ok.result.isError,false);
  const bad=handleMcp(s,{jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'get_case',arguments:{case_id:'oops'}}});
  assert.equal(bad.result.isError,true);
  assert.equal(handleMcp(s,{jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'arbitrary_rpc'}}).error.code,-32602);
  assert.equal(handleMcp(s,{jsonrpc:'2.0',id:6,method:'arbitrary/method'}).error.code,-32601);
  assert.equal(handleMcp(s,{jsonrpc:'2.0',method:'notifications/initialized'}),null);
});

test('real stdio has JSON-RPC only on stdout, bounded input and no network',()=>{
  const commands=[
    {jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}},
    {jsonrpc:'2.0',method:'notifications/initialized'},
    {jsonrpc:'2.0',id:2,method:'tools/list'},
    {jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'source_status',arguments:{}}},
  ];
  const result=spawnSync(process.execPath,['scripts/binrat-mcp-offline.mjs'],{
    cwd:process.cwd(),input:commands.map(c=>JSON.stringify(c)).join('\n')+'\n',encoding:'utf8',
    timeout:5000,env:{PATH:process.env.PATH,HOME:process.env.HOME}});
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stderr,'');
  const rows=result.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(rows.length,3,'notifications must never generate stdout');
  assert.deepEqual(rows.map(x=>x.id),[1,2,3]);
  assert.equal(rows[0].result.protocolVersion,'2025-11-25');
  assert.equal(rows[2].result.structuredContent.status,'UNKNOWN');
  assert.equal(rows[2].result.isError,false);
  assert.equal(rows.every(x=>x.jsonrpc==='2.0'),true);
});
