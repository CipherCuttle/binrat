/**
 * A single live, bounded BINRAT↔Bitquery recent Pons comparison.
 * Use only a fresh BINRAT public publication and a matching real Bitquery event.
 * EXACT ONE run grant. No trading, archive, retries, billing, model or tokens in logs.
 */
import {createHash} from 'node:crypto';
import {verifyCaseEnvelope} from '../src/public/caseEvidence.js';

const HOST='https://binrat.tech';
const BITQUERY='https://streaming.bitquery.io/graphql';
const FACTORY='0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e';
const TOPIC='8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607';
const ID=/^[0-9a-f]{64}$/;
const TX=/^0x[0-9a-f]{64}$/;
const ADDR=/^0x[0-9a-f]{40}$/;
const MAX_CALLS=Object.freeze({binrat:4,bitquery:2});
const MAX_BYTES=65536;
const FETCH_TIMEOUT_MS=10000;
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const object=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=(code:string):never=>{throw new Error(code)};
export const RECENT_QUERY='query { EVM(network: robinhood) { Events(limit: {count: 10}, orderBy: {descending: Block_Time}, where: {LogHeader: {Address: {is: "'+FACTORY+'"}} Topics: {includes: [{Hash: {is: "'+TOPIC+'"}}]}}) { Block {Number Time} Transaction {Hash From} Log {Index Signature {Name SignatureHash}} Arguments {Name Value {... on EVM_ABI_Address_Value_Arg {address}}} } } }';
export const HISTORY_QUERY=(address:string)=>{
  if(!ADDR.test(address))fail('CREATOR_INVALID');
  return 'query { EVM(network: robinhood) { Events(limit: {count: 20}, orderBy: {descending: Block_Time}, where: {LogHeader: {Address: {is: "'+FACTORY+'"}} Log: {Signature: {SignatureHash: {is: "'+TOPIC+'"}}} Arguments: {includes: {Name: {is: "deployer"}, Value: {Address: {is: "'+address+'"}}}}}) { Block {Number Time} Transaction {Hash From} Log {Index Signature {Name SignatureHash}} Arguments {Name Value {... on EVM_ABI_Address_Value_Arg {address}}} } } }';
};
export function normalizeBitquery(raw:any,max:number){
  if(!object(raw)||Array.isArray(raw.errors)&&raw.errors.length)fail('BITQUERY_QUERY_ERROR');
  const events=raw?.data?.EVM?.Events;
  if(!Array.isArray(events)||events.length>max)fail('BITQUERY_SCHEMA_INVALID');
  return events.map((r:any)=>{
    const args=Object.fromEntries((r.Arguments||[]).filter((v:any)=>typeof v?.Name==='string'&&typeof v?.Value?.address==='string').map((v:any)=>[v.Name,v.Value.address.toLowerCase()]));
    return {txHash:String(r?.Transaction?.Hash||'').toLowerCase(),
      blockNumber:String(r?.Block?.Number??''),logIndex:r?.Log?.Index,
      token:String(args.token||''),deployer:String(args.deployer||''),
      signature:String(r?.Log?.Signature?.SignatureHash||'').replace(/^0x/,'').toLowerCase()};
  }).filter((e:any)=>TX.test(e.txHash)&&/^(0|[1-9]\d*)$/.test(e.blockNumber)&&e.signature===TOPIC);
}
function validateStatus(s:any,now:number){
  if(!object(s)||s.chainId!==4663||s.schemaVersion!=='binrat.public-status/0.1'||
     s.state!=='FRESH_VERIFIED'||!ID.test(s.feedDigest)||!TX.test(s.checkpointBlockHash)||
     !/^(0|[1-9]\d*)$/.test(s.checkpointBlock)||
     !Number.isSafeInteger(s.verifiedAtMs)||!Number.isSafeInteger(s.freshnessValidUntilMs)||
     now<s.verifiedAtMs||now>s.freshnessValidUntilMs||
     now-s.verifiedAtMs>180000||s.lastSyncError!==null)fail('BINRAT_STATUS_NOT_CURRENT_VERIFIED');
  return s;
}
function validateFeed(feed:any,s:any){
  if(!object(feed)||feed.schemaVersion!=='binrat.latest-launches/0.1'||feed.chainId!==4663||
     feed.feedDigest!==s.feedDigest||feed.sourceCheckpoint!==s.checkpointBlock||
     feed.checkpointBlockHash!==s.checkpointBlockHash||!Array.isArray(feed.launches)||
     feed.launches.length<1||feed.launches.length>20)fail('BINRAT_FEED_NOT_BOUND_TO_STATUS');
  for(const item of feed.launches){
    if(!ID.test(item.launchId)||!TX.test(item.txHash)||!ADDR.test(item.deployer)||
       !ADDR.test(item.token)||!/^(0|[1-9]\d*)$/.test(item.blockNumber)||
       BigInt(item.blockNumber)>BigInt(s.checkpointBlock))fail('BINRAT_FEED_RECORD_INVALID');
  }
  return feed;
}
export function selectOverlap(feed:any,bitqueryEvents:any[]){
  for(const row of bitqueryEvents){
    const matched=feed.launches.find((b:any)=>b.txHash===row.txHash&&b.blockNumber===row.blockNumber);
    if(matched&&row.deployer&&row.token&&row.deployer===matched.deployer&&row.token===matched.token){
      return {launchId:matched.launchId,deployer:matched.deployer,token:matched.token,
        txHash:matched.txHash,blockNumber:matched.blockNumber,signature:row.signature};
    }
  }
  return null;
}
function assertPublishedCase(raw:any,chosen:any,feed:any,status:any){
  if(!object(raw)||raw.material?.caseId!==chosen.launchId||raw.material?.chainId!==4663||
     raw.material?.source!=='PONS_V2'||raw.material?.publication?.feedDigest!==feed.feedDigest||
     raw.material?.publication?.checkpointBlock!==status.checkpointBlock||
     raw.material?.publication?.checkpointBlockHash!==status.checkpointBlockHash||
     raw.material?.publication?.publicationVersion!==status.publicationVersion)fail('CASE_PUBLICATION_MISMATCH');
}
function compareEvidence(verified:any,selected:any,events:any[]){
  const target=verified.material.records[0].launch;
  const fields={transaction:target.txHash===selected.txHash,
    block:target.blockNumber===selected.blockNumber,
    token:target.token===selected.token,
    reportedDeployer:target.creator===selected.deployer,
    factory:target.launcher===FACTORY};
  if(Object.values(fields).some(v=>!v))fail('CASE_TARGET_CROSS_SOURCE_CONFLICT');
  const history=new Set(verified.material.records.map((r:any)=>r.launch.txHash));
  const shared=events.filter((e:any)=>e.deployer===target.creator&&history.has(e.txHash)).length;
  return {commonEventFields:fields,observedBitqueryCreatorEvents:events.length,
    binratVerifiedCaseRecords:verified.material.records.length,
    exactTxOverlaps:shared,
    binratCoverage:verified.material.coverage.history,
    winner:'UNDETERMINED',
    limitation:'Bitquery realtime records and BINRAT partial historical Case have different coverage. Facts matched are not equivalent evidence-depth or LLM-quality measurements.'};
}
export async function compareRecent({
  token,request=globalThis.fetch,now=Date.now(),origin=HOST
}:{token:string,request?:typeof fetch,now?:number,origin?:string}){
  if(origin!==HOST&&origin!=='https://binrat.test')fail('ORIGIN_NOT_ALLOWLISTED');
  if(typeof token!=='string'||token.length<12||token.length>2048||/[\r\n]/.test(token))fail('INVALID_BITQUERY_TOKEN');
  const receipts:{provider:string,kind:string,httpStatus:number,bytes:number,sha256:string,durationMs:number}[]=[];
  const counts={binrat:0,bitquery:0};
  const fetchOne=async(provider:'binrat'|'bitquery',kind:string,url:string,query?:string)=>{
    if(counts[provider]>=MAX_CALLS[provider])fail('REQUEST_BUDGET_EXHAUSTED');
    if(provider==='binrat'&&(!url.startsWith(origin+'/api/')||query!==undefined))fail('URL_SCOPE_INVALID');
    if(provider==='bitquery'&&(url!==BITQUERY||!query))fail('URL_SCOPE_INVALID');
    counts[provider]++;
    const begun=Date.now();
    const opts:RequestInit={method:provider==='binrat'?'GET':'POST',redirect:'error',
      signal:AbortSignal.timeout(FETCH_TIMEOUT_MS)};
    if(provider==='bitquery'){
      opts.headers={'Content-Type':'application/json',Authorization:'Bearer '+token};
      opts.body=JSON.stringify({query});
    }
    const res=await request(url,opts);
    if(!res.ok)fail(provider.toUpperCase()+'_HTTP_'+res.status);
    if(Number(res.headers.get('content-length')||0)>MAX_BYTES)fail('RESPONSE_TOO_LARGE');
    const reader=res.body?.getReader();if(!reader)fail('NO_RESPONSE_STREAM');
    let total=0;const chunks:Uint8Array[]=[];
    try{
      while(true){
        const next=await reader.read();
        if(next.done)break;
        total+=next.value.byteLength;
        if(total>MAX_BYTES){await reader.cancel().catch(()=>{});fail('RESPONSE_TOO_LARGE');}
        chunks.push(next.value);
      }
    }finally{reader.releaseLock();}
    const bytes=Buffer.concat(chunks.map(c=>Buffer.from(c)));
    receipts.push({provider,kind,httpStatus:res.status,bytes:total,sha256:hash(bytes),durationMs:Date.now()-begun});
    try{return JSON.parse(bytes.toString('utf8'));}
    catch{fail('RESPONSE_JSON_INVALID');}
  };
  let selected:any=null;
  try{
    const s=validateStatus(await fetchOne('binrat','before_status',origin+'/api/status'),now);
    const feed=validateFeed(await fetchOne('binrat','published_latest',origin+'/api/launches/latest'),s);
    // Do not spend a Bitquery query when BINRAT cannot provide fresh, bound data.
    const latest=normalizeBitquery(await fetchOne('bitquery','latest_pons_events',BITQUERY,RECENT_QUERY),10);
    selected=selectOverlap(feed,latest);
    if(!selected)return {status:'NOT_COMPARABLE',reason:'NO_IDENTICAL_RECENT_PONS_EVENT',
      counts,receipts,bitqueryEventsReturned:latest.length,winner:'UNDETERMINED'};
    const raw=await fetchOne('binrat','same_case',origin+'/api/bag/'+selected.launchId+'/evidence');
    assertPublishedCase(raw,selected,feed,s);
    const verified=await verifyCaseEnvelope(raw,selected.launchId,raw.material.publication);
    const later=validateStatus(await fetchOne('binrat','after_status',origin+'/api/status'),now);
    if(later.publicationVersion!==s.publicationVersion||later.feedDigest!==s.feedDigest||
       later.checkpointBlock!==s.checkpointBlock)fail('SOURCE_MOVED_DURING_COMPARISON');
    const history=normalizeBitquery(await fetchOne('bitquery','same_deployer_realtime',BITQUERY,HISTORY_QUERY(selected.deployer)),20);
    const analysis=compareEvidence(verified,selected,history);
    return {status:'COMPARABLE_OBSERVATIONS',reason:'NO_VERIFIED_PRODUCT_WINNER',
      chainId:4663,caseId:selected.launchId,recordedCheckpoint:s.checkpointBlock,
      caseDigest:verified.digest,selectedTxHash:selected.txHash,counts,receipts,
      ...analysis};
  }catch(err:any){
    const raw=String(err?.message||'PROBE_FAILED');
    return {status:'NOT_RUN',reason:raw.replaceAll(token,'[REDACTED]').slice(0,140),
      counts,receipts,winner:'UNDETERMINED'};
  }
}
if(process.argv[1]&&new URL(import.meta.url).pathname.endsWith(process.argv[1])){
  if(process.argv.includes('--dry-run')){
    console.log(JSON.stringify({status:'READY_OFFLINE',maxBinratReads:MAX_CALLS.binrat,maxBitqueryCalls:MAX_CALLS.bitquery,
      queriesSha256:[hash(RECENT_QUERY),hash(HISTORY_QUERY('0x'+'0'.repeat(40)))],noLiveRequests:true}));
  }else if(process.argv.includes('--live-readonly')&&process.env.BINRAT_RECENT_AB_GRANT==='ONE_SHOT_20261017'){
    const result=await compareRecent({token:process.env.BITQUERY_ACCESS_TOKEN||''});
    console.log(JSON.stringify(result));
    if(result.status==='NOT_RUN')process.exitCode=2;
  }else{
    console.error('STOP: one-time owner grant or --dry-run required');
    process.exitCode=1;
  }
}
