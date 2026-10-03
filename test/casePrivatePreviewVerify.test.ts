import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const helper = pathToFileURL(new URL('../scripts/case-private-preview-verify.mjs', import.meta.url).pathname).href;
const versionUrlHelper = pathToFileURL(new URL('../scripts/case-version-url-preview.mjs', import.meta.url).pathname).href;
function evaluate<T>(expression:string):T {
  const source=`import * as h from ${JSON.stringify(helper)}; console.log(JSON.stringify(${expression}));`;
  return JSON.parse(execFileSync(process.execPath,['--input-type=module','--eval',source],{encoding:'utf8'}));
}
function evaluateVersionUrl<T>(expression:string):T {
  const source=`import * as h from ${JSON.stringify(versionUrlHelper)}; console.log(JSON.stringify(${expression}));`;
  return JSON.parse(execFileSync(process.execPath,['--input-type=module','--eval',source],{encoding:'utf8'}));
}

const sha='a'.repeat(40);
const version={resources:{bindings:[
  {name:'DB',type:'d1',id:'89d74e01-ce7f-44cb-a777-c2a5fa283747'},
  {name:'BINRAT_RELEASE_SHA',type:'plain_text',text:sha},
  {name:'BINRAT_AUTONOMOUS_RAT_ENABLED',type:'plain_text',text:'false'},
  {name:'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED',type:'plain_text',text:'false'},
  {name:'BINRAT_TELEGRAM_UI_V2_ENABLED',type:'plain_text',text:'false'},
  {name:'BINRAT_TELEGRAM_MEDIA_ENABLED',type:'plain_text',text:'false'}
]}};

test('preview verifier requires an exact checkout and retains all activation flags off',()=>{
  assert.deepEqual(evaluate(`h.exactReleaseErrors('${sha}','${sha}')`),[]);
  assert.deepEqual(evaluate(`h.exactReleaseErrors('${sha}','${'b'.repeat(40)}')`),['RELEASE_SHA_MISMATCH']);
  assert.deepEqual(evaluate(`h.previewBindingErrors(${JSON.stringify(version)},'${sha}')`),[]);
  const fundingOn=structuredClone(version);
  fundingOn.resources.bindings.push({name:'BINRAT_PONS_FUNDING_ENABLED',type:'plain_text',text:'true'});
  assert.deepEqual(evaluate(`h.previewBindingErrors(${JSON.stringify(fundingOn)},'${sha}')`),['PONS_FUNDING_CYCLE_NOT_OFF']);
});

test('funding schema proof is a fixed read-only SELECT and requires every canonical table',()=>{
  assert.equal(evaluate('h.isReadOnlySql(h.FUNDING_SCHEMA_SQL)'),true);
  assert.equal(evaluate("h.isReadOnlySql('UPDATE pons_funding_receipts SET payload_json=\\'x\\'')"),false);
  const complete={results:[{results:[
    {name:'pons_funding_receipts'}, {name:'pons_funding_scan_state'}, {name:'pons_funding_retry_state'}
  ]}]};
  assert.deepEqual(evaluate(`h.fundingSchemaErrors(${JSON.stringify(complete)})`),[]);
  assert.deepEqual(evaluate(`h.fundingSchemaErrors({results:[{results:[{name:'pons_funding_receipts'}]}]})`),[
    'FUNDING_SCHEMA_MISSING:pons_funding_scan_state','FUNDING_SCHEMA_MISSING:pons_funding_retry_state'
  ]);
});

