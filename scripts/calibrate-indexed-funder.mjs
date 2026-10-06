// Fresh one-shot diagnostic. No resume/retry mode and no production imports.
import {mkdirSync,writeFileSync,readFileSync,renameSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {INDEXED_CALIBRATION_V1,auditIndexedCalibration} from '../dist/src/workforce/indexedCalibration.js';
import {createIndexedProbeTransport} from '../dist/src/workforce/prospectiveTransport.js';
let out,registration,error=null;
const calls=[];
const sha=value=>createHash('sha256').update(value).digest('hex');
function save(name,value){
  const target=join(out,name),temporary=target+'.tmp';
  writeFileSync(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600});
  const file=openSync(temporary,'r');try{fsyncSync(file);}finally{closeSync(file);}
  renameSync(temporary,target);const dir=openSync(out,'r');try{fsyncSync(dir);}finally{closeSync(dir);}
}
try{
  const args={},rest=process.argv.slice(2);
  for(let i=0;i<rest.length;i+=2){const name=rest[i]?.slice(2);if(!rest[i]?.startsWith('--')||!['out','capture-id','source-sha'].includes(name)||!rest[i+1]||Object.hasOwn(args,name))throw new Error('CALIBRATION_ARGUMENT_INVALID');args[name]=rest[i+1];}
  if(!args.out||!/^[a-zA-Z0-9_:-]{1,100}$/.test(args['capture-id']??'')||!/^[a-f0-9]{40}$/.test(args['source-sha']??''))throw new Error('CALIBRATION_ARGUMENT_REQUIRED');
  out=args.out;mkdirSync(out,{mode:0o700});
  const createdAtMs=Date.now();registration={captureId:args['capture-id'],sourceSha:args['source-sha'],createdAtMs,protocol:INDEXED_CALIBRATION_V1};
  save('registration.json',registration);save('raw-receipts.json',{registration,calls});
  const secret=process.env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL;delete process.env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL;
  const transport=createIndexedProbeTransport(secret);
  while(true){
    const audit=auditIndexedCalibration(calls);save('audit.json',audit);
    if(audit.error)throw new Error(audit.error);if(!audit.nextRequest)break;
    if(calls.length>=12||Date.now()-createdAtMs>=INDEXED_CALIBRATION_V1.maxRunMs)throw new Error('CALIBRATION_LIMIT_HALT');
    const row={request:audit.nextRequest,status:'PENDING',reservedAtMs:Date.now()};calls.push(row);
    save('raw-receipts.json',{registration,calls}); // Durable reservation precedes the only transport attempt.
    const response=await transport(structuredClone(row.request));
    Object.assign(row,{status:response.error?'FAILED':'COMPLETE',completedAtMs:Date.now(),rawResponse:response.rawResponse,error:response.error??null});
    save('raw-receipts.json',{registration,calls});
  }
}catch(caught){error=caught instanceof Error&&/^[A-Z][A-Z0-9_]{0,100}$/.test(caught.message)?caught.message:'CALIBRATION_FAILED';process.exitCode=1;}
finally{
  if(registration){
    save('raw-receipts.json',{registration,calls});const audit=auditIndexedCalibration(calls);save('audit.json',audit);
    const summary={...audit,nextRequest:undefined,error:error??audit.error,captureId:registration.captureId,sourceSha:registration.sourceSha,
      rawReceiptsSha256:sha(readFileSync(join(out,'raw-receipts.json'))),auditSha256:sha(readFileSync(join(out,'audit.json'))),
      costNote:'RPC responses do not provide billing evidence',noRetries:true};
    save('summary.json',summary);writeFileSync(join(out,'SHA256SUMS'),['registration.json','raw-receipts.json','audit.json','summary.json']
      .map(name=>sha(readFileSync(join(out,name)))+'  '+name).join('\n')+'\n',{mode:0o600});
    console.log(JSON.stringify(summary,null,2));
    if(audit.error||audit.nextRequest)process.exitCode=1;
  }else console.error(JSON.stringify({error,providerRequestsStarted:false}));
}
