#!/usr/bin/env node
// Promote the reviewed provider-head regression hardening from exact production.
// No merge, no D1 migration, no flag changes. Roll back automatically on failed verification.
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, appendFileSync } from 'node:fs';

const WORKER='binrat-edge-v0';
const DB='binrat-v0';
const QUEUE='binrat-sync-v0';
const DB_ID='46814564-1a41-449a-88e5-c1349eed3a27';
const WORKER_URL='https://binrat-edge-v0.pettevik.workers.dev';

const BRANCH='ops/binrat-provenance-repair-deploy-v1';
const EXPECTED_LIVE_VERSION='38ec8576-0b14-48e4-a425-175f4606c26f';
const EXPECTED_LIVE_SHA='cf85ee9cf33cdd3e7c04048e39e86b14ded775ae';
const REVIEWED_RELEASE_SHA='23afe944d1faf5ec4e681f66481ff88cbb4b7353';
const EXPECTED_DIFF=[
  'src/cloudflare/d1Store.ts',
  'src/core/ports.ts',
  'src/indexer/syncLaunches.ts',
  'src/intelligence/provenance.ts',
  'src/store/sqliteStore.ts',
  'test/ponsProvenanceRepairD1.test.ts',
  'test/sync.test.ts'
];

const CONFIG='wrangler.provenance-repair.generated.jsonc';
const PROVISION='/tmp/binrat-provenance-repair-provision.json';
const SECRETS='/tmp/binrat-provenance-repair-secrets.json';
const WRANGLER=['dlx','wrangler@4.135.0'];
const summary=process.env.GITHUB_STEP_SUMMARY;

let originalVersion=null;
let candidateVersion=null;
let deployed=false;

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
    throw new Error('WRANGLER_FAILED:'+args.slice(0,3).join(':')+':'+(error.status??'UNKNOWN'));
  }
}
function git(args){
  return execFileSync('git',args,{encoding:'utf8'}).trim();
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
  return b?.type==='plain_text'&&typeof b?.text==='string'?b.text.trim():null;
}
function secretPresent(version,name){
  return bindingList(version).get(name)?.type==='secret_text';
}
function deploymentStatus(){
  return jsonFromOutput(cli(['deployments','status','--name',WORKER,'--json','--config',PROVISION]));
}
function currentActiveVersion(){
  const id=activeVersionFrom(deploymentStatus());
  gate(id,'ACTIVE_VERSION_NOT_RESOLVED');
  return id;
}
function viewVersion(id){
  return jsonFromOutput(cli(['versions','view',id,'--name',WORKER,'--json','--config',PROVISION]));
}
function uploadVersion(tag,message){
  cli([
    'versions','upload','--config',CONFIG,'--keep-vars','--strict',
    '--secrets-file',SECRETS,'--tag',tag,'--message',message
  ],{timeout:180_000});
  const versions=jsonFromOutput(cli(['versions','list','--name',WORKER,'--json','--config',PROVISION]));
  const id=versionByTag(versions,tag);
  gate(id,'UPLOADED_VERSION_NOT_RESOLVED');
  return id;
}
function deployVersion(id,message){
  cli([
    'versions','deploy',id+'@100%','--name',WORKER,'--yes','--config',PROVISION,'--message',message
  ],{timeout:180_000});
  gate(currentActiveVersion()===id,'DEPLOYED_VERSION_NOT_ACTIVE');
}
function d1Query(sql){
  return jsonFromOutput(cli([
    'd1','execute',DB,'--remote','--yes','--json','--config',CONFIG,'--command',sql
  ],{timeout:180_000}));
}
function firstRow(result,index=0){ return result?.[index]?.results?.[0]??null; }
function outcomeCount(){
  return Number(firstRow(d1Query('SELECT COUNT(*) AS n FROM pons_outcome_receipts;'))?.n??-1);
}

