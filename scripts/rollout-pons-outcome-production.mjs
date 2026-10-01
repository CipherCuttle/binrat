#!/usr/bin/env node
// One-shot O2 production rollout from the exact live BINRAT release.
// Order: additive D1 migration -> disabled version with archive secret -> verify -> true/1 activation -> receipt proof.
// Never merges, changes Telegram webhook state, or logs secret values.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, appendFileSync } from 'node:fs';

const WORKER='binrat-edge-v0';
const DB='binrat-v0';
const QUEUE='binrat-sync-v0';
const DB_ID='46814564-1a41-449a-88e5-c1349eed3a27';
const WORKER_URL='https://binrat-edge-v0.pettevik.workers.dev';
const EXPECTED_LIVE_SHA='525bab62a21061c576099215d247d96ae8541e01';
const EXPECTED_LIVE_VERSION='43670888-161e-4aa7-aeb4-5b407cefef60';
const BRANCH='ops/binrat-o2-production-rollout-v1';
const MIGRATION='cloudflare/migrations/20261001_pons_outcome_v1.sql';
const CONFIG='/tmp/binrat-o2-production.json';
const SECRETS='/tmp/binrat-o2-production-secrets.json';
const PROVISION='/tmp/binrat-o2-production-provision.json';
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
      encoding:'utf8',
      stdio:['ignore','pipe','pipe'],
      timeout:opts.timeout??180_000,
      env:process.env
    }).trim();
  }catch(error){
    // Never include Wrangler stdout/stderr: they can contain sensitive bindings.
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
  for(const item of candidates){
    if(!byName.has(item.name)) byName.set(item.name,item);
  }
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
function firstRow(result,index=0){
  return result?.[index]?.results?.[0]??null;
}
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
function runtimeShape(version){
  return version?.resources?.script_runtime??null;
}
function normalizedBinding(binding){
  const out={name:binding.name,type:binding.type};
  if(binding.type==='plain_text') out.text=binding.text;
  if(binding.type==='d1') out.target=binding.id??binding.database_id??binding.database_name??null;
  if(binding.type==='queue') out.target=binding.queue_name??binding.queue??null;
  return out;
}
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
function writeConfig(outcomeEnabled,outcomeBound){
  const cfg={
    name:WORKER,
    main:'src/cloudflare/worker.ts',
    compatibility_date:'2026-09-18',
    compatibility_flags:['nodejs_compat'],
    assets:{directory:'./web'},
    ai:{binding:'AI'},
    d1_databases:[{binding:'DB',database_name:DB,database_id:DB_ID}],
    triggers:{crons:['* * * * *']},
    queues:{
      producers:[{binding:'SYNC_QUEUE',queue:QUEUE}],
      consumers:[{
        queue:QUEUE,max_batch_size:1,max_batch_timeout:1,max_retries:5,max_concurrency:1,retry_delay:30
      }]
    },
    vars:{
      BINRAT_RELEASE_SHA:process.env.GITHUB_SHA,
      BINRAT_PONS_OUTCOME_ENABLED:outcomeEnabled,
      BINRAT_PONS_OUTCOME_MAX_PER_CYCLE:outcomeBound
    }
  };
  writeFileSync(CONFIG,JSON.stringify(cfg,null,2));
}
function uploadVersion(tag,message){
  cli([
    'versions','upload','--config',CONFIG,'--keep-vars','--strict',
    '--secrets-file',SECRETS,'--tag',tag,'--message',message
  ],{timeout:180_000});
  const versions=jsonFromOutput(cli(['versions','list','--name',WORKER,'--json','--config',PROVISION]));
  const id=versionByTag(versions,tag);
  gate(id,'UPLOADED_VERSION_NOT_RESOLVED:'+tag);
  return id;
}
function deployVersion(id,message){
  cli([
    'versions','deploy',id+'@100%','--name',WORKER,'--yes','--config',PROVISION,'--message',message
  ],{timeout:180_000});
  gate(currentActiveVersion()===id,'DEPLOYED_VERSION_NOT_ACTIVE');
}
function snapshotCoreState(){
  const result=d1Query([
    "SELECT chain_id,block_number,block_hash,guard_block_number,guard_block_hash FROM chain_checkpoints WHERE chain_id=4663",
    "SELECT chain_id,source_verified,live_caught_up,head_block,target_block,last_sync_error,updated_at_ms FROM binrat_runtime_state WHERE chain_id=4663",
    "SELECT COUNT(*) AS launch_count FROM launches WHERE chain_id=4663",
    "SELECT launch_id,event_id,chain_id,block_number,block_hash,source,launcher,tx_hash,log_index,token,creator,pool,authority_json FROM launches WHERE chain_id=4663 ORDER BY CAST(block_number AS INTEGER),log_index,launch_id LIMIT 1"
  ].join('; '));
  return {
    checkpoint:firstRow(result,0),
    runtime:firstRow(result,1),
    launchCount:Number(firstRow(result,2)?.launch_count??0),
    anchorLaunch:firstRow(result,3)
  };
}
function outcomeTableState(){
  const exists=d1Query("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='pons_outcome_receipts';");
  const tableCount=Number(firstRow(exists)?.n??0);
  let rows=-1;
  if(tableCount===1){
    rows=Number(firstRow(d1Query('SELECT COUNT(*) AS n FROM pons_outcome_receipts;'))?.n??-1);
  }
  return {tableCount,rows};
}
function receiptSample(){
  const state=outcomeTableState();
  if(state.tableCount!==1) return {count:-1,receipts:[]};
  const count=Number(firstRow(d1Query('SELECT COUNT(*) AS n FROM pons_outcome_receipts;'))?.n??0);
  const result=d1Query(`
    SELECT launch_id,horizon_ms,observed_block,observed_block_hash,observed_timestamp_ms,
           phase,status,estimated_fdv_quote_raw,evidence_digest
    FROM pons_outcome_receipts
    ORDER BY CAST(observed_block AS INTEGER) DESC,horizon_ms
    LIMIT 10;
  `);
  return {count,receipts:result?.[0]?.results??[]};
}
async function waitForDisabledZeroRows(){
  for(let attempt=0;attempt<3;attempt+=1){
    const state=outcomeTableState();
    note('DISABLED_O2_D1_PROBE '+JSON.stringify({attempt:attempt+1,...state}));
    gate(state.tableCount===1,'O2_TABLE_MISSING_AFTER_MIGRATION');
    gate(state.rows===0,'O2_DISABLED_WROTE_RECEIPTS');
    await healthyPons('Disabled candidate Pons probe');
    if(attempt<2) await new Promise(resolve=>setTimeout(resolve,30_000));
  }
}
async function waitForFirstReceipt(){
  for(let attempt=0;attempt<10;attempt+=1){
    const sample=receiptSample();
    note('O2_RECEIPT_PROBE '+JSON.stringify({
      attempt:attempt+1,count:sample.count,
      receipts:sample.receipts.map(r=>({
        launchId:r.launch_id,horizonMs:r.horizon_ms,observedBlock:r.observed_block,
        phase:r.phase,status:r.status,estimatedFdvQuoteRaw:r.estimated_fdv_quote_raw,
        evidenceDigest:r.evidence_digest
      }))
    }));
    if(sample.count>0) return sample;
    if(attempt<9) await new Promise(resolve=>setTimeout(resolve,20_000));
  }
  throw new Error('O2_FIRST_PRODUCTION_RECEIPT_TIMEOUT');
}

gate(process.env.GITHUB_REF==='refs/heads/'+BRANCH,'O2_PRODUCTION_REF_INVALID');
gate(process.env.O2_PROD_ROLLOUT_APPROVED==='true','O2_PRODUCTION_APPROVAL_GATE_CLOSED');
gate(/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA??''),'GITHUB_SHA_INVALID');
for(const name of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','BINRAT_ROBINHOOD_ARCHIVE_RPC_URL']){
  gate(Boolean(process.env[name]?.trim()),'MISSING_REQUIRED_SECRET:'+name);
}
gate(readFileSync(MIGRATION,'utf8').includes('pons_outcome_receipts'),'O2_MIGRATION_INVALID');

