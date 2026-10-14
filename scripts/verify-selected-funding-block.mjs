/** One-shot public-RPC proof for the PRESELECTED historical funding transaction.
 * No new wallet selection, launch scan, retry, signing or production writes.
 */
import {mkdirSync,writeFileSync,renameSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

export const SPEC=Object.freeze({
  schemaVersion:'binrat.selected-funding-full-block/1',
  rpc:'https://rpc.mainnet.chain.robinhood.com',
  chainId:'0x1237',block:'0x4dbab5a',
  blockHash:'0x06e4b5633c8eade32195ffc657db00312f6ad3088474a26731ac35ecc2ec068a',
  txHash:'0x952a185b94feec5649e5e9064186cf7aa763cc5b864db9c28b53879762189488',
  from:'0x9bc462bce2acd6fbe2ef5470d55b439453451083',
  to:'0xef8cbc4444d505b32198061884cf902e9307fd59',
  value:'0x874aa453554d8',
  maxCalls:2,maxResponseBytes:1_000_000,timeoutMs:15_000
});
const fail=(code)=>{throw new Error(code);};
const quantity=value=>typeof value==='string'&&/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(value)?BigInt(value):fail('MALFORMED_QUANTITY');
const addr=value=>typeof value==='string'&&/^0x[0-9a-f]{40}$/i.test(value)?value.toLowerCase():fail('MALFORMED_ADDRESS');
const hash=value=>typeof value==='string'&&/^0x[0-9a-f]{64}$/i.test(value)?value.toLowerCase():fail('MALFORMED_HASH');
function obj(v){if(!v||typeof v!=='object'||Array.isArray(v))fail('MALFORMED_OBJECT');return v;}
function strictJson(raw){
  const parsed=JSON.parse(raw);
  const tokens=raw.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]/g)??[],stack=[];
  for(let i=0;i<tokens.length;i++){
    const token=tokens[i];if(token==='{')stack.push(new Set());else if(token==='[')stack.push(null);
    else if(token==='}'||token===']')stack.pop();
    else if(token.startsWith('"')&&tokens[i+1]===':'){
      const keys=stack.at(-1),k=JSON.parse(token);if(keys?.has(k))fail('DUPLICATE_JSON_KEY');keys?.add(k);
    }
  }
  return parsed;
}
function binding(raw,id){
  let d;try{d=obj(strictJson(raw));}catch{fail('RPC_RESPONSE_INVALID');}
  if(d.jsonrpc!=='2.0'||d.id!==id||Object.hasOwn(d,'error')||!Object.hasOwn(d,'result'))fail('RPC_RESPONSE_BINDING');
  return obj(d.result);
}
export function verifyBlockAndReceipt(block,receipt){
  const b=obj(block),r=obj(receipt),expectedNumber=quantity(SPEC.block);
  if(quantity(b.number)!==expectedNumber||hash(b.hash)!==SPEC.blockHash||
    hash(b.parentHash)===SPEC.blockHash||!Number.isSafeInteger(Number(quantity(b.timestamp)))||
    !Array.isArray(b.transactions)||b.transactions.length>5000)fail('BLOCK_AUTHORITY_INVALID');
  const seen=new Set();let match=null,index=-1;
  for(let i=0;i<b.transactions.length;i++){
    const tx=obj(b.transactions[i]),id=hash(tx.hash);
    if(seen.has(id))fail('BLOCK_DUPLICATE_TX');seen.add(id);
    if(id!==SPEC.txHash)continue;
    if(match)fail('BLOCK_DUPLICATE_SELECTED_TX');match=tx;index=i;
  }
  if(!match)fail('SELECTED_TX_NOT_IN_BLOCK');
  if(addr(match.from)!==SPEC.from||addr(match.to)!==SPEC.to||
    quantity(match.value)!==quantity(SPEC.value)||quantity(match.chainId)!==quantity(SPEC.chainId)||
    quantity(match.blockNumber)!==expectedNumber||hash(match.blockHash)!==SPEC.blockHash||
    quantity(match.transactionIndex)!==BigInt(index))fail('SELECTED_TX_CANONICAL_MISMATCH');
  if(hash(r.transactionHash)!==SPEC.txHash||quantity(r.blockNumber)!==expectedNumber||
    hash(r.blockHash)!==SPEC.blockHash||quantity(r.status)!==1n||
    quantity(r.transactionIndex)!==BigInt(index)||!Array.isArray(r.logs)||r.logs.length>128)
    fail('SELECTED_TX_RECEIPT_MISMATCH');
  for(const rawLog of r.logs){const l=obj(rawLog);if(l.removed!==false||hash(l.blockHash)!==SPEC.blockHash||
    quantity(l.blockNumber)!==expectedNumber||hash(l.transactionHash)!==SPEC.txHash)fail('RECEIPT_LOG_MISMATCH');}
  return {blockNumber:Number(expectedNumber),blockHash:SPEC.blockHash,transactionIndex:index,
    timestampSeconds:Number(quantity(b.timestamp)),source:SPEC.from,recipient:SPEC.to,
    transactionHash:SPEC.txHash,valueWei:quantity(SPEC.value).toString(),chainId:4663};
}
function syncFile(out,name,report){
  const tmp=join(out,name+'.tmp'),to=join(out,name);
  writeFileSync(tmp,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  const fd=openSync(tmp,'r');try{fsyncSync(fd);}finally{closeSync(fd);}
  renameSync(tmp,to);
  const dir=openSync(out,'r');try{fsyncSync(dir);}finally{closeSync(dir);}
}
async function readRpc(request,fetchImpl){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),SPEC.timeoutMs);
  let reader;const chunks=[];let size=0;
  try{
    const res=await fetchImpl(SPEC.rpc,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},
      body:JSON.stringify(request),signal:controller.signal});
    if(!res.ok)fail('RPC_HTTP_REJECTED');
    if(!res.body)fail('RPC_BODY_ABSENT');
    reader=res.body.getReader();
    while(true){const part=await reader.read();if(part.done)break;
      size+=part.value.byteLength;if(size>SPEC.maxResponseBytes){controller.abort();fail('RPC_BODY_OVERSIZED');}
      chunks.push(part.value);
    }
    return binding(Buffer.concat(chunks).toString('utf8'),request.id);
  }catch(e){if(e instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(e.message))throw e;fail('RPC_TRANSPORT_FAILED');}
  finally{clearTimeout(timer);try{await reader?.cancel();}catch{}}
}
export async function oneShot(fetchImpl){
  const report={schemaVersion:SPEC.schemaVersion,verdict:'BLOCKED_EVIDENCE',reason:'NO_REQUEST',
    chainId:4663,selectedTx:SPEC.txHash,selectedRecipient:SPEC.to,expectedBlock:SPEC.block,
    expectedBlockHash:SPEC.blockHash,calls:0,limit:SPEC.maxCalls,
    productionChanges:0,restartedCohort:false,launchQueried:false,costUsd:'UNKNOWN',evidence:null};
  try{
    report.calls++;
    const block=await readRpc({jsonrpc:'2.0',id:1,method:'eth_getBlockByNumber',params:[SPEC.block,true]},fetchImpl);
    if(quantity(block.number)!==quantity(SPEC.block)||hash(block.hash)!==SPEC.blockHash||
       !Array.isArray(block.transactions)||!block.transactions.some(tx=>tx?.hash?.toLowerCase()===SPEC.txHash))fail('BLOCK_FIRST_GATE_FAILED');
    report.calls++;
    const receipt=await readRpc({jsonrpc:'2.0',id:2,method:'eth_getTransactionReceipt',params:[SPEC.txHash]},fetchImpl);
    report.evidence=verifyBlockAndReceipt(block,receipt);
    report.reason='SELECTED_FUNDING_CANONICAL_MEMBERSHIP';report.verdict='FUNDING_VERIFIED';
  }catch(err){report.reason=err instanceof Error&&/^[A-Z][A-Z0-9_]{0,80}$/.test(err.message)?err.message:'EVIDENCE_CHECK_FAILED';}
  return report;
}
export async function cli(args=process.argv.slice(2)){
  if(args.length!==2||args[0]!=='--out'||!args[1])fail('CLI_USAGE_INVALID');
  const out=args[1];mkdirSync(out,{recursive:false,mode:0o700});
  syncFile(out,'receipt.json',{schemaVersion:SPEC.schemaVersion,verdict:'PENDING',reason:'RESERVED_BEFORE_NETWORK',callsReserved:SPEC.maxCalls,
    selectedTx:SPEC.txHash,selectedRecipient:SPEC.to});
  const report=await oneShot(fetch);
  syncFile(out,'final.json',report);
  console.log(JSON.stringify(report));if(report.verdict!=='FUNDING_VERIFIED')process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  try{await cli();}catch{console.error('SELECTED_FUNDING_PREFLIGHT_FAILED');process.exitCode=1;}
}
