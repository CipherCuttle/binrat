#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const WORKER='binrat-edge-v0';
const DB='binrat-v0';
const EXPECTED_DB_ID='46814564-1a41-449a-88e5-c1349eed3a27';
const WORKER_URL='https://binrat-edge-v0.pettevik.workers.dev';
const WRANGLER=['dlx','wrangler@4.135.0'];
const CONFIG='/tmp/binrat-o2-prod-preflight.jsonc';

function gate(ok,code){ if(!ok) throw new Error(code); }
function cli(args,opts={}){
  try {
    return execFileSync('pnpm',[...WRANGLER,...args],{
      encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:opts.timeout??120_000,env:process.env
    }).trim();
  } catch(error) {
    throw new Error('WRANGLER_FAILED:'+args.slice(0,3).join(':')+':'+(error.status??'UNKNOWN'));
  }
}
function jsonFromOutput(output){
  const positions=[output.indexOf('{'),output.indexOf('[')].filter(i=>i>=0);
  gate(positions.length>0,'WRANGLER_JSON_MISSING');
  return JSON.parse(output.slice(Math.min(...positions)));
}
function walk(value,visit){
  if(!value||typeof value!=='object') return null;
  const hit=visit(value); if(hit) return hit;
  for(const child of Array.isArray(value)?value:Object.values(value)){
    const nested=walk(child,visit); if(nested) return nested;
  }
  return null;
}
function activeVersionFrom(status){
  return walk(status,value=>{
    const id=value.version_id??value.versionId;
    const pct=value.percentage??value.percent??value.traffic;
    const hundred=pct===100||pct==='100'||pct===1||pct==='1';
    return typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id)&&hundred?id:null;
  });
}
function binding(version,name){
  return walk(version,value=>value?.name===name&&typeof value?.type==='string'?value:null);
}
function plain(version,name){
  const b=binding(version,name);
  return b?.type==='plain_text'&&typeof b?.text==='string'?b.text.trim():null;
}
function findUuid(value){
  return walk(value,v=>{
    for(const item of Object.values(v)){
      if(typeof item==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item)) return item;
    }
    return null;
  });
}
async function getJson(url){
  const response=await fetch(url,{signal:AbortSignal.timeout(20_000)});
  const body=await response.json().catch(()=>null);
  gate(response.ok&&body&&typeof body==='object','HTTP_PREFLIGHT_FAILED');
  return body;
}

for(const name of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID']){
  gate(Boolean(process.env[name]?.trim()),'MISSING_REQUIRED_SECRET:'+name);
}
execFileSync('bash',['-lc',`cat > ${CONFIG} <<'JSON'
{"name":"binrat-edge-v0","main":"src/cloudflare/worker.ts","compatibility_date":"2026-09-18","compatibility_flags":["nodejs_compat"]}
JSON`],{stdio:'ignore'});

const status=jsonFromOutput(cli(['deployments','status','--name',WORKER,'--json','--config',CONFIG]));
const activeVersion=activeVersionFrom(status);
gate(activeVersion,'ACTIVE_VERSION_NOT_RESOLVED');
const active=jsonFromOutput(cli(['versions','view',activeVersion,'--name',WORKER,'--json','--config',CONFIG]));
const d1=jsonFromOutput(cli(['d1','info',DB,'--json','--config',CONFIG]));
gate(findUuid(d1)===EXPECTED_DB_ID,'PRODUCTION_D1_ID_MISMATCH');

const tableProbe=jsonFromOutput(cli([
  'd1','execute',DB,'--remote','--yes','--json','--config',CONFIG,'--command',
  "SELECT COUNT(*) AS table_count FROM sqlite_master WHERE type='table' AND name='pons_outcome_receipts';"
]));
const tableCount=Number(tableProbe?.[0]?.results?.[0]?.table_count ?? 0);
let outcomeRows=-1;
if(tableCount===1){
  const countProbe=jsonFromOutput(cli([
    'd1','execute',DB,'--remote','--yes','--json','--config',CONFIG,'--command',
    "SELECT COUNT(*) AS outcome_rows FROM pons_outcome_receipts;"
  ]));
  outcomeRows=Number(countProbe?.[0]?.results?.[0]?.outcome_rows ?? -1);
}
const d1Probe={tableCount,outcomeRows};
const health=await getJson(WORKER_URL+'/health');
const apiHealth=await getJson(WORKER_URL+'/api/health');

const secretNames=[];
walk(active,value=>{
  if(value?.type==='secret_text'&&typeof value?.name==='string') secretNames.push(value.name);
  return null;
});
const releaseSha=plain(active,'BINRAT_RELEASE_SHA');

let diffSummary=null;
if(releaseSha&&/^[0-9a-f]{40}$/i.test(releaseSha)){
  try {
    execFileSync('git',['cat-file','-e',releaseSha+'^{commit}'],{stdio:'ignore'});
    const names=execFileSync('git',['diff','--name-only',releaseSha+'..HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
    diffSummary={releaseSha,changedFileCount:names.length,changedFiles:names.slice(0,80)};
  } catch {
    diffSummary={releaseSha,commitAvailable:false};
  }
}

console.log(JSON.stringify({
  kind:'PONS_OUTCOME_PRODUCTION_PREFLIGHT_PASS',
  mutationPerformed:false,
  activeVersion,
  releaseSha,
  activeFlags:{
    ponsOutcomeEnabled:plain(active,'BINRAT_PONS_OUTCOME_ENABLED'),
    ponsOutcomeMaxPerCycle:plain(active,'BINRAT_PONS_OUTCOME_MAX_PER_CYCLE'),
    autonomousRatEnabled:plain(active,'BINRAT_AUTONOMOUS_RAT_ENABLED'),
    autonomousRatPublicEnabled:plain(active,'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED'),
    telegramUiV2Enabled:plain(active,'BINRAT_TELEGRAM_UI_V2_ENABLED'),
    telegramMediaEnabled:plain(active,'BINRAT_TELEGRAM_MEDIA_ENABLED')
  },
  archiveSecretPresent:secretNames.includes('BINRAT_ROBINHOOD_ARCHIVE_RPC_URL'),
  d1Probe,
  health:{
    ok:health.ok??null,
    service:health.service??null,
    releaseSha:health.releaseSha??null
  },
  apiHealth:{
    ok:apiHealth.ok??null,
    chainId:apiHealth.chainId??null,
    indexReady:apiHealth.indexReady??null,
    liveCaughtUp:apiHealth.liveCaughtUp??null,
    checkpointBlock:apiHealth.checkpointBlock??null,
    headBlock:apiHealth.headBlock??null,
    targetBlock:apiHealth.targetBlock??null,
    launchCount:apiHealth.launchCount??null,
    lastSyncError:apiHealth.lastSyncError??null,
    runtimeFresh:apiHealth.runtimeFresh??null
  },
  diffSummary
},null,2));
