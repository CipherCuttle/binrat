// Explicit one-shot entrypoint. Never imported by a production service or ordinary CLI step.
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {ProspectiveJournal} from '../dist/src/workforce/prospectiveJournal.js';
import {PROSPECTIVE_RPC,PROSPECTIVE_FUNDER,sealCapture} from '../dist/src/workforce/prospective.js';
import {createIndexedProbeTransport,captureOneIndexedRange} from '../dist/src/workforce/prospectiveTransport.js';

let store,out,error=null;
const save=(name,value)=>writeFileSync(join(out,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});
try{
  const args={},rest=process.argv.slice(2);
  for(let i=0;i<rest.length;i+=2){const name=rest[i]?.slice(2);if(!rest[i]?.startsWith('--')||!['out','capture-id','source-sha'].includes(name)||!rest[i+1]||Object.hasOwn(args,name))throw new Error('INDEXED_PROBE_ARGUMENT_INVALID');args[name]=rest[i+1];}
  if(!args.out||!/^[a-zA-Z0-9_:-]{1,100}$/.test(args['capture-id']??'')||!/^[a-f0-9]{40}$/.test(args['source-sha']??''))throw new Error('INDEXED_PROBE_ARGUMENT_REQUIRED');
  out=args.out;mkdirSync(out,{recursive:false,mode:0o700}); // Existing output is a hard stop, never a reset/resume.
  store=new ProspectiveJournal(join(out,'capture.sqlite'),true);
  const createdAtMs=Date.now(),manifest=await sealCapture({schemaVersion:'binrat.prospective-capture/3',
    discovery:{strategy:'INDEXED_FUNDER_OUTGOING',source:'ALCHEMY_ROBINHOOD_ARCHIVE',maxRangeBlocks:4096,maxPages:3,pageSize:5},
    provenance:'PUBLIC_RPC_SHADOW',captureId:args['capture-id'],funder:PROSPECTIVE_FUNDER,endpoint:PROSPECTIVE_RPC,
    createdAtMs,expiresAtMs:createdAtMs+86400000,maxRpcCalls:48,historyBlocks:8,maxWindowBlocks:200000,
    authority:{publicRpcRead:true,model:false,delivery:false,capital:false}});
  await store.register(manifest);
  save('registration.json',{sourceSha:args['source-sha'],runner:'ONE_INDEXED_RANGE_OR_HANDOFF',observationWaitMs:60000,
    maxRunMs:480000,noRetries:true,manifest});
  const secret=process.env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL;
  delete process.env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL;
  const transport=createIndexedProbeTransport(secret);
  await captureOneIndexedRange(store,transport);
}catch(caught){error=caught instanceof Error&&/^[A-Z][A-Z0-9_]{0,100}$/.test(caught.message)?caught.message:'INDEXED_PROBE_FAILED';process.exitCode=1;}
finally{
  if(store){
    try{
      save('raw-receipts.json',store.export());
      const audit=await store.inspect();save('audit.json',audit);
      const calls=store.export().calls.map(row=>JSON.parse(row.json));
      const summary={captureId:audit.captureId,phase:audit.phase,stage:audit.stage,reason:audit.reason,error,
        attempts:calls.length,complete:calls.filter(r=>r.status==='COMPLETE').length,failed:calls.filter(r=>r.status==='FAILED').length,
        pending:calls.filter(r=>r.status==='PENDING').length,indexedAttempts:calls.filter(r=>r.request.method==='alchemy_getAssetTransfers').length,
        indexedCoverage:audit.indexedDiscovery,handoffPrepared:!!audit.handoff,finding:!!audit.finding,
        snapshotDigest:audit.snapshotDigest,modelCalls:0,deliveryCalls:0,capitalCalls:0,
        providerReportedCost:null,costNote:'RPC response does not provide billing evidence',
        stopBoundary:audit.handoff?'HANDOFF_PREPARED':audit.indexedDiscovery.ranges.length?'FIRST_CONFIRMED_INDEXED_RANGE':'HALT_OR_LIMIT'};
      save('summary.json',summary);console.log(JSON.stringify(summary,null,2));
      if(['HALTED','EXHAUSTED','EXPIRED'].includes(audit.phase))process.exitCode=1;
    }catch{console.error(JSON.stringify({error:'INDEXED_PROBE_EXPORT_FAILED',receiptsRetained:true}));process.exitCode=1;}
    finally{store.close();}
    const names=['registration.json','raw-receipts.json','audit.json','summary.json','capture.sqlite'];
    writeFileSync(join(out,'SHA256SUMS'),names.map(name=>{try{return createHash('sha256').update(readFileSync(join(out,name))).digest('hex')+'  '+name;}catch{return '# missing '+name;}}).join('\n')+'\n',{mode:0o600});
  }else console.error(JSON.stringify({error,providerRequestsStarted:false}));
}
