// Bounded GET-only acceptance. Run only against an explicitly authorized origin.
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assertDeploymentProvenance,assertBoundPublication,assertIndependentPublications,assertPublicTruth,resolvedObservationCadence } from './lib/public-acceptance.mjs';
import {readActiveDeployment,assertStableDeployment} from './lib/read-active-deployment.mjs';

const report={schemaVersion:'binrat.public-acceptance/1',status:'UNVERIFIED',observations:[],checks:[],reason:null};
const output='.artifacts/public-truth/production-acceptance.json';
mkdirSync('.artifacts/public-truth',{recursive:true});
try {
  if(!process.argv[2]) throw new Error('ACCEPTANCE_INPUT_REQUIRED');
  const input=JSON.parse(readFileSync(process.argv[2],'utf8'));
  const origin=new URL(input.origin);
  if(!['https://binrat.tech','https://binrat-read-plane-stability-candidate.pettevik.workers.dev'].includes(origin.origin)||origin.href!==origin.origin+'/')
    throw new Error('PUBLIC_ORIGIN_NOT_ALLOWLISTED');
  if(input.provider?.origin!==origin.origin) throw new Error('PROVIDER_ROUTE_UNVERIFIED');
  const providerAccess={accountId:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,workerName:input.provider.workerName};
  assertStableDeployment(input.provider,await readActiveDeployment(providerAccess));
  const intervalMs=resolvedObservationCadence(input.provider.runtimeSemantics);
  if(intervalMs>90_000) throw new Error('BOUNDED_WINDOW_EXCEEDED');
  report.resolvedCadenceMs=intervalMs;
  async function get(path,json=true) {
    const response=await fetch(new URL(path,origin),{method:'GET',redirect:'error',headers:{accept:json?'application/json':'text/html'},signal:AbortSignal.timeout(15_000)});
    const reader=response.body.getReader();const parts=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1_000_000){await reader.cancel();throw new Error('PUBLIC_RESPONSE_TOO_LARGE');}parts.push(value);}
    const body=Buffer.concat(parts).toString('utf8');
    const headers=Object.fromEntries(response.headers);report.observations.push({path,httpStatus:response.status,atMs:Date.now(),cfRay:headers['cf-ray']??null,
      buildId:headers['x-binrat-build-id']??null,bodySha256:createHash('sha256').update(body).digest('hex')});
    if(/(?:error(?: code)?\s*:?\s*1102|exceeded resource limits)/i.test(body)) throw new Error('NONRETRYABLE_1102:'+path);
    if(response.status!==200) throw new Error('PUBLIC_READ_HTTP_'+response.status+':'+path);
    return {body:json?JSON.parse(body):body,headers};
  }
  const health=await get('/health'),marker=await get('/release.json');
  const capabilities=await get('/api/capabilities'),funding=await get('/api/dumpster-ledger');
  assertDeploymentProvenance({...input,health:health.body,marker:marker.body,observedHeaders:[health.headers,capabilities.headers,funding.headers]});
  report.checks.push('source_artifact_worker_manifest_binding');
  const browser=input.browser;
  if(browser?.origin!==origin.origin||browser.buildId!==marker.body.buildId||browser.status!=='PASS'||!Array.isArray(browser.viewports)||
     ![390,430,1024,1440].every(width=>browser.viewports.includes(width))||browser.consoleErrors!==0||browser.publicEmploymentControls!==0)
    throw new Error('DEPLOYED_BROWSER_RECEIPT_REQUIRED');
  assertPublicTruth({capabilities:capabilities.body,funding:funding.body,customerText:browser.customerText});
  report.checks.push('positive_and_negative_public_truth');
  async function publication() {
    const status=await get('/api/status'),feed=await get('/api/launches/latest');
    for(const entry of [status,feed]) if(entry.headers['x-binrat-build-id']!==marker.body.buildId||entry.headers['x-binrat-source-sha']!==input.reviewedSha)
      throw new Error('PUBLICATION_RELEASE_MISMATCH');
    const observation={status:status.body,feed:feed.body,observedAtMs:Date.now()};
    await assertBoundPublication(observation.status,observation.feed,observation.observedAtMs);return observation;
  }
  const first=await publication();
  console.log('FIRST_BOUND_PUBLICATION; next observation after canonical cache/publication interval '+intervalMs+'ms');
  await new Promise(resolve=>setTimeout(resolve,intervalMs));
  const second=await publication();await assertIndependentPublications(first,second,input.provider.runtimeSemantics);
  report.checks.push('two_independent_bound_publications');
  const latest=second.feed.launches[0];if(!latest) throw new Error('REAL_PONS_CASE_UNVERIFIED');
  const detail=await get('/api/bag/'+latest.launchId);
  if(detail.headers['x-binrat-build-id']!==marker.body.buildId||detail.body.chainId!==4663||detail.body.bag?.id!==latest.launchId||!detail.body.receipt?.receiptId)
    throw new Error('REAL_PONS_CASE_INVALID');
  report.checks.push('real_fresh_pons_case');
  // Revisions created by secret/config changes may reuse the same source SHA.
  const finalHealth=await get('/health');
  assertStableDeployment(input.provider,await readActiveDeployment(providerAccess));
  assertDeploymentProvenance({...input,health:finalHealth.body,marker:marker.body,observedHeaders:[finalHealth.headers,detail.headers]});
  report.checks.push('final_active_revision_reverified');
  if(input.telegram?.status!=='PASS'||input.telegram.buildId!==marker.body.buildId||input.telegram.gatesPreserved!==true||input.telegram.mediaFallbacksPreserved!==true)
    throw new Error('DEPLOYED_TELEGRAM_SMOKE_REQUIRED');
  if(input.comprehension?.status!=='PASS'||input.comprehension.buildId!==marker.body.buildId||input.comprehension.independentReaders<3||
    input.comprehension.todayFutureDistinguished!==true) throw new Error('COMPREHENSION_RECEIPT_REQUIRED');
  report.checks.push('telegram_smoke_and_comprehension');report.status='PASS';
} catch(error) { report.reason=error.message;process.exitCode=1; }
writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,reason:report.reason,checks:report.checks}));