writeFileSync(PROVISION,JSON.stringify({
  name:WORKER,main:'src/cloudflare/worker.ts',
  compatibility_date:'2026-09-18',compatibility_flags:['nodejs_compat']
}));
writeFileSync(SECRETS,JSON.stringify({
  BINRAT_ROBINHOOD_ARCHIVE_RPC_URL:process.env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL
}));

try{
  originalVersion=currentActiveVersion();
  gate(originalVersion===EXPECTED_LIVE_VERSION,'LIVE_VERSION_DRIFT');
  const originalConfig=viewVersion(originalVersion);
  gate(plain(originalConfig,'BINRAT_RELEASE_SHA')===EXPECTED_LIVE_SHA,'LIVE_RELEASE_SHA_DRIFT');
  gate(plain(originalConfig,'BINRAT_AUTONOMOUS_RAT_ENABLED')==='true','PRIVATE_AUTONOMOUS_STATE_DRIFT');
  gate(plain(originalConfig,'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED')==='false','PUBLIC_AUTONOMOUS_STATE_DRIFT');
  gate(plain(originalConfig,'BINRAT_TELEGRAM_UI_V2_ENABLED')==='true','TELEGRAM_UI_V2_STATE_DRIFT');
  gate(plain(originalConfig,'BINRAT_TELEGRAM_MEDIA_ENABLED')==='true','TELEGRAM_MEDIA_STATE_DRIFT');
  gate(secretPresent(originalConfig,'TELEGRAM_BOT_TOKEN'),'TELEGRAM_BOT_SECRET_MISSING');
  gate(secretPresent(originalConfig,'TELEGRAM_WEBHOOK_SECRET'),'TELEGRAM_WEBHOOK_SECRET_MISSING');
  gate(!secretPresent(originalConfig,'BINRAT_ROBINHOOD_ARCHIVE_RPC_URL'),'ARCHIVE_SECRET_ALREADY_PRESENT_UNEXPECTED');
  gate(plain(originalConfig,'BINRAT_PONS_OUTCOME_ENABLED')===null,'O2_FLAG_ALREADY_PRESENT_UNEXPECTED');

  await getJson('/health');
  await healthyPons('Pre-migration Pons probe');

  writeConfig('false','3');
  // Dry-run the exact production manifest before any mutation.
  cli(['deploy','--dry-run','--config',CONFIG],{timeout:180_000});
  note('O2_PRODUCTION_DRY_RUN_PASS');

  const beforeMigration=snapshotCoreState();
  const beforeTable=outcomeTableState();
  gate(beforeTable.tableCount===0||(beforeTable.tableCount===1&&beforeTable.rows===0),'O2_PREEXISTING_STATE_UNEXPECTED');

  if(beforeTable.tableCount===0){
    cli(['d1','execute','DB','--remote','--yes','--file',MIGRATION,'--config',CONFIG],{timeout:180_000});
  }
  const afterMigration=snapshotCoreState();
  const afterTable=outcomeTableState();
  gate(afterTable.tableCount===1&&afterTable.rows===0,'O2_MIGRATION_VERIFY_FAILED');
  gate(JSON.stringify(afterMigration.anchorLaunch)===JSON.stringify(beforeMigration.anchorLaunch),
    'O2_MIGRATION_MUTATED_ANCHOR_LAUNCH');
  gate(afterMigration.launchCount>=beforeMigration.launchCount,'O2_MIGRATION_LAUNCH_COUNT_REGRESSED');
  gate(
    BigInt(afterMigration.checkpoint?.block_number??'0')>=BigInt(beforeMigration.checkpoint?.block_number??'0'),
    'O2_MIGRATION_CHECKPOINT_REGRESSED'
  );
  gate(afterMigration.runtime?.source_verified===1&&afterMigration.runtime?.last_sync_error===null,
    'O2_MIGRATION_RUNTIME_AUTHORITY_REGRESSED');
  note('O2_REMOTE_D1_MIGRATION_PASS '+JSON.stringify({
    beforeTable,afterTable,
    launchCountBefore:beforeMigration.launchCount,
    launchCountAfter:afterMigration.launchCount,
    checkpointBefore:beforeMigration.checkpoint?.block_number??null,
    checkpointAfter:afterMigration.checkpoint?.block_number??null
  }));

  const disabledTag='o2-disabled-'+process.env.GITHUB_SHA.slice(0,12);
  disabledVersion=uploadVersion(disabledTag,'BINRAT O2 disabled production candidate');
  const disabledConfig=viewVersion(disabledVersion);
  assertBindingDelta(
    originalConfig,disabledConfig,
    new Map([['BINRAT_RELEASE_SHA',{before:EXPECTED_LIVE_SHA,after:process.env.GITHUB_SHA}]]),
    new Map([
      ['BINRAT_PONS_OUTCOME_ENABLED',{type:'plain_text',text:'false'}],
      ['BINRAT_PONS_OUTCOME_MAX_PER_CYCLE',{type:'plain_text',text:'3'}],
      ['BINRAT_ROBINHOOD_ARCHIVE_RPC_URL',{type:'secret_text'}]
    ])
  );
  gate(secretPresent(disabledConfig,'BINRAT_ROBINHOOD_ARCHIVE_RPC_URL'),'DISABLED_ARCHIVE_SECRET_MISSING');
  note('O2_DISABLED_VERSION_PARITY_PASS '+disabledVersion);

  deployedStage='DISABLED_ATTEMPT';
  deployVersion(disabledVersion,'BINRAT O2 disabled production rollout');
  deployedStage='DISABLED';
  const disabledLive=viewVersion(disabledVersion);
  gate(plain(disabledLive,'BINRAT_PONS_OUTCOME_ENABLED')==='false','O2_DISABLED_FLAG_DRIFT');
  gate(plain(disabledLive,'BINRAT_PONS_OUTCOME_MAX_PER_CYCLE')==='3','O2_DISABLED_BOUND_DRIFT');
  gate(plain(disabledLive,'BINRAT_AUTONOMOUS_RAT_ENABLED')==='true','PRIVATE_AUTONOMOUS_STATE_CHANGED');
  gate(plain(disabledLive,'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED')==='false','PUBLIC_AUTONOMOUS_STATE_CHANGED');
  gate(plain(disabledLive,'BINRAT_TELEGRAM_UI_V2_ENABLED')==='true','TELEGRAM_UI_V2_STATE_CHANGED');
  gate(plain(disabledLive,'BINRAT_TELEGRAM_MEDIA_ENABLED')==='true','TELEGRAM_MEDIA_STATE_CHANGED');
  gate(secretPresent(disabledLive,'TELEGRAM_BOT_TOKEN')&&secretPresent(disabledLive,'TELEGRAM_WEBHOOK_SECRET'),
    'TELEGRAM_SECRET_BINDING_CHANGED');
  await waitForDisabledZeroRows();
  note('O2_DISABLED_PRODUCTION_VERIFY_PASS');

  writeConfig('true','1');
  const activationTag='o2-active-'+process.env.GITHUB_SHA.slice(0,12);
  activationVersion=uploadVersion(activationTag,'BINRAT O2 true/1 production candidate');
  const activationConfig=viewVersion(activationVersion);
  assertBindingDelta(
    disabledConfig,activationConfig,
    new Map([
      ['BINRAT_PONS_OUTCOME_ENABLED',{before:'false',after:'true'}],
      ['BINRAT_PONS_OUTCOME_MAX_PER_CYCLE',{before:'3',after:'1'}]
    ]),
    new Map()
  );
  gate(secretPresent(activationConfig,'BINRAT_ROBINHOOD_ARCHIVE_RPC_URL'),'ACTIVATION_ARCHIVE_SECRET_MISSING');
  note('O2_ACTIVATION_VERSION_PARITY_PASS '+activationVersion);

  deployedStage='ACTIVE_ATTEMPT';
  deployVersion(activationVersion,'BINRAT O2 true/1 controlled activation');
  deployedStage='ACTIVE';
  await healthyPons('Post-activation Pons probe');
  const sample=await waitForFirstReceipt();
  await healthyPons('Post-receipt Pons probe');
  const activeConfig=viewVersion(activationVersion);
  gate(plain(activeConfig,'BINRAT_PONS_OUTCOME_ENABLED')==='true','O2_POSTDEPLOY_FLAG_NOT_ENABLED');
  gate(plain(activeConfig,'BINRAT_PONS_OUTCOME_MAX_PER_CYCLE')==='1','O2_POSTDEPLOY_BOUND_NOT_ONE');
  gate(plain(activeConfig,'BINRAT_AUTONOMOUS_RAT_ENABLED')==='true','PRIVATE_AUTONOMOUS_STATE_CHANGED_AFTER_ACTIVATION');
  gate(plain(activeConfig,'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED')==='false','PUBLIC_AUTONOMOUS_STATE_CHANGED_AFTER_ACTIVATION');
  gate(plain(activeConfig,'BINRAT_TELEGRAM_UI_V2_ENABLED')==='true','TELEGRAM_UI_V2_STATE_CHANGED_AFTER_ACTIVATION');
  gate(plain(activeConfig,'BINRAT_TELEGRAM_MEDIA_ENABLED')==='true','TELEGRAM_MEDIA_STATE_CHANGED_AFTER_ACTIVATION');

  note('PONS_OUTCOME_PRODUCTION_ROLLOUT_PASS '+JSON.stringify({
    originalVersion,disabledVersion,activationVersion,
    releaseSha:process.env.GITHUB_SHA,
    outcomeEnabled:true,maxPerCycle:1,
    receiptCount:sample.count,
    receipts:sample.receipts.map(r=>({
      launchId:r.launch_id,horizonMs:r.horizon_ms,observedBlock:r.observed_block,
      observedBlockHash:r.observed_block_hash,observedTimestampMs:r.observed_timestamp_ms,
      phase:r.phase,status:r.status,estimatedFdvQuoteRaw:r.estimated_fdv_quote_raw,
      evidenceDigest:r.evidence_digest
    }))
  }));
}catch(error){
  note('PONS_OUTCOME_PRODUCTION_ROLLOUT_FAILED '+JSON.stringify({
    stage:deployedStage,
    code:error instanceof Error?error.message:'UNKNOWN'
  }));
  try{
    if((deployedStage==='ACTIVE'||deployedStage==='ACTIVE_ATTEMPT')&&disabledVersion){
      deployVersion(disabledVersion,'Automatic O2 rollback to disabled candidate');
      await healthyPons('O2 activation rollback Pons probe');
      note('O2_ROLLBACK_PASS target=DISABLED');
    }else if((deployedStage==='DISABLED'||deployedStage==='DISABLED_ATTEMPT')&&originalVersion){
      deployVersion(originalVersion,'Automatic O2 rollback to pre-rollout production');
      await healthyPons('O2 disabled-candidate rollback Pons probe');
      note('O2_ROLLBACK_PASS target=ORIGINAL');
    }
  }catch{
    note('O2_ROLLBACK_FAILED manual Cloudflare rollback required');
  }
  throw error;
}finally{
  rmSync(SECRETS,{force:true});
  rmSync(CONFIG,{force:true});
  rmSync(PROVISION,{force:true});
}
