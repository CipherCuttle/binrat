import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const helper = pathToFileURL(new URL('../scripts/case-private-preview-verify.mjs', import.meta.url).pathname).href;
function evaluate<T>(expression:string):T {
  const source=`import * as h from ${JSON.stringify(helper)}; console.log(JSON.stringify(${expression}));`;
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
  assert.match(preflight,/deploy --dry-run/);
  const harness=readFileSync(new URL('../scripts/case-private-preview-verify.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(harness,/versions','deploy|telegram:apply|telegram:private-menu|--file/);
  assert.match(harness,/appText\.includes\('\/api\/miniapp\/case-intelligence'\)/);
  assert.match(harness,/appText\.includes\('\/api\/miniapp\/trash-trail'\)/);
  assert.match(harness,/appText\.includes\('\/api\/miniapp\/replay'\)/);
  assert.match(harness,/FUNDING_SCHEMA_QUERY_NOT_READ_ONLY/);
});
