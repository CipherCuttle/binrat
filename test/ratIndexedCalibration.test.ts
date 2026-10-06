import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {INDEXED_CALIBRATION_V1 as policy,auditIndexedCalibration,type CalibrationCall} from '../src/workforce/indexedCalibration.js';

const recorded=JSON.parse(readFileSync('test/fixtures/workforce/recorded/pons-funding-a-rpc-v1.json','utf8'));
const result=(label:string)=>structuredClone(recorded.responses.find((r:any)=>r.label===label).response.result);
const h=(n:number)=>'0x'+n.toString(16).padStart(64,'0'),q=(n:number)=>'0x'+n.toString(16),origin=1800000000000;
const transfer=(hash:string=policy.controlHash,block:number=policy.controlBlock)=>({blockNum:q(block),hash,from:policy.funder,to:policy.controlRecipient,
  category:'external',rawContract:{address:null,value:policy.controlValue}});
// Composed offline control: real recorded tx/header/receipt, synthetic archive result and surrounding tx objects.
const controlBlock=()=>{const b=result('transferBlock');b.transactions=b.transactions.map((hash:string,i:number)=>i===3?result('transfer'):{hash});return b;};
const header=(number:number,timestamp:number)=>({number:q(number),timestamp:q(timestamp),hash:h(number),parentHash:h(number-1),transactions:[]});
function fixture(recent=true,pageKey?:string){
  const head=header(90000000,origin/1000),start=header(89800001,origin/1000-20000);
  const rb=header(89999990,origin/1000-1),txHash=h(999);
  rb.transactions=[{hash:txHash,blockHash:rb.hash,blockNumber:rb.number,transactionIndex:'0x0',chainId:'0x1237',from:policy.funder,to:policy.controlRecipient,value:policy.controlValue}] as any;
  const responses:any[]=['0x1237',{transfers:[transfer()]},controlBlock(),result('transferReceipt'),result('transferBlock'),head,start,head,
    {transfers:recent?[transfer(txHash,89999990)]:[],...(pageKey?{pageKey}:{})},head,rb,
    {transactionHash:txHash,blockHash:rb.hash,blockNumber:rb.number,status:'0x1',logs:[]}];
  const calls:CalibrationCall[]=[];
  while(true){const a=auditIndexedCalibration(calls);if(!a.nextRequest)break;const i=calls.length;
    calls.push({request:a.nextRequest,status:'COMPLETE',reservedAtMs:origin+i*2,completedAtMs:origin+i*2+1,
      rawResponse:JSON.stringify({jsonrpc:'2.0',id:i+1,result:responses[i]}),error:null});}
  return calls;
}
const alter=(calls:CalibrationCall[],index:number,change:(r:any)=>void)=>{
  const c=structuredClone(calls.slice(0,index+1)),body=JSON.parse(c[index]!.rawResponse!);change(body);c[index]!.rawResponse=JSON.stringify(body);return c;
};
test('historical composed retrieval control and recent positive verify exactly twelve original reads',()=>{
  const calls=fixture(),a=auditIndexedCalibration(calls);
  assert.equal(calls.length,12);assert.equal(a.outcome,'RECENT_ACTIVITY_VERIFIED');assert.equal(a.controlVerified,true);
  assert.equal(a.recentVerified,true);assert.equal(a.verifiedRecent!.txHash,h(999));assert.equal(a.nextRequest,null);
  assert.deepEqual(a.recentWindow,{fromBlock:'89800001',toBlock:'90000000',startTimestamp:'1799980000',endTimestamp:'1800000000'});
  assert.equal(a.modelCalls,0);assert.equal(a.providerReportedCost,null);
  assert.equal(calls[1]!.request.method,'alchemy_getAssetTransfers');assert.equal((calls[8]!.request.params[0] as any).maxCount,'0x5');
  assert.equal((calls[8]!.request.params[0] as any).order,'asc');
});
test('empty recent query ends after ten calls with provider-limited absence only',()=>{
  const calls=fixture(false),a=auditIndexedCalibration(calls);
  assert.equal(calls.length,10);assert.equal(a.outcome,'NO_RECENT_NON_SELF_RETURNED');assert.equal(a.controlVerified,true);
  assert.equal(a.pageEnded,true);assert.equal(a.recentVerified,false);assert.equal(a.coverage,'PROVIDER_INDEXED_EXTERNAL_NATIVE_CANDIDATES_ONLY');
});
test('missing historical positive ends at call two, without inspecting recent activity',()=>{
  const c=alter(fixture(),1,r=>r.result={transfers:[],pageKey:'opaque_more'}),a=auditIndexedCalibration(c);
  assert.equal(a.outcome,'CONTROL_NOT_RETURNED');assert.equal(a.controlVerified,false);assert.equal(a.nextRequest,null);assert.equal(a.recentWindow,null);
});
test('pagination never creates another attempt and self-only returned transfers cannot establish funding activity',()=>{
  const c=alter(fixture(),8,r=>{r.result.transfers[0].to=policy.funder;r.result.pageKey='more';});
  c.push(fixture()[9]!);const a=auditIndexedCalibration(c);
  assert.equal(a.outcome,'NO_RECENT_NON_SELF_RETURNED');assert.equal(a.selfReturned,1);assert.equal(a.pageEnded,false);assert.equal(a.nextRequest,null);
  const positive=auditIndexedCalibration(fixture(true,'more'));assert.equal(positive.recentVerified,true);assert.equal(positive.pageEnded,false);
});
test('canonical, receipt, index, head and reorg failures halt at the bad original response',()=>{
  const base=fixture();
  for(const [index,change] of [
    [0,(r:any)=>r.result='0x1'],[1,(r:any)=>r.result.transfers[0].rawContract.value='0x1'],
    [2,(r:any)=>r.result.transactions[3].from=policy.controlRecipient],
    [3,(r:any)=>r.result.status='0x0'],[4,(r:any)=>r.result.hash=h(333)],
    [5,(r:any)=>r.result.timestamp='0x1'],[6,(r:any)=>r.result.number='0x1'],
    [7,(r:any)=>r.result.hash=h(444)],[8,(r:any)=>r.result.transfers.push(r.result.transfers[0])],
    [8,(r:any)=>r.result.transfers[0].blockNum='0x1'],[8,(r:any)=>r.result.pageKey=null],
    [9,(r:any)=>r.result.hash=h(555)],[10,(r:any)=>r.result.transactions[0].transactionIndex='0x1'],
    [11,(r:any)=>r.result.blockHash=h(666)],[11,(r:any)=>r.id=99],
  ] as [number,(r:any)=>void][]){const a=auditIndexedCalibration(alter(base,index,change));assert.equal(a.outcome,'HALTED',String(index));assert.equal(a.nextRequest,null);}
});
test('failed, uncertain, reordered and post-terminal receipts do not provide continuation authority',()=>{
  const base=fixture();
  for(const status of ['FAILED','PENDING'] as const){const c=base.slice(0,2);c[1]={request:c[1]!.request,status,reservedAtMs:origin+2,error:'synthetic'};
    assert.equal(auditIndexedCalibration(c).outcome,'HALTED');assert.equal(auditIndexedCalibration([...c,base[2]!]).outcome,'HALTED');}
  const bad=structuredClone(base);bad[1]!.request.params=[];assert.equal(auditIndexedCalibration(bad).outcome,'HALTED');
  const duplicate=structuredClone(base.slice(0,1));duplicate[0]!.rawResponse='{"jsonrpc":"2.0","id":1,"result":"0x1","r\\u0065sult":"0x1237"}';
  assert.equal(auditIndexedCalibration(duplicate).error,'DUPLICATE_JSON_KEY');
  const nested=structuredClone(base.slice(0,2));nested[1]!.rawResponse=nested[1]!.rawResponse!.replace('"category":"external"','"category":"internal","category":"external"');
  assert.equal(auditIndexedCalibration(nested).error,'DUPLICATE_JSON_KEY');
  assert.equal(auditIndexedCalibration([...base,base[11]!]).error,'CALIBRATION_CALL_LIMIT');
  assert.equal(auditIndexedCalibration([...fixture(false),base[10]!]).error,'CALIBRATION_AFTER_TERMINAL');
});
test('CLI with no named secret retains a zero-attempt audit and rejects the existing output directory',t=>{
  const dir=mkdtempSync(join(tmpdir(),'binrat-calibration-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const out=join(dir,'capture'),env={...process.env};delete env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL;
  const args=['scripts/calibrate-indexed-funder.mjs','--out',out,'--capture-id','synthetic-calibration','--source-sha','a'.repeat(40)];
  assert.equal(spawnSync(process.execPath,args,{env,encoding:'utf8'}).status,1);
  const bytes=readFileSync(join(out,'raw-receipts.json'),'utf8'),audit=JSON.parse(readFileSync(join(out,'audit.json'),'utf8'));
  assert.equal(audit.attempts,0);assert.equal(audit.outcome,'NOT_STARTED');assert.equal(JSON.parse(bytes).registration.protocol.maxRpcCalls,12);
  assert.equal(spawnSync(process.execPath,args,{env,encoding:'utf8'}).status,1);assert.equal(readFileSync(join(out,'raw-receipts.json'),'utf8'),bytes);
});
