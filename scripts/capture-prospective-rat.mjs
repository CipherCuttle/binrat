import {spawn} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
import {ProspectiveJournal} from '../dist/src/workforce/prospectiveJournal.js';
import {PROSPECTIVE_RPC,PROSPECTIVE_FUNDER,sealCapture} from '../dist/src/workforce/prospective.js';
// Fixed, keyless endpoint. No credential discovery, model client, delivery or wallet adapter.
async function publicRead(request){
  return new Promise(resolve=>{
    const child=spawn('curl',['--proto','=https','--silent','--show-error','--fail-with-body','--max-time','15','--max-filesize','1000000',
      '-H','content-type: application/json','--data',JSON.stringify(request),PROSPECTIVE_RPC],{stdio:['ignore','pipe','pipe']});
    let bytes=0,body='',overflow=false;
    child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>1000000){overflow=true;child.kill();}else body+=chunk.toString('utf8');});
    child.stderr.on('data',()=>{}); // The raw response is retained; terminal output never includes transport internals.
    child.on('error',()=>resolve({rawResponse:body,error:'PUBLIC_RPC_TRANSPORT_FAILED'}));
    child.on('close',code=>resolve({rawResponse:body,error:overflow?'PUBLIC_RPC_RESPONSE_TOO_LARGE':code===0?null:'PUBLIC_RPC_TRANSPORT_FAILED'}));
  });
}
let store;
try{
  const [command,...rest]=process.argv.slice(2),allowed={init:['db','capture-id'],'init-consecutive':['db','capture-id'],step:['db'],inspect:['db'],export:['db'],audit:['input'],restore:['db','input']};
  if(!Object.hasOwn(allowed,command))throw new Error('PROSPECTIVE_COMMAND_INVALID');const args={};
  for(let i=0;i<rest.length;i+=2){const key=rest[i]?.slice(2),value=rest[i+1];if(!rest[i]?.startsWith('--')||!allowed[command].includes(key)||!value||Object.hasOwn(args,key))throw new Error('PROSPECTIVE_ARGUMENT_INVALID');args[key]=value;}
  if(allowed[command].some(key=>!args[key]))throw new Error('PROSPECTIVE_ARGUMENT_REQUIRED');
  let result;
  if(command==='audit'){
    if(statSync(args.input).size>12000000)throw new Error('PROSPECTIVE_EXPORT_TOO_LARGE');
    const {auditProspective}=await import('../dist/src/workforce/prospective.js');const data=JSON.parse(readFileSync(args.input,'utf8'));
    if(data.mode!=='UNVERIFIED_PROSPECTIVE_EXPORT'||!Array.isArray(data.calls)||data.calls.length>48)throw new Error('PROSPECTIVE_EXPORT_INVALID');
    result=await auditProspective(JSON.parse(data.manifest.json),data.calls.map(row=>JSON.parse(row.json)));
  }else{
    store=new ProspectiveJournal(args.db,command==='init'||command==='init-consecutive'||command==='restore',['inspect','export'].includes(command));
    if(command==='restore'){
      if(statSync(args.input).size>12000000)throw new Error('PROSPECTIVE_EXPORT_TOO_LARGE');
      result=await store.restore(JSON.parse(readFileSync(args.input,'utf8')));
    }else if(command==='init'||command==='init-consecutive'){
      const createdAtMs=Date.now();result=await store.register(await sealCapture({schemaVersion:command==='init-consecutive'?'binrat.prospective-capture/2':'binrat.prospective-capture/1',
        ...(command==='init-consecutive'?{discovery:{strategy:'CONSECUTIVE_NUMBERED_BLOCKS',maxBlocks:8}}:{}),provenance:'PUBLIC_RPC_SHADOW',captureId:args['capture-id'],
        funder:PROSPECTIVE_FUNDER,endpoint:PROSPECTIVE_RPC,createdAtMs,expiresAtMs:createdAtMs+86400000,maxRpcCalls:48,historyBlocks:8,maxWindowBlocks:200000,
        authority:{publicRpcRead:true,model:false,delivery:false,capital:false}}));
    }else result=command==='step'?await store.step(publicRead):command==='export'?store.export():await store.inspect(Date.now());
  }
  if(result.mode==='LOCAL_READ_ONLY_SHADOW'){const {fundingBlock,history,funding,nextRequest,...summary}=result;result={...summary,funding:funding?{txHash:funding.hash,from:funding.from,to:funding.to,valueWei:BigInt(funding.value).toString(),blockNumber:BigInt(funding.blockNumber).toString()}:null,historyBlocksCaptured:history.length,nextRpc:nextRequest};}
  console.log(JSON.stringify(result,null,2));if(['HALTED','EXHAUSTED'].includes(result.phase))process.exitCode=1;
}catch(error){console.error(JSON.stringify({error:error instanceof Error&&/^[A-Z][A-Z0-9_]{0,100}$/.test(error.message)?error.message:'PROSPECTIVE_COMMAND_FAILED',receiptsRetained:true}));process.exitCode=1;}
finally{store?.close();}
