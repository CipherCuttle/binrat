#!/usr/bin/env node
// One-shot #88 production canary.
// Order: additive D1 migration -> deploy reviewed head disabled -> verify -> true/1 activation
// -> persisted identity proof -> immutable pre-canary launch-authority fingerprint.
// Never merges, changes Telegram state, widens above 1/cycle, or logs secret values.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync, appendFileSync } from 'node:fs';

const WORKER='binrat-edge-v0';
const DB='binrat-v0';
const QUEUE='binrat-sync-v0';
const DB_ID='46814564-1a41-449a-88e5-c1349eed3a27';
const WORKER_URL='https://binrat-edge-v0.pettevik.workers.dev';
const EXPECTED_LIVE_SHA='23afe944d1faf5ec4e681f66481ff88cbb4b7353';
const REVIEWED_HEAD='75ea77d9384845c9c537248e5a757fff5efbd960';
const BRANCH='ops/binrat-token-identity-production-rollout-v1';
const MIGRATION='cloudflare/migrations/20261001_pons_token_identity_v1.sql';
const WORKFLOW='.github/workflows/pons-token-identity-production-rollout.yml';
const SCRIPT='scripts/rollout-pons-token-identity-production.mjs';
const CONFIG='wrangler.identity-production.generated.jsonc';
const PROVISION='/tmp/binrat-identity-production-provision.json';
const WRANGLER=['dlx','wrangler@4.135.0'];
const summary=process.env.GITHUB_STEP_SUMMARY;
let originalVersion=null;
let disabledVersion=null;
let activationVersion=null;
let deployedStage='NONE';