function provenanceGap(){
  const result=d1Query(`
    WITH contextual AS (
      SELECT p.fact_id,p.chain_id,p.launch_id,p.creator,p.observed_block,p.log_index,
        (
          SELECT prior.fact_id
          FROM provenance_facts prior
          WHERE prior.chain_id=p.chain_id
            AND prior.creator=p.creator
            AND (
              CAST(prior.observed_block AS INTEGER)<CAST(p.observed_block AS INTEGER)
              OR (CAST(prior.observed_block AS INTEGER)=CAST(p.observed_block AS INTEGER) AND prior.log_index<p.log_index)
              OR (
                CAST(prior.observed_block AS INTEGER)=CAST(p.observed_block AS INTEGER)
                AND prior.log_index=p.log_index
                AND prior.fact_id<p.fact_id
              )
            )
          ORDER BY CAST(prior.observed_block AS INTEGER) DESC,prior.log_index DESC,prior.fact_id DESC
          LIMIT 1
        ) AS previous_fact_id
      FROM provenance_facts p
      WHERE p.chain_id=4663
    )
    SELECT
      COUNT(*) AS fact_count,
      SUM(CASE WHEN direct.edge_id IS NULL THEN 1 ELSE 0 END) AS missing_direct,
      SUM(CASE WHEN c.previous_fact_id IS NOT NULL AND previous.edge_id IS NULL THEN 1 ELSE 0 END) AS missing_previous,
      SUM(CASE WHEN direct.edge_id IS NULL OR (c.previous_fact_id IS NOT NULL AND previous.edge_id IS NULL) THEN 1 ELSE 0 END) AS missing_any
    FROM contextual c
    LEFT JOIN provenance_edges direct
      ON direct.edge_id=('reported-creator:' || c.fact_id)
    LEFT JOIN provenance_edges previous
      ON previous.edge_id=CASE
        WHEN c.previous_fact_id IS NULL THEN NULL
        ELSE ('previous-launch:' || c.fact_id || ':' || c.previous_fact_id)
      END;
    SELECT COUNT(*) AS edge_count FROM provenance_edges WHERE chain_id=4663;
  `);
  const row=firstRow(result,0)??{};
  return {
    factCount:Number(row.fact_count??0),
    missingDirect:Number(row.missing_direct??0),
    missingPrevious:Number(row.missing_previous??0),
    missingAny:Number(row.missing_any??0),
    edgeCount:Number(firstRow(result,1)?.edge_count??0)
  };
}
async function getJson(path){
  const response=await fetch(WORKER_URL+path,{signal:AbortSignal.timeout(20_000)});
  const body=await response.json().catch(()=>null);
  gate(response.ok&&body&&typeof body==='object','HTTP_PROBE_FAILED:'+path);
  return body;
}
async function requireHealthy(label){
  let last=null;
  for(let attempt=0;attempt<8;attempt+=1){
    last=await getJson('/api/health');
    note(label+' '+JSON.stringify({
      attempt:attempt+1,ok:last.ok,chainId:last.chainId,indexReady:last.indexReady,
      liveCaughtUp:last.liveCaughtUp,checkpointBlock:last.checkpointBlock,
      headBlock:last.headBlock,targetBlock:last.targetBlock,
      lastSyncError:last.lastSyncError,runtimeFresh:last.runtimeFresh,
      launchCount:last.launchCount
    }));
    if(last.ok===true&&last.chainId===4663&&last.indexReady===true&&last.liveCaughtUp===true&&
      last.lastSyncError===null&&last.runtimeFresh===true) return last;
    if(attempt<7) await new Promise(resolve=>setTimeout(resolve,5_000));
  }
  throw new Error('PONS_HEALTH_GATE_FAILED:'+label);
}

async function waitForReleaseSha(expected,label){
  for(let attempt=0;attempt<12;attempt+=1){
    const health=await getJson('/health');
    note(label+' '+JSON.stringify({attempt:attempt+1,releaseSha:health.releaseSha??null}));
    if(health.releaseSha===expected) return health;
    if(attempt<11) await new Promise(resolve=>setTimeout(resolve,5_000));
  }
  throw new Error('PUBLIC_RELEASE_SHA_PROPAGATION_TIMEOUT');
}
function runtimeShape(version){ return version?.resources?.script_runtime??null; }
function assertOnlyReleaseShaChanged(beforeVersion,afterVersion){
  const before=bindingList(beforeVersion);
  const after=bindingList(afterVersion);
  gate(before.size===after.size,'CANDIDATE_BINDING_COUNT_CHANGED');

  for(const [name,b] of before){
    const a=after.get(name);
    gate(a,'CANDIDATE_BINDING_MISSING:'+name);
    gate(a.type===b.type,'CANDIDATE_BINDING_TYPE_CHANGED:'+name);

    if(b.type==='plain_text'){
      if(name==='BINRAT_RELEASE_SHA'){
        gate(b.text===EXPECTED_LIVE_SHA,'LIVE_RELEASE_BINDING_DRIFT');
        gate(a.text===REVIEWED_RELEASE_SHA,'CANDIDATE_RELEASE_SHA_INVALID');
      }else{
        gate(a.text===b.text,'CANDIDATE_VARIABLE_CHANGED:'+name);
      }
    }else if(b.type==='d1'){
      gate((a.id??a.database_id)===(b.id??b.database_id),'CANDIDATE_D1_CHANGED:'+name);
    }else if(b.type==='queue'){
      gate((a.queue_name??a.queue)===(b.queue_name??b.queue),'CANDIDATE_QUEUE_CHANGED:'+name);
    }
  }
  for(const name of after.keys()) gate(before.has(name),'CANDIDATE_BINDING_ADDED:'+name);
  gate(JSON.stringify(runtimeShape(beforeVersion))===JSON.stringify(runtimeShape(afterVersion)),
    'CANDIDATE_SCRIPT_RUNTIME_CHANGED');
}
function writeConfig(){
  writeFileSync(CONFIG,JSON.stringify({
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
      BINRAT_RELEASE_SHA:REVIEWED_RELEASE_SHA,
      BINRAT_PONS_OUTCOME_ENABLED:'true',
      BINRAT_PONS_OUTCOME_MAX_PER_CYCLE:'1'
    }
  },null,2));
}

