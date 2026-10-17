#!/usr/bin/env node
/** One-shot, bounded, read-only Bitquery comparison. NEVER prints or stores token. */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const FACTORY='0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e';
const TOPIC='8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607';
const API_ENDPOINT='https://streaming.bitquery.io/graphql';
const CASE_ID='742ed5c2d361c11d5a4da715e35e6c189a9b61ae4a433a937a96111360d7ab01';
const BLOB='ac4258f22bb32643b4829a699f7c5bf4720690ba';
const FIELD='docs/receipts/sprint-a1-2-contract/old-case-envelope.json';
const sha=(s)=>createHash('sha256').update(s).digest('hex');
const blob=(s)=>createHash('sha1').update('blob '+s.length+'\0').update(s).digest('hex');
export function frozenCase(root=process.cwd()){
  const b=readFileSync(resolve(root,FIELD));
  if(b.length>65536||blob(b)!==BLOB)throw Error('PINNED_CASE_DRIFT');
  const c=JSON.parse(b.toString('utf8')),m=c.material,l=m?.records?.[0]?.launch;
  if(m.caseId!==CASE_ID||m.chainId!==4663||m.records.length!==20||
     l.launcher!==FACTORY||l.launchId!==CASE_ID)throw Error('CASE_IDENTITY_DRIFT');
  return {caseId:CASE_ID,txHash:l.txHash,blockNumber:l.blockNumber,
    token:l.token,deployer:l.creator,caseDigest:c.digest,sourceSha256:sha(b),
    checkpoint:m.publication.checkpointBlock,coverage:m.coverage};
}
export function query(kind,tx){
  const constraints=[
    'LogHeader: {Address: {is: "'+FACTORY+'"}}',
    'Topics: {includes: [{Hash: {is: "'+TOPIC+'"}}]}'
  ];
  if(kind==='target'){
    if(!/^0x[0-9a-f]{64}$/.test(tx))throw Error('INVALID_TX_HASH');
    constraints.push('Transaction: {Hash: {is: "'+tx+'"}}');
  }
  const order=kind==='recent'?'orderBy: {descending: Block_Time},':'';
  return 'query { EVM(network: robinhood) { Events(limit: {count: '+(kind==='recent'?1:2)+'}, '+order+
    'where: {'+constraints.join(' ')+'}) { Block {Number Time} Transaction {Hash From} '+
    'Log {Index Signature {Name SignatureHash}} '+
    'Arguments {Name Value {... on EVM_ABI_Address_Value_Arg {address}}} } } }';
}
function evidenceRows(data){
  if(data?.errors?.length)return null;
  const xs=data?.data?.EVM?.Events;
  if(!Array.isArray(xs)||xs.length>2)return null;
  return xs.map(e=>{
    const named=Object.fromEntries((e.Arguments||[]).filter(x=>x?.Name&&x?.Value?.address)
      .map(x=>[x.Name,x.Value.address.toLowerCase()]));
    return {block:String(e?.Block?.Number||''),tx:String(e?.Transaction?.Hash||'').toLowerCase(),
      token:named.token||null,deployer:named.deployer||null,
      topic:String(e?.Log?.Signature?.SignatureHash||'').replace(/^0x/,'').toLowerCase()};
  });
}
export function compare(c,control,target){
  const base={status:'NOT_COMPARABLE',caseId:c.caseId,coverage:'RECORDED_BINRAT_VS_BITQUERY_REALTIME_ONLY',
    archiveQueried:false,checks:0,matched:null};
  const recent=evidenceRows(control);
  if(!recent?.length)return {...base,reason:'BITQUERY_RECENT_SAMPLE_UNAVAILABLE'};
  const rows=evidenceRows(target);
  if(!rows)return {...base,reason:'BITQUERY_TARGET_UNAVAILABLE'};
  if(rows.length===0)return {...base,reason:'HISTORICAL_TARGET_NOT_IN_FREE_REALTIME_WINDOW'};
  if(rows.length!==1)return {...base,reason:'TARGET_NONUNIQUE'};
  const r=rows[0];
  if(!r.token||!r.deployer)return {...base,reason:'DECODED_ARGUMENTS_MISSING'};
  const fields={transaction:r.tx===c.txHash,block:r.block===c.blockNumber,
    token:r.token===c.token,deployer:r.deployer===c.deployer,signature:r.topic===TOPIC};
  return {...base,status:Object.values(fields).every(Boolean)?'FIELDS_MATCH':'FIELDS_CONFLICT',
    reason:'MATCHED_EVENT_FIELDS_ONLY_NOT_PAID_FORENSIC_VALUE',checks:5,matched:fields};
}
export async function probe({token,request=globalThis.fetch,root=process.cwd()}){
  if(typeof token!=='string'||token.length<12||token.length>2048||/[\r\n]/.test(token))
    throw Error('INVALID_ACCESS_TOKEN');
  const c=frozenCase(root),receipts=[];
  let count=0;
  async function call(kind){
    if(count>=2)throw Error('REQUEST_BUDGET_EXHAUSTED');
    count++;
    const payload=JSON.stringify({query:query(kind,c.txHash)});
    const abort=AbortSignal.timeout(12000),t=Date.now();
    const res=await request(API_ENDPOINT,{method:'POST',redirect:'error',signal:abort,
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:payload});
    const ab=await res.arrayBuffer();
    if(ab.byteLength>32768)throw Error('RESPONSE_BUDGET_EXCEEDED');
    const body=Buffer.from(ab).toString('utf8');
    receipts.push({kind,status:res.status,requestSha256:sha(payload),responseSha256:sha(body),
      bytes:ab.byteLength,durationMs:Date.now()-t});
    let result;try{result=JSON.parse(body)}catch{result=null}
    return res.ok?result:null;
  }
  try{
    const recent=await call('recent');
    if(!recent?.data?.EVM?.Events?.length||recent.errors?.length)
      return {status:'NOT_RUN',reason:'BITQUERY_AUTH_SCHEMA_OR_RECENT_DATA_UNAVAILABLE',count,receipts,
        keyPersisted:false};
    const target=await call('target');
    return {version:'BINRAT_BITQUERY_AB_V1',...compare(c,recent,target),count,receipts,
      binratCaptureDigest:c.caseDigest,keyPersisted:false};
  }catch(e){
    return {status:'NOT_RUN',reason:(e?.name==='TimeoutError'?'TIMEOUT':String(e?.message||'QUERY_FAILED').replaceAll(token,'[REDACTED]')),
      count,receipts,keyPersisted:false};
  }
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  if(process.argv.includes('--dry-run')){
    const c=frozenCase();
    console.log(JSON.stringify({status:'OFFLINE_READY',caseId:c.caseId,chainId:4663,
      requestLimit:2,requestShas:[sha(query('recent',c.txHash)),sha(query('target',c.txHash))],
      liveRequests:0}));
  }else if(process.argv.includes('--live-readonly')&&process.env.BITQUERY_AB_GRANT==='BINRAT_AB_ONE_SHOT'){
    const r=await probe({token:process.env.BITQUERY_ACCESS_TOKEN});
    console.log(JSON.stringify(r));
    if(r.status==='NOT_RUN')process.exitCode=2;
  }else{
    console.error('STOP: exact opt-in grant missing; use --dry-run');
    process.exitCode=1;
  }
}