function note(line){
  console.log(line);
  if(summary) appendFileSync(summary,line+'\n');
}
function gate(ok,code){ if(!ok) throw new Error(code); }
function cli(args,opts={}){
  try{
    return execFileSync('pnpm',[...WRANGLER,...args],{
      encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:opts.timeout??180_000,env:process.env
    }).trim();
  }catch(error){
    throw new Error('WRANGLER_FAILED:'+args.slice(0,3).join(':')+':'+(error.status??'UNKNOWN'));
  }
}
function jsonFromOutput(output){
  const positions=[output.indexOf('{'),output.indexOf('[')].filter(i=>i>=0);
  gate(positions.length>0,'WRANGLER_JSON_MISSING');
  return JSON.parse(output.slice(Math.min(...positions)));
}
function walk(value,visit,seen=new Set()){
  if(!value||typeof value!=='object'||seen.has(value)) return null;
  seen.add(value);
  const hit=visit(value);
  if(hit) return hit;
  for(const child of Array.isArray(value)?value:Object.values(value)){
    const nested=walk(child,visit,seen);
    if(nested) return nested;
  }
  return null;
}
function collect(value,visit,result=[]){
  if(!value||typeof value!=='object') return result;
  const hit=visit(value);
  if(hit!==null&&hit!==undefined) result.push(hit);
  for(const child of Array.isArray(value)?value:Object.values(value)) collect(child,visit,result);
  return result;
}
function uuid(value){
  return typeof value==='string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function activeVersionFrom(status){
  return walk(status,value=>{
    const id=value.version_id??value.versionId;
    const pct=value.percentage??value.percent??value.traffic;
    const hundred=pct===100||pct==='100'||pct===1||pct==='1';
    return uuid(id)&&hundred?id:null;
  });
}
function versionByTag(versions,tag){
  return walk(versions,value=>{
    const id=value.id??value.version_id??value.versionId;
    const candidateTag=value.tag??value.annotations?.['workers/tag']??value.annotations?.tag;
    return uuid(id)&&candidateTag===tag?id:null;
  });
}
function bindingList(version){
  const candidates=collect(version,value=>{
    if(typeof value?.name==='string'&&typeof value?.type==='string') return value;
    return null;
  });
  const byName=new Map();
  for(const item of candidates) if(!byName.has(item.name)) byName.set(item.name,item);
  return byName;
}
function plain(version,name){
  const b=bindingList(version).get(name);
  return b?.type==='plain_text'&&typeof b?.text==='string'?b.text:null;
}
function secretPresent(version,name){
  return bindingList(version).get(name)?.type==='secret_text';
}
function deploymentStatus(){
  return jsonFromOutput(cli(['deployments','status','--name',WORKER,'--json','--config',PROVISION]));
}
function viewVersion(id){
  return jsonFromOutput(cli(['versions','view',id,'--name',WORKER,'--json','--config',PROVISION]));
}
function currentActiveVersion(){
  const id=activeVersionFrom(deploymentStatus());
  gate(id,'ACTIVE_VERSION_NOT_RESOLVED');
  return id;
}
function d1Query(sql){
  return jsonFromOutput(cli([
    'd1','execute',DB,'--remote','--yes','--json','--config',CONFIG,'--command',sql
  ],{timeout:180_000}));
}
function firstRow(result,index=0){ return result?.[index]?.results?.[0]??null; }
async function getJson(path){
  const response=await fetch(WORKER_URL+path,{signal:AbortSignal.timeout(20_000)});
  const body=await response.json().catch(()=>null);
  gate(response.ok&&body&&typeof body==='object','HTTP_PREFLIGHT_FAILED:'+path);
  return body;
}
async function healthyPons(label){
  let last=null;
  for(let attempt=0;attempt<7;attempt+=1){
    last=await getJson('/api/health');
    note(label+' '+JSON.stringify({
      attempt:attempt+1,ok:last.ok,chainId:last.chainId,indexReady:last.indexReady,
      liveCaughtUp:last.liveCaughtUp,checkpointBlock:last.checkpointBlock,
      headBlock:last.headBlock,targetBlock:last.targetBlock,lastSyncError:last.lastSyncError,
      runtimeFresh:last.runtimeFresh
    }));
    if(last.ok===true&&last.chainId===4663&&last.indexReady===true&&last.liveCaughtUp===true&&
       last.lastSyncError===null&&last.runtimeFresh===true) return last;
    if(attempt<6) await new Promise(resolve=>setTimeout(resolve,5_000));
  }
  throw new Error('PONS_HEALTH_GATE_FAILED:'+label);
}
function runtimeShape(version){ return version?.resources?.script_runtime??null; }
function assertBindingDelta(beforeVersion,afterVersion,allowedChanges,allowedAdditions){
  const before=bindingList(beforeVersion);
  const after=bindingList(afterVersion);
  for(const [name,b] of before){
    const a=after.get(name);
    gate(a,'CANDIDATE_BINDING_MISSING:'+name);
    gate(a.type===b.type,'CANDIDATE_BINDING_TYPE_CHANGED:'+name);
    const change=allowedChanges.get(name);
    if(b.type==='plain_text'){
      if(change){
        gate(b.text===change.before&&a.text===change.after,'CANDIDATE_VARIABLE_DELTA_INVALID:'+name);
      }else{
        gate(a.text===b.text,'CANDIDATE_VARIABLE_CHANGED:'+name);
      }
    }else if(b.type==='d1'){
      gate((a.id??a.database_id)===(b.id??b.database_id),'CANDIDATE_D1_TARGET_CHANGED:'+name);
    }else if(b.type==='queue'){
      gate((a.queue_name??a.queue)===(b.queue_name??b.queue),'CANDIDATE_QUEUE_TARGET_CHANGED:'+name);
    }
  }
  for(const [name,a] of after){
    if(before.has(name)) continue;
    const expected=allowedAdditions.get(name);
    gate(expected,'CANDIDATE_BINDING_UNAUTHORIZED:'+name);
    gate(a.type===expected.type,'CANDIDATE_ADDITION_TYPE_INVALID:'+name);
    if(expected.text!==undefined) gate(a.text===expected.text,'CANDIDATE_ADDITION_VALUE_INVALID:'+name);
  }
  gate(JSON.stringify(runtimeShape(beforeVersion))===JSON.stringify(runtimeShape(afterVersion)),
    'CANDIDATE_SCRIPT_RUNTIME_CHANGED');
}
function writeConfig(identityEnabled){
  const cfg={
    name:WORKER,main:'src/cloudflare/worker.ts',compatibility_date:'2026-09-18',
    compatibility_flags:['nodejs_compat'],assets:{directory:'./web'},ai:{binding:'AI'},
    d1_databases:[{binding:'DB',database_name:DB,database_id:DB_ID}],
    triggers:{crons:['* * * * *']},
    queues:{
      producers:[{binding:'SYNC_QUEUE',queue:QUEUE}],
      consumers:[{queue:QUEUE,max_batch_size:1,max_batch_timeout:1,max_retries:5,max_concurrency:1,retry_delay:30}]
    },
    vars:{
      BINRAT_RELEASE_SHA:REVIEWED_HEAD,
      BINRAT_PONS_TOKEN_IDENTITY_ENABLED:identityEnabled,
      BINRAT_PONS_TOKEN_IDENTITY_MAX_PER_CYCLE:'1'
    }
  };
  writeFileSync(CONFIG,JSON.stringify(cfg,null,2));
}
function uploadVersion(tag,message){
  cli(['versions','upload','--config',CONFIG,'--keep-vars','--strict','--tag',tag,'--message',message],{timeout:180_000});
  const versions=jsonFromOutput(cli(['versions','list','--name',WORKER,'--json','--config',PROVISION]));
  const id=versionByTag(versions,tag);
  gate(id,'UPLOADED_VERSION_NOT_RESOLVED:'+tag);
  return id;
}
function deployVersion(id,message){
  cli(['versions','deploy',id+'@100%','--name',WORKER,'--yes','--config',PROVISION,'--message',message],{timeout:180_000});
  gate(currentActiveVersion()===id,'DEPLOYED_VERSION_NOT_ACTIVE');
}
function identityTableState(){
  const exists=d1Query("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='pons_token_identity_receipts';");
  const tableCount=Number(firstRow(exists)?.n??0);
  let rows=-1;
  if(tableCount===1) rows=Number(firstRow(d1Query('SELECT COUNT(*) AS n FROM pons_token_identity_receipts;'))?.n??-1);
  return {tableCount,rows};
}
function checkpointBlock(){
  const row=firstRow(d1Query("SELECT block_number FROM chain_checkpoints WHERE chain_id=4663 LIMIT 1;"));
  gate(row&&typeof row.block_number==='string','IDENTITY_CHECKPOINT_MISSING');
  return row.block_number;
}
function authorityFingerprint(cutoff){
  const hash=createHash('sha256');
  let offset=0,total=0;
  for(;;){
    const sql="SELECT launch_id,authority_json FROM launches WHERE chain_id=4663 AND CAST(block_number AS INTEGER)<=CAST('"+
      cutoff+"' AS INTEGER) ORDER BY CAST(block_number AS INTEGER),log_index,launch_id LIMIT 1000 OFFSET "+offset+";";
    const rows=d1Query(sql)?.[0]?.results??[];
    for(const row of rows){
      gate(typeof row.launch_id==='string'&&typeof row.authority_json==='string','AUTHORITY_FINGERPRINT_ROW_INVALID');
      hash.update(row.launch_id.length+':'+row.launch_id+'|'+row.authority_json.length+':'+row.authority_json+'\n');
    }
    total+=rows.length;
    if(rows.length<1000) break;
    offset+=rows.length;
    gate(offset<=100_000,'AUTHORITY_FINGERPRINT_LIMIT');
  }
  return {cutoff,total,digest:hash.digest('hex')};
}
function latestIdentitySample(){
  const state=identityTableState();
  if(state.tableCount!==1) return {count:-1,rows:[]};
  const count=Number(firstRow(d1Query('SELECT COUNT(*) AS n FROM pons_token_identity_receipts;'))?.n??0);
  const result=d1Query(
    "SELECT i.identity_id,i.launch_id,i.token,i.observed_block,i.observed_block_hash,i.name,i.symbol,i.decimals,i.evidence_digest,"+
    "l.token AS launch_token FROM pons_token_identity_receipts i JOIN launches l ON l.launch_id=i.launch_id "+
    "WHERE i.chain_id=4663 ORDER BY rowid DESC LIMIT 5;"
  );
  return {count,rows:result?.[0]?.results??[]};
}
function validateIdentityRows(sample){
  gate(sample.count>0&&sample.rows.length>0,'IDENTITY_RECEIPT_SAMPLE_EMPTY');
  for(const row of sample.rows){
    gate(typeof row.identity_id==='string'&&/^[0-9a-f]{64}$/i.test(row.identity_id),'IDENTITY_ID_INVALID');
    gate(typeof row.launch_id==='string'&&/^[0-9a-f]{64}$/i.test(row.launch_id),'IDENTITY_LAUNCH_ID_INVALID');
    gate(typeof row.token==='string'&&/^0x[0-9a-f]{40}$/i.test(row.token),'IDENTITY_TOKEN_INVALID');
    gate(String(row.token).toLowerCase()===String(row.launch_token).toLowerCase(),'IDENTITY_TOKEN_LAUNCH_MISMATCH');
    gate(typeof row.observed_block==='string'&&BigInt(row.observed_block)>=0n,'IDENTITY_BLOCK_INVALID');
    gate(typeof row.observed_block_hash==='string'&&/^0x[0-9a-f]{64}$/i.test(row.observed_block_hash),'IDENTITY_BLOCK_HASH_INVALID');
    gate(typeof row.name==='string'&&Array.from(row.name).length<=256,'IDENTITY_NAME_INVALID');
    gate(typeof row.symbol==='string'&&Array.from(row.symbol).length<=64,'IDENTITY_SYMBOL_INVALID');
    gate(Number.isInteger(Number(row.decimals))&&Number(row.decimals)>=0&&Number(row.decimals)<=255,'IDENTITY_DECIMALS_INVALID');
    gate(typeof row.evidence_digest==='string'&&/^[0-9a-f]{64}$/i.test(row.evidence_digest),'IDENTITY_DIGEST_INVALID');
  }
}
async function waitDisabled(){
  for(let attempt=0;attempt<3;attempt+=1){
    const state=identityTableState();
    note('DISABLED_IDENTITY_D1_PROBE '+JSON.stringify({attempt:attempt+1,...state}));
    gate(state.tableCount===1,'IDENTITY_TABLE_MISSING_AFTER_MIGRATION');
    gate(state.rows===0,'IDENTITY_DISABLED_WROTE_RECEIPTS');
    await healthyPons('Disabled identity candidate Pons probe');
    if(attempt<2) await new Promise(resolve=>setTimeout(resolve,20_000));
  }
}
async function waitFirstReceipt(){
  for(let attempt=0;attempt<12;attempt+=1){
    const sample=latestIdentitySample();
    note('IDENTITY_RECEIPT_PROBE '+JSON.stringify({
      attempt:attempt+1,count:sample.count,
      rows:sample.rows.map(r=>({launchId:r.launch_id,token:r.token,name:r.name,symbol:r.symbol,decimals:r.decimals,observedBlock:r.observed_block,evidenceDigest:r.evidence_digest}))
    }));
    if(sample.count>0){
      validateIdentityRows(sample);
      return sample;
    }
    if(attempt<11) await new Promise(resolve=>setTimeout(resolve,20_000));
  }
  throw new Error('IDENTITY_FIRST_PRODUCTION_RECEIPT_TIMEOUT');
}

