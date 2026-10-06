import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {encodeAbiParameters,toEventSelector} from 'viem';
import {FUNDER_COHORT_V1 as policy,auditFunderCohort} from '../src/workforce/funderCohort.js';
import type {CalibrationCall} from '../src/workforce/indexedCalibration.js';
import {PONS_V2_FACTORY} from '../src/pons/chain.js';
import {ponsTokenLaunchedEvent} from '../src/pons/ponsAbi.js';

const code=JSON.parse(readFileSync('test/fixtures/workforce/recorded/pons-funding-a-rpc-v1.json','utf8')).responses[1].response.result;
const h=(n:number)=>'0x'+n.toString(16).padStart(64,'0'),address=(n:number)=>'0x'+n.toString(16).padStart(40,'0'),q=(n:number)=>'0x'+n.toString(16);
const origin=1800000000000,timestamp=(n:number)=>Math.floor(origin/1000-30000+(n-policy.fromBlock)/10);
const rows=(n=20)=>Array.from({length:n},(_,i)=>({blockNum:q(policy.fromBlock+1000+i*10),hash:h(9000+i),from:policy.funder,to:address(i+10),
  category:'external',rawContract:{address:null,value:'0x1'}}));
function log(recipient:string,n:number,id:number){
  return {address:PONS_V2_FACTORY,blockNumber:q(n),blockHash:h(n),transactionHash:h(id),logIndex:'0x0',removed:false,
    topics:[toEventSelector(ponsTokenLaunchedEvent),'0x'+address(id).slice(2).padStart(64,'0'),'0x'+address(id+1).slice(2).padStart(64,'0'),'0x'+recipient.slice(2).padStart(64,'0')],
    data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[address(0) as `0x${string}`,0n,1n])};
}
function fixture(indexRows=rows(),events:any[]=[],change?:(request:any,result:any,sequence:number)=>any){
  const calls:CalibrationCall[]=[];
  for(let count=0;count<400;count++){
    const a=auditFunderCohort(calls),r=a.nextRequest;if(!r)return calls;let result:any;
    if(r.method==='eth_chainId')result='0x1237';
    else if(r.method==='eth_getCode')result=code;
    else if(r.method==='alchemy_getAssetTransfers'){
      const page=(r.params[0] as any).pageKey?Number((r.params[0] as any).pageKey.slice(5)):0;
      result={transfers:indexRows.slice(page*5,page*5+5),...(indexRows.length>(page+1)*5?{pageKey:'page_'+(page+1)}:{})};
    }else if(r.method==='eth_getBlockByNumber'){
      const n=Number(BigInt(r.params[0] as string)),funds=indexRows.filter(t=>Number(BigInt(t.blockNum))===n);
      const txs=funds.map((t,i)=>({hash:t.hash,from:t.from,to:t.to,value:'0x1',blockHash:h(n),blockNumber:q(n),transactionIndex:q(i),chainId:'0x1237'}));
      const hashes=[...txs.map(t=>t.hash),...events.filter(e=>Number(BigInt(e.blockNumber))===n).map(e=>e.transactionHash)];
      result={number:q(n),hash:h(n),parentHash:h(n-1),timestamp:q(timestamp(n)),transactions:r.params[1]?txs:hashes};
    }else if(r.method==='eth_getTransactionReceipt'){
      const e=events.find(e=>e.transactionHash===r.params[0]),t=indexRows.find(t=>t.hash===r.params[0]);
      result={transactionHash:r.params[0],blockHash:e?.blockHash??h(Number(BigInt(t!.blockNum))),blockNumber:e?.blockNumber??t!.blockNum,status:'0x1',logs:e?[e]:[]};
    }else if(r.method==='eth_getLogs'){
      const p=r.params[0] as any;
      result=events.filter(e=>BigInt(e.blockNumber)>=BigInt(p.fromBlock)&&BigInt(e.blockNumber)<=BigInt(p.toBlock)&&p.topics[3].includes(e.topics[3]));
    }else throw new Error('unknown request');
    result=change?change(r,structuredClone(result),calls.length+1):result;
    calls.push({request:r,status:'COMPLETE',reservedAtMs:origin+calls.length*2,completedAtMs:origin+calls.length*2+1,
      rawResponse:JSON.stringify({jsonrpc:'2.0',id:r.id,result}),error:null});
  }throw new Error('fixture did not terminate');
}
const mixedEvents=()=>rows().slice(0,15).map((r,i)=>log(r.to,Number(BigInt(r.blockNum))+(i<10?1200:12000),20000+i));
const base=()=>fixture(rows(),mixedEvents());
const alter=(calls:CalibrationCall[],i:number,f:(r:any)=>void)=>{
  const copy=structuredClone(calls.slice(0,i+1)),body=JSON.parse(copy[i]!.rawResponse!);f(body);copy[i]!.rawResponse=JSON.stringify(body);return copy;
};

