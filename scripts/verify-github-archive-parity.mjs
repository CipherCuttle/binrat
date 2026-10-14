// Receipts contain constants, counters and hashes only. Never retain provider text or exception details.
import {mkdirSync,writeFileSync,readFileSync,renameSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {archiveParityReceipt,createGithubArchiveParityVerification,ARCHIVE_PARITY_REFERENCE} from '../dist/src/workforce/githubArchiveParity.js';

const out=join(process.env.RUNNER_TEMP??'.','binrat-github-archive-parity-20261014');
let receipt=archiveParityReceipt(process.env.GITHUB_SHA),fresh=false;
const secret=process.env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL;
delete process.env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL;
function save(value){
  const target=join(out,'receipt.json'),temporary=target+'.tmp';
  writeFileSync(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600});
  const fd=openSync(temporary,'r');try{fsyncSync(fd);}finally{closeSync(fd);}
  renameSync(temporary,target);const dir=openSync(out,'r');try{fsyncSync(dir);}finally{closeSync(dir);}
}
try{
  mkdirSync(out,{mode:0o700});fresh=true;save(receipt);
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const allowed=['.github/workflows/github-archive-parity-once.yml','scripts/verify-github-archive-parity.mjs',
    'src/workforce/funderCohort.ts','src/workforce/githubArchiveParity.ts','test/githubArchiveParity.test.ts'];
  if(git('rev-parse','HEAD')!==process.env.GITHUB_SHA||git('rev-parse','HEAD^')!==ARCHIVE_PARITY_REFERENCE||
    git('diff-tree','--no-commit-id','--name-only','-r','HEAD').split('\n').some(path=>!allowed.includes(path))||
    git('status','--porcelain','--untracked-files=no'))throw new Error('SOURCE_SCOPE_INVALID');
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const run=createGithubArchiveParityVerification(secret,{actions:process.env.GITHUB_ACTIONS==='true',
    repository:process.env.GITHUB_REPOSITORY,eventName:process.env.GITHUB_EVENT_NAME,created:event.created===true,
    before:event.before,ref:process.env.GITHUB_REF,runAttempt:process.env.GITHUB_RUN_ATTEMPT,
    message:event.head_commit?.message,sourceSha:process.env.GITHUB_SHA,eventSha:event.after,
    offlineVerifiedSha:process.env.BINRAT_ARCHIVE_PARITY_OFFLINE_SHA});
  receipt=await run(pending=>save(pending));
}catch{receipt={...receipt,reason:fresh?'VERIFICATION_PREFLIGHT_BLOCKED':'SINGLE_USE_DIRECTORY_EXISTS'};}
if(fresh)save(receipt);
console.log(JSON.stringify(receipt));
if(receipt.status!=='PASS')process.exitCode=1;