gate(process.env.GITHUB_REF==='refs/heads/'+BRANCH,'IDENTITY_PRODUCTION_REF_INVALID');
gate(process.env.IDENTITY_PROD_ROLLOUT_APPROVED==='true','IDENTITY_PRODUCTION_APPROVAL_GATE_CLOSED');
gate(/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA??''),'GITHUB_SHA_INVALID');

const changed=execFileSync('git',['diff','--name-only',REVIEWED_HEAD+'..'+process.env.GITHUB_SHA],{encoding:'utf8'})
  .trim().split('\n').filter(Boolean).sort();
gate(JSON.stringify(changed)===JSON.stringify([WORKFLOW,SCRIPT].sort()),'ROLLOUT_BRANCH_DIFF_NOT_OPS_ONLY');

writeFileSync(PROVISION,JSON.stringify({
  name:WORKER,main:'src/cloudflare/worker.ts',compatibility_date:'2026-09-18',compatibility_flags:['nodejs_compat']
}));

try{
  originalVersion=currentActiveVersion();
  const originalConfig=viewVersion(originalVersion);
  gate(plain(originalConfig,'BINRAT_RELEASE_SHA')===EXPECTED_LIVE_SHA,'LIVE_RELEASE_SHA_DRIFT');
  gate(plain(originalConfig,'BINRAT_PONS_OUTCOME_ENABLED')==='true','O2_ENABLED_STATE_DRIFT');
  gate(plain(originalConfig,'BINRAT_PONS_OUTCOME_MAX_PER_CYCLE')==='1','O2_BOUND_STATE_DRIFT');
  gate(secretPresent(originalConfig,'BINRAT_ROBINHOOD_ARCHIVE_RPC_URL'),'ARCHIVE_SECRET_MISSING');
  gate(plain(originalConfig,'BINRAT_PONS_TOKEN_IDENTITY_ENABLED')===null,'IDENTITY_FLAG_ALREADY_PRESENT_UNEXPECTED');
  gate(plain(originalConfig,'BINRAT_PONS_TOKEN_IDENTITY_MAX_PER_CYCLE')===null,'IDENTITY_BOUND_ALREADY_PRESENT_UNEXPECTED');

  await healthyPons('Pre-migration Pons probe');

  writeConfig('false');
  cli(['deploy','--dry-run','--config',CONFIG],{timeout:180_000});
  note('IDENTITY_PRODUCTION_DRY_RUN_PASS');

  const cutoff=checkpointBlock();
  const authorityBefore=authorityFingerprint(cutoff);
  const beforeTable=identityTableState();
  gate(beforeTable.tableCount===0||(beforeTable.tableCount===1&&beforeTable.rows===0),'IDENTITY_PREEXISTING_STATE_UNEXPECTED');

  if(beforeTable.tableCount===0){
    cli(['d1','execute','DB','--remote','--yes','--file',MIGRATION,'--config',CONFIG],{timeout:180_000});
  }
  const afterMigration=identityTableState();
  gate(afterMigration.tableCount===1&&afterMigration.rows===0,'IDENTITY_MIGRATION_VERIFY_FAILED');
  const authorityAfterMigration=authorityFingerprint(cutoff);
  gate(authorityAfterMigration.digest===authorityBefore.digest&&authorityAfterMigration.total===authorityBefore.total,
    'IDENTITY_MIGRATION_MUTATED_LAUNCH_AUTHORITY');
  note('IDENTITY_REMOTE_D1_MIGRATION_PASS '+JSON.stringify({beforeTable,afterMigration,authority:authorityAfterMigration}));

  const disabledTag='identity-disabled-'+REVIEWED_HEAD.slice(0,12);
  disabledVersion=uploadVersion(disabledTag,'BINRAT #88 identity disabled production candidate');
  const disabledConfig=viewVersion(disabledVersion);
  assertBindingDelta(
    originalConfig,disabledConfig,
    new Map([['BINRAT_RELEASE_SHA',{before:EXPECTED_LIVE_SHA,after:REVIEWED_HEAD}]]),
    new Map([
      ['BINRAT_PONS_TOKEN_IDENTITY_ENABLED',{type:'plain_text',text:'false'}],
      ['BINRAT_PONS_TOKEN_IDENTITY_MAX_PER_CYCLE',{type:'plain_text',text:'1'}]
    ])
  );
  gate(secretPresent(disabledConfig,'BINRAT_ROBINHOOD_ARCHIVE_RPC_URL'),'DISABLED_ARCHIVE_SECRET_MISSING');
  note('IDENTITY_DISABLED_VERSION_PARITY_PASS '+disabledVersion);

  deployedStage='DISABLED_ATTEMPT';
  deployVersion(disabledVersion,'BINRAT #88 identity disabled production canary');
  deployedStage='DISABLED';
  await waitDisabled();
  note('IDENTITY_DISABLED_PRODUCTION_VERIFY_PASS');

  writeConfig('true');
  const activeTag='identity-active-'+REVIEWED_HEAD.slice(0,12);
  activationVersion=uploadVersion(activeTag,'BINRAT #88 identity true/1 production candidate');
  const activationConfig=viewVersion(activationVersion);
  assertBindingDelta(
    disabledConfig,activationConfig,
    new Map([['BINRAT_PONS_TOKEN_IDENTITY_ENABLED',{before:'false',after:'true'}]]),
    new Map()
  );
  gate(plain(activationConfig,'BINRAT_PONS_TOKEN_IDENTITY_MAX_PER_CYCLE')==='1','IDENTITY_ACTIVATION_BOUND_NOT_ONE');
  gate(secretPresent(activationConfig,'BINRAT_ROBINHOOD_ARCHIVE_RPC_URL'),'ACTIVATION_ARCHIVE_SECRET_MISSING');
  note('IDENTITY_ACTIVATION_VERSION_PARITY_PASS '+activationVersion);

  deployedStage='ACTIVE_ATTEMPT';
  deployVersion(activationVersion,'BINRAT #88 token identity true/1 controlled canary');
  deployedStage='ACTIVE';
  await healthyPons('Post-activation Pons probe');
  const sample=await waitFirstReceipt();
  await healthyPons('Post-receipt Pons probe');

  const authorityAfter=authorityFingerprint(cutoff);
  gate(authorityAfter.digest===authorityBefore.digest&&authorityAfter.total===authorityBefore.total,
    'IDENTITY_ACTIVATION_MUTATED_LAUNCH_AUTHORITY');

  const activeConfig=viewVersion(activationVersion);
  gate(plain(activeConfig,'BINRAT_RELEASE_SHA')===REVIEWED_HEAD,'IDENTITY_RELEASE_SHA_DRIFT');
  gate(plain(activeConfig,'BINRAT_PONS_TOKEN_IDENTITY_ENABLED')==='true','IDENTITY_POSTDEPLOY_FLAG_NOT_ENABLED');
  gate(plain(activeConfig,'BINRAT_PONS_TOKEN_IDENTITY_MAX_PER_CYCLE')==='1','IDENTITY_POSTDEPLOY_BOUND_NOT_ONE');
  gate(plain(activeConfig,'BINRAT_PONS_OUTCOME_ENABLED')==='true','O2_STATE_CHANGED');
  gate(plain(activeConfig,'BINRAT_PONS_OUTCOME_MAX_PER_CYCLE')==='1','O2_BOUND_CHANGED');

  note('PONS_TOKEN_IDENTITY_PRODUCTION_CANARY_PASS '+JSON.stringify({
    originalVersion,disabledVersion,activationVersion,releaseSha:REVIEWED_HEAD,
    identityEnabled:true,maxPerCycle:1,identityCount:sample.count,
    authorityFingerprint:authorityAfter,
    receipts:sample.rows.map(r=>({
      launchId:r.launch_id,token:r.token,name:r.name,symbol:r.symbol,decimals:r.decimals,
      observedBlock:r.observed_block,evidenceDigest:r.evidence_digest
    }))
  }));
}catch(error){
  note('PONS_TOKEN_IDENTITY_PRODUCTION_CANARY_FAILED '+JSON.stringify({
    stage:deployedStage,code:error instanceof Error?error.message:'UNKNOWN'
  }));
  try{
    if((deployedStage==='ACTIVE'||deployedStage==='ACTIVE_ATTEMPT')&&disabledVersion){
      deployVersion(disabledVersion,'Automatic #88 rollback to identity-disabled candidate');
      await healthyPons('Identity activation rollback Pons probe');
      note('IDENTITY_ROLLBACK_PASS target=DISABLED');
    }else if((deployedStage==='DISABLED'||deployedStage==='DISABLED_ATTEMPT')&&originalVersion){
      deployVersion(originalVersion,'Automatic #88 rollback to pre-canary production');
      await healthyPons('Identity disabled-candidate rollback Pons probe');
      note('IDENTITY_ROLLBACK_PASS target=ORIGINAL');
    }
  }catch{
    note('IDENTITY_ROLLBACK_FAILED manual Cloudflare rollback required');
  }
  throw error;
}finally{
  rmSync(CONFIG,{force:true});
  rmSync(PROVISION,{force:true});
}