test('fixed ascending selection precedes logs; twenty mixed outcomes are independently canonically scored',()=>{
  const calls=base(),a=auditFunderCohort(calls);
  assert.equal(a.outcome,'COMPLETE');assert.equal(a.score.recipients,20);assert.equal(a.score.launchesWithin10Minutes,10);assert.equal(a.score.launchesWithin60Minutes,15);
  assert.equal(a.score.verdict,'SMALL_EXPERIMENT_10_MINUTE_RULE');assert.ok(calls.length<=384);
  const firstLog=calls.findIndex(c=>c.request.method==='eth_getLogs');assert.ok(a.selection.sealedAtSequence!<firstLog);
  const prefix=auditFunderCohort(calls.slice(0,a.selection.sealedAtSequence!));assert.equal(prefix.selection.digest,a.selection.digest);assert.equal(prefix.results.length,0);
  assert.equal(prefix.score.recipients,null);assert.equal(a.confirmedLaunchRanges.length,62);
  assert.equal(a.confirmedLaunchRanges[0]!.fromBlock,String(policy.fromBlock));assert.equal(a.confirmedLaunchRanges.at(-1)!.toBlock,String(policy.outcomeThroughBlock));
  for(let i=1;i<a.confirmedLaunchRanges.length;i++)assert.equal(BigInt(a.confirmedLaunchRanges[i]!.fromBlock),BigInt(a.confirmedLaunchRanges[i-1]!.toBlock)+1n);
  assert.equal(a.nextRequest,null);assert.equal(a.modelCalls,0);assert.equal(a.providerReportedCost,null);
});
test('empty mature logs provide a provider-limited negative after full coverage; prior/same-block logs do not count as later',()=>{
  const r=rows(),events=[log(r[0]!.to,Number(BigInt(r[0]!.blockNum))-1,30000),log(r[1]!.to,Number(BigInt(r[1]!.blockNum)),30001)];
  const a=auditFunderCohort(fixture(r,events));assert.equal(a.score.recipients,20);assert.equal(a.score.launchesWithin60Minutes,0);
  assert.equal(a.score.verdict,'DEFER_FUNDER_PRELAUNCH_STRATEGY');assert.equal(a.results[0]!.unverifiedPriorOrSameBlockLogs,1);
  assert.equal(a.results[1]!.within10Minutes,false);assert.ok(a.coverage.includes('PROVIDER_RETURNED'));
});
test('ten-minute and sixty-minute horizons have inclusive boundaries and do not score beyond sixty',()=>{
  const r=rows(5),delays=[600,601,3600,3601,7200];
  const a=auditFunderCohort(fixture(r,r.map((t,i)=>log(t.to,Number(BigInt(t.blockNum))+delays[i]!*10,40000+i))));
  assert.deepEqual(a.results.map(t=>t.within10Minutes),[true,false,false,false,false]);assert.deepEqual(a.results.map(t=>t.within60Minutes),[true,true,true,false,false]);
  assert.equal(a.score.verdict,'INCONCLUSIVE_SMALL_COHORT');
  const longer=auditFunderCohort(fixture(rows(),rows().map((t,i)=>log(t.to,Number(BigInt(t.blockNum))+12000,41000+i))));
  assert.equal(longer.score.verdict,'DEFER_10_MINUTE_CONSIDER_LONGER_WINDOW');
});
test('self/repeat recipients are retained diagnostically but excluded from denominator; capped pages stay explicit',()=>{
  const r=rows(40);r.forEach((t,i)=>t.to=i%2?policy.funder:address(10));
  const a=auditFunderCohort(fixture(r));assert.equal(a.selection.pages,8);assert.equal(a.selection.selfTransfers,20);
  assert.equal(a.selection.repeatedRecipients,19);assert.equal(a.score.recipients,1);assert.equal(a.score.verdict,'INCONCLUSIVE_SMALL_COHORT');
  const capped=rows(45);capped.forEach(t=>t.to=policy.funder);
  const c=auditFunderCohort(fixture(capped));assert.equal(c.selection.pageEnded,false);assert.equal(c.selection.limitation,'CAPPED_ASCENDING_PREFIX');assert.equal(c.score.recipients,0);
});
test('request, head maturity, index duplicate/order, funding/receipt and scan reorg failures never yield a score',()=>{
  const full=base();const indices=(method:string)=>full.map((c,i)=>c.request.method===method?i:-1).filter(i=>i>=0);
  const fi=full.findIndex(c=>c.request.method==='eth_getBlockByNumber'&&c.request.params[1]===true),fr=indices('eth_getTransactionReceipt')[0]!;
  const scan=indices('eth_getLogs')[0]!;
  for(const [i,f] of [[0,(r:any)=>r.result='0x1'],[1,(r:any)=>r.result='0x'],[4,(r:any)=>r.result.timestamp=q(timestamp(policy.toBlock)+3599)],
    [5,(r:any)=>r.result.transfers.push(r.result.transfers[0])],[fi,(r:any)=>r.result.transactions[0].from=address(90)],
    [fr,(r:any)=>r.result.status='0x0'],[fi+2,(r:any)=>r.result.hash=h(999)],
    [scan+1,(r:any)=>r.result.hash=h(999)]] as [number,(r:any)=>void][]){
    const a=auditFunderCohort(alter(full,i,f));assert.equal(a.outcome,'HALTED',String(i));assert.equal(a.score.recipients,null);assert.equal(a.nextRequest,null);
  }
  const bad=structuredClone(full.slice(0,1));bad[0]!.request.method='eth_sendRawTransaction';assert.equal(auditFunderCohort(bad).error,'COHORT_REQUEST_OR_TIME_MISMATCH');
});
test('wrong/duplicate logs, bad launch receipt and non-later timestamp cannot admit a positive',()=>{
  const full=base(),logIndex=full.findIndex(c=>c.request.method==='eth_getLogs'&&JSON.parse(c.rawResponse!).result.length);
  const lb=full.findIndex((c,i)=>i>full.map((c,i)=>c.request.method==='eth_getLogs'?i:-1).filter(i=>i>=0).at(-1)!+1&&c.request.method==='eth_getBlockByNumber');
  for(const [i,f] of [[logIndex,(r:any)=>r.result.push(r.result[0])],[logIndex,(r:any)=>r.result[0].removed=true],
    [logIndex,(r:any)=>r.result[0].topics[3]='0x'+address(999).slice(2).padStart(64,'0')],
    [lb,(r:any)=>r.result.timestamp=q(timestamp(Number(BigInt(rows()[0]!.blockNum))))],
    [lb+1,(r:any)=>r.result.logs=[]],[lb+2,(r:any)=>r.result.hash=h(123)]] as [number,(r:any)=>void][]){
    const a=auditFunderCohort(alter(full,i,f));assert.equal(a.outcome,'HALTED',String(i));assert.equal(a.score.launchesWithin10Minutes,null);
  }
});
test('partial, failed, pending, duplicate JSON and terminal append cannot turn missing evidence into a negative',()=>{
  const full=base();assert.equal(auditFunderCohort(full.slice(0,-1)).score.recipients,null);
  for(const status of ['FAILED','PENDING'] as const){const c=structuredClone(full.slice(0,2));c[1]!.status=status;
    assert.equal(auditFunderCohort(c).outcome,'HALTED');assert.equal(auditFunderCohort([...c,full[2]!]).error,'COHORT_AFTER_HALT');}
  const dup=structuredClone(full.slice(0,1));dup[0]!.rawResponse='{"jsonrpc":"2.0","id":1,"result":"0x1","r\\u0065sult":"0x1237"}';
  assert.equal(auditFunderCohort(dup).error,'DUPLICATE_JSON_KEY');assert.equal(auditFunderCohort([...full,full[0]!]).error,'COHORT_AFTER_TERMINAL');
  assert.equal(auditFunderCohort(Array.from({length:385},()=>full[0]!)).error,'COHORT_CALL_LIMIT');
});
test('CLI missing secret preserves a zero-attempt audit and refuses existing output bytes',t=>{
  const dir=mkdtempSync(join(tmpdir(),'binrat-cohort-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const out=join(dir,'capture'),env={...process.env};delete env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL;
  const args=['scripts/capture-funder-cohort.mjs','--out',out,'--capture-id','synthetic-cohort','--source-sha','a'.repeat(40)];
  assert.equal(spawnSync(process.execPath,args,{env,encoding:'utf8'}).status,1);
  const bytes=readFileSync(join(out,'raw-receipts.json'),'utf8');assert.equal(JSON.parse(readFileSync(join(out,'audit.json'),'utf8')).attempts,0);
  assert.equal(JSON.parse(bytes).registration.protocol.maxRpcCalls,384);
  assert.equal(spawnSync(process.execPath,args,{env,encoding:'utf8'}).status,1);assert.equal(readFileSync(join(out,'raw-receipts.json'),'utf8'),bytes);
});
test('targeted rereview: registered deadline and same-hash header field contradictions fail closed',()=>{
  const full=base(),late=structuredClone(full.slice(0,1));late[0]!.completedAtMs=origin+policy.maxRunMs;
  assert.equal(auditFunderCohort(late,origin).error,'COHORT_RESPONSE_AFTER_DEADLINE');
  assert.equal(auditFunderCohort(full,origin-policy.maxRunMs).score.recipients,null);
  const future=alter(full,4,r=>r.result.timestamp=q(origin/1000+1));assert.equal(auditFunderCohort(future).error,'COHORT_FUTURE_CEILING');
  const firstFunding=full.findIndex(c=>c.request.method==='eth_getBlockByNumber'&&c.request.params[1]===true);
  const firstScan=full.findIndex(c=>c.request.method==='eth_getLogs');
  for(const i of [firstFunding-1,firstFunding+2,firstScan+1,full.length-1]){
    const c=alter(full,i,r=>r.result.timestamp=q(Number(BigInt(r.result.timestamp))+1));
    const a=auditFunderCohort(c);assert.equal(a.outcome,'HALTED',String(i));assert.equal(a.score.recipients,null);
  }
  assert.equal(auditFunderCohort(full,origin).outcome,'COMPLETE');
});
