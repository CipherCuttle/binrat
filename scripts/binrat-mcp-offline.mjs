#!/usr/bin/env node
/**
 * BINRAT MCP V0.1: a LOCAL, OFFLINE, stdio read-only protocol proof.
 * Source: one pinned, real-but-historical Pons publication, never live RPC.
 * Not a commercial service, not a complete Case/Watch implementation.
 */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const SOURCE_COMMIT='160ab9c4fbb2f9cebd4a45cc20f5e75d85f57302';
const SOURCES=Object.freeze({
  feed:{path:'docs/receipts/sprint-a1/public-feed.json',gitBlob:'e30c7104cec98ce1a644768e43e7aa91ab7cea60'},
  status:{path:'docs/receipts/sprint-a1/public-status.json',gitBlob:'cfa2881aa00512aefd426c16dab1b09d040ac5ea'}
});
const CASE=/^[0-9a-f]{64}$/;
const ADDRESS=/^0x[0-9a-f]{40}$/;
const HASH=/^0x[0-9a-f]{64}$/;
const MAX_BYTES=32768;
const MCP_VERSIONS=new Set(['2025-03-26','2025-06-18','2025-11-25']);
const OBJECT=(x)=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const clean=(x)=>typeof x==='string'&&x.length>0;
const natural=(x)=>Number.isSafeInteger(x)&&x>=0;
const error=(code)=>{throw new Error(code)};

function readPinned(root,key){
  const spec=SOURCES[key];
  const bytes=readFileSync(join(resolve(root),spec.path));
  if(bytes.length>MAX_BYTES)error('SOURCE_SIZE_LIMIT');
  const git=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  if(git!==spec.gitBlob)error('SOURCE_GIT_BLOB_DRIFT');
  const sha256=createHash('sha256').update(bytes).digest('hex');
  let data;
  try{data=JSON.parse(bytes.toString('utf8'));}catch{error('SOURCE_JSON_INVALID');}
  return {data,sha256,gitBlob:git};
}

/** Atomic startup read: no separate network requests or mutable production state. */
export function loadCapturedPons(root=process.cwd()){
  const feed=readPinned(root,'feed'),status=readPinned(root,'status');
  const f=feed.data,s=status.data;
  if(!OBJECT(f)||!OBJECT(s)||f.schemaVersion!=='binrat.latest-launches/0.1'||
     s.schemaVersion!=='binrat.public-status/0.1'||f.chainId!==4663||s.chainId!==4663||
     !clean(f.feedDigest)||!CASE.test(f.feedDigest)||f.feedDigest!==s.feedDigest||
     f.sourceCheckpoint!==s.checkpointBlock||
     !HASH.test(f.checkpointBlockHash)||f.checkpointBlockHash!==s.checkpointBlockHash||
     !natural(s.verifiedAtMs)||!natural(s.freshnessValidUntilMs)||
     !/^(0|[1-9]\d*)$/.test(f.sourceCheckpoint)||
     !['PARTIAL','UNVERIFIED','COMPLETE'].includes(f.historyCoverage)||
     !Array.isArray(f.launches)||f.launches.length>20)
    error('SOURCE_CONTRACT_DRIFT');
  const seen=new Set();
  const launches=[];
  for(const item of f.launches){
    if(!OBJECT(item)||!CASE.test(item.launchId)||seen.has(item.launchId)||
       !ADDRESS.test(item.deployer)||!ADDRESS.test(item.token)||
       !HASH.test(item.txHash)||!/^binrat-fact:4663:[0-9a-f]{64}$/.test(item.factId)||
       !natural(item.priorLaunchCount)||!/^(0|[1-9]\d*)$/.test(item.blockNumber)||
       BigInt(item.blockNumber)>BigInt(f.sourceCheckpoint))error('SOURCE_RECORD_DRIFT');
    seen.add(item.launchId);
    // Strict allowlist: never copy arbitrary token metadata or instructions to a model.
    launches.push(Object.freeze({launchId:item.launchId,deployer:item.deployer,token:item.token,
      txHash:item.txHash,blockNumber:item.blockNumber,factId:item.factId,
      priorLaunchCount:item.priorLaunchCount}));
  }
  return Object.freeze({feed:Object.freeze({schemaVersion:f.schemaVersion,chainId:4663,
    sourceCheckpoint:f.sourceCheckpoint,checkpointBlockHash:f.checkpointBlockHash,
    historyCoverage:f.historyCoverage,feedDigest:f.feedDigest,launches:Object.freeze(launches)}),
    status:Object.freeze({schemaVersion:s.schemaVersion,state:s.state,chainId:4663,
      verifiedAtMs:s.verifiedAtMs,freshnessValidUntilMs:s.freshnessValidUntilMs,
      publicationVersion:s.publicationVersion,checkpointBlock:s.checkpointBlock}),
    source:Object.freeze({type:'RECORDED_PUBLIC_PONS_FIXTURE',sourceCommit:SOURCE_COMMIT,
      readOnly:true,live:false,feedGitBlob:feed.gitBlob,statusGitBlob:status.gitBlob,
      feedSha256:feed.sha256,statusSha256:status.sha256})});
}