gate(process.env.GITHUB_REF==='refs/heads/'+BRANCH,'PROVENANCE_REPAIR_REF_INVALID');
gate(process.env.PROVENANCE_REPAIR_PROD_APPROVED==='true','PROVENANCE_REPAIR_APPROVAL_GATE_CLOSED');
for(const name of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','BINRAT_ROBINHOOD_ARCHIVE_RPC_URL']){
  gate(Boolean(process.env[name]?.trim()),'MISSING_REQUIRED_SECRET:'+name);
}
gate(git(['cat-file','-e',REVIEWED_RELEASE_SHA+'^{commit}'])==='', 'REVIEWED_RELEASE_COMMIT_MISSING');
const sourceDiff=git(['diff','--name-only',EXPECTED_LIVE_SHA+'..'+REVIEWED_RELEASE_SHA])
  .split('\n').filter(Boolean).sort();
gate(JSON.stringify(sourceDiff)===JSON.stringify([...EXPECTED_DIFF].sort()),
  'REVIEWED_RELEASE_DIFF_SCOPE_DRIFT');

writeFileSync(PROVISION,JSON.stringify({
  name:WORKER,main:'src/cloudflare/worker.ts',
  compatibility_date:'2026-09-18',compatibility_flags:['nodejs_compat']
}));
writeFileSync(SECRETS,JSON.stringify({
  BINRAT_ROBINHOOD_ARCHIVE_RPC_URL:process.env.BINRAT_ROBINHOOD_ARCHIVE_RPC_URL
}));
writeConfig();

