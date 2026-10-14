import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SPEC,oneShot,verifyBlockAndReceipt,cli} from '../scripts/verify-selected-funding-block.mjs';

const q=n=>'0x'+n.toString(16), h=n=>'0x'+n.toString(16).padStart(64,'0');
const goodBlock=()=>({number:SPEC.block,hash:SPEC.blockHash,parentHash:h(999),timestamp:'0x68a08d00',transactions:[
  {hash:h(99),from:SPEC.from,to:SPEC.to,value:'0x1',blockNumber:SPEC.block,blockHash:SPEC.blockHash,chainId:SPEC.chainId,transactionIndex:'0x0'},
  {hash:SPEC.txHash,from:SPEC.from,to:SPEC.to,value:SPEC.value,blockNumber:SPEC.block,
   blockHash:SPEC.blockHash,chainId:SPEC.chainId,transactionIndex:'0x1'}]});
const goodReceipt=()=>({transactionHash:SPEC.txHash,blockNumber:SPEC.block,blockHash:SPEC.blockHash,
  transactionIndex:'0x1',status:'0x1',logs:[]});
function mocked(block=goodBlock(),receipt=goodReceipt()){
  const calls=[];const fn=async(url,init)=>{
    const req=JSON.parse(init.body);calls.push({url,req,init});
    return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,result:req.id===1?block:receipt}));
  };return {fn,calls};
}
const bad=(modifier)=>{
  const b=goodBlock(),r=goodReceipt();modifier(b,r);
  assert.throws(()=>verifyBlockAndReceipt(b,r));
};

test('exact two public reads prove the frozen transaction membership and successful receipt',async()=>{
  const {fn,calls}=mocked();const r=await oneShot(fn);
  assert.equal(r.verdict,'FUNDING_VERIFIED');assert.equal(r.calls,2);
  assert.equal(r.evidence.transactionIndex,1);
  assert.deepEqual(calls.map(c=>[c.req.method,c.req.params]),[
    ['eth_getBlockByNumber',[SPEC.block,true]],['eth_getTransactionReceipt',[SPEC.txHash]]]);
  assert.ok(calls.every(c=>c.url===SPEC.rpc&&c.init.redirect==='error'));
  assert.equal(r.launchQueried,false);
});
test('wrong chain ID, transfer sender, recipient or amount never verifies',()=>{
  for(const fn of [(b)=>b.transactions[1].chainId='0x1',(b)=>b.transactions[1].from='0x'+'a'.repeat(40),
    (b)=>b.transactions[1].to='0x'+'b'.repeat(40),(b)=>b.transactions[1].value='0x2'])bad(fn);
});
test('bad transaction block hash, block number or transaction index fails',()=>{
  for(const fn of [(b)=>b.transactions[1].blockHash=h(8),(b)=>b.transactions[1].blockNumber=q(BigInt(SPEC.block)+1n),
    (b)=>b.transactions[1].transactionIndex='0x0'])bad(fn);
});
test('receipt must be successful, matching same block/hash/index/tx',()=>{
  for(const fn of [(b,r)=>r.status='0x0',(b,r)=>r.blockHash=h(8),(b,r)=>r.transactionIndex='0x0',
    (b,r)=>r.transactionHash=h(8),(b,r)=>r.blockNumber=q(BigInt(SPEC.block)+1n)])bad(fn);
});
test('missing, duplicate or incorrectly ordered block transactions fail closed',()=>{
  bad((b)=>b.transactions.splice(1,1));
  bad((b)=>b.transactions.push({...b.transactions[1]}));
  bad((b)=>b.transactions.reverse());
});
test('receipt logs must bind to successful transaction and canonical block',()=>{
  bad((b,r)=>r.logs=[{removed:true,blockHash:SPEC.blockHash,blockNumber:SPEC.block,transactionHash:SPEC.txHash}]);
  bad((b,r)=>r.logs=[{removed:false,blockHash:h(8),blockNumber:SPEC.block,transactionHash:SPEC.txHash}]);
});
test('not the frozen historical block or hash fails',()=>{
  bad((b)=>b.number='0x1');bad((b)=>b.hash=h(8));
});
test('malformed provider output, RPC error or contradictory IDs are never admitted',async()=>{
  for(const response of ['{"jsonrpc":"2.0","id":2,"result":{}}',
    '{"jsonrpc":"2.0","id":1,"error":{"code":-32000}}',
    '{"jsonrpc":"2.0","id":1,"result":{},"result":{}}',
    '{"jsonrpc":"2.0","id":1,"result":']){
    let n=0;const r=await oneShot(async()=>{n++;return new Response(response)});
    assert.equal(r.verdict,'BLOCKED_EVIDENCE');assert.equal(n,1);assert.equal(r.calls,1);
  }
});
test('full-block >1MB cannot be substituted or partially admitted',async()=>{
  let calls=0;const r=await oneShot(async()=>{calls++;return new Response('x'.repeat(1_000_001))});
  assert.equal(r.verdict,'BLOCKED_EVIDENCE');assert.equal(calls,1);assert.equal(r.calls,1);
});
test('HTTP provider failure makes one attempt, no fallback or retry',async()=>{
  let calls=0;const r=await oneShot(async()=>{calls++;return new Response('bad',{status:403})});
  assert.equal(r.verdict,'BLOCKED_EVIDENCE');assert.equal(r.reason,'RPC_HTTP_REJECTED');
  assert.equal(calls,1);
});
test('second request error terminates after exactly two calls',async()=>{
  let calls=0;const r=await oneShot(async()=>{calls++;return calls===1?new Response(JSON.stringify({jsonrpc:'2.0',id:1,result:goodBlock()})):new Response('bad',{status:403})});
  assert.equal(r.verdict,'BLOCKED_EVIDENCE');assert.equal(r.calls,2);assert.equal(calls,2);
});
test('no CLI args makes zero calls; existing receipt directory fails closed',async t=>{
  const root=mkdtempSync(join(tmpdir(),'binrat-selected-block-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  await assert.rejects(cli([]),/CLI_USAGE_INVALID/);
  const prior=join(root,'already');const fs=await import('node:fs');fs.mkdirSync(prior);
  await assert.rejects(cli(['--out',prior]),/EEXIST/);
});