const TOOL_DEFS=Object.freeze([
 {name:'source_status',description:'Report pinned historical Pons source capture and explicitly UNKNOWN present-time freshness. No network.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'get_case',description:'Return a canonical verified historical Pons Case when the evidence-capture entrypoint is used; default discovery-only entrypoint stays UNKNOWN.',inputSchema:{type:'object',properties:{case_id:{type:'string',pattern:'^[0-9a-f]{64}$'}},required:['case_id'],additionalProperties:false}},
 {name:'investigate_deployer',description:'Find exact reported deployer matches within one pinned historical 20-launch snapshot only; never claim whole-chain coverage.',inputSchema:{type:'object',properties:{address:{type:'string',pattern:'^0x[0-9a-f]{40}$'},limit:{type:'integer',minimum:1,maximum:4}},required:['address'],additionalProperties:false}}
].map(x=>Object.freeze({...x,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}})));

function envelope(snapshot,status,data,reason=null){
  return {status,reason,data,
    provenance:{...snapshot.source,chainId:4663,schemaVersion:snapshot.feed.schemaVersion,
      feedDigest:snapshot.feed.feedDigest,checkpointBlock:snapshot.feed.sourceCheckpoint},
    freshness:{kind:'RECORDED_ONLY',liveNow:'UNKNOWN',recordedState:snapshot.status.state,
      recordedAtMs:snapshot.status.verifiedAtMs,recordedValidUntilMs:snapshot.status.freshnessValidUntilMs},
    coverage:{history:snapshot.feed.historyCoverage,scope:'CAPTURED_LATEST_20_WINDOW',wholeChain:false}};
}
function argumentsFor(value,allowed,required){
  if(!OBJECT(value)||Object.keys(value).some(k=>!allowed.includes(k))||
     required.some(k=>!Object.hasOwn(value,k)))error('INVALID_TOOL_ARGUMENTS');
  return value;
}
export function evaluateTool(snapshot,name,args){
  if(!TOOL_DEFS.some(t=>t.name===name))error('TOOL_UNKNOWN');
  try{
    if(name==='source_status'){
      argumentsFor(args,[],[]);
      return envelope(snapshot,'UNKNOWN',{
        source:'PONS_V2',chainId:4663,capturedLaunches:snapshot.feed.launches.length,
        recordedPublicationVersion:snapshot.status.publicationVersion},'LIVE_SOURCE_NOT_CHECKED');
    }
    if(name==='get_case'){
      const a=argumentsFor(args,['case_id'],['case_id']);
      if(typeof a.case_id!=='string'||!CASE.test(a.case_id))error('INVALID_CASE_ID');
      const match=snapshot.feed.launches.find(x=>x.launchId===a.case_id);
      const verified=snapshot.verifiedCase;
      if(verified?.caseId===a.case_id){
        // verifyCaseEnvelope() has independently rederived all 20 identities,
        // authority digests and provenance before this immutable projection exists.
        const response=envelope(snapshot,'OK',{
          caseId:verified.caseId,
          reportedDeployer:verified.reportedDeployer,
          token:verified.token,
          caseDigest:verified.caseDigest,
          priorLaunchCount:verified.priorLaunchCount,
          records:verified.records,
          evidenceValidated:true,
          evidenceSource:'PINNED_HISTORICAL_CASE_ENVELOPE',
          recordedCasePublication:verified.publication,
          currentLiveStatus:'UNKNOWN'
        },'VALIDATED_RECORDED_CASE_PARTIAL_HISTORY');
        response.provenance={
          ...response.provenance,
          caseEnvelopeSource:verified.source,
          caseEnvelopeDigest:verified.caseDigest,
          casePublicationFeedDigest:verified.publication.feedDigest,
          casePublicationCheckpoint:verified.publication.checkpointBlock
        };
        // Never borrow earlier feed freshness for the later Case publication.
        response.freshness={
          kind:'RECORDED_ONLY',liveNow:'UNKNOWN',
          recordedCaseVerifiedAtMs:verified.publication.verifiedAtMs,
          recordedCasePublicationVersion:verified.publication.publicationVersion
        };
        response.coverage={
          history:'PARTIAL',scope:'LATEST_20_DEPLOYER_LAUNCHES_THROUGH_CASE',
          resultLimit:20,olderHistory:'NOT_ENUMERATED',wholeChain:false
        };
        return response;
      }
      return envelope(snapshot,'UNKNOWN',match ? {recordedLaunchCard:match,fullCaseEvidence:null} :
        {recordedLaunchCard:null,fullCaseEvidence:null},
        match?'FULL_CASE_EVIDENCE_NOT_CAPTURED':'CASE_NOT_IN_RECORDED_WINDOW');
    }
    const a=argumentsFor(args,['address','limit'],['address']);
    if(typeof a.address!=='string'||!ADDRESS.test(a.address))error('INVALID_DEPLOYER');
    const limit=a.limit??4;
    if(!Number.isSafeInteger(limit)||limit<1||limit>4)error('INVALID_RESULT_LIMIT');
    const matches=snapshot.feed.launches.filter(x=>x.deployer===a.address);
    const found=matches.slice(0,limit);
    const truncated=matches.length>found.length;
    // Partial historical coverage and truncated result sets cannot be reported as complete OK.
    const incomplete=truncated||snapshot.feed.historyCoverage!=='COMPLETE';
    return envelope(snapshot,!matches.length||incomplete?'UNKNOWN':'OK',{
      reportedDeployer:a.address,launches:found,capturedMatchCount:matches.length,
      returned:found.length,truncated},
      !matches.length?'NO_MATCH_IN_RECORDED_WINDOW':
      truncated?'MATCHES_TRUNCATED_AT_RESULT_LIMIT':
      incomplete?'HISTORY_PARTIAL_RECORDED_WINDOW_ONLY':'RECORDED_WINDOW_ONLY');
  }catch(e){
    return envelope(snapshot,'ERROR',null,e instanceof Error?e.message:'INVALID_TOOL_ARGUMENTS');
  }
}
const rpcResult=(id,result)=>({jsonrpc:'2.0',id,result});
const rpcError=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
export function handleMcp(snapshot,message){
  if(!OBJECT(message)||message.jsonrpc!=='2.0'||!clean(message.method))return rpcError(message?.id??null,-32600,'Invalid Request');
  const id=message.id;
  const notification=id===undefined;
  if(notification)return null;
  if(typeof id!=='string'&&typeof id!=='number')return rpcError(null,-32600,'Invalid Request');
  if(message.method==='initialize'){
    const p=message.params;
    if(!OBJECT(p)||typeof p.protocolVersion!=='string')return rpcError(id,-32602,'Invalid params');
    const protocolVersion=MCP_VERSIONS.has(p.protocolVersion)?p.protocolVersion:'2025-06-18';
    return rpcResult(id,{protocolVersion,capabilities:{tools:{listChanged:false}},serverInfo:{name:'binrat-pinned-pons-offline',version:'0.1.0'}});
  }
  if(message.method==='ping')return rpcResult(id,{});
  if(message.method==='tools/list')return rpcResult(id,{tools:TOOL_DEFS});
  if(message.method==='tools/call'){
    const p=message.params;
    if(!OBJECT(p)||typeof p.name!=='string'||!TOOL_DEFS.some(t=>t.name===p.name))return rpcError(id,-32602,'Unknown or invalid tool');
    const out=evaluateTool(snapshot,p.name,p.arguments??{});
    // MCP exposes both text and structured content. For a 20-record Case,
    // a second full JSON copy would exceed the bounded JSON-RPC frame.
    const textContent=out.status==='OK'&&p.name==='get_case'
      ? JSON.stringify({status:out.status,reason:out.reason,
          caseId:out.data.caseId,reportedDeployer:out.data.reportedDeployer,
          recordedPriorLaunchCount:out.data.priorLaunchCount,
          caseDigest:out.data.caseDigest,fullRecords:'structuredContent',
          note:'Recorded Pons Case; partial history; current live state UNKNOWN'})
      : JSON.stringify(out);
    const result={content:[{type:'text',text:textContent}],structuredContent:out,isError:out.status==='ERROR'};
    return rpcResult(id,result);
  }
  return rpcError(id,-32601,'Method not found');
}
export function runStdio(snapshot){
  // stdout exclusively for one JSON-RPC object per line; stderr for diagnostics.
  let buf='';
  const emit=(x)=>{if(x!==null)process.stdout.write(JSON.stringify(x)+'\n');};
  process.stdin.setEncoding('utf8');
  process.stdin.on('data',chunk=>{
    buf+=chunk;
    if(Buffer.byteLength(buf,'utf8')>MAX_BYTES*2){
      process.stderr.write('MCP_INPUT_TOO_LARGE\n');process.exitCode=1;process.stdin.pause();return;
    }
    let newline;
    while((newline=buf.indexOf('\n'))>=0){
      const raw=buf.slice(0,newline).trim();buf=buf.slice(newline+1);
      if(!raw)continue;
      if(Buffer.byteLength(raw,'utf8')>MAX_BYTES){emit(rpcError(null,-32700,'Input too large'));continue;}
      try{emit(handleMcp(snapshot,JSON.parse(raw)));}
      catch{emit(rpcError(null,-32700,'Parse error'));}
    }
  });
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  try{runStdio(loadCapturedPons());}
  catch(e){process.stderr.write('BINRAT_MCP_OFFLINE_STOP:'+String(e instanceof Error?e.message:'UNKNOWN')+'\n');process.exitCode=1;}
}
