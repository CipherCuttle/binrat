import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,mkdirSync,copyFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {loadVerifiedCaseMcp} from '../scripts/binrat-mcp-case-offline.js';
import {evaluateTool,handleMcp} from '../scripts/binrat-mcp-offline.mjs';
import {verifyCaseEnvelope} from '../src/public/caseEvidence.js';

const CASE='742ed5c2d361c11d5a4da715e35e6c189a9b61ae4a433a937a96111360d7ab01';
const FILES=[
  'docs/receipts/sprint-a1/public-feed.json',
  'docs/receipts/sprint-a1/public-status.json',
  'docs/receipts/sprint-a1-2-contract/old-case-envelope.json'
];

test('canonical validator approves pinned real old Case with all 20 launch/provenance receipts',async()=>{
  const s=await loadVerifiedCaseMcp();
  const proof=s.verifiedCase;
  assert.equal(proof.caseId,CASE);
  assert.equal(proof.records.length,20);
  assert.equal(proof.priorLaunchCount,19);
  assert.match(proof.caseDigest,/^[a-f0-9]{64}$/);
  assert.match(proof.source.sha256,/^[a-f0-9]{64}$/);
  assert.equal(proof.source.gitBlob,'ac4258f22bb32643b4829a699f7c5bf4720690ba');
  assert.equal(proof.publication.chainId,4663);
  assert.notEqual(proof.publication.feedDigest,s.feed.feedDigest,
    'two genuine capture publications must never be silently treated as the same');
  assert.ok(BigInt(proof.publication.checkpointBlock)>=BigInt(s.feed.sourceCheckpoint));
  const out=evaluateTool(s,'get_case',{case_id:CASE});
  assert.equal(out.status,'OK');
  assert.equal(out.reason,'VALIDATED_RECORDED_CASE_PARTIAL_HISTORY');
  assert.equal(out.data.evidenceValidated,true);
  assert.equal(out.data.records.length,20);
  assert.equal(out.data.caseDigest,proof.caseDigest);
  assert.equal(out.coverage.history,'PARTIAL');
  assert.equal(out.coverage.wholeChain,false);
  assert.equal(out.freshness.liveNow,'UNKNOWN');
  assert.equal(out.provenance.caseEnvelopeDigest,proof.caseDigest);
  assert.equal(out.data.records[0].provenanceFactId,'binrat-fact:4663:'+CASE);
  assert.ok(!JSON.stringify(out).includes('imageUri'),'untrusted launch metadata must not leak into tool output');
  assert.ok(Buffer.byteLength(JSON.stringify(out))<32768,'bounded tool result');
});

test('missed IDs, mismatched authors, unpinned payloads and malformed tool names fail closed',async()=>{
  const s=await loadVerifiedCaseMcp();
  assert.equal(evaluateTool(s,'get_case',{case_id:'f'.repeat(64)}).status,'UNKNOWN');
  assert.equal(evaluateTool(s,'get_case',{case_id:CASE.toUpperCase()}).status,'ERROR');
  assert.equal(evaluateTool(s,'get_case',{case_id:CASE,transferFunds:true}).status,'ERROR');
  const r=handleMcp(s,{jsonrpc:'2.0',id:12,method:'tools/call',params:{name:'get_case',arguments:{case_id:CASE}}});
  assert.equal(r.result.structuredContent.status,'OK');
  assert.equal(r.result.isError,false);
  assert.equal(handleMcp(s,{jsonrpc:'2.0',id:13,method:'tools/call',params:{name:'compare_cases'}}).error.code,-32602);
});

test('real authoritative Case verifier detects tampering even if an attacker recomputes a wire digest',async()=>{
  const src=JSON.parse(readFileSync(resolve(FILES[2]),'utf8'));
  const mutated=structuredClone(src);
  mutated.material.records[1].launch.creator='0x'+'0'.repeat(40);
  await assert.rejects(verifyCaseEnvelope(mutated,CASE,src.material.publication));
});

test('pinning rejects old Case mutation, earlier-feed substitution, and mismatched independent captures',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'binrat-case-mcp-'));
  try{
    for(const path of FILES){
      mkdirSync(dirname(join(dir,path)),{recursive:true});
      copyFileSync(resolve(path),join(dir,path));
    }
    assert.equal((await loadVerifiedCaseMcp(dir)).verifiedCase.caseId,CASE);
    const path=join(dir,FILES[2]);
    const bytes=readFileSync(path,'utf8');
    writeFileSync(path,bytes.replace('"priorLaunchCount": 19','"priorLaunchCount": 18'));
    await assert.rejects(loadVerifiedCaseMcp(dir),/MCP_CASE_EVIDENCE_SOURCE_DRIFT/);
    writeFileSync(path,bytes);
    writeFileSync(join(dir,FILES[0]),readFileSync(resolve(FILES[0]),'utf8').replace('"PARTIAL"','"COMPLETE"'));
    await assert.rejects(loadVerifiedCaseMcp(dir),/SOURCE_GIT_BLOB_DRIFT/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('MCP stdio emits one real validated Case and no non-protocol stdout',()=>{
  const input=[
    {jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}},
    {jsonrpc:'2.0',method:'notifications/initialized'},
    {jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'get_case',arguments:{case_id:CASE}}}
  ];
  const result=spawnSync(process.execPath,['--import','tsx','scripts/binrat-mcp-case-offline.ts'],{
    cwd:process.cwd(),input:input.map(x=>JSON.stringify(x)).join('\n')+'\n',
    encoding:'utf8',timeout:15000,
    env:{PATH:process.env.PATH,HOME:process.env.HOME}
  });
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stderr,'');
  const frames=result.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(frames.length,2);
  assert.deepEqual(frames.map(x=>x.id),[1,2]);
  assert.equal(frames[1].result.structuredContent.status,'OK');
  assert.equal(frames[1].result.structuredContent.data.records.length,20);
});