try{
  originalVersion=currentActiveVersion();
  gate(originalVersion===EXPECTED_LIVE_VERSION,'LIVE_VERSION_DRIFT');
  const originalConfig=viewVersion(originalVersion);
  gate(plain(originalConfig,'BINRAT_RELEASE_SHA')===EXPECTED_LIVE_SHA,'LIVE_RELEASE_SHA_DRIFT');
  gate(plain(originalConfig,'BINRAT_PONS_OUTCOME_ENABLED')==='true','O2_NOT_ENABLED');
  gate(plain(originalConfig,'BINRAT_PONS_OUTCOME_MAX_PER_CYCLE')==='1','O2_BOUND_DRIFT');
  gate(plain(originalConfig,'BINRAT_AUTONOMOUS_RAT_ENABLED')==='true','PRIVATE_RAT_STATE_DRIFT');
  gate(plain(originalConfig,'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED')==='false','PUBLIC_RAT_STATE_DRIFT');
  gate(plain(originalConfig,'BINRAT_TELEGRAM_UI_V2_ENABLED')==='true','TELEGRAM_UI_STATE_DRIFT');
  gate(plain(originalConfig,'BINRAT_TELEGRAM_MEDIA_ENABLED')==='true','TELEGRAM_MEDIA_STATE_DRIFT');
  gate(secretPresent(originalConfig,'TELEGRAM_BOT_TOKEN'),'TELEGRAM_BOT_SECRET_MISSING');
  gate(secretPresent(originalConfig,'TELEGRAM_WEBHOOK_SECRET'),'TELEGRAM_WEBHOOK_SECRET_MISSING');
  gate(secretPresent(originalConfig,'BINRAT_ROBINHOOD_ARCHIVE_RPC_URL'),'ARCHIVE_SECRET_MISSING');

  const publicHealth=await getJson('/health');
  gate(publicHealth.releaseSha===EXPECTED_LIVE_SHA,'PUBLIC_RELEASE_SHA_DRIFT');
  await requireHealthy('PRE_DEPLOY_HEALTH');
  const beforeRows=outcomeCount();
  gate(beforeRows>=1,'O2_RECEIPT_TABLE_EMPTY');
  note('PRE_DEPLOY_RECEIPTS '+beforeRows);

  cli(['deploy','--dry-run','--config',CONFIG],{timeout:180_000});
  note('PROVIDER_FIX_DRY_RUN_PASS');

  const tag='provider-head-fix-'+REVIEWED_RELEASE_SHA.slice(0,12);
  candidateVersion=uploadVersion(tag,'BINRAT provider-head regression hardening');
  const candidateConfig=viewVersion(candidateVersion);
  assertOnlyReleaseShaChanged(originalConfig,candidateConfig);
  gate(secretPresent(candidateConfig,'BINRAT_ROBINHOOD_ARCHIVE_RPC_URL'),'CANDIDATE_ARCHIVE_SECRET_MISSING');
  gate(secretPresent(candidateConfig,'TELEGRAM_BOT_TOKEN'),'CANDIDATE_TELEGRAM_BOT_SECRET_MISSING');
  gate(secretPresent(candidateConfig,'TELEGRAM_WEBHOOK_SECRET'),'CANDIDATE_TELEGRAM_WEBHOOK_SECRET_MISSING');
  note('PROVIDER_FIX_CANDIDATE_PARITY_PASS '+candidateVersion);

  deployVersion(candidateVersion,'BINRAT provider-head regression hardening');
  deployed=true;

  await waitForReleaseSha(REVIEWED_RELEASE_SHA,'POST_DEPLOY_RELEASE');
  const health1=await requireHealthy('POST_DEPLOY_HEALTH_1');
  const rows1=outcomeCount();
  gate(rows1>=beforeRows,'O2_RECEIPT_COUNT_REGRESSED');

  await new Promise(resolve=>setTimeout(resolve,35_000));

  const health2=await requireHealthy('POST_DEPLOY_HEALTH_2');
  const rows2=outcomeCount();
  gate(rows2>=rows1,'O2_RECEIPT_COUNT_REGRESSED_AFTER_DEPLOY');

  const active=viewVersion(candidateVersion);
  gate(plain(active,'BINRAT_RELEASE_SHA')===REVIEWED_RELEASE_SHA,'ACTIVE_RELEASE_SHA_INVALID');
  gate(plain(active,'BINRAT_PONS_OUTCOME_ENABLED')==='true','ACTIVE_O2_DISABLED');
  gate(plain(active,'BINRAT_PONS_OUTCOME_MAX_PER_CYCLE')==='1','ACTIVE_O2_BOUND_CHANGED');
  gate(plain(active,'BINRAT_AUTONOMOUS_RAT_ENABLED')==='true','ACTIVE_PRIVATE_RAT_CHANGED');
  gate(plain(active,'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED')==='false','ACTIVE_PUBLIC_RAT_CHANGED');
  gate(plain(active,'BINRAT_TELEGRAM_UI_V2_ENABLED')==='true','ACTIVE_TELEGRAM_UI_CHANGED');
  gate(plain(active,'BINRAT_TELEGRAM_MEDIA_ENABLED')==='true','ACTIVE_TELEGRAM_MEDIA_CHANGED');

  note('PROVIDER_HEAD_REGRESSION_PRODUCTION_PROMOTION_PASS '+JSON.stringify({
    originalVersion,candidateVersion,releaseSha:REVIEWED_RELEASE_SHA,
    beforeRows,rowsAfterDeploy:rows1,rowsAfterObservation:rows2,
    checkpoint1:health1.checkpointBlock,head1:health1.headBlock,target1:health1.targetBlock,
    checkpoint2:health2.checkpointBlock,head2:health2.headBlock,target2:health2.targetBlock,
    lastSyncError:health2.lastSyncError,runtimeFresh:health2.runtimeFresh
  }));
}catch(error){
  note('PROVIDER_HEAD_REGRESSION_PRODUCTION_PROMOTION_FAILED '+JSON.stringify({
    deployed,
    code:error instanceof Error?error.message:'UNKNOWN'
  }));
  if(deployed&&originalVersion){
    try{
      deployVersion(originalVersion,'Automatic rollback: provider-head regression hardening');
      await requireHealthy('ROLLBACK_HEALTH');
      note('PROVIDER_FIX_ROLLBACK_PASS '+originalVersion);
    }catch{
      note('PROVIDER_FIX_ROLLBACK_FAILED manual Cloudflare rollback required');
    }
  }
  throw error;
}finally{
  rmSync(CONFIG,{force:true});
  rmSync(PROVISION,{force:true});
  rmSync(SECRETS,{force:true});
}