test('Version URL candidate config uses active targets and forces only preview-safe flags off',()=>{
  const template={name:'binrat-edge-v0',main:'src/cloudflare/worker.ts',assets:{directory:'./web'},compatibility_date:'2026-09-18',
    d1_databases:[{binding:'DB',database_name:'template-db',database_id:'REPLACE_WITH_D1_DATABASE_ID'}],
    queues:{producers:[{binding:'SYNC_QUEUE',queue:'template-queue'}],consumers:[{queue:'template-queue'}]},
    vars:{BINRAT_PUBLIC_SITE_URL:'https://REPLACE_WITH_PUBLIC_SITE'}};
  const active={resources:{bindings:[
    {name:'DB',type:'d1',id:'89d74e01-ce7f-44cb-a777-c2a5fa283747',database_name:'production-db'},
    {name:'SYNC_QUEUE',type:'queue',queue_name:'production-queue'}, {name:'AI',type:'ai'},
    {name:'BINRAT_PUBLIC_SITE_URL',type:'plain_text',text:'https://binrat.tech'},
    {name:'UNRELATED',type:'plain_text',text:'preserve-me'},
    {name:'BINRAT_AUTONOMOUS_RAT_ENABLED',type:'plain_text',text:'true'},
    {name:'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED',type:'plain_text',text:'true'},
    {name:'BINRAT_TELEGRAM_UI_V2_ENABLED',type:'plain_text',text:'true'},
    {name:'BINRAT_TELEGRAM_MEDIA_ENABLED',type:'plain_text',text:'true'},
    {name:'BINRAT_PONS_FUNDING_ENABLED',type:'plain_text',text:'true'}
  ]}};
  const config=evaluateVersionUrl<any>(`h.prepareCandidateConfig(${JSON.stringify(template)},${JSON.stringify(active)},'${sha}')`);
  assert.equal(config.main,'../src/cloudflare/worker.ts');
  assert.equal(config.assets.directory,'../web');
  assert.equal(config.d1_databases[0].database_id,'89d74e01-ce7f-44cb-a777-c2a5fa283747');
  assert.equal(config.queues.producers[0].queue,'production-queue');
  assert.equal(config.queues.consumers[0].queue,'production-queue');
  assert.equal(config.vars.BINRAT_PUBLIC_SITE_URL,'https://binrat.tech');
  assert.equal(config.vars.UNRELATED,'preserve-me');
  for(const name of ['BINRAT_AUTONOMOUS_RAT_ENABLED','BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED','BINRAT_TELEGRAM_UI_V2_ENABLED','BINRAT_TELEGRAM_MEDIA_ENABLED','BINRAT_PONS_FUNDING_ENABLED']) assert.equal(config.vars[name],'false');
  assert.equal(config.vars.BINRAT_RELEASE_SHA,sha);
});

test('machine-readable version-upload receipts require one secure non-production Version URL',()=>{
  const id='123e4567-e89b-42d3-a456-426614174000';
  const url='https://abc123-binrat-edge-v0.pettevik.workers.dev/';
  const ndjson=`{"type":"wrangler-session","version":1}\n{"type":"version-upload","version":1,"worker_name":"binrat-edge-v0","version_id":"${id}","preview_urls":["${url}"]}`;
  assert.deepEqual(evaluateVersionUrl(`h.parseVersionUploadReceipt(${JSON.stringify(ndjson)})`),{candidateVersionId:id,versionUrl:url});
  assert.equal(evaluateVersionUrl(`(()=>{try{h.parseVersionUploadReceipt('{"type":"version-upload","worker_name":"binrat-edge-v0","preview_urls":[]}')}catch(error){return error.message}})()`),'VERSION_UPLOAD_ID_MISSING_OR_AMBIGUOUS');
  assert.equal(evaluateVersionUrl(`(()=>{try{h.parseVersionUploadReceipt('{"type":"version-upload","worker_name":"binrat-edge-v0","version_id":"${id}","versionId":"223e4567-e89b-42d3-a456-426614174000","preview_urls":["${url}"]}')}catch(error){return error.message}})()`),'VERSION_UPLOAD_ID_MISSING_OR_AMBIGUOUS');
  assert.deepEqual(evaluateVersionUrl(`h.versionUrlErrors('https://binrat-edge-v0.pettevik.workers.dev/')`),['VERSION_URL_INVALID']);
  assert.deepEqual(evaluateVersionUrl(`h.versionUrlErrors('http://abc-binrat-edge-v0.pettevik.workers.dev/')`),['VERSION_URL_INVALID']);
});

test('live smoke rejects Pons and Case authority disagreement',()=>{
  assert.deepEqual(evaluate("h.ponsHealthErrors({ok:true,chainId:4663,indexReady:true,liveCaughtUp:true,runtimeFresh:true,lastSyncError:null})"),[]);
  assert.deepEqual(evaluate("h.ponsHealthErrors({ok:true,chainId:4663,indexReady:true,liveCaughtUp:false,runtimeFresh:true,lastSyncError:null})"),['PONS_NOT_CANONICAL_READY']);
  const launch='c'.repeat(64);
  const bundle={
    case:{caseVersion:'BINRAT_CASE_MODEL_V1',asOfBlock:'123',current:{launchId:launch},handoffs:[{targetLaunchId:launch}]},
    trashTrail:{presentationVersion:'BINRAT_PONS_TRASH_TRAIL_PRESENTATION_V1',launches:[]},
    replay:{replayVersion:'BINRAT_PONS_REPLAY_LAB_V1',semantics:'KNOWABLE_AS_OF_BLOCK',asOfBlock:'123',targetLaunchKnown:true,targetLaunch:{launchId:launch},previousLaunches:[]}
  };
  assert.deepEqual(evaluate(`h.caseBundleErrors(${JSON.stringify(bundle)},'${launch}')`),[]);
  bundle.replay.asOfBlock='124';
  assert.deepEqual(evaluate(`h.caseBundleErrors(${JSON.stringify(bundle)},'${launch}')`),['REPLAY_AS_OF_MISMATCH']);
});

test('prepared workflows are manual-only and exclude obsolete donor references and mutation paths',()=>{
  const preflight=readFileSync(new URL('../.github/workflows/case-surface-canonical-private-preview.yml',import.meta.url),'utf8');
  const liveSmoke=readFileSync(new URL('../.github/workflows/case-surface-canonical-live-smoke.yml',import.meta.url),'utf8');
  for(const workflow of [preflight,liveSmoke]) {
    assert.match(workflow,/workflow_dispatch:/);
    assert.doesNotMatch(workflow,/\n\s*push:/);
    assert.doesNotMatch(workflow,/ops\/binrat-case-surface-private-preview-v1|f5934950011455061569075fc6111d0022a11629/);
    assert.doesNotMatch(workflow,/telegram:(apply|private-menu|verify)|versions deploy|d1 execute[^\n]*--file/);
  }
  assert.match(preflight,/versions upload/);
  assert.match(preflight,/WRANGLER_OUTPUT_FILE_PATH/);
  assert.doesNotMatch(preflight,/\n\s*\.artifacts\/wrangler-version-upload\.ndjson\n/);
  assert.doesNotMatch(preflight,/versions deploy|wrangler@4\.135\.0 deploy|traffic percentage|d1 migrations?|telegram:(apply|private-menu|verify)|PONS_FUNDING_CYCLE/);
  assert.doesNotMatch(liveSmoke,/versions upload|versions deploy|wrangler@4\.135\.0 deploy/);
  const harness=readFileSync(new URL('../scripts/case-private-preview-verify.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(harness,/versions','deploy|telegram:apply|telegram:private-menu|--file/);
  assert.match(harness,/appText\.includes\('\/api\/miniapp\/case-intelligence'\)/);
  assert.match(harness,/appText\.includes\('\/api\/miniapp\/trash-trail'\)/);
  assert.match(harness,/appText\.includes\('\/api\/miniapp\/replay'\)/);
  assert.match(harness,/FUNDING_SCHEMA_QUERY_NOT_READ_ONLY/);
  const versionHarness=readFileSync(new URL('../scripts/case-version-url-preview.mjs',import.meta.url),'utf8');
  assert.match(versionHarness,/version-upload/);
  assert.match(versionHarness,/FUNDING_SCHEMA_QUERY_NOT_READ_ONLY/);
  assert.doesNotMatch(versionHarness,/versions',\s*'deploy|wrangler@4\.135\.0 deploy|telegram:(apply|private-menu|verify)/);
});
